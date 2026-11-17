import type { CardDef } from '../engine/defs';
import { holdBonus } from './helpers';

export const ITEMS: CardDef[] = [
  {
    id: 'flashlight', kind: 'item', name: '强光手电',
    text: '速度检定时多掷 1 颗骰。',
    rollBonus: (_g, _s, trait, purpose) => (trait === 'speed' && purpose === 'check' ? 1 : 0),
  },
  {
    id: 'axe', kind: 'item', name: '消防斧',
    text: '武器。用力量攻击时多掷 1 颗骰。',
    weapon: { trait: 'might', dice: 1 },
  },
  {
    id: 'medkit', kind: 'item', name: '急救包',
    text: '能力：把你或同一房间里一名探险者的力量和速度恢复到起始值，然后弃掉急救包。',
    action: {
      label: '包扎', discard: true,
      *run(g, s) {
        const here = g.playersAt(g.p(s).tile);
        const t = yield* g.choosePlayer(s, '给谁包扎？', here);
        if (t == null) return;
        g.heal(t, 'might');
        g.heal(t, 'speed');
      },
      ai: (g, s) => g.value(s, 'might') < 3 || g.value(s, 'speed') < 3,
    },
  },
  {
    id: 'amulet', kind: 'item', name: '平安符',
    text: '获得时理智 +1，失去时理智 -1。',
    ...holdBonus('sanity'),
  },
];
