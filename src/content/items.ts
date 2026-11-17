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
    text: '武器。用力量攻击时多掷 2 颗骰。太沉了：持有时速度检定少掷 1 颗骰。',
    flavor: '斧柄上的红漆剥落了，刃口却磨得发亮。',
    weapon: { trait: 'might', dice: 2 },
    rollBonus: (_g, _s, trait, purpose) => (trait === 'speed' && purpose === 'check' ? -1 : 0),
  },
  {
    id: 'crowbar', kind: 'item', name: '撬棍',
    text: '武器。用力量攻击时多掷 1 颗骰。力量检定时多掷 1 颗骰。',
    flavor: '撬门、撬箱子、撬开不该撬开的东西。',
    weapon: { trait: 'might', dice: 1 },
    rollBonus: (_g, _s, trait, purpose) => (trait === 'might' && purpose === 'check' ? 1 : 0),
  },
  {
    id: 'flare-gun', kind: 'item', name: '信号枪',
    text: '远程武器（只有一发）。可以用力量攻击视线内的目标，多掷 2 颗骰；远程攻击失败你不会受伤。开火后弃掉信号枪。',
    flavor: '橙色枪身上印着“海上救生专用”。只剩一发了。',
    weapon: { trait: 'might', dice: 2, ranged: true, once: true },
  },
  {
    id: 'bell', kind: 'item', name: '三清铃',
    text: '精神武器（法器）。可以改用理智攻击（双方比理智），多掷 1 颗骰。只能对有理智的对手使用。',
    flavor: '铃声一响，屋里的东西好像都停下来听了一下。',
    weapon: { trait: 'sanity', dice: 1 },
  },

  // ---------------- 持有加成 ----------------
  {
    id: 'amulet', kind: 'item', name: '平安符',
    text: '符咒。获得时理智 +1，失去时理智 -1。',
    flavor: '红布包着的三角符，是出门前奶奶硬塞给你的。',
    ...holdBonus('sanity'),
  },
  {
    id: 'gloves', kind: 'item', name: '劳保手套',
    text: '获得时力量 +1，失去时力量 -1。',
    flavor: '帆布手套，掌心沾着不知道谁的黑色指印。',
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
    flavor: '光柱扫过的地方，总有什么东西刚刚缩回去。',
    rollBonus: (_g, _s, trait, purpose) => (trait === 'speed' && purpose === 'check' ? 1 : 0),
  },
  {
    id: 'compass', kind: 'item', name: '罗盘',
    text: '法器。知识检定时多掷 1 颗骰。',
    flavor: '天池里的磁针一直在抖，始终指向楼下。',
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
    flavor: '“咔嚓”一声，火苗窜起来，黑暗往后退了半步。',
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
    flavor: '开到最大也盖不住那阵笑声，但至少小了一点。',
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
        g.log(`${g.p(t).name} 的伤口包扎好了`, 'good', t);
      },
      ai: (g, s) => (below(g, s, 'might') && below(g, s, 'speed')) || g.value(s, 'might') <= 2 || g.value(s, 'speed') <= 2,
    },
  },
  {
    id: 'painkiller', kind: 'item', name: '止痛药',
    text: '能力：吞两片，力量或速度 +1（自选），然后弃掉止痛药。',
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
    text: '符咒。能力：异变后，对同一房间里一只怪物造成 2 点伤害（通常会使它眩晕）；或者把你的理智恢复到起始值。然后弃掉黄符纸。',
    flavor: '朱砂画的符，墨迹像是昨天才干。',
    action: {
      label: '贴符', discard: true,
      can: (g, s) => hostileHere(g, s).length > 0 || below(g, s, 'sanity'),
      *run(g, s) {
        const ms = hostileHere(g, s);
        const opts = [...ms.map((m) => `贴在「${m.name}」身上`), '烧掉符纸，定一定神（理智恢复到起始值）'];
        const i = yield* g.choose(s, '这张符用在哪？', opts);
        if (i < ms.length) {
          g.log(`${g.p(s).name} 把黄符拍在「${ms[i].name}」身上`, 'good', s);
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
    text: '火源（剧本中可以用来点火）。能力：划亮最后几根，你和同一房间所有探险者理智 +1，然后弃掉火柴。',
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
    text: '绳子（剧本中可能用到）。能力：顺着绳子垂降，移动到下一层任意一个已发现的房间（不花移动），然后弃掉登山绳。',
    flavor: '二十米长，承重三百公斤，结头打得很专业。',
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
    text: '能力：打开手电筒照路，本回合移动 +2。电量耗尽，弃掉手机。',
    flavor: '电量 3%，没有信号，相册里多了几张你没拍过的照片。',
    action: {
      label: '打开手电筒', discard: true,
      *run(g) { g.state.moveLeft += 2; },
      ai: (g) => g.state.moveLeft === 0,
    },
  },
  {
    id: 'energy-drink', kind: 'item', name: '功能饮料',
    text: '能力：一口气喝完，速度 +1，本回合移动 +1。然后弃掉功能饮料。',
    flavor: '罐子上写着“熬夜必备”。今晚确实需要。',
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
    text: '法器。能力：点上三炷香。若你在祠堂或佛堂，理智和知识各 +1；否则理智 +1。然后弃掉线香。',
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
