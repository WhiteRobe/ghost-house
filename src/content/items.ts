// 22 张物品。剧本引用时：
//   符咒类：talisman 黄符纸、amulet 平安符；法器：bell 三清铃、compass 罗盘、prayer-beads 佛珠、incense 线香
//   火源：lighter 打火机、matches 火柴；绳子：rope 登山绳；武器：axe crowbar flare-gun bell
import type { CardDef } from '../engine/defs';
import type { Game } from '../engine/game';
import type { Trait } from '../shared/types';
import { EXPLORERS } from './explorers';
import { holdBonus } from './helpers';

/** 低于起始值 */
const below = (g: Game, s: number, t: Trait) => {
  const ex = EXPLORERS.find((e) => e.id === g.p(s).explorer);
  return !!ex && g.p(s).traits[t] < ex.start[t];
};
const floorOf = (key: string) => key.split(':')[0];
const hostileHere = (g: Game, s: number) =>
  g.state.phase === 'haunt' ? g.monstersAt(g.p(s).tile).filter((m) => g.isEnemy(s, { monster: m.id })) : [];

export const ITEMS: CardDef[] = [
  // ---------------- 武器 ----------------
  {
    id: 'axe', kind: 'item', name: '消防斧',
    text: '武器。用力量攻击时多掷 2 颗骰。速度检定少掷 1 颗骰。',
    flavor: '斧柄的红漆掉了一半，刃口磨得发亮。',
    weapon: { trait: 'might', dice: 2 },
    rollBonus: (_g, _s, trait, purpose) => (trait === 'speed' && purpose === 'check' ? -1 : 0),
  },
  {
    id: 'crowbar', kind: 'item', name: '撬棍',
    text: '武器。用力量攻击时多掷 1 颗骰。力量检定时多掷 1 颗骰。',
    flavor: '弯头上卡着半片指甲，不是你的。',
    weapon: { trait: 'might', dice: 1 },
    rollBonus: (_g, _s, trait, purpose) => (trait === 'might' && purpose === 'check' ? 1 : 0),
  },
  {
    id: 'flare-gun', kind: 'item', name: '信号枪',
    text: '武器，只能用一次。用力量攻击时多掷 2 颗骰。可以攻击视线内其他房间的目标，这样攻击输了你不受伤。攻击后弃掉信号枪。',
    flavor: '橙色枪身上印着“海上救生专用”，膛里只有一发。',
    weapon: { trait: 'might', dice: 2, ranged: true, once: true },
  },
  {
    id: 'bell', kind: 'item', name: '三清铃',
    text: '武器（法器）。可以改用理智攻击，双方比理智，你多掷 1 颗骰。不能攻击没有理智值的怪物。',
    flavor: '摇了一下，楼上的脚步声停了。',
    weapon: { trait: 'sanity', dice: 1 },
  },

  // ---------------- 持有加成 ----------------
  {
    id: 'amulet', kind: 'item', name: '平安符',
    text: '符咒。获得时理智 +1，失去时理智 -1。',
    flavor: '红布包的三角符，出门前奶奶硬塞进你兜里的。',
    ...holdBonus('sanity'),
  },
  {
    id: 'gloves', kind: 'item', name: '劳保手套',
    text: '获得时力量 +1，失去时力量 -1。',
    flavor: '帆布手套，掌心印着几个黑指印，比你的手指细。',
    ...holdBonus('might'),
  },
  {
    id: 'sneakers', kind: 'item', name: '跑鞋',
    text: '获得时速度 +1，失去时速度 -1。',
    flavor: '鞋码刚好是你的。为什么会刚好是你的？',
    ...holdBonus('speed'),
  },
  {
    id: 'notebook', kind: 'item', name: '探灵笔记',
    text: '获得时知识 +1，失去时知识 -1。',
    flavor: '前一个探灵博主留下的本子，最后几页被撕掉了。',
    ...holdBonus('knowledge'),
  },

  // ---------------- 检定加骰 ----------------
  {
    id: 'flashlight', kind: 'item', name: '强光手电',
    text: '速度检定时多掷 1 颗骰。',
    flavor: '光柱扫到墙角，一只手缩了回去。',
    rollBonus: (_g, _s, trait, purpose) => (trait === 'speed' && purpose === 'check' ? 1 : 0),
  },
  {
    id: 'compass', kind: 'item', name: '罗盘',
    text: '法器。知识检定时多掷 1 颗骰。',
    flavor: '磁针一直在抖，针尖朝着楼下。',
    rollBonus: (_g, _s, trait, purpose) => (trait === 'knowledge' && purpose === 'check' ? 1 : 0),
  },
  {
    id: 'prayer-beads', kind: 'item', name: '佛珠',
    text: '法器。理智检定时多掷 1 颗骰。',
    flavor: '一百零八颗，你数了三遍，每次都多出一颗。',
    rollBonus: (_g, _s, trait, purpose) => (trait === 'sanity' && purpose === 'check' ? 1 : 0),
  },
  {
    id: 'lighter', kind: 'item', name: '打火机',
    text: '火源（剧本中可以用来点火）。被攻击时，防御多掷 1 颗骰。',
    flavor: '“咔嚓”一下，火苗蹿起来，照见门背后挂着一件湿雨衣。',
    rollBonus: (_g, _s, _t, purpose) => (purpose === 'defend' ? 1 : 0),
  },

  // ---------------- 减伤 ----------------
  {
    id: 'helmet', kind: 'item', name: '安全帽',
    text: '一次受到 2 点或以上物理伤害时，伤害 -1。',
    flavor: '黄色塑料帽，帽檐上写着“拆迁办”。',
    reduceDamage: (_g, _s, kind, n) => (kind === 'physical' && n >= 2 ? n - 1 : n),
  },
  {
    id: 'headphones', kind: 'item', name: '降噪耳机',
    text: '一次受到 2 点或以上精神伤害时，伤害 -1。',
    flavor: '开到最大也盖不住那阵笑声，只是小了一点。',
    reduceDamage: (_g, _s, kind, n) => (kind === 'mental' && n >= 2 ? n - 1 : n),
  },

  // ---------------- 一次性消耗品 ----------------
  {
    id: 'medkit', kind: 'item', name: '急救包',
    text: '能力：把你或同一房间里一名探险者的力量和速度恢复到起始值，然后弃掉急救包。',
    flavor: '十字标志已经褪成粉色，绷带倒还是新的。',
    action: {
      label: '包扎', discard: true,
      *run(g, s) {
        const here = [s, ...g.playersAt(g.p(s).tile).filter((o) => o !== s)];
        const t = yield* g.choosePlayer(s, '给谁包扎？', here);
        if (t == null) return;
        g.heal(t, 'might');
        g.heal(t, 'speed');
        g.log(`${g.p(t).name} 包扎好了伤口`, 'good', t);
      },
      ai: (g, s) => (below(g, s, 'might') && below(g, s, 'speed')) || g.value(s, 'might') <= 2 || g.value(s, 'speed') <= 2,
    },
  },
  {
    id: 'painkiller', kind: 'item', name: '止痛药',
    text: '能力：力量 +1 或速度 +1（自选），然后弃掉止痛药。',
    flavor: '说明书上写着“每日不超过两次”，你已经记不清是第几次了。',
    action: {
      label: '吃药', discard: true,
      *run(g, s) {
        const i = yield* g.choose(s, '哪里最疼？', ['力量 +1', '速度 +1']);
        yield* g.gain(s, i === 0 ? 'might' : 'speed', 1);
      },
      ai: (g, s) => below(g, s, 'might'),
    },
  },
  {
    id: 'talisman', kind: 'item', name: '黄符纸',
    text: '符咒。能力：同一房间有敌对怪物，或你的理智低于起始值时可以使用。选一项：对同一房间一只敌对怪物造成 2 点伤害（通常会让它眩晕）；或者把你的理智恢复到起始值。然后弃掉黄符纸。',
    flavor: '朱砂画的符，蹭一下，手指就红了。',
    action: {
      label: '贴符', discard: true,
      can: (g, s) => hostileHere(g, s).length > 0 || below(g, s, 'sanity'),
      *run(g, s) {
        const ms = hostileHere(g, s);
        const opts = [...ms.map((m) => `贴在「${m.name}」身上`), '烧掉它（理智恢复到起始值）'];
        const i = yield* g.choose(s, '这张符用在哪？', opts);
        if (i < ms.length) {
          g.log(`${g.p(s).name} 把黄符拍在「${ms[i].name}」脑门上`, 'good', s);
          yield* g.hurtMonster(ms[i].id, 2, s);
        } else {
          g.heal(s, 'sanity');
        }
      },
      ai: (g, s) => !g.isTraitor(s) && (hostileHere(g, s).length > 0 || g.value(s, 'sanity') <= 2),
    },
  },
  {
    id: 'matches', kind: 'item', name: '火柴',
    text: '火源（剧本中可以用来点火）。能力：你和同一房间的每名探险者理智 +1，然后弃掉火柴。',
    flavor: '老式的“洋火”，盒子上印着穿旗袍的女人。',
    action: {
      label: '划火柴', discard: true,
      *run(g, s) {
        for (const o of g.playersAt(g.p(s).tile)) yield* g.gain(o, 'sanity', 1);
      },
      ai: (g, s) => g.state.phase === 'explore' && g.playersAt(g.p(s).tile).length >= 2,
    },
  },
  {
    id: 'rope', kind: 'item', name: '登山绳',
    text: '绳子（剧本中可能用到）。能力：你不在地下室时可以使用。移动到下一层任意一个已发现的房间（不花移动），然后弃掉登山绳。',
    flavor: '二十米长，承重三百公斤，绳结打得很专业，不是你打的。',
    action: {
      label: '垂降', discard: true,
      can: (g, s) => floorOf(g.p(s).tile) !== 'B',
      *run(g, s) {
        const to = floorOf(g.p(s).tile) === 'U' ? 'G' : 'B';
        const tiles = Object.keys(g.state.tiles).filter((k) => floorOf(k) === to);
        const t = yield* g.chooseTile(s, '降到哪个房间？', tiles);
        if (t) yield* g.moveInto(s, t, '顺着绳子滑了下去');
      },
      ai: () => false,
    },
  },
  {
    id: 'phone', kind: 'item', name: '手机',
    text: '能力：本回合移动 +2，然后弃掉手机。',
    flavor: '电量 3%，没有信号，相册里多了几张你没拍过的照片。',
    action: {
      label: '打开手电筒', discard: true,
      *run(g) { g.state.moveLeft += 2; },
      ai: (g) => g.state.moveLeft === 0,
    },
  },
  {
    id: 'energy-drink', kind: 'item', name: '功能饮料',
    text: '能力：速度 +1，本回合移动 +1，然后弃掉功能饮料。',
    flavor: '罐子上写着“熬夜必备”，保质期到 2009 年。',
    action: {
      label: '喝掉', discard: true,
      *run(g, s) {
        yield* g.gain(s, 'speed', 1);
        g.state.moveLeft += 1;
      },
      ai: () => true,
    },
  },
  {
    id: 'incense', kind: 'item', name: '线香',
    text: '法器。能力：理智 +1；如果你在祠堂或佛堂，知识也 +1。然后弃掉线香。',
    flavor: '一把没拆封的线香，包装纸上写着“敬祖”。',
    action: {
      label: '上香', discard: true,
      *run(g, s) {
        const room = g.roomOf(s)?.id;
        yield* g.gain(s, 'sanity', 1);
        if (room === 'ancestral-hall' || room === 'chapel') yield* g.gain(s, 'knowledge', 1);
      },
      ai: (g, s) => {
        const room = g.roomOf(s)?.id;
        return room === 'ancestral-hall' || room === 'chapel' || g.value(s, 'sanity') <= 2;
      },
    },
  },
];
