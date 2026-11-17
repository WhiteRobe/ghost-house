import { CARDS, EXPLORERS, ROOMS } from '../../content';
import { CARD_KIND_NAME, TRAIT_NAME, type GameEvent, type GameState, type Target } from '../../shared/types';

export interface LogLine {
  id: number;
  text: string;
  tone?: 'good' | 'bad' | 'info' | 'haunt' | 'turn';
  seat?: number;
}

let nextId = 1;

export function roomName(s: GameState, key: string): string {
  const t = s.tiles[key];
  return t ? ROOMS[t.room]?.name ?? '？' : '？';
}

export function seatName(s: GameState, seat: number | undefined): string {
  if (seat == null || seat < 0) return '';
  return s.players[seat]?.name ?? '';
}

export function targetName(s: GameState, t: Target): string {
  if ('seat' in t) return seatName(s, t.seat);
  return s.monsters.find((m) => m.id === t.monster)?.name ?? '怪物';
}

export function explorerOf(s: GameState, seat: number) {
  return EXPLORERS[s.players[seat]?.explorer];
}

/** 事件 -> 日志行（不需要显示的返回 null） */
export function describe(e: GameEvent, s: GameState): LogLine | null {
  const L = (text: string, tone?: LogLine['tone'], seat?: number): LogLine => ({ id: nextId++, text, tone, seat });
  switch (e.t) {
    case 'turn': return L(`—— 第 ${e.round} 轮 · ${seatName(s, e.seat)} 的回合 ——`, 'turn', e.seat);
    case 'monsterPhase': return L('—— 怪物行动 ——', 'turn');
    case 'log': return L(e.text, e.tone, e.seat);
    case 'roll': {
      const who = e.seat != null ? seatName(s, e.seat) + ' ' : '';
      const res = e.ok == null ? '' : e.ok ? ' ✓ 成功' : ' ✗ 失败';
      return L(`🎲 ${who}${e.label}：[${e.dice.join(' ')}] = ${e.total}${res}`, e.ok === false ? 'bad' : e.ok ? 'good' : 'info', e.seat);
    }
    case 'hauntRoll': return L(`🎲 异变检定（${e.need}）：[${e.dice.join(' ')}] = ${e.total} ${e.ok ? '—— 异变降临！' : ''}`, 'haunt', e.seat);
    case 'trait': {
      const ex = explorerOf(s, e.seat);
      const v = (i: number) => (i <= 0 ? '☠' : ex?.tracks[e.trait][i - 1]);
      const up = e.to > e.from;
      return L(`${seatName(s, e.seat)} ${TRAIT_NAME[e.trait]} ${v(e.from)} → ${v(e.to)}`, up ? 'good' : 'bad', e.seat);
    }
    case 'lose': {
      const c = CARDS[e.card];
      return L(e.to != null ? `「${c?.name}」从 ${seatName(s, e.seat)} 转到 ${seatName(s, e.to)}` : `${seatName(s, e.seat)} 失去了「${c?.name}」`, 'info', e.seat);
    }
    case 'card': {
      if (e.how !== 'gain') return null;
      const c = CARDS[e.card];
      return L(`${seatName(s, e.seat)} 获得${CARD_KIND_NAME[c?.kind ?? 'item']}「${c?.name}」`, 'info', e.seat);
    }
    case 'place': {
      const who = e.seat != null ? seatName(s, e.seat) : s.monsters.find((m) => m.id === e.monster)?.name ?? '';
      return L(`${e.text ? e.text + '：' : ''}${who} 来到了「${roomName(s, e.to)}」`, 'info', e.seat);
    }
    case 'attack': {
      const dmg = e.loser ? `，${targetName(s, e.loser)} 受到 ${e.damage} 点伤害` : '，不分胜负';
      return L(`⚔ ${targetName(s, e.from)} 对 ${targetName(s, e.to)}（${TRAIT_NAME[e.trait]}）：[${e.a.join(' ')}] 对 [${e.d.join(' ')}]${dmg}`, 'bad');
    }
    case 'death': return L(`☠ ${seatName(s, e.seat)} 倒下了`, 'bad', e.seat);
    case 'stun': return null;
    case 'haunt': return L(`★ 异变：${e.title}`, 'haunt');
    case 'end': return L(`★ ${e.winner.title}`, 'haunt');
    default: return null;
  }
}
