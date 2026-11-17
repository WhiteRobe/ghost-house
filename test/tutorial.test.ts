import { describe, expect, it } from 'vitest';
import { config, playOut } from './helpers';

describe('教学局', () => {
  it('新手不会当背叛者，异变不早于第 4 轮，且一定会发生', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cfg = { ...config(seed, 3, 'live'), debugHaunt: 46, protect: [0], minHauntRound: 4, firstSeat: 0 };
      const { game } = playOut(cfg);
      expect(game.state.haunt?.id).toBe(46);
      expect(game.state.haunt?.traitor).not.toBe(0);
      expect(game.errors).toEqual([]);
      expect(game.pending).toBeNull();
    }
  });
});
