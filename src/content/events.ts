import type { CardDef } from '../engine/defs';
import { rollTable } from './helpers';

export const EVENTS: CardDef[] = [
  {
    id: 'whisper', kind: 'event', name: '耳边低语',
    text: '理智检定。4+：你定了定神，理智 +1。1-3：受到 1 点精神伤害。0：受到 2 点精神伤害。',
    *run(g, s) {
      yield* rollTable(g, s, 'sanity', [
        [4, function* (g, s) { yield* g.gain(s, 'sanity', 1); }],
        [1, function* (g, s) { yield* g.damage(s, 'mental', 1, '耳边低语'); }],
        [0, function* (g, s) { yield* g.damage(s, 'mental', 2, '耳边低语'); }],
      ]);
    },
  },
  {
    id: 'rat', kind: 'event', name: '老鼠群',
    text: '速度检定。3+：你跳开了。0-2：受到 1 点物理伤害。',
    *run(g, s) {
      const r = yield* g.check(s, 'speed', 3);
      if (r < 3) yield* g.damage(s, 'physical', 1, '老鼠群');
    },
  },
  {
    id: 'old-photo', kind: 'event', name: '泛黄的合影',
    text: '知识检定。4+：你认出了照片里的人，知识 +1。0-3：什么也没发生。',
    *run(g, s) {
      const r = yield* g.check(s, 'knowledge', 4);
      if (r >= 4) yield* g.gain(s, 'knowledge', 1);
    },
  },
  {
    id: 'suona', kind: 'event', name: '唢呐声',
    text: '远处传来迎亲的唢呐。若已出现至少 3 个凶兆，异变立即开始（纸人娶亲）。',
    haunt: 46,
  },
];
