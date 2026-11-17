// 规则引擎：纯 TS、确定性、无 I/O。
// 整局游戏是一个生成器：需要玩家决策时 yield 一个 Request，answer() 校验后把 Answer 送回去。
// 恢复时用同样的 config 重放回答日志即可（DO 被驱逐后用）。
import {
  DX, DY, FLOORS, MENTAL, PHYSICAL, TRAITS, TRAIT_NAME, CARD_KIND_NAME,
  hasDoor, parseKey, tileKey, traitValue,
  type Answer, type AttackOpt, type CardKind, type DamageKind, type Dir, type Floor, type GameConfig, type GameEvent,
  type GameState, type Monster, type PlayerState, type Request, type Side, type Target, type Token, type Trait, type Winner,
} from '../shared/types';
import { CARDS, EXPLORERS, OMEN_IDS, ROOMS, SCENARIOS, START_ROOMS } from '../content';
import { HAUNTS } from '../haunts';
import type { AiHint, CardDef, HauntDef, MonsterDef, RollPurpose, RoomDef } from './defs';
import { Rng } from './rng';

export type Gen<T = void> = Generator<Request, T, Answer>;

/** 只在服务端的秘密状态 */
export interface Secret {
  decks: Record<CardKind, string[]> & { rooms: string[] };
  /** 隐藏背叛者的座位 */
  hidden: number | null;
  /** 剧本秘密变量：任何人都看不到 */
  vars: Record<string, unknown>;
  lastOmen: string | null;
}

export interface Brief {
  side: Side | 'solo';
  goal: string;
  rules: string[];
  win: string;
}

export interface SeatView {
  state: GameState;
  brief: Brief | null;
  /** 你的真实阵营（隐藏背叛者看得到自己） */
  side: Side | null;
}

const MAX_DICE = 8;
const HAUNT_ROUND_LIMIT = 40;
const EXPLORE_ROUND_LIMIT = 40;

export class Game {
  readonly config: GameConfig;
  readonly answers: Answer[] = [];
  state: GameState;
  secret: Secret;
  rng: Rng;
  haunt: HauntDef | null = null;
  pending: Request | null = null;
  /** 内容层出错记录（测试用） */
  errors: string[] = [];
  private gen: Gen;
  private events: GameEvent[] = [];

  // ---- 回合内临时状态（重放时会重新算出来） ----
  used = new Set<string>();
  turnCards: string[] = [];
  turnEnded = false;
  attacked = false;
  traded = false;
  looted = false;
  private forceNext: number | null = null;
  private roundStart = 0;
  private omenThisTurn = false;
  private hauntThisTurn = false;

  private constructor(config: GameConfig) {
    this.config = config;
    this.rng = new Rng(config.seed);
    const n = config.seats.length;
    const rooms = Object.values(ROOMS).filter((r) => !r.start).map((r) => r.id);
    const deck = (k: CardKind) => this.rng.shuffle(Object.values(CARDS).filter((c) => c.kind === k).map((c) => c.id));
    this.secret = {
      decks: { rooms: this.rng.shuffle(rooms), item: deck('item'), omen: deck('omen'), event: deck('event') },
      hidden: null,
      vars: {},
      lastOmen: null,
    };
    const tiles: GameState['tiles'] = {};
    for (const [key, room, rot] of START_ROOMS) {
      const { floor, x, y } = parseKey(key);
      tiles[key] = { room, floor, x, y, rot };
    }
    const players: PlayerState[] = config.seats.map((s, seat) => {
      const ex = EXPLORERS[s.explorer];
      return {
        seat, name: s.name, ai: s.ai, explorer: s.explorer,
        traits: { ...ex.start }, tile: START_ROOMS[0][0], cards: [], dead: false, side: null, flags: {},
      };
    });
    this.state = {
      phase: 'explore', round: 1, turn: 0, players, tiles, tokens: [], monsters: [], links: [],
      decks: { item: 0, omen: 0, event: 0, rooms: { B: 0, G: 0, U: 0 } },
      omensDrawn: 0, scenario: config.scenario, mode: config.mode, haunt: null, winner: null, moveLeft: 0,
    };
    this.roundStart = config.firstSeat ?? this.rng.int(n);
    this.syncDecks();
    this.gen = this.main();
  }

  static create(config: GameConfig): Game {
    const g = new Game(config);
    g.step(undefined);
    return g;
  }

  static restore(config: GameConfig, answers: Answer[]): Game {
    const g = Game.create(config);
    for (const a of answers) {
      const r = g.answer(a);
      if (!r.ok) throw new Error('restore: ' + r.error);
    }
    g.takeEvents();
    return g;
  }

  get seq(): number {
    return this.answers.length;
  }

  get n(): number {
    return this.state.players.length;
  }

  takeEvents(): GameEvent[] {
    return this.events.splice(0);
  }

  answer(a: Answer): { ok: true; events: GameEvent[] } | { ok: false; error: string } {
    const req = this.pending;
    if (!req) return { ok: false, error: '对局已结束' };
    const err = validate(this, req, a);
    if (err) return { ok: false, error: err };
    this.answers.push(a);
    this.step(a);
    return { ok: true, events: this.takeEvents() };
  }

  private step(a: Answer | undefined) {
    try {
      const r = this.gen.next(a as Answer);
      this.pending = r.done ? null : r.value;
    } catch (e) {
      console.error('engine crashed', e);
      this.errors.push('crash: ' + String((e as Error)?.stack ?? e));
      this.pending = null;
      if (!this.state.winner) this.setWinner({ side: 'none', seats: [], title: '鬼屋吞没了一切', text: '（引擎出错，对局提前结束）' });
    }
    if (this.pending && this.checkWin()) this.pending = null;
    if (!this.pending && this.state.phase !== 'end') {
      if (!this.state.winner) this.setWinner({ side: 'none', seats: [], title: '对局结束', text: '' });
    }
    this.syncDecks();
  }

  private syncDecks() {
    const d = this.secret.decks;
    const rooms: Record<Floor, number> = { B: 0, G: 0, U: 0 };
    for (const id of d.rooms) for (const f of ROOMS[id].floors) rooms[f]++;
    this.state.decks = { item: d.item.length, omen: d.omen.length, event: d.event.length, rooms };
  }

  // =====================================================================
  // 主流程
  // =====================================================================

  private *main(): Gen {
    let seat = this.roundStart;
    for (let guard = 0; guard < 5000; guard++) {
      if (this.checkWin()) return;
      yield* this.playTurn(seat);
      if (this.checkWin()) return;
      if (this.state.phase === 'haunt' && seat === this.monsterSeat() && !this.hauntThisTurn) {
        yield* this.monsterPhase();
        if (this.checkWin()) return;
      }
      let next = (seat + 1) % this.n;
      if (this.forceNext != null) this.state.round++;
      else if (next === this.roundStart) yield* this.roundEnd();
      if (this.forceNext != null) {
        next = this.forceNext;
        this.roundStart = next;
        this.forceNext = null;
      }
      seat = next;
    }
    this.setWinner({ side: 'none', seats: [], title: '漫漫长夜', text: '这一夜似乎永远不会结束。' });
  }

  private *roundEnd(): Gen {
    const s = this.state;
    s.round++;
    // 教学局：到了指定轮数还没触发，就由最后一个凶兆直接触发
    if (s.phase === 'explore' && this.config.minHauntRound && s.round > this.config.minHauntRound + 2) {
      yield* this.beginHaunt((this.roundStart + this.n - 1) % this.n, this.hauntFor(this.secret.lastOmen ?? OMEN_IDS[0]));
      return;
    }
    if (s.phase === 'haunt' && s.haunt) {
      s.haunt.round++;
      if (this.haunt?.onRoundEnd) yield* this.safe(this.haunt.onRoundEnd(this));
      if (s.haunt.round > HAUNT_ROUND_LIMIT && !s.winner) {
        this.setWinner({ side: 'none', seats: [], title: '天亮了', text: '天亮之前谁也没能了结此事，鬼屋重归寂静。' });
      }
    } else if (s.phase === 'explore') {
      const left = s.decks.rooms.B + s.decks.rooms.G + s.decks.rooms.U;
      if (left === 0 || s.round > EXPLORE_ROUND_LIMIT) {
        this.log('房子再也藏不住它的秘密了……', 'haunt');
        const omen = this.secret.lastOmen ?? OMEN_IDS[this.rng.int(OMEN_IDS.length)];
        yield* this.beginHaunt((this.roundStart + this.n - 1) % this.n, this.hauntFor(omen));
      }
    }
  }

