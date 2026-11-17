// 对局界面的小组件：卡牌、属性轨、玩家列表、骰子。
import { CARDS, EXPLORERS } from '../../content';
import { CARD_KIND_NAME, TRAITS, TRAIT_NAME, traitValue, type GameState, type PlayerState, type Trait } from '../../shared/types';
import type { SeatInfo } from '../../shared/protocol';
import { art, SIDE_NAME } from '../art';
import { Img } from '../ui/common';

export function CardView({ id, small, onClick, selected }: { id: string; small?: boolean; onClick?: () => void; selected?: boolean }) {
  const c = CARDS[id];
  if (!c) return null;
  return (
    <div class={`gcard kind-${c.kind} ${small ? 'small' : ''} ${onClick ? 'pickable' : ''} ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div class="gcard-art"><Img src={art.card(id)} /></div>
      <div class="gcard-body">
        <div class="gcard-kind">{CARD_KIND_NAME[c.kind]}{c.weapon ? ' · 武器' : ''}{c.bound ? ' · 伙伴' : ''}</div>
        <div class="gcard-name">{c.name}</div>
        {!small && <div class="gcard-text">{c.text}</div>}
        {!small && c.flavor && <div class="gcard-flavor">{c.flavor}</div>}
      </div>
    </div>
  );
}

export function Portrait({ explorer, size = 40, dead }: { explorer: string; size?: number; dead?: boolean }) {
  const ex = EXPLORERS[explorer];
  return (
    <div class={`portrait ${dead ? 'dead' : ''}`} style={{ width: `${size}px`, height: `${size}px`, background: ex?.color }}>
      <span>{ex?.name.slice(0, 1)}</span>
      <Img src={art.explorer(explorer)} />
    </div>
  );
}

const SHORT: Record<Trait, string> = { speed: '速', might: '力', sanity: '理', knowledge: '知' };

export function TraitChips({ p }: { p: PlayerState }) {
  const ex = EXPLORERS[p.explorer];
  return (
    <div class="trait-chips">
      {TRAITS.map((t) => {
        const v = traitValue(ex.tracks[t], p.traits[t]);
        const low = p.traits[t] <= 1;
        return <span class={`chip t-${t} ${low ? 'low' : ''}`} title={TRAIT_NAME[t]}>{SHORT[t]}{p.traits[t] === 0 ? '☠' : v}</span>;
      })}
    </div>
  );
}

/** 完整属性轨 */
export function TraitTracks({ p }: { p: PlayerState }) {
  const ex = EXPLORERS[p.explorer];
  return (
    <div class="tracks">
      {TRAITS.map((t) => (
        <div class={`track t-${t}`}>
          <span class="track-name">{TRAIT_NAME[t]}</span>
          <span class={`cell skull ${p.traits[t] === 0 ? 'cur' : ''}`}>☠</span>
          {ex.tracks[t].map((v, i) => (
            <span class={`cell ${p.traits[t] === i + 1 ? 'cur' : ''} ${ex.start[t] === i + 1 ? 'start' : ''} ${i === 0 ? 'crit' : ''}`}>{v}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PlayerList({ s, you, seats, onPick, waiting }: { s: GameState; you: number | null; seats: SeatInfo[]; onPick?: (seat: number) => void; waiting: number | null }) {
  return (
    <div class="plist">
      {s.players.map((p) => {
        const seat = seats[p.seat];
        const offline = seat?.kind === 'human' && !seat.online;
        const ex = EXPLORERS[p.explorer];
        return (
          <div class={`prow ${s.turn === p.seat ? 'turn' : ''} ${p.dead ? 'dead' : ''} ${p.seat === you ? 'me' : ''}`} onClick={() => onPick?.(p.seat)}>
            <Portrait explorer={p.explorer} size={38} dead={p.dead} />
            <div class="prow-main">
              <div class="prow-name">
                <b>{p.name}</b>
                {p.ai && <span class="tag tiny">AI</span>}
                {offline && <span class="tag tiny warn">离线</span>}
                {p.side && s.phase !== 'explore' && <span class={`tag tiny side-${p.side}`}>{SIDE_NAME[p.side]}</span>}
                {p.flags.escaped && <span class="tag tiny ok">已逃出</span>}
                {waiting === p.seat && <span class="thinking">…</span>}
              </div>
              <div class="muted tiny">{ex?.name} · 🃏{p.cards.length}</div>
              <TraitChips p={p} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 一颗鬼屋骰：0/1/2 个点 */
export function Die({ v, rolling }: { v: number; rolling?: boolean }) {
  return (
    <span class={`die ${rolling ? 'rolling' : ''}`}>
      {Array.from({ length: v }, () => <i />)}
    </span>
  );
}
