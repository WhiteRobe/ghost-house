// 房间板块（不含起始房间）。doors：1 北 2 东 4 南 8 西。symbols：发现时要抽的牌。
import type { Trait } from '../shared/types';
import type { Game } from '../engine/game';
import type { Fx, RoomDef } from '../engine/defs';

const N = 1, E = 2, S = 4, W = 8;

/** 每人每局一次的标记 */
const used = (g: Game, s: number, key: string) => !!g.p(s).flags['room:' + key];
const mark = (g: Game, s: number, key: string) => { g.p(s).flags['room:' + key] = true; };

/** 每人每局一次：在此结束回合时某项属性 +1 */
function onceGain(key: string, trait: Trait): Fx {
  return function* (g, s) {
    if (used(g, s, key)) return;
    mark(g, s, key);
    yield* g.gain(s, trait, 1);
  };
}

export const ROOMS_LIST: RoomDef[] = [
  // ======================= 地下室 =======================
  {
    id: 'furnace', name: '锅炉房', floors: ['B'], doors: N | E | S, symbols: ['omen'], harmful: true,
    text: '铸铁锅炉的炉门半开着，炭火不知被谁烧了几十年，墙皮烤得卷了边。\n回合结束时在这里：受到 1 点物理伤害。',
    *onEndTurn(g, s) { yield* g.damage(s, 'physical', 1, '炉口喷出一股热浪'); },
  },
  {
    id: 'wine-cellar', name: '酒窖', floors: ['B'], doors: N | S, symbols: ['event'],
    text: '橡木酒桶上贴着褪色的洋文标签。最里头那坛黄酒，封泥是新的。\n特殊行动（每人每局一次）：开坛喝一口。理智检定 4+：力量 +1；0–1：受到 1 点精神伤害。',
    action: {
      label: '开坛喝一口',
      desc: '每人每局一次。理智检定 4+：力量 +1；0–1：受到 1 点精神伤害',
      can: (g, s) => !used(g, s, 'wine-cellar'),
      ai: (g, s) => g.value(s, 'sanity') >= 4,
      *run(g, s) {
        mark(g, s, 'wine-cellar');
        const r = yield* g.check(s, 'sanity', 4, '酒窖：理智检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 灌了一口，从喉咙一路热到肚子`, 'good');
          yield* g.gain(s, 'might', 1);
        } else if (r <= 1) {
          yield* g.damage(s, 'mental', 1, '酒里漂着一根长头发');
        } else g.log(`${g.p(s).name} 尝了一口，又酸又涩`, 'info');
      },
    },
  },
  {
    id: 'well', name: '古井', floors: ['B'], doors: N | E, symbols: ['omen'],
    text: '地下室正中有口青砖井，井沿缠着旧红绳。往下看，水里的人影比你们多一个。',
  },
  {
    id: 'morgue', name: '停尸间', floors: ['B'], doors: N | E | S, symbols: ['event'], harmful: true,
    text: '几张铁床上盖着发黄的白布，露出来的脚趾上挂着木牌，写的都是同一个日期。\n回合结束时在这里：理智检定 3+。失败：受到 1 点精神伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'sanity', 3, '停尸间：理智检定 3+');
      if (r < 3) yield* g.damage(s, 'mental', 1, '白布下伸出了一只手');
    },
  },
  {
    id: 'crypt', name: '地宫', floors: ['B'], doors: N | S, symbols: ['omen'],
    text: '拱顶压得很低，三口朱漆棺材并排摆着，棺盖上钉着桃木钉，有一根已经松了。',
  },
  {
    id: 'underground-river', name: '暗河', floors: ['B'], doors: E | W, symbols: ['event'], leaveCost: 1,
    text: '地基底下有条暗河，水冰得扎手，河面漂着一串没点的河灯。\n离开这里多花 1 点移动。',
  },
  {
    id: 'coal-room', name: '煤房', floors: ['B'], doors: N | E, symbols: ['item'],
    text: '煤堆有半人高，铲子还插在上面。煤灰里有一串小孩的赤脚印，一直走进了墙里。',
  },
  {
    id: 'water-prison', name: '水牢', floors: ['B'], doors: N, symbols: [], harmful: true,
    text: '铁栅栏后面是齐腰深的死水，墙上的铁环锈成了红褐色，水底有东西在拽你的裤脚。\n回合结束时在这里：力量检定 3+。失败：受到 1 点物理伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'might', 3, '水牢：力量检定 3+');
      if (r < 3) yield* g.damage(s, 'physical', 1, '被拽进了水里');
    },
  },

  // ======================= 一楼 =======================
  {
    id: 'cellar-hatch', name: '地窖口', floors: ['G'], doors: N | S, symbols: ['event'],
    link: 'basement-landing',
    text: '地板上的活板门敞着，铜环还在晃。石阶直直往下，底下吹上来一股霉味。\n这个房间与地下室楼梯口相连。',
  },
  {
    id: 'kitchen', name: '厨房', floors: ['G'], doors: N | E, symbols: ['omen'],
    text: '灶上的大铁锅还冒着热气，锅里炖的肉看不出是什么，案板上的菜刀磨得锃亮。\n每人每局一次：回合结束时在这里，力量 +1。',
    onEndTurn: onceGain('kitchen', 'might'),
  },
  {
    id: 'dining', name: '餐厅', floors: ['G'], doors: N | E | S | W, symbols: ['omen'],
    text: '长餐桌上摆了十二副银餐具，每个座位前一碗冒尖的白米饭，饭上直直插着一双筷子。',
  },
  {
    id: 'ballroom', name: '舞厅', floors: ['G'], doors: N | E | S | W, symbols: ['event'],
    text: '水晶吊灯上挂满蛛网。角落的留声机自己转起来，咿咿呀呀放一首谁也没听过的老歌。\n特殊行动（每人每局一次）：随乐起舞。速度检定 4+：理智 +1；0–1：受到 1 点精神伤害。',
    action: {
      label: '随乐起舞',
      desc: '每人每局一次。速度检定 4+：理智 +1；0–1：受到 1 点精神伤害',
      can: (g, s) => !used(g, s, 'ballroom'),
      ai: (g, s) => g.value(s, 'speed') >= 4,
      *run(g, s) {
        mark(g, s, 'ballroom');
        const r = yield* g.check(s, 'speed', 4, '舞厅：速度检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 跳完一曲，心跳慢了下来`, 'good');
          yield* g.gain(s, 'sanity', 1);
        } else if (r <= 1) {
          yield* g.damage(s, 'mental', 1, '舞伴的手冰凉');
        } else g.log(`${g.p(s).name} 踩错了几步，唱片卡住了`, 'info');
      },
    },
  },
  {
    id: 'ancestral-hall', name: '祠堂', floors: ['G'], doors: N | E | S, symbols: ['omen'],
    text: '供桌上摆满了黑漆牌位，香炉里三炷香刚烧到一半。屋里没有别人。\n特殊行动（每人每局一次）：上香。知识检定 4+：抽 1 张物品；0–1：受到 1 点精神伤害。',
    action: {
      label: '上香',
      desc: '每人每局一次。知识检定 4+：抽 1 张物品；0–1：受到 1 点精神伤害',
      can: (g, s) => !used(g, s, 'ancestral-hall'),
      ai: (g, s) => g.value(s, 'knowledge') >= 4,
      *run(g, s) {
        mark(g, s, 'ancestral-hall');
        const r = yield* g.check(s, 'knowledge', 4, '祠堂：知识检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 恭恭敬敬拜了三拜，供桌下的抽屉弹开了`, 'good');
          yield* g.draw(s, 'item');
        } else if (r <= 1) {
          yield* g.damage(s, 'mental', 1, '所有牌位同时转向了你');
        } else g.log(`${g.p(s).name} 插上香，香灰落了一截`, 'info');
      },
    },
  },
  {
    id: 'garden', name: '后花园', floors: ['G'], doors: N | E | S, symbols: ['event'],
    text: '（室外）荒草没过膝盖，假山后的秋千自己在晃。月季开得红到发黑。\n特殊行动（每人每局一次）：在花丛里翻找。速度检定 4+：抽 1 张物品；0–1：受到 1 点物理伤害。',
    action: {
      label: '在花丛里翻找',
      desc: '每人每局一次。速度检定 4+：抽 1 张物品；0–1：受到 1 点物理伤害',
      can: (g, s) => !used(g, s, 'garden'),
      ai: (g, s) => g.value(s, 'speed') >= 4,
      *run(g, s) {
        mark(g, s, 'garden');
        const r = yield* g.check(s, 'speed', 4, '后花园：速度检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 在花根底下摸到一个硬东西`, 'good');
          yield* g.draw(s, 'item');
        } else if (r <= 1) {
          yield* g.damage(s, 'physical', 1, '花刺扎进了手心');
        } else g.log(`${g.p(s).name} 只翻出了一把湿泥`, 'info');
      },
    },
  },
  {
    id: 'opera-stage', name: '戏台', floors: ['G'], doors: N | S, symbols: ['omen'],
    text: '洋楼里搭着一座老戏台，红绸幕布拉了一半。台口的锣自己响了一声，后台有人在吊嗓子。',
  },
  {
    id: 'servants', name: '佣人房', floors: ['G'], doors: N | E, symbols: ['item'],
    text: '小屋里挤着四张木板床，被子叠得方方正正，每个枕头底下压着一张写了生辰八字的黄纸。',
  },
  {
    id: 'main-hall', name: '正厅', floors: ['G'], doors: N | E | S | W, symbols: ['event'],
    text: '正厅挂满了红绸，正中贴着一个褪色的大红囍字。太师椅上搭着一件小号的嫁衣。',
  },

  // ======================= 二楼 =======================
  {
    id: 'master-bedroom', name: '主卧', floors: ['U'], doors: N | E | S, symbols: ['omen'],
    text: '雕花架子床挂着厚帐子，里面有人在均匀地喘气。掀开一看，褥子上只有一个人形的凹痕。\n特殊行动（每人每局一次）：在床边歇一会儿。理智低于起始值时，恢复到起始值。',
    action: {
      label: '歇一会儿',
      desc: '每人每局一次。理智低于起始值时，恢复到起始值',
      can: (g, s) => !used(g, s, 'master-bedroom'),
      ai: (g, s) => g.value(s, 'sanity') <= 3,
      *run(g, s) {
        mark(g, s, 'master-bedroom');
        g.heal(s, 'sanity');
        g.log(`${g.p(s).name} 在床沿坐了一会儿，手不抖了`, 'good');
      },
    },
  },
  {
    id: 'nursery', name: '儿童房', floors: ['U'], doors: N | E, symbols: ['event'], harmful: true,
    text: '摇篮自己在摇，拨浪鼓咚咚响了两声。墙上的蜡笔画全是一家人，每张都多画了一个没有脸的孩子。\n进入这里时：理智检定 3+。失败：受到 1 点精神伤害。',
    *onEnter(g, s) {
      const r = yield* g.check(s, 'sanity', 3, '儿童房：理智检定 3+');
      if (r < 3) yield* g.damage(s, 'mental', 1, '有孩子在背后叫你');
    },
  },
  {
    id: 'attic', name: '阁楼', floors: ['U'], doors: N | S, symbols: ['event'],
    text: '斜顶下堆满了樟木箱，老鼠在梁上跑。有只箱子的锁扣上全是抓痕，是从里面抓的。',
  },
  {
    id: 'balcony', name: '露台', floors: ['U'], doors: N | E, symbols: ['omen'],
    text: '（室外）铁栏杆外面全是雾，看不见院墙，也看不见来时的路。远处有人在唱哭嫁歌。',
  },
  {
    id: 'dressing', name: '梳妆间', floors: ['U'], doors: N | E, symbols: ['omen'],
    text: '梳妆台上的胭脂水粉摆得整整齐齐，象牙梳上缠着几根长头发。镜面上有层雾，怎么擦都擦不掉。\n特殊行动（每人每局一次）：对镜梳头。理智检定 5+：知识 +1；0–2：受到 1 点精神伤害。',
    action: {
      label: '对镜梳头',
      desc: '每人每局一次。理智检定 5+：知识 +1；0–2：受到 1 点精神伤害',
      can: (g, s) => !used(g, s, 'dressing'),
      ai: (g, s) => g.value(s, 'sanity') >= 5,
      *run(g, s) {
        mark(g, s, 'dressing');
        const r = yield* g.check(s, 'sanity', 5, '梳妆间：理智检定 5+');
        if (r >= 5) {
          g.log(`${g.p(s).name} 在镜子里看见了这栋楼几十年前的样子`, 'good');
          yield* g.gain(s, 'knowledge', 1);
        } else if (r <= 2) {
          yield* g.damage(s, 'mental', 1, '镜子里的人没有跟着你动');
        } else g.log(`${g.p(s).name} 在镜子里只看见自己一张白脸`, 'info');
      },
    },
  },
  {
    id: 'clock-tower', name: '钟楼', floors: ['U'], doors: N | S, symbols: ['event'],
    text: '大齿轮咔哒咔哒地转，钟摆却一动不动。表盘背面用朱砂写着一行时辰，是倒着排的。',
  },

  // ======================= 多楼层 =======================
  {
    id: 'library', name: '书房', floors: ['G', 'U'], doors: N | E, symbols: ['event'],
    text: '书架顶到天花板，线装书和洋文书混着放。桌上摊着一本手抄县志，墨还没干。\n每人每局一次：回合结束时在这里，知识 +1。',
    onEndTurn: onceGain('library', 'knowledge'),
  },
  {
    id: 'chapel', name: '佛堂', floors: ['G', 'U'], doors: N, symbols: ['omen'],
    text: '佛龛里供着一尊菩萨，头上蒙着红布。木鱼声从红布底下传出来，一下，一下。\n每人每局一次：回合结束时在这里，理智 +1。',
    onEndTurn: onceGain('chapel', 'sanity'),
  },
  {
    id: 'storeroom', name: '储藏间', floors: ['B', 'G', 'U'], doors: N | S, symbols: ['item'],
    text: '旧家具上都蒙着白布，高高低低，总像有人蹲在底下。',
  },
  {
    id: 'collapsed', name: '坍塌的卧室', floors: ['G', 'U'], doors: N | E | S | W, symbols: [], harmful: true,
    text: '半边地板塌出一个大洞，烧黑的房梁斜插下去，洞底看不见。\n回合结束时在这里：速度检定 5+。失败：从洞里掉到地下室楼梯口，受到 1 骰物理伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'speed', 5, '坍塌的卧室：速度检定 5+');
      if (r >= 5) return;
      g.moveTo(s, 'B:0,-2', '地板塌了！');
      const d = yield* g.roll(1, '坠落伤害', s);
      yield* g.damage(s, 'physical', d, '摔下楼');
    },
  },
  {
    id: 'laundry-chute', name: '洗衣槽', floors: ['G', 'U'], doors: N | S, symbols: [],
    text: '墙上开着一个铁皮槽口，里面塞满发霉的床单，深处有湿东西在往下滑。\n回合结束时在这里：顺着槽滑到地下室楼梯口。',
    *onEndTurn(g, s) {
      if (g.p(s).tile === 'B:0,-2') return;
      g.moveTo(s, 'B:0,-2', '顺着洗衣槽滑了下去');
      g.log(`${g.p(s).name} 顺着洗衣槽一路滑到了地下室楼梯口`, 'info');
    },
  },
  {
    id: 'dumbwaiter', name: '送菜梯', floors: ['B', 'G', 'U'], doors: N | E, symbols: [],
    text: '墙里嵌着一部手摇送菜梯，箱子刚好塞得下一个蜷着的人，麻绳上沾着油和暗红的污渍。\n回合结束时在这里：你可以钻进去，掷 2 骰。0–1：到地下室楼梯口；2：到一楼走廊；3–4：到二楼楼梯口。',
    *onEndTurn(g, s) {
      const c = yield* g.choose(s, '要钻进送菜梯吗？', ['不钻', '钻进去，掷 2 骰决定去哪层']);
      if (c !== 1) return;
      const r = yield* g.roll(2, '送菜梯', s);
      const to = r <= 1 ? 'B:0,-2' : r === 2 ? 'G:0,-1' : 'U:0,-2';
      if (g.p(s).tile === to) return;
      g.moveTo(s, to, '送菜梯吱呀吱呀地动了');
    },
  },
  {
    id: 'secret-passage', name: '密道', floors: ['B', 'G', 'U'], doors: N, symbols: [],
    link: 'hallway',
    text: '书架后面是一道夹墙，只能侧着身子过，墙缝里塞着一卷卷符纸，另一头通到一楼走廊。\n这个房间与走廊相连。',
  },
  {
    id: 'drill-room', name: '练功房', floors: ['B', 'G'], doors: N | E | S, symbols: [],
    text: '青砖地踩出了坑，梅花桩和木人桩上全是刀痕。墙角的石锁上有个手印，还是热的。\n每人每局一次：回合结束时在这里，速度 +1。',
    onEndTurn: onceGain('drill-room', 'speed'),
  },
  {
    id: 'bathroom', name: '浴室', floors: ['G', 'U'], doors: N | E, symbols: ['event'],
    text: '铸铁浴缸里放满了水，水面漂着花瓣，龙头还在滴。伸手一试，水是温的。',
  },
  {
    id: 'darkroom', name: '暗房', floors: ['B', 'U'], doors: N, symbols: ['event'],
    text: '红灯下晾着一排还在滴水的相片，拍的全是这栋洋楼，每张的窗户里都站着一个穿长衫的人。\n特殊行动（每人每局一次）：冲洗底片。知识检定 4+：知识 +1；0–1：受到 1 点精神伤害。',
    action: {
      label: '冲洗底片',
      desc: '每人每局一次。知识检定 4+：知识 +1；0–1：受到 1 点精神伤害',
      can: (g, s) => !used(g, s, 'darkroom'),
      ai: (g, s) => g.value(s, 'knowledge') >= 4,
      *run(g, s) {
        mark(g, s, 'darkroom');
        const r = yield* g.check(s, 'knowledge', 4, '暗房：知识检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 在底片上看出了这栋楼的格局`, 'good');
          yield* g.gain(s, 'knowledge', 1);
        } else if (r <= 1) {
          yield* g.damage(s, 'mental', 1, '显影出来的是你自己的遗照');
        } else g.log(`${g.p(s).name} 冲出了一张模糊的废片`, 'info');
      },
    },
  },
  {
    id: 'music-room', name: '琴房', floors: ['G', 'U'], doors: N | E | S, symbols: ['omen'],
    text: '立式钢琴上搁着一把断了弦的琵琶。琴凳还是热的，琴键上落了一层香灰。\n特殊行动（每人每局一次）：弹奏一曲。知识检定 4+：理智 +1；0–1：受到 1 点精神伤害。',
    action: {
      label: '弹奏一曲',
      desc: '每人每局一次。知识检定 4+：理智 +1；0–1：受到 1 点精神伤害',
      can: (g, s) => !used(g, s, 'music-room'),
      ai: (g, s) => g.value(s, 'knowledge') >= 4,
      *run(g, s) {
        mark(g, s, 'music-room');
        const r = yield* g.check(s, 'knowledge', 4, '琴房：知识检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 弹完一曲，屋里没那么冷了`, 'good');
          yield* g.gain(s, 'sanity', 1);
        } else if (r <= 1) {
          yield* g.damage(s, 'mental', 1, '另一双手按在了你的手上');
        } else g.log(`${g.p(s).name} 弹出几个走调的音`, 'info');
      },
    },
  },
  {
    id: 'guest-room', name: '客房', floors: ['G', 'U'], doors: N | S, symbols: ['event'],
    text: '床刚铺好，枕边放着一张请柬，上面写着你的名字，落款是七十年前。',
  },
  {
    id: 'conservatory', name: '花房', floors: ['G', 'U'], doors: N | E | S, symbols: ['item'],
    text: '玻璃顶下的花草长疯了，藤蔓爬满铁架。土里露出几截白根，看着像指骨。',
  },
  {
    id: 'vault', name: '保险库', floors: ['B', 'U'], doors: N, symbols: ['item', 'item'],
    text: '半人高的德国保险门虚掩着，里面码着银元、地契，还有一沓沓红纸包好的冥币。',
  },
  {
    id: 'junk-room', name: '杂物间', floors: ['B', 'G', 'U'], doors: N | E | S, symbols: [],
    text: '破藤椅、断腿桌、缺了角的花轿一直堆到天花板，碰一下就哗啦塌下来。\n发现这个房间时：在这里放 1 个杂物障碍。',
    *onDiscover(g, s) {
      const key = g.p(s).tile;
      g.token(key, 'obstacle', '杂物', { obstacle: true, icon: 'obstacle' });
      g.log('杂物塌了一地，挡住了去路', 'info');
    },
  },
  {
    id: 'gallery', name: '画廊', floors: ['G', 'U'], doors: N | E | S | W, symbols: ['omen'],
    text: '长墙上挂满这家人的油画像，从穿马褂的老太爷到穿洋装的小姐，眼珠都跟着你转。',
  },
  {
    id: 'armory', name: '兵器室', floors: ['B', 'G'], doors: N | E, symbols: [],
    text: '兵器架上的刀枪落满了灰，正中挂着一杆老猎枪，枪托上刻着「镇宅」。\n发现这个房间时：从物品牌堆里找出 1 张武器获得，然后洗混物品牌堆。',
    *onDiscover(g, s) {
      const got = yield* g.searchDeck(s, 'item', (c) => !!c.weapon);
      if (!got) g.log('兵器架上已经空了', 'info');
    },
  },
  {
    id: 'tea-room', name: '茶室', floors: ['G', 'U'], doors: N | E, symbols: ['event'],
    text: '紫檀桌上摆着一套盖碗，茶刚斟满，碗沿有一圈淡淡的口红印。\n特殊行动（每人每局一次）：喝下那碗茶。掷 2 骰。3+：理智 +1；0：受到 1 点精神伤害。',
    action: {
      label: '喝下那碗茶',
      desc: '每人每局一次。掷 2 骰。3+：理智 +1；0：受到 1 点精神伤害',
      can: (g, s) => !used(g, s, 'tea-room'),
      ai: (g, s) => g.value(s, 'sanity') >= 3,
      *run(g, s) {
        mark(g, s, 'tea-room');
        const r = yield* g.roll(2, '茶室', s);
        if (r >= 3) {
          g.log(`${g.p(s).name} 一碗热茶下去，手心不凉了`, 'good');
          yield* g.gain(s, 'sanity', 1);
        } else if (r === 0) {
          yield* g.damage(s, 'mental', 1, '茶底沉着一颗眼珠');
        } else g.log(`${g.p(s).name} 只喝出一嘴苦味`, 'info');
      },
    },
  },
  {
    id: 'mirror-corridor', name: '镜廊', floors: ['G', 'U'], doors: N | S, symbols: ['omen'], harmful: true,
    text: '两边墙上镶满大大小小的铜镜。镜子里的走廊比外面长得多，尽头站着一个背对你的红衣女人。\n回合结束时在这里：理智检定 4+。失败：受到 1 点精神伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'sanity', 4, '镜廊：理智检定 4+');
      if (r < 4) yield* g.damage(s, 'mental', 1, '镜中人转过了身');
    },
  },
];
