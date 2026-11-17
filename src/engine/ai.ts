// AI：启发式，不做搜索。不能使用 g.rng（AI 的回答会写进日志，恢复时不会重新调用 AI）。
import { hasDoor, parseKey, tileKey, DX, DY, TRAITS, type Answer, type AttackOpt, type Request, type Target, type Trait } from '../shared/types';
import { CARDS, ROOMS } from '../content';
import { Game, setAutoMonster } from './game';

type TurnReq = Extract<Request, { kind: 'turn' }>;

export function aiAnswer(g: Game, req: Request): Answer {
  switch (req.kind) {
    case 'turn': return aiTurn(g, req);
    case 'rotate': return { kind: 'rotate', rot: bestRotation(g, req.room, req.tile, req.rots) };
    case 'damage': return { kind: 'damage', alloc: allocDamage(g, req.seat, req.amount, req.caps) };
    case 'choose': return { kind: 'choose', i: 0 };
    case 'tile': return { kind: 'tile', tile: nearest(g, g.p(req.seat).tile, req.tiles) };
    case 'player': return { kind: 'player', seat: req.seats[0] };
    case 'card': return { kind: 'card', card: req.cards[0] };
    case 'trade': return { kind: 'trade', ok: !req.take.length || g.sideOf(req.seat) === g.sideOf(req.from) };
    case 'monster': return aiMonster(g, req);
  }
}

/** 超时默认：和 AI 一样 */
export const defaultAnswer = aiAnswer;

// ---------- 回合 ----------

function aiTurn(g: Game, req: TurnReq): Answer {
  const seat = req.seat;
  // 物品里 AI 觉得值得用的
  for (const a of req.actions) {
    if (!a.id.startsWith('card:')) continue;
    const def = CARDS[a.id.slice(5)]?.action;
    if (def?.ai?.(g, seat)) return { kind: 'turn', a: 'act', id: a.id };
  }
  for (const a of req.actions) {
    if (!a.id.startsWith('room:')) continue;
    const def = ROOMS[a.id.slice(5)]?.action;
    if (def?.ai?.(g, seat)) return { kind: 'turn', a: 'act', id: a.id };
  }
  if (g.state.phase === 'haunt') {
    const h = hauntTurn(g, req);
    if (h) return h;
  }
  return exploreTurn(g, req) ?? { kind: 'turn', a: 'end' };
}

function exploreTurn(g: Game, req: TurnReq): Answer | null {
  if (req.explore.length) {
    const dir = req.explore[(g.seq + req.seat) % req.explore.length];
    return { kind: 'turn', a: 'explore', dir };
  }
  const frontier = frontierTiles(g);
  if (!frontier.length) return null;
  const here = g.p(req.seat).tile;
  // 能走到门口并且还剩至少 1 点移动去探索
  let best: string | null = null;
  let bestCost = Infinity;
  for (const [k, c] of Object.entries(req.moves)) {
    if (!frontier.includes(k)) continue;
    if (req.moveLeft - c < g.leaveCost(k, { seat: req.seat })) continue;
    if (c < bestCost) { best = k; bestCost = c; }
  }
  if (best) return { kind: 'turn', a: 'move', to: best };
  const step = stepToward(g, here, req.moves, frontier);
  return step ? { kind: 'turn', a: 'move', to: step } : null;
}

function frontierTiles(g: Game): string[] {
  const out: string[] = [];
  for (const k of Object.keys(g.state.tiles)) {
    const { floor } = parseKey(k);
    if (g.state.decks.rooms[floor] > 0 && g.openDirs(k).length) out.push(k);
  }
  return out;
}

/** 在可达格中挑一个离目标最近、且比当前更近的格子 */
/** 回合结束停在这些房间会被送走或受伤，AI 尽量不停在这里 */
const TRAP = new Set(['laundry-chute', 'collapsed', 'furnace', 'dumbwaiter']);

function stepToward(g: Game, here: string, moves: Record<string, number>, goals: string[]): string | null {
  if (!goals.length) return null;
  const trap = (k: string) => (!goals.includes(k) && TRAP.has(g.state.tiles[k]?.room ?? '') ? 0.6 : 0);
  const dist = (k: string) => Math.min(...goals.map((t) => g.distance(k, t))) + trap(k);
  const cur = dist(here);
  let best: string | null = null;
  let bestD = cur;
  let bestC = Infinity;
  for (const [k, c] of Object.entries(moves)) {
    const d = dist(k);
    if (d < bestD || (d === bestD && best && c < bestC)) { best = k; bestD = d; bestC = c; }
  }
  return best && bestD < cur ? best : null;
}

function hauntTurn(g: Game, req: TurnReq): Answer | null {
  const seat = req.seat;
  const hint = g.hint(seat);
  for (const id of hint.actions ?? []) {
    const full = id.includes(':') ? id : 'haunt:' + id;
    if (req.actions.some((a) => a.id === full)) return { kind: 'turn', a: 'act', id: full };
  }
  if (hint.attack !== false && req.attacks.length) {
    const atk = pickAttack(g, seat, req.attacks, hint.targets);
    if (atk) return atk;
  }
  // 搜刮遗体
  if (req.loot.length) {
    const l = req.loot[0];
    return { kind: 'turn', a: 'loot', from: l.seat, card: l.cards[0] };
  }
  const here = g.p(seat).tile;
  let goals = hint.goals?.filter((k) => g.state.tiles[k]) ?? [];
  if (!goals.length) goals = defaultGoals(g, seat);
  if (goals.includes(here)) return hint.goals?.length ? { kind: 'turn', a: 'end' } : null;
  const step = stepToward(g, here, req.moves, goals);
  if (step) return { kind: 'turn', a: 'move', to: step };
  return hint.goals?.length ? { kind: 'turn', a: 'end' } : null;
}