  private *playTurn(seat: number): Gen {
    const p = this.p(seat);
    if (p.dead) return;
    const s = this.state;
    s.turn = seat;
    this.used = new Set();
    this.turnCards = [...p.cards];
    this.turnEnded = false;
    this.attacked = false;
    this.traded = false;
    this.looted = false;
    this.omenThisTurn = false;
    this.hauntThisTurn = false;
    s.moveLeft = this.value(seat, 'speed');
    this.emit({ t: 'turn', seat, round: s.round });
    if (this.haunt?.onTurnStart) yield* this.safe(this.haunt.onTurnStart(this, seat));

    for (let guard = 0; guard < 300 && !this.turnEnded && !p.dead && !s.winner; guard++) {
      const a = yield this.turnRequest(seat);
      if (a.kind !== 'turn') continue;
      yield* this.safe(this.doTurnAction(seat, a));
      if (this.checkWin()) return;
    }
    if (p.dead || s.winner || this.hauntThisTurn) return;

    const room = this.roomOf(seat);
    if (room?.onEndTurn && !(room.harmful && this.isTraitor(seat))) yield* this.safe(room.onEndTurn(this, seat));
    if (this.haunt?.onTurnEnd && !p.dead) yield* this.safe(this.haunt.onTurnEnd(this, seat));
    if (s.mode === 'classic' && this.omenThisTurn && s.phase === 'explore') yield* this.classicHauntRoll(seat);
    s.moveLeft = 0;
  }

  private *doTurnAction(seat: number, a: Extract<Answer, { kind: 'turn' }>): Gen {
    switch (a.a) {
      case 'end':
        this.turnEnded = true;
        return;
      case 'move':
        yield* this.walk(seat, a.to);
        return;
      case 'explore':
        yield* this.explore(seat, a.dir);
        return;
      case 'act':
        yield* this.runAction(seat, a.id);
        return;
      case 'attack': {
        this.attacked = true;
        const weapon = a.weapon ? CARDS[a.weapon] : undefined;
        if (a.weapon) this.used.add('weapon:' + a.weapon);
        yield* this.attack({ seat }, a.target, { trait: weapon?.weapon?.trait, weapon: a.weapon, ranged: !!weapon?.weapon?.ranged && !this.sameTile({ seat }, a.target) });
        if (a.weapon && weapon?.weapon?.once && this.has(seat, a.weapon)) {
          this.log(`「${weapon.name}」用掉了`, 'info', seat);
          yield* this.loseCard(seat, a.weapon);
        }
        return;
      }
      case 'trade': {
        this.traded = true;
        const other = a.with;
        let ok: boolean;
        const r = yield { kind: 'trade', seat: other, from: seat, give: a.give, take: a.take };
        ok = r.kind === 'trade' && r.ok;
        if (!ok) {
          this.log(`${this.p(other).name} 拒绝了交易`, 'info');
          return;
        }
        for (const c of a.give) yield* this.loseCard(seat, c, other);
        for (const c of a.take) yield* this.loseCard(other, c, seat);
        this.log(`${this.p(seat).name} 与 ${this.p(other).name} 完成了交易`, 'info');
        return;
      }
      case 'loot': {
        this.looted = true;
        yield* this.loseCard(a.from, a.card, seat);
        this.log(`${this.p(seat).name} 从 ${this.p(a.from).name} 的遗体上拿走了「${CARDS[a.card].name}」`);
        return;
      }
    }
  }

  // =====================================================================
  // 决策请求
  // =====================================================================

  turnRequest(seat: number): Request {
    const s = this.state;
    const p = this.p(seat);
    const moves: Record<string, number> = {};
    if (s.moveLeft > 0) {
      for (const [k, v] of this.reach(p.tile, s.moveLeft, { seat })) if (k !== p.tile) moves[k] = v.cost;
    }
    const explore: Dir[] = [];
    const leave = this.leaveCost(p.tile, { seat });
    if (s.moveLeft >= leave) {
      const { floor } = parseKey(p.tile);
      if (s.decks.rooms[floor] > 0) for (const d of this.openDirs(p.tile)) explore.push(d);
    }
    const trades = [];
    if (!this.traded) {
      for (const o of s.players) {
        if (o.seat === seat || o.dead || o.tile !== p.tile) continue;
        trades.push({ seat: o.seat, theirs: o.cards.filter((c) => !CARDS[c].bound) });
      }
    }
    const loot = [];
    if (s.phase === 'haunt' && !this.looted) {
      for (const o of s.players) if (o.dead && o.tile === p.tile && o.cards.length) loot.push({ seat: o.seat, cards: [...o.cards] });
    }
    return {
      kind: 'turn', seat, moveLeft: s.moveLeft, moves, explore,
      actions: this.listActions(seat),
      attacks: s.phase === 'haunt' && !this.attacked ? this.listAttacks(seat) : [],
      trades, loot,
      tradeable: p.cards.filter((c) => !CARDS[c].bound),
    };
  }

  listActions(seat: number): { id: string; label: string; desc?: string }[] {
    const out: { id: string; label: string; desc?: string }[] = [];
    const p = this.p(seat);
    for (const c of p.cards) {
      const def = CARDS[c];
      const id = 'card:' + c;
      if (!def.action || this.used.has(id) || !this.turnCards.includes(c)) continue;
      if (def.action.can && !def.action.can(this, seat)) continue;
      out.push({ id, label: `${def.name}：${def.action.label}`, desc: def.action.desc });
    }
    const room = this.roomOf(seat);
    if (room?.action && !this.used.has('room:' + room.id) && (!room.action.can || room.action.can(this, seat))) {
      out.push({ id: 'room:' + room.id, label: `${room.name}：${room.action.label}`, desc: room.action.desc });
    }
    if (this.haunt && this.state.phase === 'haunt') {
      const side = this.sideOf(seat);
      for (const ha of this.haunt.actions ?? []) {
        const id = 'haunt:' + ha.id;
        if (this.used.has(id)) continue;
        if (ha.side !== 'any' && ha.side !== side) continue;
        if (ha.can && !ha.can(this, seat)) continue;
        out.push({ id, label: ha.label, desc: ha.desc });
      }
    }
    return out;
  }

  private *runAction(seat: number, id: string): Gen {
    this.used.add(id);
    const [kind, ...rest] = id.split(':');
    const key = rest.join(':');
    if (kind === 'card') {
      const def = CARDS[key];
      if (!def.action) return;
      this.log(`${this.p(seat).name} 使用了「${def.name}」`);
      yield* def.action.run(this, seat);
      if (def.action.discard && this.p(seat).cards.includes(key)) yield* this.loseCard(seat, key);
    } else if (kind === 'room') {
      const room = ROOMS[key];
      if (room.action) yield* room.action.run(this, seat);
    } else if (kind === 'haunt') {
      const ha = this.haunt?.actions?.find((x) => x.id === key);
      if (!ha) return;
      if (ha.publicText) this.reveal(ha.publicText);
      yield* ha.run(this, seat);
    }
  }

  // =====================================================================
  // 地图与移动
  // =====================================================================

  room(key: string): RoomDef | undefined {
    const t = this.state.tiles[key];
    return t ? ROOMS[t.room] : undefined;
  }

  roomOf(seat: number): RoomDef | undefined {
    return this.room(this.p(seat).tile);
  }

  /** 已放置的某个房间所在格子 */
  findTile(roomId: string): string | null {
    for (const [k, t] of Object.entries(this.state.tiles)) if (t.room === roomId) return k;
    return null;
  }

  tileName(key: string): string {
    return this.room(key)?.name ?? '未知之处';
  }

  /** 门口朝向空格的方向 */
  openDirs(key: string): Dir[] {
    const t = this.state.tiles[key];
    if (!t) return [];
    const out: Dir[] = [];
    for (let d = 0; d < 4; d++) {
      if (!hasDoor(ROOMS[t.room].doors, t.rot, d)) continue;
      const nk = tileKey(t.floor, t.x + DX[d], t.y + DY[d]);
      if (!this.state.tiles[nk]) out.push(d as Dir);
    }
    return out;
  }

  /** 某楼层所有还能探索的门口数 */
  frontier(floor: Floor): number {
    let n = 0;
    for (const [k, t] of Object.entries(this.state.tiles)) if (t.floor === floor) n += this.openDirs(k).length;
    return n;
  }

