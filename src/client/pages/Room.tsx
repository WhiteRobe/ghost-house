import { useEffect, useRef, useState } from 'preact/hooks';
import type { ClientMsg, RoomInfo, SeatInfo, ServerMsg } from '../../shared/protocol';
import { EXPLORERS, SCENARIOS } from '../../content';
import { TRAITS, TRAIT_NAME, traitValue } from '../../shared/types';
import { Conn, type ConnStatus } from '../net';
import { go, me, toast } from '../store';
import { Modal, TopBar, Img } from '../ui/common';
import { GameView } from '../game/GameView';
import { game, onGameMsg, resetGame } from '../game/store';
import { Portrait } from '../game/parts';
import { art } from '../art';
import { sfx, startMusic } from '../audio';

export function Room({ id }: { id: string }) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [you, setYou] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [err, setErr] = useState<string | null>(null);
  const conn = useRef<Conn<ServerMsg, ClientMsg> | null>(null);

  useEffect(() => {
    resetGame();
    const c = new Conn<ServerMsg, ClientMsg>(`/ws/house/${id}`, (m) => {
      if (m.type === 'room') {
        setRoom(m.room);
        setYou(m.you);
        if (m.room.status === 'waiting') resetGame();
      } else if (m.type === 'game') onGameMsg(m);
      else if (m.type === 'error') {
        toast(m.msg);
        if (/不存在|不能加入|只能/.test(m.msg)) setErr(m.msg);
      } else if (m.type === 'emote') toast(`${m.seat + 1} 号：${m.e}`);
    }, setStatus, () => ({ type: 'hello' }));
    conn.current = c;
    return () => { c.close(); resetGame(); };
  }, [id]);

  const send = (m: ClientMsg) => conn.current?.send(m);
  const leave = () => { send({ type: 'leave' }); go('/lobby'); };
  const isHost = !!room && room.hostId === me.value?.id;

  if (err) return <><TopBar /><div class="page"><div class="empty-hint"><span class="big">🚪</span>{err}<br /><button class="btn" onClick={() => go('/lobby')}>回大厅</button></div></div></>;
  if (!room) return <><TopBar /><div class="page"><div class="empty-hint">正在推开大门…</div></div></>;
  if (game.value && room.status !== 'waiting') return (
    <>
      <GameView room={room} send={send} isHost={isHost} onLeave={() => go('/lobby')} />
      {status !== 'open' && <div class="conn-banner">连接中断，正在重连…</div>}
    </>
  );
  return <Waiting room={room} you={you} send={send} isHost={isHost} onLeave={leave} status={status} />;
}

function Waiting({ room, you, send, isHost, onLeave, status }: { room: RoomInfo; you: number | null; send: (m: ClientMsg) => void; isHost: boolean; onLeave: () => void; status: ConnStatus }) {
  const [picking, setPicking] = useState<number | null>(null);
  useEffect(() => startMusic('lobby'), []);
  // 教学局：进门直接开始
  useEffect(() => { if (room.settings.tutorial && isHost && status === 'open') send({ type: 'start' }); }, [status]);
  if (room.settings.tutorial) return <><TopBar /><div class="page"><div class="empty-hint"><span class="big">🕯️</span>正在准备新手教程…</div></div></>;
  const filled = room.seats.filter((s) => s.kind !== 'empty').length;
  const link = `${location.origin}/#/room/${room.id}`;
  return (
    <>
      <TopBar><span class="muted small">{status === 'open' ? '' : '连接中…'}</span></TopBar>
      <div class="page">
        <div class="lobby-head">
          <h2>{room.name}</h2>
          <span class="tag">房间码 {room.code}</span>
          {!room.guestOnly && <button class="btn small ghost" onClick={() => { navigator.clipboard?.writeText(link); toast('邀请链接已复制'); }}>复制邀请链接</button>}
          <div class="spacer" />
          <button class="btn ghost" onClick={onLeave}>离开</button>
        </div>

        <div class="seat-grid">
          {room.seats.map((s, i) => <SeatCard seat={s} i={i} you={you} isHost={isHost} send={send} onPick={() => setPicking(i)} />)}
        </div>

        <div class="panel settings">
          <h3>设置</h3>
          <label class="label">缘起（你们为什么来到这里）</label>
          <div class="seg wrap">
            <button class={room.settings.scenario === 'random' ? 'on' : ''} disabled={!isHost} onClick={() => send({ type: 'settings', settings: { scenario: 'random' } })}>随机</button>
            {Object.values(SCENARIOS).map((sc) => (
              <button class={room.settings.scenario === sc.id ? 'on' : ''} disabled={!isHost} onClick={() => send({ type: 'settings', settings: { scenario: sc.id } })}>{sc.name}</button>
            ))}
          </div>
          {room.settings.scenario !== 'random' && <p class="muted small">{SCENARIOS[room.settings.scenario]?.text}</p>}
          <label class="label">异变规则</label>
          <div class="seg">
            <button class={room.settings.mode === 'standard' ? 'on' : ''} disabled={!isHost} onClick={() => send({ type: 'settings', settings: { mode: 'standard' } })}>标准（掷凶兆数颗骰 ≥5 触发）</button>
            <button class={room.settings.mode === 'classic' ? 'on' : ''} disabled={!isHost} onClick={() => send({ type: 'settings', settings: { mode: 'classic' } })}>经典（回合末 6 骰 &lt; 凶兆数）</button>
          </div>
          <label class="label">人数</label>
          <div class="seg">
            {[3, 4, 5, 6].map((n) => <button class={room.seats.length === n ? 'on' : ''} disabled={!isHost} onClick={() => send({ type: 'settings', settings: {}, maxSeats: n })}>{n} 人</button>)}
          </div>
          <div class="row end" style={{ marginTop: '16px' }}>
            {isHost ? (
              <button class="btn primary big" disabled={filled < 3} onClick={() => { sfx('door'); send({ type: 'start' }); }}>
                {filled < 3 ? `至少 3 人（现在 ${filled}）` : '推门进去'}
              </button>
            ) : <span class="muted">等待房主开始…</span>}
          </div>
        </div>
      </div>
      {picking != null && <ExplorerPicker room={room} seat={picking} onClose={() => setPicking(null)} send={send} />}
    </>
  );
}

