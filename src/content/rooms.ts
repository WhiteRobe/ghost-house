// 房间板块（不含起始房间）。doors：1 北 2 东 4 南 8 西。symbols：发现时要抽的牌。
import type { RoomDef } from '../engine/defs';

export const ROOMS_LIST: RoomDef[] = [
  {
    id: 'cellar-hatch', name: '地窖口', floors: ['G'], doors: 1 | 4, symbols: ['event'],
    link: 'basement-landing',
    text: '地板上有一块活板门，下面的石阶直通地下室楼梯口（两间房相连）。',
  },
  {
    id: 'library', name: '书房', floors: ['G', 'U'], doors: 1 | 2, symbols: ['event'],
    text: '每人每局一次：在这里结束回合时，知识 +1。',
    *onEndTurn(g, s) {
      const p = g.p(s);
      if (p.flags['library']) return;
      p.flags['library'] = true;
      yield* g.gain(s, 'knowledge', 1);
    },
  },
  {
    id: 'furnace', name: '锅炉房', floors: ['B'], doors: 1 | 2 | 4, symbols: ['omen'], harmful: true,
    text: '在这里结束回合时，受到 1 点物理伤害。',
    *onEndTurn(g, s) { yield* g.damage(s, 'physical', 1, '锅炉房的热浪'); },
  },
  {
    id: 'collapsed', name: '坍塌的卧室', floors: ['G', 'U'], doors: 15, symbols: [], harmful: true,
    text: '在这里结束回合时，进行速度 5+ 检定；失败则从破洞跌落到地下室楼梯口，受到 1 骰物理伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'speed', 5);
      if (r >= 5) return;
      g.moveTo(s, 'B:0,-2', '地板塌了！');
      const d = yield* g.roll(1, '坠落伤害', s);
      yield* g.damage(s, 'physical', d, '坠落');
    },
  },
  {
    id: 'chapel', name: '佛堂', floors: ['G', 'U'], doors: 1, symbols: ['omen'],
    text: '每人每局一次：在这里结束回合时，理智 +1。',
    *onEndTurn(g, s) {
      const p = g.p(s);
      if (p.flags['chapel']) return;
      p.flags['chapel'] = true;
      yield* g.gain(s, 'sanity', 1);
    },
  },
  {
    id: 'storeroom', name: '储藏间', floors: ['B', 'G', 'U'], doors: 1 | 4, symbols: ['item'],
    text: '堆满了蒙着白布的旧家具。',
  },
];
