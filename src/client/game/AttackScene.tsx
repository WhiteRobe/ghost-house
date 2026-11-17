// 战斗动画：入场 → 掷骰 → 冲撞 / 斩击 → 伤害数字
import { useEffect, useState } from 'preact/hooks';
import { EXPLORERS } from '../../content';
import { TRAIT_NAME, type GameEvent, type GameState, type Target } from '../../shared/types';
import { art } from '../art';
import { Img } from '../ui/common';
import { Die } from './parts';
import { targetName } from './describe';
import { fast } from './store';
import { sfx } from '../audio';

type AttackEvent = Extract<GameEvent, { t: 'attack' }>;
type Stage = 'enter' | 'roll' | 'reveal' | 'clash' | 'done';

const same = (a: Target | null, b: Target) => !!a && ('seat' in a && 'seat' in b ? a.seat === b.seat : 'monster' in a && 'monster' in b ? a.monster === b.monster : false);

function Fighter({ s, t, side, dice, stage, won, lost, damage, trait }: {
  s: GameState; t: Target; side: 'l' | 'r'; dice: number[]; stage: Stage; won: boolean; lost: boolean; damage: number; trait: string;
}) {
  const total = dice.reduce((a, b) => a + b, 0);
  const [fake, setFake] = useState(dice.map(() => 0));
  useEffect(() => {
    if (stage !== 'roll') return;
    const iv = setInterval(() => setFake(dice.map(() => Math.floor(Math.random() * 3))), 70);
    return () => clearInterval(iv);
  }, [stage]);
  let face;
  if ('seat' in t) {
    const p = s.players[t.seat];
    const ex = EXPLORERS[p?.explorer];
    face = <div class="f-face" style={{ background: ex?.color }}><span>{ex?.name.slice(0, 1)}</span><Img src={art.explorer(p?.explorer ?? '')} /></div>;
  } else {
    const m = s.monsters.find((x) => x.id === t.monster);
    face = <div class="f-face monster"><span>{m?.name.slice(0, 1) ?? '怪'}</span>{m && <Img src={art.monster(m.icon)} />}</div>;
  }
  const clash = stage === 'clash' || stage === 'done';
  return (
    <div class={`fighter ${side} ${clash && won ? 'won' : ''} ${clash && lost ? 'lost' : ''} stage-${stage}`}>
      {face}
      <div class="f-name">{targetName(s, t)}</div>
      <div class="muted tiny">{trait} · {dice.length} 颗骰</div>
      <div class="dice-row">{(stage === 'enter' ? dice.map(() => 0) : stage === 'roll' ? fake : dice).map((v) => <Die v={v} rolling={stage === 'roll'} />)}</div>
      <div class={`f-total ${stage === 'enter' || stage === 'roll' ? 'hidden' : ''}`}>{total}</div>
      {clash && lost && damage > 0 && <div class="f-dmg">-{damage}</div>}
      {clash && lost && <svg class="slash" viewBox="0 0 100 100"><path d="M10 15 L90 85" /><path d="M20 8 L95 70" /></svg>}
    </div>
  );
}

export function AttackScene({ s, e, onDone }: { s: GameState; e: AttackEvent; onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('enter');
  useEffect(() => {
    const k = fast.value ? 0.5 : 1;
    const ts = [
      setTimeout(() => { setStage('roll'); sfx('dice'); }, 300 * k),
      setTimeout(() => setStage('reveal'), 1050 * k),
      setTimeout(() => { setStage('clash'); sfx(e.loser ? 'hit' : 'clang'); }, 1500 * k),
      setTimeout(() => setStage('done'), 2300 * k),
      setTimeout(onDone, 3100 * k),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);
  const fromWon = same(e.loser, e.to);
  const toWon = same(e.loser, e.from);
  const clash = stage === 'clash' || stage === 'done';
  return (
    <div class={`ov ov-attack ${clash ? 'shake' : ''}`} onClick={onDone}>
      <div class="arena">
        <div class="arena-title">⚔ {TRAIT_NAME[e.trait]}对决</div>
        <div class="arena-row">
          <Fighter s={s} t={e.from} side="l" dice={e.a} stage={stage} won={fromWon} lost={toWon} damage={e.damage} trait="进攻" />
          <div class={`clash-mark ${clash ? 'on' : ''} ${clash && !e.loser ? 'tie' : ''}`}>{clash ? (e.loser ? '' : '铛') : 'VS'}</div>
          <Fighter s={s} t={e.to} side="r" dice={e.d} stage={stage} won={toWon} lost={fromWon} damage={e.damage} trait="防守" />
        </div>
        <div class={`arena-result ${clash ? 'on' : ''}`}>
          {!e.loser ? '势均力敌，谁也没伤到谁' : 'monster' in e.loser ? `${targetName(s, e.loser)} 挨了一下（${e.damage} 点）` : `${targetName(s, e.loser)} 受到 ${e.damage} 点${e.trait === 'might' || e.trait === 'speed' ? '物理' : '精神'}伤害`}
        </div>
      </div>
      {clash && e.loser && <div class="flash" />}
    </div>
  );
}
