// 9 张凶兆。顺序即异变表的列顺序。
import type { CardDef } from '../engine/defs';
import { holdBonus } from './helpers';

export const OMENS: CardDef[] = [
  {
    id: 'mirror', kind: 'omen', name: '铜镜',
    text: '获得时理智 +1，失去时理智 -1。',
    flavor: '镜面映出的你，比你慢半拍眨眼。',
    ...holdBonus('sanity'),
  },
  {
    id: 'effigy', kind: 'omen', name: '纸人',
    text: '伙伴，不能交易。你受到的物理伤害 -1。',
    flavor: '它画着腮红，嘴角似乎比刚才更弯了。',
    bound: true,
    reduceDamage: (_g, _s, kind, n) => (kind === 'physical' ? n - 1 : n),
  },
  {
    id: 'watch', kind: 'omen', name: '停走的怀表',
    text: '获得时速度 +1，失去时速度 -1。',
    flavor: '指针停在三点十七分，但你听得见它在走。',
    ...holdBonus('speed'),
  },
  {
    id: 'jade', kind: 'omen', name: '血沁玉佩',
    text: '你受到的精神伤害 -1。',
    flavor: '玉里有一缕红丝，像血管一样微微跳动。',
    reduceDamage: (_g, _s, kind, n) => (kind === 'mental' ? n - 1 : n),
  },
  {
    id: 'cat', kind: 'omen', name: '黑猫',
    text: '伙伴，不能交易。理智检定时多掷 1 颗骰。',
    flavor: '它不怕生，一直跟着你，好像在等你带它回家。',
    bound: true,
    rollBonus: (_g, _s, trait, purpose) => (trait === 'sanity' && purpose === 'check' ? 1 : 0),
  },
  {
    id: 'diary', kind: 'omen', name: '旧日记',
    text: '获得时知识 +1，失去时知识 -1。',
    flavor: '最后一页的字迹还没干：“他们又来了。”',
    ...holdBonus('knowledge'),
  },
  {
    id: 'sword', kind: 'omen', name: '桃木剑',
    text: '武器。用力量攻击时多掷 1 颗骰。',
    flavor: '剑身刻着褪色的符文，握在手里微微发烫。',
    weapon: { trait: 'might', dice: 1 },
  },
  {
    id: 'shoe', kind: 'omen', name: '绣花鞋',
    text: '获得时速度 +1、理智 -1；失去时速度 -1、理智 +1。',
    flavor: '只有一只。鞋底还是湿的。',
    *onGain(g, s) { yield* g.gain(s, 'speed'); yield* g.lose(s, 'sanity'); },
    *onLose(g, s) { yield* g.lose(s, 'speed'); yield* g.gain(s, 'sanity'); },
  },
  {
    id: 'veil', kind: 'omen', name: '红盖头',
    text: '获得时受到 1 点精神伤害。能力：每回合一次，你可以盖上它，瞬间出现在另一名探险者所在的房间。',
    flavor: '盖头底下，有人在轻轻地笑。',
    *onGain(g, s) { yield* g.damage(s, 'mental', 1, '红盖头'); },
    action: {
      label: '盖上盖头',
      desc: '移动到另一名存活探险者所在的房间',
      can: (g, s) => g.alive().some((o) => o !== s && g.p(o).tile !== g.p(s).tile),
      *run(g, s) {
        const others = g.alive().filter((o) => o !== s && g.p(o).tile !== g.p(s).tile);
        const t = yield* g.choosePlayer(s, '盖头掀开时，你想站在谁身边？', others);
        if (t != null) g.moveTo(s, g.p(t).tile, '红影一闪');
      },
    },
  },
];
