import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { me, go } from '../store';
import { api } from '../api';
import { audioPrefs, setAudio, sfx } from '../audio';

export function Modal(p: { onClose?: () => void; children: ComponentChildren; class?: string; title?: string }) {
  return (
    <div class="modal-bg" onClick={(e) => e.target === e.currentTarget && p.onClose?.()}>
      <div class={`panel modal ${p.class ?? ''}`}>
        {p.title && <h3 class="modal-title">{p.title}</h3>}
        {p.onClose && <button class="modal-x" onClick={p.onClose} aria-label="关闭">×</button>}
        {p.children}
      </div>
    </div>
  );
}

/** 图片：加载失败时隐藏，露出底下的纯色背景 */
export function Img(p: { src: string; alt?: string; class?: string }) {
  const [bad, setBad] = useState(false);
  if (bad || !p.src) return null;
  return <img class={p.class} src={p.src} alt={p.alt ?? ''} loading="lazy" draggable={false} onError={() => setBad(true)} />;
}

export function TimerRing({ deadline, total = 90000 }: { deadline: number | null; total?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const left = Math.max(0, deadline - now);
  const frac = Math.min(1, left / total);
  const C = 2 * Math.PI * 10;
  return (
    <svg class="timer-ring" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="10" fill="#1b1512" stroke="#5a4636" stroke-width="2" />
      <circle cx="13" cy="13" r="10" fill="none" stroke={left < 15000 ? '#c0392b' : '#f0b44c'} stroke-width="3"
        stroke-dasharray={`${C * frac} ${C}`} transform="rotate(-90 13 13)" stroke-linecap="round" />
      <text x="13" y="17" text-anchor="middle" font-size="9" font-weight="700" fill="#e8dcc0">{Math.ceil(left / 1000)}</text>
    </svg>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <div class="logo" onClick={onClick}>
      <img src="/favicon.svg" alt="" />
      <span>鬼屋</span>
    </div>
  );
}

export function SoundButton() {
  const [m, setM] = useState(audioPrefs.muted);
  return (
    <button class="icon-btn" title={m ? '打开声音' : '静音'} onClick={() => { setAudio({ muted: !m }); setM(!m); if (m) sfx('click'); }}>
      {m ? '🔇' : '🔊'}
    </button>
  );
}

export function TopBar({ children }: { children?: ComponentChildren }) {
  const u = me.value;
  return (
    <div class="topbar">
      <Logo onClick={() => go('/lobby')} />
      {children}
      <div class="spacer" />
      <button class="icon-btn" title="图鉴" onClick={() => go('/codex')}>📖</button>
      <SoundButton />
      {u && (
        <>
          <span class="who">{u.name}</span>
          <button class="btn small ghost" onClick={async () => { await api.logout().catch(() => {}); me.value = null; go('/'); }}>退出</button>
        </>
      )}
    </div>
  );
}
