import { useEffect, useMemo, useState } from 'preact/hooks';
import { ROOMS, CARDS } from '../../content';
import { FLOORS, FLOOR_NAME, parseKey, type Answer, type Floor, type Request } from '../../shared/types';
import type { ClientMsg, RoomInfo } from '../../shared/protocol';
import { MapView } from './MapView';
import { game, logLines, focusFloor, overlay, fast, setFast, animating } from './store';
import { CardView, PlayerList, TraitTracks, Portrait } from './parts';
import { AttackModal, CardModal, ChooseModal, DamageModal, LootModal, MonsterBar, PlayerModal, RotateBar, TradeAskModal, TradeModal } from './Decisions';
import { OverlayLayer } from './Overlays';
import { roomName, seatName } from './describe';
import { Modal, SoundButton, TimerRing } from '../ui/common';
import { SIDE_NAME } from '../art';
import { startMusic, sfx } from '../audio';
import { toast } from '../store';

const KIND_WAIT: Record<string, string> = {
  turn: '行动', rotate: '摆放房间', damage: '分配伤害', choose: '做选择', tile: '选择房间', player: '选择玩家', card: '选择卡牌', trade: '考虑交易', monster: '指挥怪物',
};

export function GameView({ room, send, isHost, onLeave }: { room: RoomInfo; send: (m: ClientMsg) => void; isHost: boolean; onLeave: () => void }) {
  const m = game.value!;
  const s = m.state;
  const you = m.you;
  const me = you != null ? s.players[you] : null;
  const busy = animating();
  const req = m.pending?.mine && !busy ? m.pending.req : null;
  const [modal, setModal] = useState<'trade' | 'attack' | 'loot' | 'brief' | 'cards' | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [rot, setRot] = useState(0);
  const [monSel, setMonSel] = useState<number | null>(null);
  const [side, setSide] = useState<'players' | 'log'>('players');
  const [drawer, setDrawer] = useState(false);
  const floor = focusFloor.value;

  useEffect(() => startMusic(s.phase === 'haunt' ? 'haunt' : s.phase === 'end' ? null : 'explore'), [s.phase]);
  useEffect(() => { if (req?.kind === 'rotate') setRot(req.rots[0]); }, [m.seq]);
  useEffect(() => { if (req?.kind === 'monster' && !req.monsters.some((x) => x.id === monSel)) setMonSel(req.monsters[0]?.id ?? null); }, [m.seq]);
  // 需要我决策时，把地图切到相关楼层
  useEffect(() => {
    if (!req) return;
    const key = req.kind === 'rotate' ? req.tile : req.kind === 'tile' ? req.tiles[0] : req.kind === 'turn' ? me?.tile : null;
    if (key) focusFloor.value = parseKey(key).floor;
  }, [m.seq, busy]);

  const answer = (a: Answer) => {
    sfx('click');
    send({ type: 'answer', seq: m.seq, answer: a });
  };

  // 地图交互参数
  const mapProps = useMemo(() => {
    if (!req) return {};
    if (req.kind === 'turn') return { moves: req.moves, explore: req.explore, exploreFrom: me?.tile, focus: me?.tile };
    if (req.kind === 'rotate') return { ghost: { key: req.tile, room: req.room, rot }, focus: req.tile };
    if (req.kind === 'tile') return { pick: req.tiles, focus: req.tiles[0] };
    if (req.kind === 'monster') {
      const cur = req.monsters.find((x) => x.id === monSel);
      return { moves: cur?.moves, pick: req.monsters.map((x) => 'm' + x.id), focus: s.monsters.find((x) => x.id === monSel)?.tile };
    }
    return {};
  }, [req, rot, monSel, m.seq]);

  const onTile = (key: string) => {
    if (!req) return;
    if (key.startsWith('m')) {
      if (req.kind === 'monster') setMonSel(Number(key.slice(1)));
      return;
    }
    if (req.kind === 'turn' && key in req.moves) answer({ kind: 'turn', a: 'move', to: key });
    else if (req.kind === 'tile' && req.tiles.includes(key)) answer({ kind: 'tile', tile: key });
    else if (req.kind === 'monster' && monSel != null) answer({ kind: 'monster', a: 'move', id: monSel, to: key });
  };

  const waitingSeat = m.pending ? (m.pending.mine ? you : m.pending.seat) : null;
  const waitText = m.pending && !m.pending.mine ? `等待 ${seatName(s, m.pending.seat)} ${KIND_WAIT[m.pending.kind] ?? ''}…` : null;
  const floorCount = (f: Floor) => s.players.filter((p) => !p.dead && parseKey(p.tile).floor === f).length;

  return (
    <div class={`game phase-${s.phase}`}>
      <div class="g-top">
        <button class="icon-btn" title="离开" onClick={onLeave}>←</button>
        <div class="g-title">
          {s.haunt ? <><span class="haunt-chip">异变</span> {s.haunt.title}</> : <>探索中 · 凶兆 {s.omensDrawn}/9</>}
          {s.haunt?.track && <span class="tag">{s.haunt.track.label} {s.haunt.track.value}{s.haunt.track.max != null ? '/' + s.haunt.track.max : ''}</span>}
          <span class="muted small">第 {s.round} 轮{s.haunt ? ` · 异变第 ${s.haunt.round} 轮` : ''}</span>
        </div>
        <div class="spacer" />
        {s.haunt && <button class="btn small primary" onClick={() => setModal('brief')}>📜 手册</button>}
        {s.winner && !overlay.value && <button class="btn small" onClick={() => game.value && overlay.value === null && (overlay.value = { kind: 'end', e: { t: 'end', winner: s.winner! } })}>结局</button>}
        <button class={`icon-btn ${fast.value ? 'on' : ''}`} title="加速动画" onClick={() => setFast(!fast.value)}>⏩</button>
        <SoundButton />
        <button class="icon-btn mobile-only" onClick={() => setDrawer(!drawer)}>☰</button>
      </div>

      <div class="g-body">
        <div class="g-map">
          <div class="floor-tabs">
            {[...FLOORS].reverse().map((f) => (
              <button class={f === floor ? 'on' : ''} onClick={() => (focusFloor.value = f)}>
                {FLOOR_NAME[f]}{floorCount(f) ? <span class="badge">{floorCount(f)}</span> : null}
              </button>
            ))}
            <span class="muted tiny decks">房间：地 {s.decks.rooms.B} / 一 {s.decks.rooms.G} / 二 {s.decks.rooms.U}</span>
          </div>
          <MapView s={s} floor={floor} you={you} {...mapProps} onTile={onTile}
            onExplore={(dir) => req?.kind === 'turn' && answer({ kind: 'turn', a: 'explore', dir })}
            onInspect={setInspect} />
          {waitText && <div class="wait-banner">{waitText} <TimerRing deadline={m.pending!.deadline} /></div>}
          {req?.kind === 'tile' && (
            <div class="wait-banner mine">{req.prompt}{req.optional && <button class="btn small ghost" onClick={() => answer({ kind: 'tile', tile: null })}>不选</button>}</div>
          )}
        </div>

        <div class={`g-side ${drawer ? 'open' : ''}`}>
          <div class="tabs">
            <button class={side === 'players' ? 'on' : ''} onClick={() => setSide('players')}>玩家</button>
            <button class={side === 'log' ? 'on' : ''} onClick={() => setSide('log')}>日志</button>
          </div>
          {side === 'players' ? (
            <>
              <PlayerList s={s} you={you} seats={room.seats} waiting={waitingSeat} onPick={(seat) => { focusFloor.value = parseKey(s.players[seat].tile).floor; }} />
              {s.haunt && s.haunt.revealed.length > 0 && (
                <div class="revealed">
                  <div class="label">已公开的规则</div>
                  {s.haunt.revealed.map((r) => <div class="small">· {r}</div>)}
                </div>
              )}
            </>
          ) : <LogView />}
        </div>
      </div>

      {/* 底部：我的面板 + 行动 */}
      <div class="g-dock">
        {me ? (
          <div class="me-panel">
            <div class="me-head">
              <Portrait explorer={me.explorer} size={44} dead={me.dead} />
              <div>
                <b>{me.name}</b>
                {m.side && s.phase !== 'explore' && <span class={`tag tiny side-${m.side}`}>{SIDE_NAME[m.side]}</span>}
                <div class="muted tiny">在「{roomName(s, me.tile)}」{s.turn === you && s.phase !== 'end' ? ` · 剩余移动 ${s.moveLeft}` : ''}</div>
              </div>
            </div>
            <TraitTracks p={me} />
            <div class="me-cards">
              {me.cards.map((c) => <CardView id={c} small onClick={() => setInspect('card:' + c)} />)}
              {!me.cards.length && <span class="muted small">还没有物品</span>}
            </div>
          </div>
        ) : <div class="muted">你在观战</div>}

        <div class="dock-actions">
          {req?.kind === 'turn' && <TurnBar req={req} answer={answer} open={setModal} />}
          {req?.kind === 'rotate' && <RotateBar req={req} rot={rot} setRot={setRot} send={answer} />}
          {req?.kind === 'monster' && <MonsterBar s={s} req={req} send={answer} sel={monSel} setSel={setMonSel} />}
          {!req && m.pending?.mine && busy && <div class="muted">……</div>}
        </div>
      </div>

      {req?.kind === 'damage' && <DamageModal s={s} req={req} send={answer} key={m.seq} />}
      {req?.kind === 'choose' && <ChooseModal req={req} send={answer} />}
      {req?.kind === 'player' && <PlayerModal s={s} req={req} send={answer} />}
      {req?.kind === 'card' && <CardModal req={req} send={answer} />}
      {req?.kind === 'trade' && <TradeAskModal s={s} req={req} send={answer} />}
      {req?.kind === 'turn' && modal === 'trade' && <TradeModal s={s} req={req} send={answer} onClose={() => setModal(null)} />}
      {req?.kind === 'turn' && modal === 'attack' && <AttackModal s={s} req={req} send={answer} onClose={() => setModal(null)} />}
      {req?.kind === 'turn' && modal === 'loot' && <LootModal s={s} req={req} send={answer} onClose={() => setModal(null)} />}
      {modal === 'brief' && <BriefModal onClose={() => setModal(null)} />}
      {inspect && <Inspect k={inspect} onClose={() => setInspect(null)} />}
      <OverlayLayer s={s} you={you} side={m.side} brief={m.brief} onOpenBrief={() => setModal('brief')} room={room} isHost={isHost}
        onRematch={() => send({ type: 'rematch' })} onLeave={onLeave} />
    </div>
  );
}

