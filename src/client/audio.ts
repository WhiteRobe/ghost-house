// 程序合成的音效与氛围音乐（WebAudio，无音频文件）。
type Sfx = 'hit' | 'clang' | 'click' | 'dice' | 'door' | 'card' | 'hurt' | 'gain' | 'step' | 'haunt' | 'win' | 'lose' | 'heart' | 'turn';

const KEY = 'ghost-audio';
export const audioPrefs: { muted: boolean; music: number; sfx: number } = (() => {
  try {
    return { muted: false, music: 0.5, sfx: 0.8, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { muted: false, music: 0.5, sfx: 0.8 };
  }
})();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;

function ac(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    applyPrefs();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function applyPrefs() {
  if (!master || !musicBus) return;
  master.gain.value = audioPrefs.muted ? 0 : 1;
  musicBus.gain.value = audioPrefs.music * 0.35;
}

export function setAudio(p: Partial<typeof audioPrefs>) {
  Object.assign(audioPrefs, p);
  localStorage.setItem(KEY, JSON.stringify(audioPrefs));
  applyPrefs();
}

// 第一次交互时解锁
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => ac(), { once: true });

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number; attack?: number } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
  const v = (opts.vol ?? 0.2) * audioPrefs.sfx;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { vol?: number; freq?: number; q?: number; delay?: number; type?: BiquadFilterType } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.value = opts.freq ?? 1200;
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.value = (opts.vol ?? 0.3) * audioPrefs.sfx;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function sfx(name: Sfx) {
  if (audioPrefs.muted) return;
  switch (name) {
    case 'click': tone(660, 0.06, { type: 'triangle', vol: 0.08 }); break;
    case 'turn': tone(392, 0.25, { type: 'sine', vol: 0.12 }); tone(587, 0.35, { type: 'sine', vol: 0.1, delay: 0.12 }); break;
    case 'step': noise(0.08, { freq: 300, vol: 0.18, type: 'lowpass' }); break;
    case 'dice':
      for (let i = 0; i < 6; i++) noise(0.05, { freq: 2500 + i * 300, vol: 0.25, q: 4, delay: i * 0.07 + Math.random() * 0.03 });
      break;
    case 'door':
      tone(90, 0.9, { type: 'sawtooth', vol: 0.05, slide: 1.6, attack: 0.2 });
      noise(0.5, { freq: 600, q: 8, vol: 0.12, delay: 0.1 });
      break;
    case 'card': noise(0.15, { freq: 4000, q: 0.7, vol: 0.15 }); tone(880, 0.2, { type: 'triangle', vol: 0.05, delay: 0.05 }); break;
    case 'hurt': tone(140, 0.35, { type: 'square', vol: 0.12, slide: 0.5 }); noise(0.2, { freq: 400, vol: 0.2 }); break;
    case 'hit':
      noise(0.25, { freq: 900, q: 0.8, vol: 0.45 });
      tone(110, 0.3, { type: 'square', vol: 0.18, slide: 0.4 });
      tone(55, 0.45, { type: 'sine', vol: 0.4, slide: 0.6 });
      break;
    case 'clang':
      tone(1320, 0.6, { type: 'triangle', vol: 0.12, slide: 0.98 });
      tone(1980, 0.4, { type: 'sine', vol: 0.06 });
      noise(0.08, { freq: 5000, q: 2, vol: 0.2 });
      break;
    case 'gain': tone(523, 0.15, { type: 'triangle', vol: 0.1 }); tone(784, 0.25, { type: 'triangle', vol: 0.1, delay: 0.08 }); break;
    case 'heart':
      tone(60, 0.18, { type: 'sine', vol: 0.4 });
      tone(55, 0.22, { type: 'sine', vol: 0.3, delay: 0.25 });
      break;
    case 'haunt':
      tone(73.4, 3.5, { type: 'sawtooth', vol: 0.08, attack: 1, slide: 0.7 });
      tone(77.8, 3.5, { type: 'sawtooth', vol: 0.06, attack: 1.2, slide: 0.72 });
      tone(1244, 2.5, { type: 'sine', vol: 0.03, attack: 1.5, delay: 0.5 });
      noise(2.5, { freq: 200, vol: 0.2, type: 'lowpass', delay: 0.3 });
      break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.1, delay: i * 0.15 })); break;
    case 'lose': [392, 370, 311, 233].forEach((f, i) => tone(f, 0.7, { type: 'sine', vol: 0.1, delay: i * 0.3 })); break;
  }
}

// ---------- 氛围音乐：低频持续音 + 偶发的八音盒音符 ----------

let musicMode: 'lobby' | 'explore' | 'haunt' | null = null;
let musicNodes: AudioNode[] = [];
let musicTimer: ReturnType<typeof setInterval> | undefined;

export function startMusic(mode: 'lobby' | 'explore' | 'haunt' | null) {
  if (mode === musicMode) return;
  musicMode = mode;
  for (const n of musicNodes) {
    try { (n as OscillatorNode).stop?.(); } catch { /* ignore */ }
    n.disconnect();
  }
  musicNodes = [];
  clearInterval(musicTimer);
  if (!mode) return;
  const c = ac();
  if (!c || !musicBus) return;
  const root = mode === 'haunt' ? 55 : mode === 'explore' ? 65.4 : 73.4;
  const pad = c.createGain();
  pad.gain.value = 0.25;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = mode === 'haunt' ? 500 : 320;
  pad.connect(lp).connect(musicBus);
  for (const [mul, det] of [[1, 0], [1.5, 4], [mode === 'haunt' ? 1.06 : 2, -5]] as const) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = root * mul;
    o.detune.value = det;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.07 + Math.random() * 0.05;
    lg.gain.value = 6;
    lfo.connect(lg).connect(o.detune);
    o.connect(pad);
    o.start();
    lfo.start();
    musicNodes.push(o, lfo, lg);
  }
  musicNodes.push(pad, lp);
  const scale = mode === 'haunt' ? [0, 1, 3, 6, 7, 8] : [0, 3, 5, 7, 10, 12];
  musicTimer = setInterval(() => {
    if (audioPrefs.muted || !musicBus || Math.random() < 0.45) return;
    const n = scale[Math.floor(Math.random() * scale.length)];
    const f = root * 8 * 2 ** (n / 12);
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g).connect(musicBus);
    o.start(t);
    o.stop(t + 2.3);
  }, mode === 'haunt' ? 900 : 1600);
}
