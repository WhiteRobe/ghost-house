// 用法：npx tsx scripts/sim.ts [局数] [人数]
import { config, playOut } from '../test/helpers';

const games = Number(process.argv[2] ?? 5);
const n = Number(process.argv[3] ?? 4);
const stats: Record<string, number> = {};
for (let seed = 1; seed <= games; seed++) {
  const t0 = performance.now();
  const { game, steps } = playOut(config(seed, n));
  const w = game.state.winner;
  const key = `${game.state.haunt?.id ?? '-'} ${game.state.haunt?.title ?? '无异变'} -> ${w?.side}`;
  stats[key] = (stats[key] ?? 0) + 1;
  console.log(`#${seed} ${steps} 步 ${Math.round(performance.now() - t0)}ms 轮次 ${game.state.round} 异变轮 ${game.state.haunt?.round ?? 0} 房间 ${Object.keys(game.state.tiles).length} ${key} ${w?.text ?? ''}`);
}
console.log(stats);
