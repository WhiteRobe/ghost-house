// 每个异变：不同人数、不同种子，AI 互打都能结束，且内容层不报错、可以重放。
// 只跑某一个：npx vitest run test/haunts.test.ts -t "h12 "
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine';
import { HAUNTS } from '../src/haunts';
import { config, playOut } from './helpers';

describe('异变冒烟', () => {
  for (const h of Object.values(HAUNTS)) {
    it(`h${h.id} ${h.title}`, () => {
      const results: string[] = [];
      for (const [seed, n] of [[11, 3], [12, 4], [13, 5], [14, 6], [15, 4], [16, 3]] as const) {
        const cfg = { ...config(seed * 100 + h.id, n), debugHaunt: h.id };
        const { game, steps } = playOut(cfg);
        expect(game.errors, `seed ${seed} n ${n}`).toEqual([]);
        expect(game.state.haunt?.id, `seed ${seed} 没进入异变`).toBe(h.id);
        expect(game.pending, `seed ${seed} n ${n} 没结束（${steps} 步）`).toBeNull();
        expect(game.state.winner).not.toBeNull();
        const again = Game.restore(cfg, game.answers);
        expect(JSON.stringify(again.state)).toBe(JSON.stringify(game.state));
        results.push(`${n}人:${game.state.winner!.side}@${game.state.haunt!.round}`);
      }
      console.log(`h${h.id} ${h.title}: ${results.join(' ')}`);
    });
  }
});
