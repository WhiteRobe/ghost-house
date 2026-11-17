import { Game, aiAnswer } from '../src/engine';
import type { GameConfig, RuleMode } from '../src/shared/types';
import { EXPLORERS, SCENARIOS } from '../src/content';

export function config(seed: number, n = 4, scenario?: string, mode: RuleMode = 'standard'): GameConfig {
  const boards = new Set<number>();
  const picks: string[] = [];
  const all = Object.values(EXPLORERS);
  for (let i = 0; picks.length < n; i++) {
    const e = all[(seed * 7 + i * 5) % all.length];
    if (boards.has(e.board)) continue;
    boards.add(e.board);
    picks.push(e.id);
  }
  const sc = Object.keys(SCENARIOS);
  return {
    seed,
    seats: picks.map((explorer, i) => ({ name: `AI${i + 1}`, ai: 'normal', explorer })),
    scenario: scenario ?? sc[seed % sc.length],
    mode,
  };
}

/** AI 互打到结束，返回游戏和步数。forceHaunt：直接从探索跳到指定异变 */
export function playOut(cfg: GameConfig, maxSteps = 20000): { game: Game; steps: number } {
  const game = Game.create(cfg);
  let steps = 0;
  while (game.pending && steps < maxSteps) {
    const a = aiAnswer(game, game.pending);
    const r = game.answer(a);
    if (!r.ok) throw new Error(`AI 回答被拒：${r.error} ${JSON.stringify(game.pending).slice(0, 300)} ${JSON.stringify(a)}`);
    steps++;
  }
  return { game, steps };
}