function defaultGoals(g: Game, seat: number): string[] {
  const enemies: string[] = [];
  const mine = g.value(seat, 'might');
  for (const o of g.state.players) {
    if (o.dead || o.seat === seat || !g.isEnemy(seat, { seat: o.seat })) continue;
    if (g.isTraitor(seat) || mine >= g.value(o.seat, 'might')) enemies.push(o.tile);
  }
  if (!g.isTraitor(seat)) {
    for (const m of g.state.monsters) if (!m.stunned && mine >= (m.traits.might ?? 0) + 1) enemies.push(m.tile);
  }
  return enemies;
}

function pickAttack(g: Game, seat: number, opts: AttackOpt[], targets?: (number | `m${number}`)[]): Answer | null {
  const allowed = (t: Target) => !targets || targets.some((x) => (typeof x === 'number' ? 'seat' in t && t.seat === x : 'monster' in t && `m${t.monster}` === x));
  let best: { opt: AttackOpt; weapon?: string; edge: number } | null = null;
  for (const opt of opts) {
    if (!allowed(opt.target)) continue;
    const choices: (string | undefined)[] = opt.ranged ? opt.weapons : [undefined, ...opt.weapons];
    for (const w of choices) {
      const trait: Trait = w ? CARDS[w].weapon!.trait : 'might';
      const mine = g.value(seat, trait) + (w ? CARDS[w].weapon!.dice : 0);
      const theirs = 'seat' in opt.target ? g.value(opt.target.seat, trait) : (g.monster(opt.target.monster)?.traits[trait] ?? 0);
      const edge = mine - theirs + (opt.ranged ? 2 : 0);
      if (!best || edge > best.edge) best = { opt, weapon: w, edge };
    }
  }
  if (!best) return null;
  const aggressive = g.isTraitor(seat) || targets != null;
  if (best.edge < (aggressive ? -1 : 0)) return null;
  return { kind: 'turn', a: 'attack', target: best.opt.target, weapon: best.weapon };
}

// ---------- 其他决策 ----------

function bestRotation(g: Game, room: string, key: string, rots: number[]): number {
  const { floor, x, y } = parseKey(key);
  let best = rots[0];
  let top = -1;
  for (const rot of rots) {
    let open = 0;
    for (let d = 0; d < 4; d++) {
      if (!hasDoor(ROOMS[room].doors, rot, d)) continue;
      if (!g.state.tiles[tileKey(floor, x + DX[d], y + DY[d])]) open++;
    }
    if (open > top) { top = open; best = rot; }
  }
  return best;
}

function allocDamage(g: Game, seat: number, amount: number, caps: Partial<Record<Trait, number>>): Partial<Record<Trait, number>> {
  const p = g.p(seat);
  const left: Partial<Record<Trait, number>> = { ...caps };
  const alloc: Partial<Record<Trait, number>> = {};
  for (let i = 0; i < amount; i++) {
    let pick: Trait | null = null;
    for (const t of TRAITS) {
      if (!left[t]) continue;
      const after = p.traits[t] - (alloc[t] ?? 0);
      // 避免降到 0（死亡），优先扣位置最高的属性
      const score = after - 1 <= 0 ? -100 + after : after;
      if (pick == null) pick = t;
      else {
        const pa = p.traits[pick] - (alloc[pick] ?? 0);
        const ps = pa - 1 <= 0 ? -100 + pa : pa;
        if (score > ps) pick = t;
      }
    }
    if (!pick) break;
    alloc[pick] = (alloc[pick] ?? 0) + 1;
    left[pick]! -= 1;
  }
  return alloc;
}

function nearest(g: Game, from: string, tiles: string[]): string | null {
  let best: string | null = null;
  let d = Infinity;
  for (const t of tiles) {
    const x = g.distance(from, t);
    if (x < d || best == null) { best = t; d = x; }
  }
  return best;
}

// ---------- 怪物 ----------

function aiMonster(g: Game, req: Extract<Request, { kind: 'monster' }>): Answer {
  for (const m of req.monsters) {
    if (m.attacks.length) {
      // 打最弱的
      let target = m.attacks[0].target;
      let low = Infinity;
      for (const a of m.attacks) {
        const v = 'seat' in a.target ? g.value(a.target.seat, 'might') : 99;
        if (v < low) { low = v; target = a.target; }
      }
      return { kind: 'monster', a: 'attack', id: m.id, target };
    }
  }
  for (const m of req.monsters) {
    const mon = g.monster(m.id);
    if (!mon || !Object.keys(m.moves).length) continue;
    const custom = g.haunt?.ai?.monster?.(g, m.id)?.goals?.filter((k) => g.state.tiles[k]);
    const goals = custom?.length ? custom : g.state.players.filter((p) => !p.dead && !g.isTraitor(p.seat)).map((p) => p.tile);
    if (goals.includes(mon.tile)) continue;
    const step = stepToward(g, mon.tile, m.moves, goals);
    if (step) return { kind: 'monster', a: 'move', id: m.id, to: step };
  }
  return { kind: 'monster', a: 'end' };
}

setAutoMonster(aiMonster);