  /** 一步可达的格子（双方都有门，或远距连接） */
  neighbors(key: string, phase = false): string[] {
    const t = this.state.tiles[key];
    if (!t) return [];
    const out: string[] = [];
    for (let d = 0; d < 4; d++) {
      const nk = tileKey(t.floor, t.x + DX[d], t.y + DY[d]);
      const n = this.state.tiles[nk];
      if (!n) continue;
      if (phase || (hasDoor(ROOMS[t.room].doors, t.rot, d) && hasDoor(ROOMS[n.room].doors, n.rot, (d + 2) % 4))) out.push(nk);
    }
    const link = ROOMS[t.room].link;
    if (link) {
      const lk = this.findTile(link);
      if (lk && !out.includes(lk)) out.push(lk);
    }
    for (const rid of REVERSE_LINKS[t.room] ?? []) {
      const lk = this.findTile(rid);
      if (lk && !out.includes(lk)) out.push(lk);
    }
    for (const [a, b] of this.state.links) {
      if (a === key && !out.includes(b)) out.push(b);
      if (b === key && !out.includes(a)) out.push(a);
    }
    return out;
  }

  /** 离开某格的花费：基础 1，有障碍或敌人再 +1 */
  leaveCost(key: string, mover: { seat?: number; monster?: number }): number {
    let extra = 0;
    if (this.state.tokens.some((t) => t.tile === key && t.obstacle)) extra = 1;
    const room = this.room(key);
    if (room?.leaveCost) extra = Math.max(extra, room.leaveCost);
    if (this.state.phase === 'haunt' && extra === 0) {
      if (mover.seat != null) {
        const me = mover.seat;
        if (this.state.monsters.some((m) => m.tile === key && !m.stunned && !this.monsterDef(m)?.noBlock && this.isEnemy(me, { monster: m.id }))) extra = 1;
        else if (this.state.players.some((o) => o.seat !== me && !o.dead && o.tile === key && this.isEnemy(me, { seat: o.seat }))) extra = 1;
      } else if (mover.monster != null) {
        if (this.state.players.some((o) => !o.dead && o.tile === key && !this.isTraitor(o.seat))) extra = 1;
      }
    }
    return 1 + extra;
  }

  /** Dijkstra：预算内可到达的格子 */
  reach(from: string, budget: number, mover: { seat?: number; monster?: number }, phase = false): Map<string, { cost: number; prev: string | null }> {
    const best = new Map<string, { cost: number; prev: string | null }>([[from, { cost: 0, prev: null }]]);
    const queue: string[] = [from];
    while (queue.length) {
      queue.sort((a, b) => best.get(a)!.cost - best.get(b)!.cost);
      const cur = queue.shift()!;
      const c = best.get(cur)!.cost;
      const step = this.leaveCost(cur, mover);
      for (const nk of this.neighbors(cur, phase)) {
        const nc = c + step;
        if (nc > budget) continue;
        const old = best.get(nk);
        if (!old || nc < old.cost) {
          best.set(nk, { cost: nc, prev: cur });
          if (!queue.includes(nk)) queue.push(nk);
        }
      }
    }
    return best;
  }

  private distCache = new Map<string, Map<string, number>>();
  private distSig = '';

  /** 不限预算的最短步数（AI 与剧本用）。按起点缓存整张 BFS 结果，地图变化时失效 */
  distance(from: string, to: string): number {
    if (from === to) return 0;
    const sig = Object.keys(this.state.tiles).length + ':' + this.state.links.length;
    if (sig !== this.distSig) {
      this.distSig = sig;
      this.distCache.clear();
    }
    let seen = this.distCache.get(from);
    if (!seen) {
      seen = new Map<string, number>([[from, 0]]);
      const q = [from];
      while (q.length) {
        const cur = q.shift()!;
        for (const nk of this.neighbors(cur)) {
          if (seen.has(nk)) continue;
          seen.set(nk, seen.get(cur)! + 1);
          q.push(nk);
        }
      }
      this.distCache.set(from, seen);
    }
    return seen.get(to) ?? Infinity;
  }

  /** 视线：同楼层、沿同一方向、每一步都穿过相连的门 */
  lineOfSight(from: string, to: string): boolean {
    if (from === to) return true;
    const a = parseKey(from);
    const b = parseKey(to);
    if (a.floor !== b.floor || (a.x !== b.x && a.y !== b.y)) return false;
    const d = a.x === b.x ? (b.y < a.y ? 0 : 2) : b.x > a.x ? 1 : 3;
    let cur = from;
    for (let i = 0; i < 30; i++) {
      const c = parseKey(cur);
      const nk = tileKey(c.floor, c.x + DX[d], c.y + DY[d]);
      if (!this.neighbors(cur).includes(nk)) return false;
      if (nk === to) return true;
      cur = nk;
    }
    return false;
  }

  private *walk(seat: number, to: string): Gen {
    const s = this.state;
    const p = this.p(seat);
    const r = this.reach(p.tile, s.moveLeft, { seat });
    const target = r.get(to);
    if (!target) return;
    const path: string[] = [];
    for (let k: string | null = to; k; k = r.get(k)!.prev) path.unshift(k);
    for (let i = 1; i < path.length; i++) {
      const cost = this.leaveCost(path[i - 1], { seat });
      if (s.moveLeft < cost) break;
      s.moveLeft -= cost;
      p.tile = path[i];
      this.emit({ t: 'move', seat, path: [path[i - 1], path[i]] });
      const before = p.tile;
      yield* this.enterEffects(seat);
      if (p.dead || this.turnEnded || p.tile !== before || s.winner) break;
    }
  }

  private *enterEffects(seat: number): Gen {
    const room = this.roomOf(seat);
    if (room?.onEnter && !(room.harmful && this.isTraitor(seat))) yield* this.safe(room.onEnter(this, seat));
    if (this.haunt?.onEnter && this.state.phase === 'haunt') yield* this.safe(this.haunt.onEnter(this, seat));
  }

  private *explore(seat: number, dir: Dir): Gen {
    const s = this.state;
    const p = this.p(seat);
    const from = parseKey(p.tile);
    s.moveLeft -= this.leaveCost(p.tile, { seat });
    const roomId = this.drawRoom(from.floor);
    if (!roomId) {
      this.log(`${FLOOR_LABEL[from.floor]}已经没有新的房间了`, 'info');
      return;
    }
    const x = from.x + DX[dir];
    const y = from.y + DY[dir];
    const key = tileKey(from.floor, x, y);
    const rots = this.validRotations(roomId, from.floor, x, y, (dir + 2) % 4);
    let rot = rots[0];
    if (rots.length > 1) {
      const a = yield { kind: 'rotate', seat, tile: key, room: roomId, rots };
      if (a.kind === 'rotate') rot = a.rot;
    }
    this.place(roomId, from.floor, x, y, rot, seat);
    const prev = p.tile;
    p.tile = key;
    this.emit({ t: 'move', seat, path: [prev, key] });
    const room = ROOMS[roomId];
    this.log(`${p.name} 发现了「${room.name}」`);
    if (room.onDiscover) yield* this.safe(room.onDiscover(this, seat));
    for (const k of room.symbols ?? []) {
      if (p.dead || s.winner) break;
      if (this.hauntThisTurn && k === 'omen') continue;
      yield* this.draw(seat, k);
    }
    this.turnEnded = true;
  }

  /** 从房间堆抽一张能放在该楼层的板块；不符合的放到堆底 */
  private drawRoom(floor: Floor): string | null {
    const stack = this.secret.decks.rooms;
    for (let i = 0; i < stack.length; i++) {
      const id = stack.shift()!;
      if (ROOMS[id].floors.includes(floor)) return id;
      stack.push(id);
    }
    return null;
  }

  /** 新板块必须有一扇门朝向来处；尽量保证该楼层还有可探索的门 */
  validRotations(roomId: string, floor: Floor, x: number, y: number, backDir: number): number[] {
    const doors = ROOMS[roomId].doors;
    const ok: number[] = [];
    const keepOpen: number[] = [];
    for (let rot = 0; rot < 4; rot++) {
      if (backDir >= 0 && !hasDoor(doors, rot, backDir)) continue;
      ok.push(rot);
      const key = tileKey(floor, x, y);
      this.state.tiles[key] = { room: roomId, floor, x, y, rot };
      if (this.frontier(floor) > 0) keepOpen.push(rot);
      delete this.state.tiles[key];
    }
    const list = keepOpen.length ? keepOpen : ok;
    return list.length ? list : [0];
  }

