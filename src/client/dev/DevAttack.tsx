// 仅开发环境：预览战斗动画  #/dev/attack
import { useState } from 'preact/hooks';
import type { GameState, PlayerState } from '../../shared/types';
import { AttackScene } from '../game/AttackScene';
import { MapView } from '../game/MapView';
import { PlayerList } from '../game/parts';

const pl = (seat: number, name: string, explorer: string): PlayerState => ({
  seat, name, explorer, traits: { speed: 4, might: 4, sanity: 4, knowledge: 4 }, tile: 'G:0,0', cards: [], dead: false, side: seat ? 'traitor' : 'hero', flags: {},
});
const s = {
  phase: 'haunt', turn: 0,
  tiles: { 'G:0,0': { room: 'entrance', floor: 'G', x: 0, y: 0, rot: 0 }, 'G:0,-1': { room: 'hallway', floor: 'G', x: 0, y: -1, rot: 0 }, 'G:0,-2': { room: 'stairs', floor: 'G', x: 0, y: -2, rot: 0 } },
  tokens: [], links: [],
  players: [pl(0, '我', 'zhao'), pl(1, 'AI·小翠', 'shen')],
  monsters: [{ id: 9, kind: 'zombie', name: '僵尸', icon: 'zombie', tile: 'G:0,0', traits: { might: 5 }, stunned: false }],
} as unknown as GameState;

const CASES = [
  { t: 'attack', from: { seat: 0 }, to: { seat: 1 }, trait: 'might', a: [2, 1, 2, 0, 1], d: [0, 1, 1], damage: 4, loser: { seat: 1 } },
  { t: 'attack', from: { monster: 9 }, to: { seat: 0 }, trait: 'might', a: [1, 1, 0, 2, 0], d: [2, 2, 1, 1], damage: 2, loser: { monster: 9 } },
  { t: 'attack', from: { seat: 1 }, to: { seat: 0 }, trait: 'sanity', a: [1, 1, 0], d: [2, 0, 0], damage: 0, loser: null },
] as const;

export function DevAttack() {
  const [i, setI] = useState<number | null>(null);
  return (
    <div class="page">
      {CASES.map((_, k) => <button class="btn" onClick={() => setI(k)}>案例 {k + 1}</button>)}
      <div style={{ display: 'flex', gap: '12px', height: '420px', marginTop: '12px' }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex' }}><MapView s={s} floor="G" you={0} /></div>
        <div style={{ width: '280px' }}><PlayerList s={s} you={0} seats={[]} waiting={null} /></div>
      </div>
      {i != null && <AttackScene key={i} s={s} e={CASES[i] as any} onDone={() => setI(null)} />}
    </div>
  );
}
