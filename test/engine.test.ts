import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine';
import { config, playOut } from './helpers';

describe('引擎冒烟', () => {
  it('AI 能把一局打完，且可以重放恢复', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const cfg = config(seed, 3 + (seed % 4));
      const { game, steps } = playOut(cfg);
      expect(game.pending, `seed ${seed} 没结束，步数 ${steps}`).toBeNull();
      expect(game.state.winner).not.toBeNull();
      const again = Game.restore(cfg, game.answers);
      expect(JSON.stringify(again.state)).toBe(JSON.stringify(game.state));
    }
  });
});