  private place(roomId: string, floor: Floor, x: number, y: number, rot: number, seat: number) {
    const key = tileKey(floor, x, y);
    this.state.tiles[key] = { room: roomId, floor, x, y, rot };
    const i = this.secret.decks.rooms.indexOf(roomId);
    if (i >= 0) this.secret.decks.rooms.splice(i, 1);
    this.emit({ t: 'tile', key, tile: this.state.tiles[key], seat });
  }

  /**
   * 把指定房间（从房间堆里找）放到某层一个可用的门口。返回格子 key；
   * 已经放过就直接返回原位置；放不下返回 null。
   */
  placeRoom(roomId: string, floors?: Floor[]): string | null {
    const existing = this.findTile(roomId);
    if (existing) return existing;
    const def = ROOMS[roomId];
    if (!def) return null;
    const allowed = floors ?? def.floors;
    const spots: { floor: Floor; x: number; y: number; back: number }[] = [];
    for (const f of FLOORS) {
      if (!allowed.includes(f)) continue;
      for (const [k, t] of Object.entries(this.state.tiles)) {
        if (t.floor !== f) continue;
        for (const d of this.openDirs(k)) spots.push({ floor: f, x: t.x + DX[d], y: t.y + DY[d], back: (d + 2) % 4 });
      }
    }
    if (!spots.length) return null;
    const spot = spots[this.rng.int(spots.length)];
    const rots = this.validRotations(roomId, spot.floor, spot.x, spot.y, spot.back);
    this.place(roomId, spot.floor, spot.x, spot.y, rots[0], this.state.turn);
    this.log(`「${def.name}」出现在${FLOOR_LABEL[spot.floor]}`, 'info');
    return tileKey(spot.floor, spot.x, spot.y);
  }

  /** 保证三层楼互相可达：地下室走不到时，走廊尽头露出一道暗梯 */
  ensureConnected() {
    const hall = START_ROOMS[1][0];
    const base = START_ROOMS[4][0];
    if (this.distance(hall, base) === Infinity) {
      this.link(hall, base);
      this.log('走廊尽头的墙板松动了，后面是一道通往地下室的暗梯。', 'info');
    }
    for (const p of this.state.players) {
      if (!p.dead && this.distance(p.tile, hall) === Infinity) this.link(p.tile, hall);
    }
  }

  /** 剧本临时连接两个格子 */
  link(a: string, b: string) {
    this.state.links.push([a, b]);
  }

  // =====================================================================
  // 玩家与属性
  // =====================================================================

  p(seat: number): PlayerState {
    return this.state.players[seat];
  }

  value(seat: number, trait: Trait): number {
    const p = this.p(seat);
    return traitValue(EXPLORERS[p.explorer].tracks[trait], p.traits[trait]);
  }

  alive(): number[] {
    return this.state.players.filter((p) => !p.dead).map((p) => p.seat);
  }

  /** 真实阵营（含隐藏背叛者） */
  sideOf(seat: number): Side | null {
    if (this.secret.hidden === seat) return 'traitor';
    return this.p(seat).side;
  }

  isTraitor(seat: number): boolean {
    return this.sideOf(seat) === 'traitor';
  }

  traitor(): number | null {
    if (this.secret.hidden != null) return this.secret.hidden;
    const p = this.state.players.find((x) => x.side === 'traitor');
    return p ? p.seat : null;
  }

  heroes(includeDead = false): number[] {
    return this.state.players.filter((p) => (includeDead || !p.dead) && this.sideOf(p.seat) === 'hero').map((p) => p.seat);
  }

  /** 按人数取值：3/4/5/6 人 */
  scale(a3: number, a4: number, a5: number, a6: number): number {
    return [a3, a3, a3, a3, a4, a5, a6][Math.min(this.n, 6)];
  }

  playersAt(key: string, aliveOnly = true): number[] {
    return this.state.players.filter((p) => p.tile === key && (!aliveOnly || !p.dead)).map((p) => p.seat);
  }

  private setTrait(seat: number, trait: Trait, idx: number) {
    const p = this.p(seat);
    const from = p.traits[trait];
    const to = Math.max(0, Math.min(8, idx));
    if (from === to) return;
    p.traits[trait] = to;
    this.emit({ t: 'trait', seat, trait, from, to });
  }

  *gain(seat: number, trait: Trait, n = 1): Gen {
    const p = this.p(seat);
    if (p.dead || n <= 0) return;
    this.setTrait(seat, trait, p.traits[trait] + n);
  }

  /** 直接失去属性（不是伤害，不能减免） */
  *lose(seat: number, trait: Trait, n = 1): Gen {
    const p = this.p(seat);
    if (p.dead || n <= 0) return;
    const floor = this.state.phase === 'haunt' ? 0 : 1;
    this.setTrait(seat, trait, Math.max(floor, p.traits[trait] - n));
    if (p.traits[trait] === 0) yield* this.kill(seat, null);
  }

  /** 恢复到起始值（已在起始值以上不变） */
  heal(seat: number, trait?: Trait) {
    const p = this.p(seat);
    if (p.dead) return;
    const start = EXPLORERS[p.explorer].start;
    for (const t of trait ? [trait] : TRAITS) if (p.traits[t] < start[t]) this.setTrait(seat, t, start[t]);
  }

  /** 受到伤害；玩家自己分配。返回实际承受的点数 */
  *damage(seat: number, kind: DamageKind, n: number, reason = '', by: number | null = null): Gen<number> {
    const p = this.p(seat);
    if (p.dead || n <= 0) return 0;
    for (const c of p.cards) {
      const r = CARDS[c].reduceDamage;
      if (r) n = r(this, seat, kind, n);
    }
    if (n <= 0) {
      this.log(`${p.name} 没有受到伤害`, 'good');
      return 0;
    }
    const traits = kind === 'physical' ? PHYSICAL : kind === 'mental' ? MENTAL : kind === 'general' ? TRAITS : [kind];
    const floor = this.state.phase === 'haunt' ? 0 : 1;
    const caps: Partial<Record<Trait, number>> = {};
    let total = 0;
    for (const t of traits) {
      const c = Math.max(0, p.traits[t] - floor);
      if (c > 0) caps[t] = c;
      total += c;
    }
    const amount = Math.min(n, total);
    const kindName = kind === 'physical' ? '物理' : kind === 'mental' ? '精神' : kind === 'general' ? '' : TRAIT_NAME[kind];
    this.log(`${p.name} 受到 ${n} 点${kindName}伤害${reason ? `（${reason}）` : ''}`, 'bad', seat);
    if (amount === 0) return 0;
    const usable = Object.keys(caps) as Trait[];
    let alloc: Partial<Record<Trait, number>>;
    if (usable.length === 1) alloc = { [usable[0]]: amount };
    else if (amount === total) alloc = { ...caps };
    else {
      const a = yield { kind: 'damage', seat, amount, caps, reason };
      alloc = a.kind === 'damage' ? a.alloc : {};
    }
    for (const t of usable) if (alloc[t]) this.setTrait(seat, t, p.traits[t] - alloc[t]!);
    if (TRAITS.some((t) => p.traits[t] === 0)) yield* this.kill(seat, by);
    return amount;
  }

  /** 逃出房子：不再行动，手牌留在原地以外的地方（直接移出游戏），不算死亡 */
  escape(seat: number, text?: string) {
    const p = this.p(seat);
    if (p.dead) return;
    p.dead = true;
    p.flags.escaped = true;
    p.cards = [];
    this.log(text ?? `${p.name} 逃出了这栋房子`, 'good', seat);
    if (this.state.turn === seat) this.turnEnded = true;
  }

  /** 是否逃出 */
  escaped(seat: number): boolean {
    return !!this.p(seat).flags.escaped;
  }

  *kill(seat: number, killer: number | null): Gen {
    const p = this.p(seat);
    if (p.dead) return;
    if (this.state.phase !== 'haunt') {
      for (const t of TRAITS) if (p.traits[t] < 1) this.setTrait(seat, t, 1);
      return;
    }
    p.dead = true;
    this.emit({ t: 'death', seat });
    this.log(`${p.name} 死了`, 'bad', seat);
    if (this.secret.hidden === seat) this.revealTraitor();
    if (this.state.turn === seat) this.turnEnded = true;
    if (this.haunt?.onDeath) yield* this.safe(this.haunt.onDeath(this, seat, killer));
  }

