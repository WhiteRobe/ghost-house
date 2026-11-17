// 各类决策的界面（只在轮到我、且动画播放完时出现）
import { useState } from 'preact/hooks';
import { CARDS, ROOMS } from '../../content';
import { TRAIT_NAME, TRAITS, traitValue, type Answer, type GameState, type Request, type Target, type Trait } from '../../shared/types';
import { EXPLORERS } from '../../content';
import { Modal } from '../ui/common';
import { CardView, Portrait } from './parts';
import { roomName, seatName, targetName } from './describe';
import { sfx } from '../audio';

type Send = (a: Answer) => void;

export function DamageModal({ s, req, send }: { s: GameState; req: Extract<Request, { kind: 'damage' }>; send: Send }) {
  const traits = TRAITS.filter((t) => req.caps[t]);
  const [alloc, setAlloc] = useState<Partial<Record<Trait, number>>>({});
  const used = traits.reduce((a, t) => a + (alloc[t] ?? 0), 0);
  const p = s.players[req.seat];
  const ex = EXPLORERS[p.explorer];
  const left = req.amount - used;
  return (
    <Modal title={`分配 ${req.amount} 点伤害`}>
      {req.reason && <div class="muted">{req.reason}</div>}
      <div class="dmg-rows">
        {traits.map((t) => {
          const a = alloc[t] ?? 0;
          const after = p.traits[t] - a;
          return (
            <div class="dmg-row">
              <span class="dmg-name">{TRAIT_NAME[t]}</span>
              <span class="dmg-val">{traitValue(ex.tracks[t], p.traits[t])} → <b class={after <= 0 ? 'bad' : ''}>{after <= 0 ? '☠' : traitValue(ex.tracks[t], after)}</b></span>
              <button class="btn small ghost" disabled={a <= 0} onClick={() => setAlloc({ ...alloc, [t]: a - 1 })}>－</button>
              <b class="dmg-n">{a}</b>
              <button class="btn small ghost" disabled={left <= 0 || a >= (req.caps[t] ?? 0)} onClick={() => setAlloc({ ...alloc, [t]: a + 1 })}>＋</button>
            </div>
          );
        })}
      </div>
      <div class="row end">
        <span class="muted">还需分配 {left} 点</span>
        <button class="btn primary" disabled={left !== 0} onClick={() => send({ kind: 'damage', alloc })}>确定</button>
      </div>
    </Modal>
  );
}

