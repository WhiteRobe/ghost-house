import { useEffect, useState } from 'preact/hooks';
import type { LobbyMsg, RoomSummary } from '../../shared/protocol';
import { Conn, type ConnStatus } from '../net';
import { api } from '../api';
import { me, go, toast } from '../store';
import { Modal, TopBar } from '../ui/common';

const STATUS: Record<RoomSummary['status'], string> = { waiting: '等人中', playing: '探索中', ended: '已结束' };

export function Lobby() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const guest = !!me.value?.guest;

  useEffect(() => {
    const c = new Conn<LobbyMsg, never>('/ws/lobby', (m) => {
      if (m.type === 'rooms') setRooms(m.rooms);
      else if (m.type === 'upsert') setRooms((rs) => [m.room, ...rs.filter((r) => r.id !== m.room.id)]);
      else if (m.type === 'remove') setRooms((rs) => rs.filter((r) => r.id !== m.id));
    }, setStatus);
    return () => c.close();
  }, []);

  const sorted = [...rooms].sort((a, b) => {
    const w = (r: RoomSummary) => (r.status === 'waiting' ? 0 : r.status === 'playing' ? 1 : 2);
    return w(a) - w(b) || b.updatedAt - a.updatedAt;
  });

  async function joinCode() {
    if (!/^\w{4,8}$/.test(code.trim())) return toast('请输入房间码');
    try {
      const { id } = await api.joinByCode(code.trim().toUpperCase());
      go(`/room/${id}`);
    } catch (e: any) {
      toast(e.message);
    }
  }

  return (
    <>
      <TopBar />
      <div class="page">
        <div class="lobby-head">
          <h2>大厅</h2>
          <span class={`tag ${status === 'open' ? 'ok' : 'warn'}`}>{status === 'open' ? '● 已连接' : '○ 连接中…'}</span>
          <div class="spacer" />
          {!guest && (
            <div class="row">
              <input class="input" style={{ width: '120px' }} placeholder="房间码" value={code} maxLength={8}
                onInput={(e) => setCode(e.currentTarget.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && joinCode()} />
              <button class="btn ghost" onClick={joinCode}>加入</button>
            </div>
          )}
          <button class="btn primary" onClick={() => setCreating(true)}>{guest ? '和 AI 开一局' : '创建房间'}</button>
        </div>
        {guest && (
          <div class="panel" style={{ marginBottom: '16px' }}>
            <b>游客模式</b>：可以和 AI 一起探索鬼屋。想和朋友一起？<a href="#/" onClick={async () => { await api.logout().catch(() => {}); me.value = null; }}>注册一个账号</a>。
          </div>
        )}
        {sorted.length === 0 ? (
          <div class="empty-hint"><span class="big">🕯️</span>还没有人点起蜡烛。创建一个房间吧。</div>
        ) : (
          <div class="room-grid">
            {sorted.map((r) => (
              <div class="panel room-card" key={r.id} onClick={() => (guest ? toast('游客只能和 AI 一起玩') : go(`/room/${r.id}`))}>
                <div class="row">
                  <span class={`tag status-${r.status}`}>{STATUS[r.status]}</span>
                  <span class="spacer" />
                  <span class="tag">{r.code}</span>
                </div>
                <h3>{r.name}</h3>
                <div class="muted small">房主 {r.host}</div>
                <div class="seats">
                  {Array.from({ length: r.maxSeats }, (_, i) => <span class={`pip ${i < r.humans ? 'h' : i < r.humans + r.ais ? 'a' : ''}`} />)}
                  <span class="spacer" />
                  <span class="muted small">{r.humans + r.ais}/{r.maxSeats}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {creating && <CreateRoom onClose={() => setCreating(false)} guest={guest} />}
    </>
  );
}

function CreateRoom({ onClose, guest }: { onClose: () => void; guest: boolean }) {
  const [name, setName] = useState(`${me.value?.name ?? ''}的鬼屋`);
  const [n, setN] = useState(4);
  const [priv, setPriv] = useState(guest);
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const { id } = await api.createRoom(name.trim() || '鬼屋', n, priv || guest);
      go(`/room/${id}`);
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} title={guest ? '和 AI 开一局' : '创建房间'}>
      <label class="label">房间名</label>
      <input class="input" value={name} maxLength={20} onInput={(e) => setName(e.currentTarget.value)} />
      <label class="label">人数（含 AI）</label>
      <div class="seg">{[3, 4, 5, 6].map((k) => <button class={k === n ? 'on' : ''} onClick={() => setN(k)}>{k} 人</button>)}</div>
      {!guest && (
        <>
          <label class="label">可见性</label>
          <div class="seg">
            <button class={!priv ? 'on' : ''} onClick={() => setPriv(false)}>公开</button>
            <button class={priv ? 'on' : ''} onClick={() => setPriv(true)}>私密（凭房间码）</button>
          </div>
        </>
      )}
      <div class="row end" style={{ marginTop: '18px' }}>
        <button class="btn ghost" onClick={onClose}>取消</button>
        <button class="btn primary" onClick={create} disabled={busy}>创建</button>
      </div>
    </Modal>
  );
}
