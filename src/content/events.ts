// 43 张事件。其中 5 张会触发异变（haunt 字段）：suona→46、blackout→47、midnight-call→48、well-voice→49、opera-gong→50。
import type { CardDef, Fx } from '../engine/defs';
import type { Game } from '../engine/game';
import type { Trait } from '../shared/types';
import { rollTable } from './helpers';

const NAME: Record<Trait, string> = { speed: '速度', might: '力量', sanity: '理智', knowledge: '知识' };
const floorOf = (key: string) => key.split(':')[0];

// ---- 小积木 ----
const none: Fx = function* (g, s) { g.log(`${g.p(s).name} 有惊无险`, 'info', s); };
const gain = (t: Trait, n = 1): Fx => function* (g, s) { yield* g.gain(s, t, n); };
const gain2 = (a: Trait, b: Trait): Fx => function* (g, s) { yield* g.gain(s, a, 1); yield* g.gain(s, b, 1); };
const lose = (t: Trait, n = 1): Fx => function* (g, s) { yield* g.lose(s, t, n); };
const phys = (n: number, why: string): Fx => function* (g, s) { yield* g.damage(s, 'physical', n, why); };
const ment = (n: number, why: string): Fx => function* (g, s) { yield* g.damage(s, 'mental', n, why); };
const dieDmg = (kind: 'physical' | 'mental', why: string): Fx => function* (g, s) {
  const n = yield* g.roll(1, why, s);
  if (n > 0) yield* g.damage(s, kind, n, why);
  else g.log(`${g.p(s).name} 运气不错，没有受伤`, 'good', s);
};
const item: Fx = function* (g, s) { yield* g.draw(s, 'item'); };
const both = (a: Fx, b: Fx): Fx => function* (g, s) { yield* a(g, s); yield* b(g, s); };

/** 检定表：rows 从高到低 */
function table(trait: Trait, rows: [number, Fx][]): Fx {
  return function* (g, s) {
    const need = rows.length > 1 ? rows[0][0] : undefined;
    yield* rollTable(g, s, trait, rows, `${NAME[trait]}检定${need != null ? ` ${need}+` : ''}`);
  };
}

/** 同房间每个人各做一次检定，低于 need 的执行 fail */
function everyone(trait: Trait, need: number, fail: Fx): Fx {
  return function* (g, s) {
    for (const o of g.playersAt(g.p(s).tile)) {
      const r = yield* g.check(o, trait, need);
      if (r < need) yield* fail(g, o);
    }
  };
}

function randomTileOnFloor(g: Game, s: number): string | null {
  const here = g.p(s).tile;
  const list = Object.keys(g.state.tiles).filter((k) => floorOf(k) === floorOf(here) && k !== here);
  return list.length ? list[g.rng.int(list.length)] : null;
}