  // =====================================================================
  // 掷骰
  // =====================================================================

  rollDice(n: number): number[] {
    const k = Math.max(0, Math.min(MAX_DICE, n));
    return Array.from({ length: k }, () => this.rng.die());
  }

  /** 掷 n 颗骰并广播 */
  *roll(n: number, label: string, seat?: number): Gen<number> {
    const dice = this.rollDice(n);
    const total = dice.reduce((a, b) => a + b, 0);
    this.emit({ t: 'roll', seat, label, dice, total });
    return total;
  }

  bonus(seat: number, trait: Trait, purpose: RollPurpose): number {
    let b = 0;
    for (const c of this.p(seat).cards) {
      const f = CARDS[c].rollBonus;
      if (f) b += f(this, seat, trait, purpose);
    }
    if (this.haunt?.rollBonus && this.state.phase === 'haunt') b += this.haunt.rollBonus(this, seat, trait, purpose);
    return b;
  }

  /** 属性检定：掷「属性值 + 加成」颗骰，返回点数。need 只用来显示成败 */
  *check(seat: number, trait: Trait, need?: number, label?: string, extra = 0): Gen<number> {
    const n = this.value(seat, trait) + this.bonus(seat, trait, 'check') + extra;
    const dice = this.rollDice(n);
    const total = dice.reduce((a, b) => a + b, 0);
    const ok = need != null ? total >= need : undefined;
    this.emit({ t: 'roll', seat, label: label ?? `${TRAIT_NAME[trait]}检定${need != null ? ` ${need}+` : ''}`, dice, total, need, ok });
    return total;
  }

  // =====================================================================
  // 卡牌
  // =====================================================================

  card(id: string): CardDef {
    return CARDS[id];
  }

  has(seat: number, card: string): boolean {
    return this.p(seat).cards.includes(card);
  }

  holder(card: string): number | null {
    const p = this.state.players.find((x) => x.cards.includes(card));
    return p ? p.seat : null;
  }

  /** 抽一张牌并结算。返回卡 id */
  *draw(seat: number, kind: CardKind): Gen<string | null> {
    const deck = this.secret.decks[kind];
    const id = deck.shift();
    if (!id) {
      this.log(`${CARD_KIND_NAME[kind]}牌堆已经空了`, 'info');
      return null;
    }
    const def = CARDS[id];
    if (kind === 'event') {
      this.emit({ t: 'card', seat, card: id, how: 'event' });
      this.log(`${this.p(seat).name} 遭遇事件「${def.name}」`);
      let skip = false;
      if (this.isTraitor(seat) && this.state.phase === 'haunt') {
        skip = (yield* this.choose(seat, `你是背叛者，可以无视事件「${def.name}」`, ['结算这张事件', '无视它'], id)) === 1;
      }
      if (!skip && def.run) yield* this.safe(def.run(this, seat));
      deck.push(id);
      if (def.haunt && this.state.phase === 'explore' && !this.p(seat).dead && !this.config.debugHaunt) {
        // 事件引发的异变：至少 3 个凶兆后，掷「凶兆数」颗骰 5+ 才会成真
        const n = this.state.omensDrawn;
        if (n >= 3) {
          const dice = this.rollDice(n);
          const sum = dice.reduce((a, b) => a + b, 0);
          const ok = sum >= 5;
          this.emit({ t: 'hauntRoll', seat, dice, total: sum, need: `「${def.name}」· 5 点以上触发`, ok });
          if (ok) yield* this.beginHaunt(seat, def.haunt);
          else this.log('……房子低语着，但时机未到。', 'haunt');
        } else this.log('……房子低语着，但时机未到。', 'haunt');
      }
      return id;
    }
    this.emit({ t: 'card', seat, card: id, how: 'draw' });
    this.log(`${this.p(seat).name} 获得${CARD_KIND_NAME[kind]}「${def.name}」`);
    yield* this.gainCard(seat, id, false);
    if (kind === 'omen') {
      this.state.omensDrawn++;
      this.secret.lastOmen = id;
      this.omenThisTurn = true;
      if (this.state.phase === 'explore' && this.state.mode === 'standard') yield* this.hauntRoll(seat);
    }
    return id;
  }

  /** 从牌堆里找一张指定的卡交给玩家（不在牌堆则无效）。 */
  *takeFromDeck(seat: number, card: string): Gen<boolean> {
    const def = CARDS[card];
    if (!def) return false;
    const deck = this.secret.decks[def.kind];
    const i = deck.indexOf(card);
    if (i < 0) return false;
    deck.splice(i, 1);
    this.emit({ t: 'card', seat, card, how: 'gain' });
    yield* this.gainCard(seat, card, false);
    return true;
  }

  /** 从牌堆顶依次翻，直到找到符合条件的卡 */
  *searchDeck(seat: number, kind: CardKind, pred: (c: CardDef) => boolean): Gen<string | null> {
    const deck = this.secret.decks[kind];
    const i = deck.findIndex((c) => pred(CARDS[c]));
    if (i < 0) return null;
    const [id] = deck.splice(i, 1);
    this.rng.shuffle(deck);
    this.emit({ t: 'card', seat, card: id, how: 'gain' });
    this.log(`${this.p(seat).name} 获得「${CARDS[id].name}」`);
    yield* this.gainCard(seat, id, false);
    return id;
  }

  *gainCard(seat: number, card: string, announce = true): Gen {
    const p = this.p(seat);
    p.cards.push(card);
    if (announce) this.emit({ t: 'card', seat, card, how: 'gain' });
    const def = CARDS[card];
    if (def.onGain) yield* this.safe(def.onGain(this, seat));
  }

  /** 失去一张卡；to 给出则交给他人，否则移出游戏（事件放回牌堆底） */
  *loseCard(seat: number, card: string, to?: number): Gen {
    const p = this.p(seat);
    const i = p.cards.indexOf(card);
    if (i < 0) return;
    p.cards.splice(i, 1);
    this.emit({ t: 'lose', seat, card, to });
    const def = CARDS[card];
    if (def.onLose && !p.dead) yield* this.safe(def.onLose(this, seat));
    if (to != null) yield* this.gainCard(to, card, false);
  }

  // =====================================================================
  // 选择
  // =====================================================================

  *choose(seat: number, prompt: string, options: (string | { label: string; desc?: string })[], card?: string): Gen<number> {
    const opts = options.map((o) => (typeof o === 'string' ? { label: o } : o));
    if (opts.length <= 1) return 0;
    const a = yield { kind: 'choose', seat, prompt, options: opts, card };
    return a.kind === 'choose' ? a.i : 0;
  }

  *chooseTile(seat: number, prompt: string, tiles: string[], optional = false): Gen<string | null> {
    if (!tiles.length) return null;
    if (tiles.length === 1 && !optional) return tiles[0];
    const a = yield { kind: 'tile', seat, prompt, tiles, optional };
    return a.kind === 'tile' ? a.tile : null;
  }

  *choosePlayer(seat: number, prompt: string, seats: number[], optional = false): Gen<number | null> {
    if (!seats.length) return null;
    if (seats.length === 1 && !optional) return seats[0];
    const a = yield { kind: 'player', seat, prompt, seats, optional };
    return a.kind === 'player' ? a.seat : null;
  }

  *chooseCard(seat: number, prompt: string, cards: string[], optional = false): Gen<string | null> {
    if (!cards.length) return null;
    if (cards.length === 1 && !optional) return cards[0];
    const a = yield { kind: 'card', seat, prompt, cards, optional };
    return a.kind === 'card' ? a.card : null;
  }

  // =====================================================================
  // 位移
  // =====================================================================

  /** 直接把玩家放到某格（不花移动，不触发进入效果） */
  moveTo(seat: number, key: string, text?: string) {
    const p = this.p(seat);
    if (!this.state.tiles[key] || p.tile === key) return;
    p.tile = key;
    this.emit({ t: 'place', seat, to: key, text });
  }

  /** 放到某格并触发进入效果 */
  *moveInto(seat: number, key: string, text?: string): Gen {
    this.moveTo(seat, key, text);
    yield* this.enterEffects(seat);
  }

  endTurn() {
    this.turnEnded = true;
  }

  // =====================================================================
  // 标记与怪物
  // =====================================================================

  private nextId = 1;