function TurnBar({ req, answer, open }: { req: Extract<Request, { kind: 'turn' }>; answer: (a: Answer) => void; open: (m: 'trade' | 'attack' | 'loot') => void }) {
  const canMove = Object.keys(req.moves).length > 0;
  return (
    <div class="actionbar">
      <div class="ab-title">你的回合 · 剩余移动 {req.moveLeft}</div>
      <div class="muted small">
        {canMove ? '点击高亮的房间移动；' : ''}{req.explore.length ? '点击「？」探索新房间（探索后回合结束）。' : ''}
      </div>
      <div class="row wrap">
        {req.actions.map((a) => (
          <button class="btn small" title={a.desc} onClick={() => answer({ kind: 'turn', a: 'act', id: a.id })}>{a.label}</button>
        ))}
        {req.attacks.length > 0 && <button class="btn small danger" onClick={() => open('attack')}>⚔ 攻击</button>}
        {req.trades.length > 0 && <button class="btn small ghost" onClick={() => open('trade')}>交易</button>}
        {req.loot.length > 0 && <button class="btn small ghost" onClick={() => open('loot')}>搜刮遗体</button>}
        <span class="spacer" />
        <button class="btn primary" onClick={() => answer({ kind: 'turn', a: 'end' })}>结束回合</button>
      </div>
    </div>
  );
}