export function ChooseModal({ req, send }: { req: Extract<Request, { kind: 'choose' }>; send: Send }) {
  return (
    <Modal title="做出选择">
      {req.card && <div class="center" style={{ marginBottom: '10px' }}><CardView id={req.card} /></div>}
      <p class="prompt">{req.prompt}</p>
      <div class="col">
        {req.options.map((o, i) => (
          <button class="btn ghost choice" onClick={() => { sfx('click'); send({ kind: 'choose', i }); }}>
            <b>{o.label}</b>{o.desc && <span class="muted small"> {o.desc}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function PlayerModal({ s, req, send }: { s: GameState; req: Extract<Request, { kind: 'player' }>; send: Send }) {
  return (
    <Modal title="选择一名玩家">
      <p class="prompt">{req.prompt}</p>
      <div class="col">
        {req.seats.map((seat) => (
          <button class="btn ghost choice row" onClick={() => send({ kind: 'player', seat })}>
            <Portrait explorer={s.players[seat].explorer} size={30} /> {seatName(s, seat)}
            <span class="muted small">（{roomName(s, s.players[seat].tile)}）</span>
          </button>
        ))}
        {req.optional && <button class="btn ghost" onClick={() => send({ kind: 'player', seat: null })}>不选</button>}
      </div>
    </Modal>
  );
}

export function CardModal({ req, send }: { req: Extract<Request, { kind: 'card' }>; send: Send }) {
  return (
    <Modal title="选择一张卡">
      <p class="prompt">{req.prompt}</p>
      <div class="card-grid">
        {req.cards.map((c) => <CardView id={c} onClick={() => send({ kind: 'card', card: c })} />)}
      </div>
      {req.optional && <div class="row end"><button class="btn ghost" onClick={() => send({ kind: 'card', card: null })}>不选</button></div>}
    </Modal>
  );
}

export function TradeAskModal({ s, req, send }: { s: GameState; req: Extract<Request, { kind: 'trade' }>; send: Send }) {
  return (
    <Modal title={`${seatName(s, req.from)} 想和你交易`}>
      <div class="trade-cols">
        <div><div class="label">你会得到</div><div class="card-grid">{req.give.length ? req.give.map((c) => <CardView id={c} small />) : <span class="muted">（无）</span>}</div></div>
        <div><div class="label">你要交出</div><div class="card-grid">{req.take.length ? req.take.map((c) => <CardView id={c} small />) : <span class="muted">（无）</span>}</div></div>
      </div>
      <div class="row end">
        <button class="btn ghost" onClick={() => send({ kind: 'trade', ok: false })}>拒绝</button>
        <button class="btn primary" onClick={() => send({ kind: 'trade', ok: true })}>同意</button>
      </div>
    </Modal>
  );
}

/** 发起交易 */
export function TradeModal({ s, req, send, onClose }: { s: GameState; req: Extract<Request, { kind: 'turn' }>; send: Send; onClose: () => void }) {
  const [who, setWho] = useState(req.trades[0]?.seat ?? -1);
  const [give, setGive] = useState<string[]>([]);
  const [take, setTake] = useState<string[]>([]);
  const opt = req.trades.find((t) => t.seat === who);
  const tog = (arr: string[], set: (x: string[]) => void, c: string) => set(arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c]);
  return (
    <Modal title="交易" onClose={onClose}>
      <div class="seg">{req.trades.map((t) => <button class={t.seat === who ? 'on' : ''} onClick={() => { setWho(t.seat); setTake([]); }}>{seatName(s, t.seat)}</button>)}</div>
      <div class="trade-cols">
        <div><div class="label">我给出</div><div class="card-grid">{req.tradeable.map((c) => <CardView id={c} small selected={give.includes(c)} onClick={() => tog(give, setGive, c)} />)}</div></div>
        <div><div class="label">我想要</div><div class="card-grid">{opt?.theirs.map((c) => <CardView id={c} small selected={take.includes(c)} onClick={() => tog(take, setTake, c)} />)}</div></div>
      </div>
      <div class="row end">
        <button class="btn primary" disabled={!give.length && !take.length} onClick={() => { send({ kind: 'turn', a: 'trade', with: who, give, take }); onClose(); }}>发出交易</button>
      </div>
    </Modal>
  );
}

/** 攻击：选目标与武器 */
export function AttackModal({ s, req, send, onClose }: { s: GameState; req: Extract<Request, { kind: 'turn' }>; send: Send; onClose: () => void }) {
  return (
    <Modal title="攻击" onClose={onClose}>
      <div class="col">
        {req.attacks.map((a) => (
          <div class="attack-opt">
            <b>{a.label}</b>
            <div class="row wrap">
              {!a.ranged && <button class="btn small primary" onClick={() => { send({ kind: 'turn', a: 'attack', target: a.target }); onClose(); }}>徒手</button>}
              {a.weapons.map((w) => (
                <button class="btn small primary" onClick={() => { send({ kind: 'turn', a: 'attack', target: a.target, weapon: w }); onClose(); }}>
                  用「{CARDS[w].name}」（{TRAIT_NAME[CARDS[w].weapon!.trait]} +{CARDS[w].weapon!.dice}）
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function LootModal({ s, req, send, onClose }: { s: GameState; req: Extract<Request, { kind: 'turn' }>; send: Send; onClose: () => void }) {
  return (
    <Modal title="搜刮遗体" onClose={onClose}>
      {req.loot.map((l) => (
        <div>
          <div class="label">{seatName(s, l.seat)} 的遗物（拿一件）</div>
          <div class="card-grid">{l.cards.map((c) => <CardView id={c} small onClick={() => { send({ kind: 'turn', a: 'loot', from: l.seat, card: c }); onClose(); }} />)}</div>
        </div>
      ))}
    </Modal>
  );
}

/** 怪物阶段面板 */
export function MonsterBar({ s, req, send, sel, setSel }: { s: GameState; req: Extract<Request, { kind: 'monster' }>; send: Send; sel: number | null; setSel: (id: number | null) => void }) {
  const cur = req.monsters.find((m) => m.id === sel);
  return (
    <div class="actionbar">
      <div class="ab-title">怪物行动 · 选择一只怪物</div>
      <div class="row wrap">
        {req.monsters.map((m) => {
          const mon = s.monsters.find((x) => x.id === m.id);
          return (
            <button class={`btn small ${sel === m.id ? 'primary' : 'ghost'}`} onClick={() => setSel(m.id)}>
              {mon?.name}（{roomName(s, mon?.tile ?? '')}，移动 {m.moveLeft}）
            </button>
          );
        })}
      </div>
      {cur && (
        <div class="row wrap">
          {Object.keys(cur.moves).length > 0 && <span class="muted small">点击地图上高亮的房间移动</span>}
          {cur.attacks.map((a) => (
            <button class="btn small primary" onClick={() => send({ kind: 'monster', a: 'attack', id: cur.id, target: a.target })}>攻击 {targetName(s, a.target)}</button>
          ))}
        </div>
      )}
      <div class="row end"><button class="btn" onClick={() => send({ kind: 'monster', a: 'end' })}>结束怪物行动</button></div>
    </div>
  );
}

export function RotateBar({ req, rot, setRot, send }: { req: Extract<Request, { kind: 'rotate' }>; rot: number; setRot: (r: number) => void; send: Send }) {
  const i = Math.max(0, req.rots.indexOf(rot));
  const room = ROOMS[req.room];
  return (
    <div class="actionbar">
      <div class="ab-title">发现了「{room.name}」· 选择朝向</div>
      <div class="muted small">{room.text}</div>
      <div class="row">
        <button class="btn ghost" onClick={() => setRot(req.rots[(i - 1 + req.rots.length) % req.rots.length])}>⟲ 转</button>
        <button class="btn ghost" onClick={() => setRot(req.rots[(i + 1) % req.rots.length])}>转 ⟳</button>
        <span class="spacer" />
        <button class="btn primary" onClick={() => send({ kind: 'rotate', rot: req.rots[i] })}>就这样放</button>
      </div>
    </div>
  );
}

export const targetKey = (t: Target) => ('seat' in t ? `p${t.seat}` : `m${t.monster}`);
