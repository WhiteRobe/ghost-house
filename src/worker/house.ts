import { DurableObject } from 'cloudflare:workers';
import type { Answer, GameConfig, GameEvent } from '../shared/types';
import type { ClientMsg, PendingView, RoomInfo, RoomSummary, SeatInfo, ServerMsg } from '../shared/protocol';
import { Game, aiAnswer } from '../engine';
import { EXPLORERS, SCENARIOS } from '../content';
import { lobbyStub, type Env, type Identity } from './env';

const CLEANUP_MS = 15 * 60e3;
const AI_NAMES = ['阿福', '小翠', '老周', '豆豆', '铁蛋', '春妮', '石头', '二丫'];

interface TimerState { seq: number; deadline: number }

/** 一局鬼屋：座位管理 + 权威游戏状态 + 按座位过滤的视图推送。 */
export class HouseDO extends DurableObject<Env> {
  private info: RoomInfo | null = null;
  private config: GameConfig | null = null;
  private game: Game | null = null;
  private timer: TimerState | null = null;
  /** AI 下一个回合最早的开始时间：回合交接时停一下，让真人看清是谁在行动 */
  private aiAt: number | null = null;
  private offline: Record<string, number> = {};
  private cleanupAt: number | null = null;
  private dirty = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, answers TEXT NOT NULL)');
    for (const { k, v } of sql.exec<{ k: string; v: string }>('SELECT k, v FROM kv')) {
      const val = JSON.parse(v);
      if (k === 'info') this.info = val;
      else if (k === 'config') this.config = val;
      else if (k === 'timer') this.timer = val;
      else if (k === 'offline') this.offline = val;
      else if (k === 'cleanup') this.cleanupAt = val;
    }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  // ---------- 持久化 ----------

  private set(k: 'info' | 'config' | 'timer' | 'offline' | 'cleanup') {
    this.dirty.add(k);
  }

  private flush(newAnswers: Answer[] = []) {
    const sql = this.ctx.storage.sql;
    if (newAnswers.length) sql.exec('INSERT INTO log (answers) VALUES (?)', JSON.stringify(newAnswers));
    const vals: Record<string, unknown> = { info: this.info, config: this.config, timer: this.timer, offline: this.offline, cleanup: this.cleanupAt };
    for (const k of this.dirty) {
      if (vals[k] == null) sql.exec('DELETE FROM kv WHERE k = ?', k);
      else sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, JSON.stringify(vals[k]));
    }
    this.dirty.clear();
  }

  /** 懒加载：被驱逐后从回答日志重放 */
  private getGame(): Game | null {
    if (this.game || !this.config) return this.game;
    const answers: Answer[] = [];
    for (const r of this.ctx.storage.sql.exec<{ answers: string }>('SELECT answers FROM log ORDER BY id')) answers.push(...JSON.parse(r.answers));
    try {
      this.game = Game.restore(this.config, answers);
    } catch (e) {
      console.error('restore failed', e);
      this.config = null;
      this.set('config');
      if (this.info) { this.info.status = 'waiting'; this.set('info'); }
      this.ctx.storage.sql.exec('DELETE FROM log');
      this.flush();
    }
    return this.game;
  }

  // ---------- RPC ----------

  async init(opts: { id: string; code: string; name: string; host: Identity; maxSeats: number; private: boolean; guestOnly: boolean; tutorial?: boolean }) {
    if (this.info) return;
    const seats: SeatInfo[] = Array.from({ length: opts.maxSeats }, () => ({ kind: 'empty' }) as SeatInfo);
    seats[0] = { kind: 'human', userId: opts.host.id, name: opts.host.name, online: false, guest: opts.host.guest, explorer: opts.tutorial ? 'zhao' : undefined };
    this.info = {
      id: opts.id, code: opts.code, name: opts.name, hostId: opts.host.id, private: opts.private, guestOnly: opts.guestOnly,
      status: 'waiting', seats, settings: { scenario: opts.tutorial ? 'live' : 'random', mode: 'standard', tutorial: opts.tutorial },
    };
    if (opts.tutorial) {
      seats[1] = { kind: 'ai', name: 'AI·小翠', explorer: 'su' };
      seats[2] = { kind: 'ai', name: 'AI·石头', explorer: 'xiaoman' };
    }
    this.cleanupAt = Date.now() + CLEANUP_MS;
    this.set('info');
    this.set('cleanup');
    this.flush();
    await this.schedule();
  }

  // ---------- WebSocket ----------

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const user: Identity = {
      id: req.headers.get('X-User-Id') ?? '',
      name: decodeURIComponent(req.headers.get('X-User-Name') ?? ''),
      guest: req.headers.get('X-Guest') === '1',
    };
    const pair = new WebSocketPair();
    const ws = pair[1];
    const reject = (msg: string) => {
      ws.accept();
      ws.send(JSON.stringify({ type: 'error', msg } satisfies ServerMsg));
      setTimeout(() => ws.close(4000, 'rejected'), 200);
      return new Response(null, { status: 101, webSocket: pair[0] });
    };
    const info = this.info;
    if (!info || !user.id) return reject('房间不存在或已解散');
    const isHost = user.id === info.hostId;
    const seated = this.seatOf(user.id) != null;
    if (info.guestOnly && !isHost) return reject('这是游客的练习房，不能加入');
    if (user.guest && !isHost) return reject('游客只能在自己的房间里和 AI 玩');

    this.ctx.acceptWebSocket(ws, [user.id]);
    ws.serializeAttachment(user);

    let seatChanged = false;
    if (info.status === 'waiting' && !seated) {
      const empty = info.seats.findIndex((s) => s.kind === 'empty');
      if (empty >= 0) {
        info.seats[empty] = { kind: 'human', userId: user.id, name: user.name, online: true, guest: user.guest };
        this.set('info');
        seatChanged = true;
      }
    }
    if (user.id in this.offline) { delete this.offline[user.id]; this.set('offline'); }
    if (this.cleanupAt != null) { this.cleanupAt = null; this.set('cleanup'); }

    this.send(ws, this.roomMsg(user.id));
    if (this.getGame()) this.send(ws, this.gameMsg(user.id, [], true));
    this.broadcastRoom();
    const { answers, events } = this.autoLoop();
    if (answers.length) await this.finishStep(answers, events);
    else {
      this.flush();
      await this.schedule();
    }
    if (seatChanged) await this.reportLobby();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const user = ws.deserializeAttachment() as Identity;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    const err = await this.handle(ws, user, msg);
    if (err) this.send(ws, { type: 'error', msg: err });
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code === 1006 ? 1000 : code); } catch { /* 已关闭 */ }
    await this.onDisconnect(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.onDisconnect(ws);
  }

  private async onDisconnect(ws: WebSocket) {
    const user = ws.deserializeAttachment() as Identity | null;
    if (!user || !this.info) return;
    const still = this.ctx.getWebSockets(user.id).some((s) => s !== ws && s.readyState === WebSocket.OPEN);
    if (!still && this.info.status === 'playing' && this.seatOf(user.id) != null) {
      this.offline[user.id] = Date.now();
      this.set('offline');
    }
    if (this.openSockets(ws).length === 0) {
      this.cleanupAt = Date.now() + CLEANUP_MS;
      this.set('cleanup');
    }
    this.flush();
    this.broadcastRoom(ws);
    await this.schedule();
  }

  // ---------- 消息处理 ----------

  private async handle(ws: WebSocket, user: Identity, msg: ClientMsg): Promise<string | null> {
    const info = this.info;
    if (!info) return '房间不存在';
    const isHost = user.id === info.hostId;
    const mySeat = this.seatOf(user.id);

    switch (msg.type) {
      case 'hello': {
        this.send(ws, this.roomMsg(user.id));
        if (this.getGame()) this.send(ws, this.gameMsg(user.id, [], true));
        return null;
      }
      case 'emote': {
        if (mySeat == null || typeof msg.e !== 'string') return null;
        const data = JSON.stringify({ type: 'emote', seat: mySeat, e: msg.e.slice(0, 24) } satisfies ServerMsg);
        for (const s of this.openSockets()) s.send(data);
        return null;
      }
      case 'setSeat': {
        if (info.status !== 'waiting') return '对局已开始';
        const seat = info.seats[msg.seat];
        if (!seat) return '座位不存在';
        if (msg.to === 'me') {
          if (seat.kind !== 'empty') return '这个座位已经有人了';
          const prev = mySeat != null ? info.seats[mySeat] : null;
          if (mySeat != null) info.seats[mySeat] = { kind: 'empty' };
          info.seats[msg.seat] = { kind: 'human', userId: user.id, name: user.name, online: true, guest: user.guest, explorer: prev?.kind === 'human' ? prev.explorer : undefined };
        } else {
          if (!isHost) return '只有房主可以设置座位';
          if (msg.to === 'ai') {
            if (seat.kind === 'human') return '请先把玩家移出座位';
            info.seats[msg.seat] = { kind: 'ai', name: this.aiName(), explorer: this.freeExplorer() };
          } else {
            if (seat.kind === 'human' && seat.userId !== user.id) this.kicked(seat.userId);
            info.seats[msg.seat] = { kind: 'empty' };
          }
        }
        return this.afterSeatChange();
      }
      case 'setExplorer': {
        if (info.status !== 'waiting') return '对局已开始';
        const seat = info.seats[msg.seat];
        if (!seat || seat.kind === 'empty') return '座位不存在';
        if (seat.kind === 'human' ? seat.userId !== user.id : !isHost) return '不能替别人选角色';
        if (msg.explorer != null) {
          const ex = EXPLORERS[msg.explorer];
          if (!ex) return '没有这个角色';
          const clash = info.seats.some((s, i) => i !== msg.seat && s.kind !== 'empty' && s.explorer && EXPLORERS[s.explorer]?.board === ex.board);
          if (clash) return '同一张角色板的另一面已经有人选了';
        }
        seat.explorer = msg.explorer ?? undefined;
        return this.afterSeatChange();
      }
      case 'settings': {
        if (!isHost) return '只有房主可以修改设置';
        if (info.status !== 'waiting') return '对局已开始';
        const s = msg.settings ?? {};
        if (s.scenario && (s.scenario === 'random' || SCENARIOS[s.scenario])) info.settings.scenario = s.scenario;
        if (s.mode === 'standard' || s.mode === 'classic') info.settings.mode = s.mode;
        if (msg.maxSeats != null) {
          const n = Math.max(3, Math.min(6, Math.floor(msg.maxSeats)));
          while (info.seats.length < n) info.seats.push({ kind: 'empty' });
          while (info.seats.length > n) {
            const i = info.seats.findLastIndex((x) => x.kind !== 'human');
            if (i < 0) break;
            info.seats.splice(i, 1);
          }
        }
        return this.afterSeatChange();
      }
      case 'kick': {
        if (!isHost) return '只有房主可以踢人';
        if (info.status !== 'waiting') return '对局已开始';
        const seat = info.seats[msg.seat];
        if (!seat || seat.kind !== 'human' || seat.userId === user.id) return '不能移出这个座位';
        this.kicked(seat.userId);
        info.seats[msg.seat] = { kind: 'empty' };
        return this.afterSeatChange();
      }
      case 'leave': {
        if (info.status === 'waiting' && mySeat != null) {
          info.seats[mySeat] = { kind: 'empty' };
          if (isHost) this.passHost(user.id);
          await this.afterSeatChange();
        }
        ws.close(1000, 'leave');
        return null;
      }
      case 'start':
      case 'rematch': {
        if (!isHost) return '只有房主可以开始';
        if (msg.type === 'start' && info.status !== 'waiting') return '对局已开始';
        if (msg.type === 'rematch') {
          if (info.status !== 'ended') return '对局还没结束';
          info.status = 'waiting';
          this.config = null;
          this.game = null;
          this.ctx.storage.sql.exec('DELETE FROM log');
          this.set('config');
          return this.afterSeatChange();
        }
        return this.startGame();
      }
      case 'answer': {
        const game = this.getGame();
        if (!game || info.status !== 'playing') return '对局未开始';
        if (msg.seq !== game.seq) return '操作已过期';
        if (mySeat == null) return '你不在座位上';
        const req = game.pending;
        if (!req) return '对局已结束';
        if (req.seat !== mySeat) return '现在不是你的操作';
        return this.advance(msg.answer);
      }
    }
    return null;
  }

  private afterSeatChange(): Promise<null> {
    this.set('info');
    this.flush();
    this.broadcastRoom();
    return this.reportLobby().then(() => null);
  }

  private kicked(userId: string) {
    for (const s of this.ctx.getWebSockets(userId)) this.send(s, { type: 'error', msg: '你被房主移出了座位' });
  }

  private passHost(oldId: string) {
    const info = this.info!;
    const next = info.seats.find((s) => s.kind === 'human' && s.userId !== oldId);
    if (next && next.kind === 'human') info.hostId = next.userId;
  }

  private aiName(): string {
    const used = new Set(this.info!.seats.map((s) => (s.kind === 'empty' ? '' : s.name)));
    const free = AI_NAMES.filter((n) => !used.has('AI·' + n));
    return 'AI·' + (free[Math.floor(Math.random() * free.length)] ?? String(used.size));
  }

  /** 一个还没被占用角色板的探险者 */
  private freeExplorer(exclude: SeatInfo[] = this.info!.seats): string | undefined {
    const used = new Set(exclude.flatMap((s) => (s.kind !== 'empty' && s.explorer ? [EXPLORERS[s.explorer].board] : [])));
    const free = Object.values(EXPLORERS).filter((e) => !used.has(e.board));
    return free.length ? free[Math.floor(Math.random() * free.length)].id : undefined;
  }

  // ---------- 对局推进 ----------

  private async startGame(): Promise<string | null> {
    const info = this.info!;
    const seats = info.seats.filter((s) => s.kind !== 'empty');
    if (seats.length < 3) return '至少需要 3 名玩家（可以用 AI 补位）';
    if (!seats.some((s) => s.kind === 'human')) return '至少需要 1 名真人玩家';
    // 未选角色的随机分配
    for (const s of seats as Exclude<SeatInfo, { kind: 'empty' }>[]) if (!s.explorer) s.explorer = this.freeExplorer(seats);
    info.seats = seats;
    info.status = 'playing';
    const scenarios = Object.keys(SCENARIOS);
    const scenario = info.settings.scenario === 'random' ? scenarios[Math.floor(Math.random() * scenarios.length)] : info.settings.scenario;
    this.config = {
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      seats: seats.map((s) => (s.kind === 'ai' ? { name: s.name, ai: 'normal' as const, explorer: s.explorer! } : { name: s.kind === 'human' ? s.name : '', explorer: s.kind === 'human' ? s.explorer! : '' })),
      scenario,
      mode: info.settings.mode,
      ...(info.settings.tutorial ? { debugHaunt: 46, protect: seats.flatMap((s, i) => (s.kind === 'human' ? [i] : [])), minHauntRound: 4, firstSeat: 0 } : {}),
    };
    this.game = Game.create(this.config);
    this.timer = null;
    this.offline = {};
    for (const k of ['info', 'config', 'timer', 'offline'] as const) this.set(k);
    this.ctx.storage.sql.exec('DELETE FROM log');
    this.broadcastRoom();
    await this.advance(null, this.game.takeEvents());
    await this.reportLobby();
    return null;
  }

  private async advance(first: Answer | null, initial: GameEvent[] = []): Promise<string | null> {
    const game = this.getGame()!;
    const answers: Answer[] = [];
    const events: GameEvent[] = [...initial];
    if (first) {
      const r = game.answer(first);
      if (!r.ok) {
        this.flush();
        return r.error;
      }
      answers.push(first);
      events.push(...r.events);
      this.pauseAfter(r.events, events);
    } else this.pauseAfter(initial, initial);
    const more = this.autoLoop();
    answers.push(...more.answers);
    events.push(...more.events);
    await this.finishStep(answers, events);
    return null;
  }

  private async finishStep(answers: Answer[], events: GameEvent[]) {
    const game = this.game!;
    if (!game.pending) {
      this.timer = null;
      this.set('timer');
      if (this.info!.status === 'playing') {
        this.info!.status = 'ended';
        this.set('info');
        await this.recordResult();
        this.broadcastRoom();
        await this.reportLobby();
      }
    } else if (this.timer?.seq !== game.seq) {
      this.timer = { seq: game.seq, deadline: Date.now() + animEstimate(events) + Number(this.env.TURN_TIMEOUT_MS || 90000) };
      this.set('timer');
    }
    this.flush(answers);
    this.broadcastGame(events);
    await this.schedule();
  }

  /** AI 座位与已托管的掉线座位连续行动，直到需要在线真人决策 */
  private autoLoop(): { answers: Answer[]; events: GameEvent[] } {
    const game = this.getGame();
    const answers: Answer[] = [];
    const events: GameEvent[] = [];
    if (!game || this.info?.status !== 'playing') return { answers, events };
    if (this.aiAt != null && Date.now() < this.aiAt - 50) return { answers, events };
    this.aiAt = null;
    for (let guard = 0; guard < 3000 && game.pending; guard++) {
      const req = game.pending;
      if (!this.isAuto(req.seat)) break;
      const a = aiAnswer(game, req);
      const r = game.answer(a);
      if (!r.ok) {
        console.error('auto answer rejected', r.error, JSON.stringify(req).slice(0, 500), a);
        break;
      }
      answers.push(a);
      events.push(...r.events);
      if (this.pauseAfter(r.events, events)) break;
    }
    return { answers, events };
  }

  /** 刚开始了一个新回合（或怪物阶段），且接下来还是 AI：停一下再继续 */
  private pauseAfter(stepEvents: GameEvent[], chunk: GameEvent[]): boolean {
    const game = this.game;
    if (!game?.pending || !this.isAuto(game.pending.seat) || !this.anyHumanOnline()) return false;
    if (!stepEvents.some((e) => e.t === 'turn' || e.t === 'monsterPhase')) return false;
    this.aiAt = Date.now() + Math.min(12000, 1500 + animEstimate(chunk));
    return true;
  }

  private isAuto(seat: number): boolean {
    const s = this.info!.seats[seat];
    if (!s || s.kind !== 'human') return true;
    const since = this.offline[s.userId];
    if (since == null) return false;
    return Date.now() - since >= this.takeoverMs() && this.anyHumanOnline();
  }

  private takeoverMs() {
    return Number(this.env.OFFLINE_TAKEOVER_MS || 30000);
  }

  private anyHumanOnline(): boolean {
    return this.info!.seats.some((s) => s.kind === 'human' && this.isOnline(s.userId));
  }

  private isOnline(userId: string) {
    return this.ctx.getWebSockets(userId).some((s) => s.readyState === WebSocket.OPEN);
  }

  private seatDeadline(seat: number): number | null {
    const s = this.info?.seats[seat];
    if (!s || s.kind !== 'human' || !this.timer) return null;
    if (this.info?.settings.tutorial && this.offline[s.userId] == null) return null; // 教学局不限时
    const since = this.offline[s.userId];
    if (since != null && this.anyHumanOnline()) return Math.min(this.timer.deadline, since + this.takeoverMs());
    return this.timer.deadline;
  }

  private async schedule() {
    const times: number[] = [];
    if (this.cleanupAt != null) times.push(this.cleanupAt);
    const req = this.game?.pending;
    if (this.info?.status === 'playing' && req && this.anyHumanOnline()) {
      const d = this.seatDeadline(req.seat);
      if (d != null) times.push(d);
      if (this.aiAt != null) times.push(this.aiAt);
    }
    const want = times.length ? Math.max(Math.min(...times), Date.now() + 100) : null;
    const cur = await this.ctx.storage.getAlarm();
    if (want == null) {
      if (cur != null) await this.ctx.storage.deleteAlarm();
    } else if (cur == null || Math.abs(cur - want) > 500) {
      await this.ctx.storage.setAlarm(want);
    }
  }

  async alarm() {
    const now = Date.now();
    if (this.cleanupAt != null && now >= this.cleanupAt && this.openSockets().length === 0) {
      if (this.info) await lobbyStub(this.env).remove(this.info.id);
      await this.ctx.storage.deleteAll();
      this.info = this.config = this.game = this.timer = null;
      this.offline = {};
      this.cleanupAt = null;
      return;
    }
    const game = this.getGame();
    if (game?.pending && this.info?.status === 'playing') {
      const { answers, events } = this.autoLoop();
      const req = game.pending;
      if (req && this.timer?.seq === game.seq && now >= this.timer.deadline - 50) {
        // 超时：用 AI 的选择代为决定
        const a = aiAnswer(game, req);
        const r = game.answer(a);
        if (r.ok) {
          answers.push(a);
          events.push(...r.events);
          this.pauseAfter(r.events, events);
          const more = this.autoLoop();
          answers.push(...more.answers);
          events.push(...more.events);
        }
      }
      await this.finishStep(answers, events);
      return;
    }
    await this.schedule();
  }

  private async recordResult() {
    const game = this.game!;
    const w = game.state.winner;
    const players = game.state.players.map((p, i) => {
      const s = this.info!.seats[i];
      return { userId: s?.kind === 'human' ? s.userId : undefined, name: p.name, ai: !!p.ai, explorer: p.explorer, side: game.sideOf(i), won: !!w?.seats.includes(i) };
    });
    try {
      await this.env.DB.prepare('INSERT INTO match_results (room_id, finished_at, players) VALUES (?, ?, ?)')
        .bind(this.info!.id, Date.now(), JSON.stringify({ haunt: game.state.haunt?.id ?? null, winner: w?.side ?? null, players })).run();
    } catch (e) {
      console.error('record result failed', e);
    }
  }

  // ---------- 广播 ----------

  private openSockets(except?: WebSocket) {
    return this.ctx.getWebSockets().filter((s) => s !== except && s.readyState === WebSocket.OPEN && s.deserializeAttachment());
  }

  private seatOf(userId: string): number | null {
    const i = this.info?.seats.findIndex((s) => s.kind === 'human' && s.userId === userId) ?? -1;
    return i >= 0 ? i : null;
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* 连接已断 */ }
  }

  private roomMsg(userId: string, except?: WebSocket): ServerMsg {
    const info = this.info!;
    const seats = info.seats.map((s) =>
      s.kind === 'human' ? { ...s, online: this.ctx.getWebSockets(s.userId).some((w) => w !== except && w.readyState === WebSocket.OPEN) } : s,
    );
    return { type: 'room', room: { ...info, seats }, you: this.seatOf(userId) };
  }

  /** 唯一的对局出口：按座位过滤状态、事件、决策 */
  private gameMsg(userId: string, events: GameEvent[], full: boolean): ServerMsg {
    const game = this.game!;
    const you = this.seatOf(userId);
    const view = game.viewFor(you);
    const req = game.pending;
    let pending: PendingView | null = null;
    if (req) {
      const mine = you != null && req.seat === you;
      const deadline = this.seatDeadline(req.seat);
      pending = mine ? { mine: true, req, deadline } : { mine: false, kind: req.kind, seat: req.seat, deadline };
    }
    return {
      type: 'game', seq: game.seq, full, you, pending,
      events: events.filter((e) => Game.visible(e, view.side, you)),
      state: view.state, brief: view.brief, side: view.side,
    };
  }

  private broadcastRoom(except?: WebSocket) {
    for (const ws of this.openSockets(except)) {
      const u = ws.deserializeAttachment() as Identity;
      this.send(ws, this.roomMsg(u.id, except));
    }
  }

  private broadcastGame(events: GameEvent[]) {
    if (!this.game) return;
    for (const ws of this.openSockets()) {
      const u = ws.deserializeAttachment() as Identity;
      this.send(ws, this.gameMsg(u.id, events, false));
    }
  }

  private async reportLobby() {
    const info = this.info;
    if (!info) return;
    const host = info.seats.find((s) => s.kind === 'human' && s.userId === info.hostId);
    const summary: RoomSummary = {
      id: info.id, code: info.code, name: info.name,
      host: host?.kind === 'human' ? host.name : '',
      status: info.status,
      humans: info.seats.filter((s) => s.kind === 'human').length,
      ais: info.seats.filter((s) => s.kind === 'ai').length,
      maxSeats: info.seats.length,
      updatedAt: Date.now(),
    };
    try {
      await lobbyStub(this.env).upsert(summary);
    } catch (e) {
      console.error('lobby upsert failed', e);
    }
  }
}

/** 客户端播放这些事件动画的大致时长，用于放宽真人决策的截止时间 */
function animEstimate(events: GameEvent[]): number {
  let ms = 0;
  for (const e of events) {
    if (e.t === 'move') ms += 250 * e.path.length;
    else if (e.t === 'roll' || e.t === 'hauntRoll' || e.t === 'attack') ms += 1400;
    else if (e.t === 'card') ms += 1800;
    else if (e.t === 'haunt') ms += 8000;
    else if (e.t === 'tile') ms += 700;
    else ms += 100;
  }
  return Math.min(ms, 60e3);
}