  token(tile: string, kind: string, label: string, opts: Partial<Omit<Token, 'id' | 'tile' | 'kind' | 'label'>> = {}): Token {
    const t: Token = { id: this.nextId++, kind, tile, label, ...opts };
    this.state.tokens.push(t);
    return t;
  }

  removeToken(id: number) {
    this.state.tokens = this.state.tokens.filter((t) => t.id !== id);
  }

  tokensAt(tile: string, kind?: string): Token[] {
    return this.state.tokens.filter((t) => t.tile === tile && (!kind || t.kind === kind));
  }

  tokens(kind: string): Token[] {
    return this.state.tokens.filter((t) => t.kind === kind);
  }

  monsterDef(m: Monster): MonsterDef | undefined {
    return this.haunt?.monsters?.[m.kind];
  }

  spawn(kind: string, tile: string, data?: Record<string, unknown>): Monster | null {
    const def = this.haunt?.monsters?.[kind];
    if (!def || !this.state.tiles[tile]) return null;
    const m: Monster = {
      id: this.nextId++, kind, name: def.name, icon: def.icon, tile,
      traits: { speed: def.speed, might: def.might, sanity: def.sanity, knowledge: def.knowledge },
      stunned: false, hp: def.hp, data,
    };
    this.state.monsters.push(m);
    this.emit({ t: 'place', monster: m.id, to: tile, text: `${def.name}出现了` });
    return m;
  }

  monster(id: number): Monster | undefined {
    return this.state.monsters.find((m) => m.id === id);
  }

  monstersAt(tile: string, kind?: string): Monster[] {
    return this.state.monsters.filter((m) => m.tile === tile && (!kind || m.kind === kind));
  }

  removeMonster(id: number) {
    this.state.monsters = this.state.monsters.filter((m) => m.id !== id);
  }

  moveMonster(id: number, key: string) {
    const m = this.monster(id);
    if (!m || !this.state.tiles[key]) return;
    m.tile = key;
    this.emit({ t: 'place', monster: id, to: key });
  }

  stun(id: number) {
    const m = this.monster(id);
    if (!m || m.stunned) return;
    m.stunned = true;
    this.emit({ t: 'stun', monster: id });
    this.log(`${m.name} 被击晕了`, 'good');
  }

  *hurtMonster(id: number, dmg: number, by: number | null): Gen {
    const m = this.monster(id);
    if (!m || dmg <= 0) return;
    if (this.haunt?.onMonsterHurt) {
      const handled = yield* this.haunt.onMonsterHurt(this, id, dmg, by);
      if (handled) return;
    }
    const def = this.monsterDef(m);
    if (m.hp != null) {
      m.hp -= dmg;
      if (m.hp <= 0) {
        this.removeMonster(id);
        this.log(`${m.name} 被消灭了`, 'good');
      } else this.log(`${m.name} 受到 ${dmg} 点伤害（剩余 ${m.hp}）`, 'good');
      return;
    }
    if (def?.stun === false) {
      this.log(`${m.name} 毫发无伤`, 'bad');
      return;
    }
    this.stun(id);
  }

  // =====================================================================
  // 战斗
  // =====================================================================

  sameTile(a: Target, b: Target): boolean {
    return this.targetTile(a) === this.targetTile(b);
  }

  targetTile(t: Target): string {
    return 'seat' in t ? this.p(t.seat).tile : (this.monster(t.monster)?.tile ?? '');
  }

  targetName(t: Target): string {
    return 'seat' in t ? this.p(t.seat).name : (this.monster(t.monster)?.name ?? '怪物');
  }

  private targetValue(t: Target, trait: Trait): number {
    if ('seat' in t) return this.value(t.seat, trait);
    return this.monster(t.monster)?.traits[trait] ?? 0;
  }

  /** seat 是否把 target 视为敌人 */
  isEnemy(seat: number, target: Target): boolean {
    if (this.state.phase !== 'haunt' || !this.haunt) return false;
    if (this.haunt.canAttack) return this.haunt.canAttack(this, seat, 'seat' in target ? { seat: target.seat } : { monster: target.monster });
    const type = this.haunt.type;
    if ('monster' in target) return !this.isTraitor(seat);
    if (target.seat === seat) return false;
    if (type === 'ffa' || type === 'hidden') return true;
    if (type === 'coop') return false;
    return this.sideOf(seat) !== this.sideOf(target.seat);
  }

  listAttacks(seat: number): AttackOpt[] {
    const p = this.p(seat);
    const out: AttackOpt[] = [];
    const weapons = p.cards.filter((c) => CARDS[c].weapon && this.turnCards.includes(c) && !this.used.has('weapon:' + c));
    const melee = weapons;
    const ranged = weapons.filter((c) => CARDS[c].weapon!.ranged);
    const consider = (target: Target, label: string, tile: string) => {
      if (!this.isEnemy(seat, target)) return;
      if (tile === p.tile) out.push({ target, label, weapons: melee.filter((w) => this.canUseTrait(target, CARDS[w].weapon!.trait)) });
      else if (ranged.length && this.lineOfSight(p.tile, tile)) {
        const ws = ranged.filter((w) => this.canUseTrait(target, CARDS[w].weapon!.trait));
        if (ws.length) out.push({ target, label: label + '（远程）', weapons: ws, ranged: true });
      }
    };
    for (const o of this.state.players) if (o.seat !== seat && !o.dead) consider({ seat: o.seat }, o.name, o.tile);
    for (const m of this.state.monsters) consider({ monster: m.id }, m.name, m.tile);
    return out;
  }

  private canUseTrait(target: Target, trait: Trait): boolean {
    if ('seat' in target) return true;
    return this.monster(target.monster)?.traits[trait] != null;
  }

  /** 对抗攻击：高者对低者造成差值伤害。ranged 时进攻方失败不受伤 */
  *attack(from: Target, to: Target, opts: { trait?: Trait; weapon?: string; ranged?: boolean; bonus?: number } = {}): Gen<{ winner: Target | null; damage: number }> {
    const trait = opts.trait ?? 'might';
    const wdef = opts.weapon ? CARDS[opts.weapon].weapon : undefined;
    let an = this.targetValue(from, trait) + (wdef?.dice ?? 0) + (opts.bonus ?? 0);
    let dn = this.targetValue(to, trait);
    if ('seat' in from) an += this.bonus(from.seat, trait, 'attack');
    if ('seat' in to) dn += this.bonus(to.seat, trait, 'defend');
    const a = this.rollDice(an);
    const d = this.rollDice(dn);
    const at = a.reduce((x, y) => x + y, 0);
    const dt = d.reduce((x, y) => x + y, 0);
    const diff = Math.abs(at - dt);
    const loser = at > dt ? to : dt > at && !opts.ranged ? from : null;
    this.emit({ t: 'attack', from, to, trait, a, d, damage: loser ? diff : 0, loser });
    const verb = opts.weapon ? `用「${CARDS[opts.weapon].name}」` : '';
    this.log(`${this.targetName(from)} ${verb}攻击 ${this.targetName(to)}：${at} 对 ${dt}`, 'info');
    if (!loser) return { winner: null, damage: 0 };
    const winner = loser === to ? from : to;
    yield* this.hurt(loser, diff, trait, 'seat' in winner ? winner.seat : null);
    return { winner, damage: diff };
  }

  /** 按属性类型对目标造成伤害（玩家或怪物） */
  *hurt(t: Target, n: number, trait: Trait, by: number | null): Gen {
    if ('monster' in t) {
      yield* this.hurtMonster(t.monster, n, by);
      return;
    }
    const kind: DamageKind = PHYSICAL.includes(trait) ? 'physical' : 'mental';
    yield* this.damage(t.seat, kind, n, '战斗', by);
  }

  // =====================================================================
  // 怪物阶段
  // =====================================================================

  private monsterSeat(): number {
    const t = this.traitor();
    return t ?? (this.roundStart + this.n - 1) % this.n;
  }

  /** 控制怪物的座位；没有背叛者时为 null（自动） */
  monsterController(): number | null {
    return this.traitor();
  }

