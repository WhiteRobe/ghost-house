import { useEffect, useState } from 'preact/hooks';
import { TRAIT_NAME, type GameState } from '../../shared/types';
import type { Brief, RoomInfo } from '../../shared/protocol';
import { CARDS, SCENARIOS } from '../../content';
import { CardView, Die } from './parts';
import { dismissOverlay, overlay, fast } from './store';
import { seatName, targetName } from './describe';
import { art, SIDE_NAME } from '../art';
import { Img } from '../ui/common';
import { sfx } from '../audio';

function useRolling(ms = 650) {
  const [r, setR] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setR(false), fast.value ? ms / 2 : ms);
    return () => clearTimeout(t);
  }, []);
  return r;
}

function Dice({ dice }: { dice: number[] }) {
  const rolling = useRolling();
  const [fake, setFake] = useState(dice.map(() => 0));
  useEffect(() => {
    if (!rolling) return;
    const t = setInterval(() => setFake(dice.map(() => Math.floor(Math.random() * 3))), 70);
    return () => clearInterval(t);
  }, [rolling]);
  return <div class="dice-row">{(rolling ? fake : dice).map((v) => <Die v={v} rolling={rolling} />)}{!dice.length && <span class="muted">（没有骰子）</span>}</div>;
}

export function OverlayLayer({ s, you, side, brief, onOpenBrief, room, onRematch, onLeave, isHost }: {
  s: GameState; you: number | null; side: string | null; brief: Brief | null; onOpenBrief: () => void;
  room: RoomInfo; onRematch: () => void; onLeave: () => void; isHost: boolean;
}) {
  const o = overlay.value;
  if (!o) return null;
  const close = () => dismissOverlay();
  switch (o.kind) {
    case 'roll': {
      const e = o.e;
      return (
        <div class="ov ov-roll" onClick={close}>
          <div class="ov-box">
            <div class="ov-who">{e.seat != null ? seatName(s, e.seat) : ''}</div>
            <div class="ov-label">{e.label}</div>
            <Dice dice={e.dice} />
            <div class={`ov-total ${e.ok === false ? 'bad' : e.ok ? 'good' : ''}`}>{e.total}{e.ok != null ? (e.ok ? ' 成功' : ' 失败') : ''}</div>
          </div>
        </div>
      );
    }
    case 'hauntRoll': {
      const e = o.e;
      return (
        <div class="ov ov-roll haunt" onClick={close}>
          <div class="ov-box">
            <div class="ov-label">异变检定 · {e.need}</div>
            <Dice dice={e.dice} />
            <div class={`ov-total ${e.ok ? 'bad' : ''}`}>{e.total}{e.ok ? ' —— 房子醒了' : ' —— 还在沉睡'}</div>
          </div>
        </div>
      );
    }
    case 'attack': {
      const e = o.e;
      return (
        <div class="ov ov-roll" onClick={close}>
          <div class="ov-box wide">
            <div class="ov-label">⚔ {targetName(s, e.from)} 攻击 {targetName(s, e.to)} · {TRAIT_NAME[e.trait]}</div>
            <div class="vs">
              <div><div class="muted small">{targetName(s, e.from)}</div><Dice dice={e.a} /><b>{e.a.reduce((a, b) => a + b, 0)}</b></div>
              <div class="vs-x">VS</div>
              <div><div class="muted small">{targetName(s, e.to)}</div><Dice dice={e.d} /><b>{e.d.reduce((a, b) => a + b, 0)}</b></div>
            </div>
            <div class="ov-total bad">{e.loser ? `${targetName(s, e.loser)} 受到 ${e.damage} 点伤害` : '势均力敌'}</div>
          </div>
        </div>
      );
    }
    case 'card': {
      const e = o.e;
      const c = CARDS[e.card];
      return (
        <div class="ov ov-card" onClick={close}>
          <div class="ov-box">
            <div class="ov-who">{seatName(s, e.seat)} {e.how === 'event' ? '遭遇了' : '找到了'}</div>
            <CardView id={e.card} />
            {c?.kind === 'omen' && <div class="ov-hint">凶兆出现了……</div>}
            <div class="muted tiny">点击继续</div>
          </div>
        </div>
      );
    }
    case 'haunt': {
      const e = o.e;
      const h = s.haunt;
      const mySide = side === 'traitor' ? '背叛者' : brief?.side === 'solo' ? '各自为战' : '幸存者';
      return (
        <div class="ov ov-haunt">
          <div class="ov-box haunt-box">
            <div class="haunt-kicker">异变 · 第 {e.id} 号</div>
            <h2 class="haunt-title">{e.title}</h2>
            <div class="haunt-art"><Img src={art.ui('haunt')} /></div>
            <p class="haunt-intro">{h?.intro}</p>
            <div class="haunt-who">
              揭示者：<b>{seatName(s, e.revealer)}</b>
              {e.traitor != null ? <> · 背叛者：<b class="bad">{seatName(s, e.traitor)}</b></> : h?.type === 'hidden' ? <> · 背叛者藏在你们之中</> : h?.type === 'coop' ? <> · 没有背叛者，所有人必须合作</> : h?.type === 'ffa' ? <> · 每个人都只为自己</> : null}
            </div>
            {you != null && <div class={`haunt-side side-${side}`}>你是 <b>{mySide}</b></div>}
            <div class="row center-row">
              <button class="btn primary big" onClick={() => { sfx('click'); close(); onOpenBrief(); }}>打开我的手册</button>
            </div>
          </div>
        </div>
      );
    }
    case 'end':
      return <EndBox s={s} you={you} w={o.e.winner} room={room} isHost={isHost} onRematch={onRematch} onLeave={onLeave} close={close} />;
  }
}

function EndBox({ s, you, w, room, isHost, onRematch, onLeave, close }: {
  s: GameState; you: number | null; w: NonNullable<GameState['winner']>; room: RoomInfo; isHost: boolean; onRematch: () => void; onLeave: () => void; close: () => void;
}) {
      const iWon = you != null && w.seats.includes(you);
      useEffect(() => sfx(iWon ? 'win' : 'lose'), []);
      return (
        <div class="ov ov-end">
          <div class="ov-box haunt-box">
            <div class="haunt-kicker">{s.haunt ? `异变 · ${s.haunt.title}` : SCENARIOS[s.scenario]?.name}</div>
            <h2 class="haunt-title">{w.title}</h2>
            {you != null && <div class={`haunt-side ${iWon ? 'good' : 'bad'}`}>{iWon ? '你活了下来' : w.side === 'none' ? '无人获胜' : '你输了'}</div>}
            <p class="haunt-intro">{w.text}</p>
            {room.settings.tutorial && <div class="tutorial-done">🎓 新手教程完成！回到大厅就可以创建房间，邀请朋友一起玩了。</div>}
            <div class="muted">获胜：{w.seats.map((x) => seatName(s, x)).join('、') || '无'}</div>
            <div class="end-players">
              {s.players.map((p) => (
                <span class={`tag ${w.seats.includes(p.seat) ? 'ok' : ''}`}>{p.name}{p.side ? ' · ' + SIDE_NAME[p.side] : ''}{p.dead ? ' ☠' : ''}</span>
              ))}
            </div>
            <div class="row center-row">
              <button class="btn ghost" onClick={close}>看看地图</button>
              {isHost && room.status === 'ended' && <button class="btn primary" onClick={onRematch}>再来一局</button>}
              <button class="btn ghost" onClick={onLeave}>回大厅</button>
            </div>
          </div>
        </div>
      );
    }