function SeatCard({ seat, i, you, isHost, send, onPick }: { seat: SeatInfo; i: number; you: number | null; isHost: boolean; send: (m: ClientMsg) => void; onPick: () => void }) {
  const mine = i === you;
  const canPick = seat.kind !== 'empty' && (mine || (seat.kind === 'ai' && isHost));
  const ex = seat.kind !== 'empty' && seat.explorer ? EXPLORERS[seat.explorer] : null;
  return (
    <div class={`panel seat ${mine ? 'mine' : ''} ${seat.kind}`}>
      <div class="seat-art" onClick={canPick ? onPick : undefined}>
        {ex ? <><Portrait explorer={ex.id} size={84} /><div class="seat-ex">{ex.name}</div></> : seat.kind !== 'empty' ? <div class="seat-ex muted">{canPick ? '点击选择角色' : '未选角色'}</div> : <div class="seat-ex muted">空位</div>}
      </div>
      <div class="seat-name">
        {seat.kind === 'empty' ? '—' : seat.name}
        {seat.kind === 'human' && !seat.online && <span class="tag tiny warn">离线</span>}
        {seat.kind === 'ai' && <span class="tag tiny">AI</span>}
      </div>
      <div class="row wrap center-row">
        {seat.kind === 'empty' && you == null && <button class="btn small" onClick={() => send({ type: 'setSeat', seat: i, to: 'me' })}>坐这里</button>}
        {seat.kind === 'empty' && you != null && <button class="btn small ghost" onClick={() => send({ type: 'setSeat', seat: i, to: 'me' })}>换到这里</button>}
        {seat.kind === 'empty' && isHost && <button class="btn small" onClick={() => send({ type: 'setSeat', seat: i, to: 'ai' })}>加 AI</button>}
        {seat.kind === 'ai' && isHost && <button class="btn small ghost" onClick={() => send({ type: 'setSeat', seat: i, to: 'empty' })}>移除</button>}
        {seat.kind === 'human' && isHost && !mine && <button class="btn small ghost" onClick={() => send({ type: 'kick', seat: i })}>请离</button>}
      </div>
    </div>
  );
}

function ExplorerPicker({ room, seat, onClose, send }: { room: RoomInfo; seat: number; onClose: () => void; send: (m: ClientMsg) => void }) {
  const taken = new Map<number, number>();
  room.seats.forEach((s, i) => { if (s.kind !== 'empty' && s.explorer && i !== seat) taken.set(EXPLORERS[s.explorer].board, i); });
  const cur = room.seats[seat];
  const curEx = cur.kind !== 'empty' ? cur.explorer : undefined;
  return (
    <Modal onClose={onClose} title="选择探险者" class="wide">
      <div class="ex-grid">
        {Object.values(EXPLORERS).map((ex) => {
          const blocked = taken.has(ex.board);
          return (
            <div class={`ex-card ${blocked ? 'blocked' : ''} ${curEx === ex.id ? 'on' : ''}`} onClick={() => { if (blocked) return; send({ type: 'setExplorer', seat, explorer: ex.id }); onClose(); }}>
              <div class="ex-art" style={{ background: ex.color }}><Img src={art.explorer(ex.id)} /></div>
              <div class="ex-body">
                <b>{ex.name}</b> <span class="muted tiny">{ex.age} 岁</span>
                <div class="tiny muted">{ex.bio}</div>
                <div class="ex-traits">
                  {TRAITS.map((t) => <span class={`chip t-${t}`}>{TRAIT_NAME[t]} {traitValue(ex.tracks[t], ex.start[t])}</span>)}
                </div>
                {blocked && <div class="tiny bad">同一张角色板的另一面已被选</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div class="row end"><button class="btn ghost" onClick={() => { send({ type: 'setExplorer', seat, explorer: null }); onClose(); }}>随机</button></div>
    </Modal>
  );
}