  private *monsterPhase(): Gen {
    const s = this.state;
    if (!s.monsters.length) return;
    s.turn = -1;
    this.emit({ t: 'monsterPhase' });
    const active: Monster[] = [];
    for (const m of s.monsters) {
      if (m.stunned) {
        m.stunned = false;
        this.log(`${m.name} 恢复过来了`, 'info');
      } else active.push(m);
    }
    const budget = new Map<number, number>();
    const kinds = [...new Set(active.map((m) => m.kind))];
    for (const k of kinds) {
      const def = this.haunt?.monsters?.[k];
      const total = yield* this.roll(def?.speed ?? 1, `${def?.name ?? '怪物'}移动`);
      for (const m of active) if (m.kind === k) budget.set(m.id, Math.max(1, total));
    }
    const attacked = new Set<number>();
    const ctrl = this.monsterController();
    for (let guard = 0; guard < 200 && !s.winner; guard++) {
      const req = this.monsterRequest(ctrl ?? -1, active, budget, attacked);
      if (!req.monsters.some((m) => Object.keys(m.moves).length || m.attacks.length)) break;
      let a: Answer;
      if (ctrl != null) a = yield req;
      else a = autoMonster(this, req);
      if (a.kind !== 'monster' || a.a === 'end') break;
      const m = this.monster(a.id);
      if (!m) continue;
      if (a.a === 'move') {
        const r = this.reach(m.tile, budget.get(m.id) ?? 0, { monster: m.id }, !!this.monsterDef(m)?.phase);
        const node = r.get(a.to);
        if (!node) continue;
        const path: string[] = [];
        for (let k: string | null = a.to; k; k = r.get(k)!.prev) path.unshift(k);
        budget.set(m.id, (budget.get(m.id) ?? 0) - node.cost);
        m.tile = a.to;
        this.emit({ t: 'move', monster: m.id, path });
      } else {
        attacked.add(m.id);
        yield* this.attack({ monster: m.id }, a.target, {});
      }
      if (this.checkWin()) return;
    }
    s.turn = this.monsterSeat();
  }

  monsterRequest(seat: number, active: Monster[], budget: Map<number, number>, attacked: Set<number>): Extract<Request, { kind: 'monster' }> {
    const monsters = [];
    for (const m of active) {
      if (!this.monster(m.id) || m.stunned) continue;
      const moves: Record<string, number> = {};
      const left = budget.get(m.id) ?? 0;
      if (left > 0) for (const [k, v] of this.reach(m.tile, left, { monster: m.id }, !!this.monsterDef(m)?.phase)) if (k !== m.tile) moves[k] = v.cost;
      const attacks: AttackOpt[] = [];
      if (!attacked.has(m.id)) {
        for (const o of this.state.players) {
          if (o.dead || o.tile !== m.tile || this.isTraitor(o.seat)) continue;
          if (this.haunt?.canAttack && !this.haunt.canAttack(this, -1, { seat: o.seat }, m.id)) continue;
          attacks.push({ target: { seat: o.seat }, label: o.name, weapons: [] });
        }
      }
      monsters.push({ id: m.id, moveLeft: left, moves, attacks });
    }
    return { kind: 'monster', seat, monsters };
  }

  // =====================================================================
  // 异变
  // =====================================================================

  hauntFor(omen: string): number {
    if (this.config.debugHaunt && HAUNTS[this.config.debugHaunt]) return this.config.debugHaunt;
    const id = SCENARIOS[this.state.scenario]?.table[omen];
    return id && HAUNTS[id] ? id : fallbackHaunt(omen);
  }

  private *hauntRoll(seat: number): Gen {
    const n = this.state.omensDrawn;
    const total = OMEN_IDS.length;
    const dice = this.rollDice(n);
    const sum = dice.reduce((a, b) => a + b, 0);
    const early = this.state.round < (this.config.minHauntRound ?? 0);
    const ok = !early && (sum >= 5 || n >= total || (!!this.config.debugHaunt && n >= 2));
    this.emit({ t: 'hauntRoll', seat, dice, total: sum, need: n >= total ? '最后一个凶兆，必定触发' : '5 点以上触发', ok });
    if (ok) yield* this.beginHaunt(seat, this.hauntFor(this.secret.lastOmen!));
    else this.log('房子还在沉睡……', 'haunt');
  }

  private *classicHauntRoll(seat: number): Gen {
    const n = this.state.omensDrawn;
    const dice = this.rollDice(6);
    const sum = dice.reduce((a, b) => a + b, 0);
    const ok = sum < n;
    this.emit({ t: 'hauntRoll', seat, dice, total: sum, need: `小于 ${n} 触发`, ok });
    if (ok) yield* this.beginHaunt(seat, this.hauntFor(this.secret.lastOmen!));
    else this.log('房子还在沉睡……', 'haunt');
  }

  /** 异变开始 */
  *beginHaunt(revealer: number, id: number): Gen {
    const s = this.state;
    if (s.phase !== 'explore') return;
    const def = HAUNTS[id] ?? HAUNTS[fallbackHaunt('')];
    this.haunt = def;
    s.phase = 'haunt';
    this.hauntThisTurn = true;
    this.turnEnded = true;
    let traitor = this.pickTraitor(revealer);
    for (const p of s.players) p.side = 'hero';
    if (def.type === 'hidden') {
      this.secret.hidden = traitor;
      traitor = null;
    } else if (traitor != null && def.type !== 'coop') s.players[traitor].side = 'traitor';
    if (def.type === 'coop') traitor = null;
    s.haunt = { id: def.id, title: def.title, type: def.type, intro: def.intro, revealer, traitor, round: 1, vars: {}, revealed: [] };
    this.emit({ t: 'haunt', id: def.id, title: def.title, revealer, traitor });
    this.log(`异变降临：${def.title}`, 'haunt');
    if (traitor != null) this.log(`${s.players[traitor].name} 成为了背叛者！`, 'haunt');
    else if (def.type === 'hidden') this.log('你们之中藏着一个背叛者……', 'haunt');
    this.ensureConnected();
    if (def.setup) yield* this.safe(def.setup(this));
    this.ensureConnected();
    const first = this.traitor() ?? revealer;
    this.forceNext = (first + 1) % this.n;
  }

  private pickTraitor(revealer: number): number | null {
    const pick = this.pickTraitorRaw(revealer);
    const protect = this.config.protect ?? [];
    if (pick == null || !protect.includes(pick)) return pick;
    for (let i = 1; i < this.n; i++) {
      const s = (pick + i) % this.n;
      if (!protect.includes(s)) return s;
    }
    return pick;
  }

  private pickTraitorRaw(revealer: number): number | null {
    const rule = this.haunt!.traitor;
    const order = Array.from({ length: this.n }, (_, i) => (revealer + i) % this.n);
    const best = (score: (s: number) => number, exclude = false) => {
      let pick: number | null = null;
      let top = -Infinity;
      for (const s of order) {
        if (exclude && s === revealer) continue;
        const v = score(s);
        if (v > top) { top = v; pick = s; }
      }
      return pick;
    };
    switch (rule.type) {
      case 'revealer': return revealer;
      case 'left': return (revealer + 1) % this.n;
      case 'highest': return best((s) => this.value(s, rule.trait), rule.exclude);
      case 'lowest': return best((s) => -this.value(s, rule.trait), rule.exclude);
      case 'holder': return this.holder(rule.card) ?? revealer;
      case 'oldest': return best((s) => EXPLORERS[this.p(s).explorer].age);
      case 'youngest': return best((s) => -EXPLORERS[this.p(s).explorer].age);
      case 'hidden': return order[this.rng.int(order.length)];
      case 'none': return null;
    }
  }

  /** 隐藏背叛者现身 */
  revealTraitor() {
    const t = this.secret.hidden;
    if (t == null) return;
    this.secret.hidden = null;
    this.p(t).side = 'traitor';
    if (this.state.haunt) this.state.haunt.traitor = t;
    this.log(`${this.p(t).name} 露出了真面目——背叛者！`, 'haunt');
  }

  /** 把一条规则公开到日志（「执行即公开」） */
  reveal(text: string) {
    const h = this.state.haunt;
    if (h && !h.revealed.includes(text)) h.revealed.push(text);
    this.log(text, 'haunt');
  }

  /** 剧本公开变量 */
  get hv(): Record<string, any> {
    return this.state.haunt?.vars ?? {};
  }

  /** 剧本秘密变量 */
  get hs(): Record<string, any> {
    return this.secret.vars;
  }

  setTrack(label: string, value: number, max?: number) {
    if (this.state.haunt) this.state.haunt.track = { label, value, max };
  }

