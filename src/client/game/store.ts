import { signal } from '@preact/signals';
import type { ServerMsg } from '../../shared/protocol';
import { parseKey, type Floor, type GameEvent } from '../../shared/types';
import { describe, type LogLine } from './describe';
import { sfx } from '../audio';

export type GameMsg = Extract<ServerMsg, { type: 'game' }>;

export type Overlay =
  | { kind: 'roll'; e: Extract<GameEvent, { t: 'roll' }> }
  | { kind: 'hauntRoll'; e: Extract<GameEvent, { t: 'hauntRoll' }> }
  | { kind: 'attack'; e: Extract<GameEvent, { t: 'attack' }> }
  | { kind: 'card'; e: Extract<GameEvent, { t: 'card' }> }
  | { kind: 'haunt'; e: Extract<GameEvent, { t: 'haunt' }> }
  | { kind: 'end'; e: Extract<GameEvent, { t: 'end' }> };

export const game = signal<GameMsg | null>(null);
export const logLines = signal<LogLine[]>([]);
export const overlay = signal<Overlay | null>(null);
export const focusFloor = signal<Floor>('G');
export const fast = signal<boolean>(localStorage.getItem('ghost-fast') === '1');
/** 当前回合事件中最近一次移动的格子（地图高亮用） */
export const lastMoved = signal<string | null>(null);

const queue: Overlay[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

export function setFast(v: boolean) {
  fast.value = v;
  localStorage.setItem('ghost-fast', v ? '1' : '0');
}

function duration(o: Overlay): number | null {
  const k = fast.value ? 0.5 : 1;
  switch (o.kind) {
    case 'roll': return 1500 * k;
    case 'hauntRoll': return 2600 * k;
    case 'attack': return 2200 * k;
    case 'card': return o.e.how === 'event' ? 3600 * k : 2200 * k;
    case 'haunt': return null; // 需要点击
    case 'end': return null;
  }
}

function playNext() {
  clearTimeout(timer);
  const o = queue.shift() ?? null;
  overlay.value = o;
  if (!o) return;
  if (o.kind === 'roll' || o.kind === 'hauntRoll' || o.kind === 'attack') sfx('dice');
  if (o.kind === 'card') sfx('card');
  if (o.kind === 'haunt') sfx('haunt');
  const d = duration(o);
  if (d != null && !document.hidden) timer = setTimeout(playNext, d);
  else if (d != null) playNext();
}

export function dismissOverlay() {
  playNext();
}

export function resetGame() {
  queue.length = 0;
  clearTimeout(timer);
  overlay.value = null;
  game.value = null;
  logLines.value = [];
}

export function onGameMsg(m: GameMsg) {
  const prev = game.value;
  game.value = m;
  const s = m.state;
  if (m.full || !prev) {
    if (!logLines.value.length) logLines.value = [{ id: 0, text: '已连接到这栋房子。', tone: 'info' }];
    const me = m.you != null ? s.players[m.you] : null;
    focusFloor.value = me ? parseKey(me.tile).floor : 'G';
    if (s.winner && !overlay.value) {
      queue.push({ kind: 'end', e: { t: 'end', winner: s.winner } });
      playNext();
    }
    return;
  }
  const lines: LogLine[] = [];
  const startIdle = overlay.value == null && queue.length === 0;
  for (const e of m.events) {
    const l = describe(e, s);
    if (l) lines.push(l);
    switch (e.t) {
      case 'roll': queue.push({ kind: 'roll', e }); break;
      case 'hauntRoll': queue.push({ kind: 'hauntRoll', e }); break;
      case 'attack': queue.push({ kind: 'attack', e }); break;
      case 'card': if (e.how !== 'gain') queue.push({ kind: 'card', e }); break;
      case 'haunt': queue.push({ kind: 'haunt', e }); break;
      case 'end': queue.push({ kind: 'end', e }); break;
      case 'turn': {
        const p = s.players[e.seat];
        if (p) focusFloor.value = parseKey(p.tile).floor;
        if (e.seat === m.you) sfx('turn');
        break;
      }
      case 'move': {
        const to = e.path[e.path.length - 1];
        lastMoved.value = to;
        if (e.seat != null && e.seat === s.turn) focusFloor.value = parseKey(to).floor;
        sfx('step');
        break;
      }
      case 'place': lastMoved.value = e.to; if (e.seat === m.you) focusFloor.value = parseKey(e.to).floor; break;
      case 'tile': sfx('door'); break;
      case 'trait': if (e.seat === m.you) sfx(e.to > e.from ? 'gain' : 'hurt'); break;
      case 'death': sfx('lose'); break;
    }
  }
  if (lines.length) logLines.value = [...logLines.value, ...lines].slice(-300);
  if (startIdle && queue.length) playNext();
}

/** 动画是否还在播放（播放期间不弹出决策） */
export function animating(): boolean {
  return overlay.value != null && overlay.value.kind !== 'end';
}
