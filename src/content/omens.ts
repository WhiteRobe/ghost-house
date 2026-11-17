// 9 张凶兆。顺序即异变表的列顺序。
import type { CardDef } from '../engine/defs';
import { holdBonus } from './helpers';

export const OMENS: CardDef[] = [
  {
    id: 'mirror', kind: 'omen', name: '铜镜',
    text: '获得时理智 +1，失去时理智 -1。',
    flavor: '镜子里的你眨眼，总比你慢半拍。',
    ...holdBonus('sanity'),
  },
  {
    id: 'effigy', kind: 'omen', name: '纸人',
    text: '伙伴，不能交易。你每次受到的物理伤害 -1。',
    flavor: '脸上画着两团腮红。刚才看它的时候，它嘴角没这么弯。',
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
    text: '你每次受到的精神伤害 -1。',
    flavor: '玉里有根红丝，贴着手心的时候会跳。',
    reduceDamage: (_g, _s, kind, n) => (kind === 'mental' ? n - 1 : n),
  },
  {
    id: 'cat', kind: 'omen', name: '黑猫',
    text: '伙伴，不能交易。理智检定时多掷 1 颗骰。',
    flavor: '它一点不怕生，你走到哪它跟到哪，尾巴老绕着你的脚踝。',
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
    text: '武器。用它做力量攻击时多掷 1 颗骰。',
    flavor: '剑身上的符文快磨平了，握久了手心发烫。',
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
    text: '获得时受到 1 点精神伤害。每回合一次：你可以盖上它，直接移到另一名存活探险者所在的房间，不花移动。',
    flavor: '盖头底下有人在笑，声音就贴在你耳边。',
    *onGain(g, s) { yield* g.damage(s, 'mental', 1, '红盖头'); },
    action: {
      label: '盖上盖头',
      desc: '移动到另一名存活探险者所在的房间',
      can: (g, s) => g.alive().some((o) => o !== s && g.p(o).tile !== g.p(s).tile),
      *run(g, s) {
        const others = g.alive().filter((o) => o !== s && g.p(o).tile !== g.p(s).tile);
        const t = yield* g.choosePlayer(s, '掀开盖头时，你要站在谁旁边？', others);
        if (t != null) g.moveTo(s, g.p(t).tile, '红影一闪');
      },
    },
  },
];