function LogView() {
  const lines = logLines.value;
  useEffect(() => {
    const el = document.querySelector('.log');
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div class="log">
      {lines.map((l) => <div key={l.id} class={`log-line ${l.tone ?? ''}`}>{l.text}</div>)}
    </div>
  );
}

function BriefModal({ onClose }: { onClose: () => void }) {
  const m = game.value!;
  const h = m.state.haunt;
  const b = m.brief;
  return (
    <Modal onClose={onClose} class="brief" title={h ? `异变：${h.title}` : '手册'}>
      {h && <p class="haunt-intro">{h.intro}</p>}
      {b ? (
        <>
          <div class={`brief-side side-${b.side}`}>{b.side === 'traitor' ? '背叛者密函' : b.side === 'solo' ? '求生守则' : '幸存者手札'}</div>
          <div class="label">目标</div>
          <p><b>{b.goal}</b></p>
          <div class="label">规则</div>
          <ul>{b.rules.map((r) => <li>{r}</li>)}</ul>
          <div class="muted small">只有你这一方能看到这份手册。规则一旦被执行，就会公开给所有人。</div>
        </>
      ) : <p class="muted">你在观战，看不到任何一方的手册。</p>}
      {h && h.revealed.length > 0 && (
        <>
          <div class="label">已公开的规则</div>
          <ul>{h.revealed.map((r) => <li>{r}</li>)}</ul>
        </>
      )}
    </Modal>
  );
}

function Inspect({ k, onClose }: { k: string; onClose: () => void }) {
  if (k.startsWith('card:')) {
    const id = k.slice(5);
    if (!CARDS[id]) return null;
    return <Modal onClose={onClose}><div class="center"><CardView id={id} /></div></Modal>;
  }
  const s = game.value!.state;
  const t = s.tiles[k];
  if (!t) return null;
  const r = ROOMS[t.room];
  const here = s.players.filter((p) => p.tile === k);
  const ms = s.monsters.filter((x) => x.tile === k);
  const tks = s.tokens.filter((x) => x.tile === k);
  return (
    <Modal onClose={onClose} title={r.name}>
      <p>{r.text}</p>
      <div class="muted small">{FLOOR_NAME[t.floor]}{r.symbols?.length ? ' · 发现时抽：' + r.symbols.map((x) => ({ item: '物品', omen: '凶兆', event: '事件' })[x]).join('、') : ''}</div>
      {here.length > 0 && <div class="small">在这里：{here.map((p) => p.name + (p.dead ? '（遗体）' : '')).join('、')}</div>}
      {ms.length > 0 && <div class="small">怪物：{ms.map((x) => x.name + (x.stunned ? '（眩晕）' : '') + (x.hp != null ? `（血量 ${x.hp}）` : '')).join('、')}</div>}
      {tks.length > 0 && <div class="small">标记：{tks.map((x) => x.label).join('、')}</div>}
    </Modal>
  );
}

export { toast };