  win(side: Side | 'none' | 'solo', text?: string, seats?: number[]) {
    if (this.state.winner) return;
    const def = this.haunt;
    const title = side === 'hero' ? '幸存者获胜' : side === 'traitor' ? '背叛者获胜' : side === 'solo' ? '独自生还' : '无人生还';
    const t = text ?? (side === 'hero' ? def?.hero.win : side === 'traitor' ? def?.traitorSide?.win : '') ?? '';
    const ws = seats ?? (side === 'hero' ? this.heroes(true) : side === 'traitor' ? this.state.players.filter((p) => this.isTraitor(p.seat)).map((p) => p.seat) : []);
    this.setWinner({ side, seats: ws, title, text: t });
  }

  private setWinner(w: Winner) {
    if (this.state.winner) return;
    this.state.winner = w;
    this.state.phase = 'end';
    if (this.secret.hidden != null) this.revealTraitor();
    this.emit({ t: 'end', winner: w });
  }

  private checkWin(): boolean {
    const s = this.state;
    if (s.winner) return true;
    if (s.phase !== 'haunt' || !this.haunt) return false;
    const r = this.haunt.checkWin?.(this);
    if (r) {
      this.win(r.side, r.text, r.seats);
      return true;
    }
    const alive = this.alive();
    const type = this.haunt.type;
    if (!alive.length) {
      this.win('none', '黑暗吞噬了每一个人。');
      return true;
    }
    if (type === 'ffa') {
      if (alive.length === 1) {
        this.win('solo', `${this.p(alive[0]).name} 是唯一走出鬼屋的人。`, alive);
        return true;
      }
      return false;
    }
    if (type !== 'coop' && this.heroes().length === 0) {
      this.win('traitor');
      return true;
    }
    return false;
  }

  // =====================================================================
  // 工具
  // =====================================================================

  emit(e: GameEvent) {
    this.events.push(e);
  }

  log(text: string, tone?: 'good' | 'bad' | 'info' | 'haunt', seat?: number, side?: Side) {
    this.emit({ t: 'log', text, tone, seat, side });
  }

  /** 只有某一名玩家能看到的消息 */
  tell(seat: number, text: string, tone: 'good' | 'bad' | 'info' | 'haunt' = 'haunt') {
    this.emit({ t: 'log', text: '（只有你知道）' + text, tone, seat, to: seat });
  }

  /** 内容层出错时跳过，不让整局崩掉 */
  *safe<T>(g: Gen<T>): Gen<T | undefined> {
    try {
      return yield* g;
    } catch (e) {
      console.error('content error', e);
      this.errors.push(String((e as Error)?.stack ?? e));
      this.log('（一条规则执行出错，已跳过）', 'info');
      return undefined;
    }
  }

  /** 给某个座位看的视图 */
  viewFor(seat: number | null): SeatView {
    const s = this.state;
    const side = seat != null ? this.sideOf(seat) : null;
    const state: GameState = {
      ...s,
      tokens: s.tokens.filter((t) => !t.side || t.side === side),
      players: s.players.map((p) => ({ ...p })),
    };
    let brief: Brief | null = null;
    const def = this.haunt;
    if (def && seat != null && s.phase !== 'explore') {
      if (def.type === 'ffa') brief = { side: 'solo', ...(def.traitorSide ?? def.hero) };
      else if (side === 'traitor' && def.traitorSide) brief = { side: 'traitor', ...def.traitorSide };
      else brief = { side: 'hero', ...def.hero };
    }
    return { state, brief, side };
  }

  /** 事件是否对某个视角可见 */
  static visible(e: GameEvent, side: Side | null, seat: number | null = null): boolean {
    if (e.t !== 'log') return true;
    if (e.to != null && e.to !== seat) return false;
    return !e.side || e.side === side;
  }

  /** 剧本 AI 提示 */
  hint(seat: number): AiHint {
    const ai = this.haunt?.ai;
    if (!ai) return {};
    const side = this.sideOf(seat);
    const f = side === 'traitor' ? ai.traitor : ai.hero;
    try {
      return f ? f(this, seat) : {};
    } catch (e) {
      console.error('hint error', e);
      return {};
    }
  }
}

const FLOOR_LABEL: Record<Floor, string> = { B: '地下室', G: '一楼', U: '二楼' };

/** 房间 id -> 以它为 link 目标的房间 */
const REVERSE_LINKS: Record<string, string[]> = {};
for (const r of Object.values(ROOMS)) if (r.link) (REVERSE_LINKS[r.link] ??= []).push(r.id);

function fallbackHaunt(_omen: string): number {
  const ids = Object.keys(HAUNTS).map(Number).sort((a, b) => a - b);
  return ids[0];
}

// =====================================================================
// 校验
// =====================================================================

const sameTarget = (a: Target, b: Target) => ('seat' in a && 'seat' in b ? a.seat === b.seat : 'monster' in a && 'monster' in b ? a.monster === b.monster : false);

export function validate(g: Game, req: Request, a: Answer): string | null {
  if (a.kind !== req.kind) return '操作类型不符';
  switch (req.kind) {
    case 'turn': {
      const t = a as Extract<Answer, { kind: 'turn' }>;
      switch (t.a) {
        case 'end': return null;
        case 'move': return t.to in req.moves ? null : '到不了那里';
        case 'explore': return req.explore.includes(t.dir) ? null : '那边不能探索';
        case 'act': return req.actions.some((x) => x.id === t.id) ? null : '现在不能这么做';
        case 'attack': {
          const opt = req.attacks.find((x) => sameTarget(x.target, t.target));
          if (!opt) return '不能攻击这个目标';
          if (t.weapon && !opt.weapons.includes(t.weapon)) return '不能用这件武器';
          if (opt.ranged && !t.weapon) return '远程攻击需要武器';
          return null;
        }
        case 'trade': {
          const opt = req.trades.find((x) => x.seat === t.with);
          if (!opt) return '不能和他交易';
          if (!Array.isArray(t.give) || !Array.isArray(t.take) || (!t.give.length && !t.take.length)) return '交易内容为空';
          if (!t.give.every((c) => req.tradeable.includes(c)) || !t.take.every((c) => opt.theirs.includes(c))) return '交易内容无效';
          return null;
        }
        case 'loot': {
          const opt = req.loot.find((x) => x.seat === t.from);
          return opt && opt.cards.includes(t.card) ? null : '拿不到这件东西';
        }
      }
      return '未知操作';
    }
    case 'rotate': return req.rots.includes((a as { rot: number }).rot) ? null : '方向不对';
    case 'damage': {
      const alloc = (a as { alloc: Partial<Record<Trait, number>> }).alloc ?? {};
      let sum = 0;
      for (const [k, v] of Object.entries(alloc)) {
        const cap = req.caps[k as Trait] ?? 0;
        if (!Number.isInteger(v) || v! < 0 || v! > cap) return '伤害分配无效';
        sum += v!;
      }
      return sum === req.amount ? null : `需要分配 ${req.amount} 点伤害`;
    }
    case 'choose': {
      const i = (a as { i: number }).i;
      return Number.isInteger(i) && i >= 0 && i < req.options.length ? null : '选项无效';
    }
    case 'tile': {
      const tile = (a as { tile: string | null }).tile;
      if (tile == null) return req.optional ? null : '必须选择一个位置';
      return req.tiles.includes(tile) ? null : '位置无效';
    }
    case 'player': {
      const s = (a as { seat: number | null }).seat;
      if (s == null) return req.optional ? null : '必须选择一名玩家';
      return req.seats.includes(s) ? null : '玩家无效';
    }
    case 'card': {
      const c = (a as { card: string | null }).card;
      if (c == null) return req.optional ? null : '必须选择一张卡';
      return req.cards.includes(c) ? null : '卡牌无效';
    }
    case 'trade': return typeof (a as { ok: boolean }).ok === 'boolean' ? null : '无效回答';
    case 'monster': {
      const m = a as Extract<Answer, { kind: 'monster' }>;
      if (m.a === 'end') return null;
      const opt = req.monsters.find((x) => x.id === m.id);
      if (!opt) return '这个怪物不能行动';
      if (m.a === 'move') return m.to in opt.moves ? null : '怪物到不了那里';
      if (m.a === 'attack') return opt.attacks.some((x) => sameTarget(x.target, m.target)) ? null : '怪物不能攻击这个目标';
      return '未知操作';
    }
  }
}

// 自动怪物（无背叛者时）由 ai.ts 注入，避免循环依赖
let autoMonster: (g: Game, req: Extract<Request, { kind: 'monster' }>) => Answer = () => ({ kind: 'monster', a: 'end' });
export function setAutoMonster(f: typeof autoMonster) {
  autoMonster = f;
}
