// 内容作者用的小工具。只能 import type 引擎，避免把引擎打进前端包。
import type { Trait } from '../shared/types';
import type { Game, Gen } from '../engine/game';
import type { CardDef, Fx } from '../engine/defs';

/** 持有期间某项属性 +n：获得时提升，失去时降低 */
export function holdBonus(trait: Trait, n = 1): Pick<CardDef, 'onGain' | 'onLose'> {
  return {
    *onGain(g, s) { yield* g.gain(s, trait, n); },
    *onLose(g, s) { yield* g.lose(s, trait, n); },
  };
}

/**
 * 属性检定结果表。rows 按门槛从高到低：[[5, fx], [3, fx], [0, fx]]，取第一个满足的。
 * 返回掷出的点数。
 */
export function* rollTable(g: Game, seat: number, trait: Trait, rows: [number, Fx][], label?: string): Gen<number> {
  const r = yield* g.check(seat, trait, undefined, label);
  for (const [min, fx] of rows) {
    if (r >= min) {
      yield* fx(g, seat);
      break;
    }
  }
  return r;
}

export const nothing: Fx = function* (g, s) {
  g.log(`${g.p(s).name} 等了一会儿，什么事也没有`, 'info');
};