export const EVENTS: CardDef[] = [
  // ====================== 检定 + 结果表 ======================
  {
    id: 'whisper', kind: 'event', name: '耳边低语',
    text: '理智检定。4+：你定了定神，理智 +1。1-3：受到 1 点精神伤害。0：受到 2 点精神伤害。',
    flavor: '有人贴着你的耳朵，一遍遍念你的小名。',
    run: table('sanity', [[4, gain('sanity')], [1, ment(1, '耳边低语')], [0, ment(2, '耳边低语')]]),
  },
  {
    id: 'rat', kind: 'event', name: '老鼠搬家',
    text: '速度检定。3+：你跳开了。0-2：被咬了几口，受到 1 点物理伤害。',
    flavor: '黑压压一片从墙缝里涌出来，排着队，像在赶路。',
    run: table('speed', [[3, none], [0, phys(1, '老鼠搬家')]]),
  },
  {
    id: 'old-photo', kind: 'event', name: '泛黄的合影',
    text: '知识检定。4+：你认出了照片里的人，知识 +1。0-3：照片里多出来的那个人在看你，受到 1 点精神伤害。',
    flavor: '一家七口站在洋楼前。你数了数，是八个人。',
    run: table('knowledge', [[4, gain('knowledge')], [0, ment(1, '泛黄的合影')]]),
  },
  {
    id: 'chandelier', kind: 'event', name: '吊灯坠落',
    text: '速度检定。4+：你扑到一边，毫发无伤。2-3：被碎玻璃划伤，受到 1 点物理伤害。0-1：被砸中，受到 2 点物理伤害。',
    flavor: '铁链“嘎吱”一声，头顶的水晶吊灯晃了晃。',
    run: table('speed', [[4, none], [2, phys(1, '吊灯坠落')], [0, phys(2, '吊灯坠落')]]),
  },
  {
    id: 'stuck-door', kind: 'event', name: '卡死的门',
    text: '力量检定。4+：你一肩膀撞开了门，力量 +1。0-3：门纹丝不动，你扭伤了肩膀，受到 1 点物理伤害。',
    flavor: '门把手是温的，好像刚刚有人握过。',
    run: table('might', [[4, gain('might')], [0, phys(1, '卡死的门')]]),
  },
  {
    id: 'blood-handprint', kind: 'event', name: '墙上的血手印',
    text: '知识检定。4+：你看出这是朱砂混着鸡血，是驱邪用的，知识 +1。0-3：手印越来越多，受到 1 点理智伤害。',
    flavor: '一排小小的手印，从墙脚一直按到天花板。',
    *run(g, s) {
      yield* rollTable(g, s, 'knowledge', [
        [4, gain('knowledge')],
        [0, function* (g, s) { yield* g.damage(s, 'sanity', 1, '墙上的血手印'); }],
      ], '知识检定 4+');
    },
  },
  {
    id: 'old-radio', kind: 'event', name: '自己打开的收音机',
    text: '知识检定。5+：你听懂了电台在播什么，知识和理智各 +1。2-4：只有沙沙声。0-1：电台在念你的名字，受到 1 点精神伤害。',
    flavor: '“……下面插播一条寻人启事……”',
    run: table('knowledge', [[5, gain2('knowledge', 'sanity')], [2, none], [0, ment(1, '收音机')]]),
  },
  {
    id: 'footsteps', kind: 'event', name: '楼上的脚步声',
    text: '理智检定。3+：只是房子在热胀冷缩。0-2：脚步声停在了你正上方，受到 1 点精神伤害。',
    flavor: '咚，咚，咚。走到一半，忽然变成了跑。',
    run: table('sanity', [[3, none], [0, ment(1, '楼上的脚步声')]]),
  },
  {
    id: 'cold-hand', kind: 'event', name: '冰冷的手',
    text: '力量检定。4+：你甩开了它，力量 +1。0-3：它抓得更紧了，掷 1 颗骰，受到等量物理伤害。',
    flavor: '黑暗里有一只手握住了你的手腕，指甲很长。',
    run: table('might', [[4, gain('might')], [0, dieDmg('physical', '冰冷的手')]]),
  },
  {
    id: 'rotten-floor', kind: 'event', name: '朽烂的地板',
    text: '速度检定。4+：你及时跳开。0-3：地板塌了，受到 1 点物理伤害；如果你不在地下室，你掉到「地下室楼梯口」。',
    flavor: '脚下的木板发出一声长长的叹息。',
    run: table('speed', [[4, none], [0, function* (g, s) {
      yield* g.damage(s, 'physical', 1, '朽烂的地板');
      const to = g.findTile('basement-landing');
      if (to && floorOf(g.p(s).tile) !== 'B') yield* g.moveInto(s, to, '从地板的破洞掉了下去');
    }]]),
  },
  {
    id: 'shadow-puppet', kind: 'event', name: '窗纸上的皮影',
    text: '知识检定。4+：你认出这是哪一出戏，知识 +1。0-3：皮影转过脸来看你，理智 -1。',
    flavor: '没有灯，窗纸上的小人却在一招一式地唱。',
    run: table('knowledge', [[4, gain('knowledge')], [0, lose('sanity')]]),
  },
  {
    id: 'red-thread', kind: 'event', name: '缠身的红线',
    text: '速度检定。4+：你挣脱了。0-3：红线勒进了脚踝，速度 -1。',
    flavor: '红线的另一头，消失在门缝下面。',
    run: table('speed', [[4, none], [0, lose('speed')]]),
  },
  {
    id: 'mirror-face', kind: 'event', name: '镜中的脸',
    text: '理智检定。5+：你直视着它，它先移开了视线，理智 +1。2-4：受到 1 点精神伤害。0-1：受到 2 点精神伤害。',
    flavor: '镜子里的你在笑。你没有笑。',
    run: table('sanity', [[5, gain('sanity')], [2, ment(1, '镜中的脸')], [0, ment(2, '镜中的脸')]]),
  },
  {
    id: 'crying-child', kind: 'event', name: '孩子的哭声',
    text: '理智检定。4+：你循着哭声找到了墙里的空洞，知识 +1。0-3：哭声变成了笑声，受到 1 点精神伤害。',
    flavor: '“妈妈……妈妈你在哪……”',
    run: table('sanity', [[4, gain('knowledge')], [0, ment(1, '孩子的哭声')]]),
  },
  {
    id: 'portrait-eyes', kind: 'event', name: '画像的眼睛',
    text: '理智检定。4+：你确定那只是画。1-3：受到 1 点精神伤害。0：画像的眼睛跟着你转，理智 -1、知识 -1。',
    flavor: '老太爷穿着长衫坐在太师椅上，眼珠是后来补上去的。',
    run: table('sanity', [[4, none], [1, ment(1, '画像的眼睛')], [0, both(lose('sanity'), lose('knowledge'))]]),
  },
  {
    id: 'opera-mask', kind: 'event', name: '墙上的脸谱',
    text: '理智检定。4+：你认出这是镇宅的钟馗脸谱，理智 +1。0-3：脸谱的嘴动了，受到 1 点知识伤害。',
    flavor: '一整面墙的脸谱，红的、白的、黑的，都朝着门口。',
    run: table('sanity', [[4, gain('sanity')], [0, function* (g, s) { yield* g.damage(s, 'knowledge', 1, '墙上的脸谱'); }]]),
  },
  {
    id: 'camphor-chest', kind: 'event', name: '樟木箱',
    text: '力量检定。4+：你撬开了箱子，抽 1 张物品。0-3：箱盖砸在你手上，受到 1 点物理伤害。',
    flavor: '箱子上贴着封条，日期是民国二十六年。',
    run: table('might', [[4, item], [0, phys(1, '樟木箱')]]),
  },
  {
    id: 'hidden-drawer', kind: 'event', name: '书桌暗格',
    text: '知识检定。4+：你找到了机关，抽 1 张物品。0-3：机关里弹出一根针，受到 1 点物理伤害。',
    flavor: '抽屉比看上去浅了两寸。',
    run: table('knowledge', [[4, item], [0, phys(1, '书桌暗格')]]),
  },
  {
    id: 'tv-snow', kind: 'event', name: '雪花电视',
    text: '知识检定。4+：你从雪花里看出一张平面图，知识 +1。0-3：雪花里有人在往外爬，受到 1 点理智伤害。',
    flavor: '这台黑白电视根本没插电。',
    run: table('knowledge', [[4, gain('knowledge')], [0, function* (g, s) { yield* g.damage(s, 'sanity', 1, '雪花电视'); }]]),
  },
  {
    id: 'long-hair', kind: 'event', name: '水池里的长发',
    text: '力量检定。3+：你把手抽了回来。0-2：头发缠住你往下拽，受到 1 点物理伤害和 1 点精神伤害。',
    flavor: '一大团黑发堵在下水口，还在慢慢往上冒。',
    run: table('might', [[3, none], [0, both(phys(1, '水池里的长发'), ment(1, '水池里的长发'))]]),
  },
  {
    id: 'cobweb', kind: 'event', name: '满屋蛛网',
    text: '速度检定。3+：你钻了过去。0-2：你被缠住了，本回合剩余移动清零。',
    flavor: '蛛网密得像纱帐，正中间挂着一只绣花荷包。',
    run: table('speed', [[3, none], [0, function* (g, s) {
      g.state.moveLeft = 0;
      g.log(`${g.p(s).name} 被蛛网缠住，动弹不得`, 'bad', s);
    }]]),
  },
  {
    id: 'lullaby', kind: 'event', name: '摇篮曲',
    text: '理智检定。4+：你咬住舌尖保持清醒，理智 +1。0-3：你靠着墙睡着了，立即结束你的回合。',
    flavor: '女人的声音轻轻哼着：“月光光，照地堂……”',
    run: table('sanity', [[4, gain('sanity')], [0, function* (g, s) {
      g.log(`${g.p(s).name} 不知不觉睡着了`, 'bad', s);
      g.endTurn();
    }]]),
  },
  {
    id: 'ancestor-tablet', kind: 'event', name: '牌位上的名字',
    text: '知识检定。5+：你看懂了族谱的辈分，知识和理智各 +1。3-4：知识 +1。0-2：最新的那块牌位上写着你的名字，受到 1 点精神伤害。',
    flavor: '一排排黑漆牌位，最后一块的字还是湿的。',
    run: table('knowledge', [[5, gain2('knowledge', 'sanity')], [3, gain('knowledge')], [0, ment(1, '牌位上的名字')]]),
  },
  {
    id: 'bleeding-ceiling', kind: 'event', name: '天花板渗血',
    text: '理智检定。3+：只是生锈的水管。1-2：受到 1 点精神伤害。0：受到 2 点精神伤害。',
    flavor: '一滴，一滴，落在你的后颈上，是温的。',
    run: table('sanity', [[3, none], [1, ment(1, '天花板渗血')], [0, ment(2, '天花板渗血')]]),
  },
  {
    id: 'pushed', kind: 'event', name: '背后一推',
    text: '速度检定。4+：你稳住了身子，速度 +1。0-3：你被推进了同楼层另一个随机的已发现房间，并受到 1 点物理伤害。',
    flavor: '一双冰凉的手按在你的背上。',
    run: table('speed', [[4, gain('speed')], [0, function* (g, s) {
      yield* g.damage(s, 'physical', 1, '背后一推');
      const t = randomTileOnFloor(g, s);
      if (t) yield* g.moveInto(s, t, '被一股力量推了出去');
    }]]),
  },

  // ====================== 影响同房间所有人 ======================
  {
    id: 'cold-spot', kind: 'event', name: '阴冷的角落',
    text: '你和同一房间的每名探险者各做一次力量检定。3+：没事。0-2：冻得发抖，受到 1 点物理伤害。',
    flavor: '呼出的气变成了白雾，可现在是七月。',
    run: everyone('might', 3, phys(1, '阴冷的角落')),
  },
  {
    id: 'selfie', kind: 'event', name: '自动拍照',
    text: '你的手机自己拍了一张合影。你和同一房间的每名探险者各做一次理智检定。3+：没事。0-2：照片里每个人身后都站着一个人，受到 1 点精神伤害。',
    flavor: '“咔嚓。”闪光灯亮起的那一瞬，你看见了。',
    run: everyone('sanity', 3, ment(1, '自动拍照')),
  },
  {
    id: 'sandalwood', kind: 'event', name: '一缕檀香',
    text: '不知哪里飘来一阵檀香。你和同一房间的每名探险者理智 +1。',
    flavor: '像是有人在楼上的佛堂里，替你们点了一炷香。',
    *run(g, s) {
      for (const o of g.playersAt(g.p(s).tile)) yield* g.gain(o, 'sanity', 1);
    },
  },

  // ====================== 需要选择 ======================
  {
    id: 'mahjong', kind: 'event', name: '自己洗牌的麻将',
    text: '一张麻将桌在自己洗牌，三缺一。选择：离开（无事发生）；或坐下打一圈，做知识检定。5+：你赢了，抽 1 张物品。3-4：打平。0-2：你输了，受到 2 点精神伤害。',
    flavor: '另外三把椅子是空的，牌却一张张被摸走了。',
    *run(g, s) {
      const i = yield* g.choose(s, '三缺一，坐不坐？', ['起身离开', '坐下打一圈'], 'mahjong');
      if (i === 0) return;
      yield* rollTable(g, s, 'knowledge', [[5, item], [3, none], [0, ment(2, '自己洗牌的麻将')]], '知识检定 5+');
    },
  },
  {
    id: 'wedding-candy', kind: 'event', name: '桌上的喜糖',
    text: '红纸包着一把喜糖。选择：不吃；或吃一颗，做理智检定。4+：甜得发腻，力量 +1。0-3：糖里裹着纸灰，受到 1 点伤害（任选属性）。',
    flavor: '糖纸上印着一对新人，新娘的脸被抠掉了。',
    *run(g, s) {
      const i = yield* g.choose(s, '要不要尝一颗？', ['不吃', '吃一颗'], 'wedding-candy');
      if (i === 0) return;
      yield* rollTable(g, s, 'sanity', [[4, gain('might')], [0, function* (g, s) { yield* g.damage(s, 'general', 1, '喜糖'); }]], '理智检定 4+');
    },
  },
  {
    id: 'coin-divination', kind: 'event', name: '三枚铜钱',
    text: '桌上摆着三枚铜钱和一张卦象图。选择：不碰；或起一卦，掷 3 颗骰。4+：上上签，任选一项属性 +1。2-3：平签。0-1：下下签，受到 1 点精神伤害。',
    flavor: '铜钱上的年号是“宣统”，边缘被磨得发亮。',
    *run(g, s) {
      const i = yield* g.choose(s, '要不要起一卦？', ['不碰', '起一卦'], 'coin-divination');
      if (i === 0) return;
      const r = yield* g.roll(3, '起卦', s);
      if (r >= 4) {
        const t: Trait[] = ['might', 'speed', 'sanity', 'knowledge'];
        const k = yield* g.choose(s, '上上签！哪项属性 +1？', t.map((x) => NAME[x] + ' +1'));
        yield* g.gain(s, t[k], 1);
      } else if (r <= 1) yield* g.damage(s, 'mental', 1, '下下签');
    },
  },
  {
    id: 'ghost-fire', kind: 'event', name: '鬼火引路',
    text: '一团绿莹莹的火在门口飘。选择：不理它；或跟着走，移动到同楼层另一个随机的已发现房间，知识 +1。',
    flavor: '它飘得不快，像是在等你。',
    *run(g, s) {
      const i = yield* g.choose(s, '跟不跟？', ['不理它', '跟着鬼火走'], 'ghost-fire');
      if (i === 0) return;
      const t = randomTileOnFloor(g, s);
      if (t) yield* g.moveInto(s, t, '跟着鬼火走了');
      yield* g.gain(s, 'knowledge', 1);
    },
  },
  {
    id: 'bed-figure', kind: 'event', name: '被子下的人形',
    text: '床上的被子隆起一个人形。选择：别掀；或掀开被子，做理智检定。4+：被子里裹着一样东西，抽 1 张物品。0-3：被子里什么也没有，但床是温的，受到 2 点精神伤害。',
    flavor: '被子在轻轻起伏，像在呼吸。',
    *run(g, s) {
      const i = yield* g.choose(s, '掀不掀？', ['别掀', '掀开被子'], 'bed-figure');
      if (i === 0) return;
      yield* rollTable(g, s, 'sanity', [[4, item], [0, ment(2, '被子下的人形')]], '理智检定 4+');
    },
  },
  {
    id: 'planchette', kind: 'event', name: '请碟仙',
    text: '桌上铺着写满字的红纸，倒扣着一只瓷碟。选择：不玩；或请碟仙，做知识检定。5+：碟仙告诉你房子的秘密，知识和理智各 +1。2-4：受到 1 点精神伤害。0-1：碟子碎了，受到 2 点精神伤害。',
    flavor: '“碟仙碟仙请出来……”你还没念完，碟子就动了。',
    *run(g, s) {
      const i = yield* g.choose(s, '要不要请碟仙？', ['不玩', '请碟仙'], 'planchette');
      if (i === 0) return;
      yield* rollTable(g, s, 'knowledge', [[5, gain2('knowledge', 'sanity')], [2, ment(1, '请碟仙')], [0, ment(2, '请碟仙')]], '知识检定 5+');
    },
  },
  {
    id: 'warm-tea', kind: 'event', name: '还温着的茶',
    text: '茶几上一杯茶还冒着热气。选择：不喝；或喝下，掷 2 颗骰。3+：好茶，力量 +1。1-2：没什么味道。0：茶里有东西，受到 1 点物理伤害。',
    flavor: '杯沿有一圈口红印，颜色是几十年前流行的。',
    *run(g, s) {
      const i = yield* g.choose(s, '喝不喝？', ['不喝', '喝下去'], 'warm-tea');
      if (i === 0) return;
      const r = yield* g.roll(2, '喝茶', s);
      if (r >= 3) yield* g.gain(s, 'might', 1);
      else if (r === 0) yield* g.damage(s, 'physical', 1, '还温着的茶');
    },
  },

  // ====================== 给物品 / 放标记 ======================
  {
    id: 'maid-shadow', kind: 'event', name: '女佣的影子',
    text: '一个穿斜襟褂子的影子从你身边走过，往你手里塞了样东西。抽 1 张物品。',
    flavor: '“少爷，您落下的。”她没有回头。',
    run: item,
  },
  {
    id: 'fallen-beam', kind: 'event', name: '断梁',
    text: '速度检定。4+：你躲开了。0-3：受到 1 点物理伤害。无论结果如何，在这个房间放一个「断梁」标记（离开这个房间要多花 1 点移动）。',
    flavor: '房梁上刻着“民国十年吉日上梁”，现在它断成了两截。',
    *run(g, s) {
      yield* rollTable(g, s, 'speed', [[4, none], [0, phys(1, '断梁')]], '速度检定 4+');
      const tile = g.p(s).tile;
      if (!g.tokensAt(tile, 'beam').length) g.token(tile, 'beam', '断梁', { icon: '🪵', obstacle: true });
    },
  },
  {
    id: 'ever-lamp', kind: 'event', name: '长明灯',
    text: '角落里一盏油灯自己亮了。在这个房间放一个「长明灯」标记，你理智 +1。',
    flavor: '灯油早就干了，火苗却稳稳的，一点也不晃。',
    *run(g, s) {
      const tile = g.p(s).tile;
      if (!g.tokensAt(tile, 'lamp').length) g.token(tile, 'lamp', '长明灯', { icon: '🪔' });
      yield* g.gain(s, 'sanity', 1);
    },
  },

  // ====================== 异变触发 ======================
  {
    id: 'suona', kind: 'event', name: '唢呐声',
    text: '远处传来迎亲的唢呐。理智检定 3+，失败受到 1 点精神伤害。之后，若已出现至少 3 个凶兆，异变立即开始。',
    flavor: '喜调吹得欢天喜地，却一声比一声近。',
    haunt: 46,
    run: table('sanity', [[3, none], [0, ment(1, '唢呐声')]]),
  },
  {
    id: 'blackout', kind: 'event', name: '停电',
    text: '整栋楼的灯一下子全灭了。你本回合剩余移动清零。之后，若已出现至少 3 个凶兆，异变立即开始。',
    flavor: '黑暗里，配电箱的方向传来“咔哒”一声，像是有人拉下了闸。',
    haunt: 47,
    *run(g, s) {
      g.state.moveLeft = 0;
      g.log(`${g.p(s).name} 在黑暗中不敢乱动`, 'bad', s);
    },
  },
  {
    id: 'midnight-call', kind: 'event', name: '午夜来电',
    text: '走廊里的老式电话响了。知识检定。4+：你听出了电话那头的线索，知识 +1。0-3：听筒里传出你自己的声音，受到 1 点精神伤害。之后，若已出现至少 3 个凶兆，异变立即开始。',
    flavor: '电话线早就被剪断了，铃声却一直响到第十三下。',
    haunt: 48,
    run: table('knowledge', [[4, gain('knowledge')], [0, ment(1, '午夜来电')]]),
  },
  {
    id: 'well-voice', kind: 'event', name: '井里的声音',
    text: '地底深处有人在喊你。理智检定。4+：你捂住耳朵，没有理会。0-3：受到 1 点精神伤害；如果古井已经被发现，你不由自主地走到了古井。之后，若已出现至少 3 个凶兆，异变立即开始。',
    flavor: '“下来呀……下面好凉快……”',
    haunt: 49,
    run: table('sanity', [[4, none], [0, function* (g, s) {
      yield* g.damage(s, 'mental', 1, '井里的声音');
      const w = g.findTile('well');
      if (w && !g.p(s).dead) yield* g.moveInto(s, w, '被井里的声音引了过去');
    }]]),
  },
  {
    id: 'opera-gong', kind: 'event', name: '戏台开锣',
    text: '锣鼓点子在楼里炸响。所有探险者各做一次理智检定 3+，失败受到 1 点精神伤害。之后，若已出现至少 3 个凶兆，异变立即开始。',
    flavor: '“咚咚锵——”台下没有人，可是每个座位都坐满了。',
    haunt: 50,
    *run(g) {
      for (const o of g.alive()) {
        const r = yield* g.check(o, 'sanity', 3);
        if (r < 3) yield* g.damage(o, 'mental', 1, '戏台开锣');
      }
    },
  },
];
