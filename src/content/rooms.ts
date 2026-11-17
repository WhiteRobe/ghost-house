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
    text: '铸铁锅炉的炉门半开，里面的炭火不知被谁烧了几十年，墙皮被烤得卷起。\n在这里结束回合时，受到 1 点物理伤害。',
    *onEndTurn(g, s) { yield* g.damage(s, 'physical', 1, '锅炉房的热浪'); },
  },
  {
    id: 'wine-cellar', name: '酒窖', floors: ['B'], doors: N | S, symbols: ['event'],
    text: '一排排橡木酒桶上贴着褪色的洋文标签，最里面那坛黄酒的封泥却是新的。\n特殊行动（每人每局一次）：开坛喝一口。理智检定 4+ 力量 +1；0–1 受到 1 点精神伤害。',
    action: {
      label: '开坛喝一口',
      desc: '每人每局一次。理智 4+：力量 +1；0–1：1 点精神伤害',
      can: (g, s) => !used(g, s, 'wine-cellar'),
      ai: (g, s) => g.value(s, 'sanity') >= 4,
      *run(g, s) {
        mark(g, s, 'wine-cellar');
        const r = yield* g.check(s, 'sanity', 4, '酒窖：理智检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 一口烈酒下肚，浑身发热`, 'good');
          yield* g.gain(s, 'might', 1);
        } else if (r <= 1) {
          yield* g.damage(s, 'mental', 1, '酒里漂着一缕长发');
        } else g.log(`${g.p(s).name} 尝了一口，又酸又涩`, 'info');
      },
    },
  },
  {
    id: 'well', name: '古井', floors: ['B'], doors: N | E, symbols: ['omen'],
    text: '地下室正中砌着一口青砖井，井沿缠着褪色的红绳，往下看是黑得发亮的水面——水面上映出的人影比你多一个。',
  },
  {
    id: 'morgue', name: '停尸间', floors: ['B'], doors: N | E | S, symbols: ['event'], harmful: true,
    text: '几张铁床上盖着发黄的白布，布下的轮廓一动不动，脚趾上的木牌写着同一个日期。\n在这里结束回合时，进行理智检定 3+；失败受到 1 点精神伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'sanity', 3, '停尸间：理智检定 3+');
      if (r < 3) yield* g.damage(s, 'mental', 1, '白布下伸出了一只手');
    },
  },
  {
    id: 'crypt', name: '地宫', floors: ['B'], doors: N | S, symbols: ['omen'],
    text: '拱顶低矮的墓室里并排摆着三口朱漆棺材，棺盖上钉着桃木钉，其中一根已经松脱了。',
  },
  {
    id: 'underground-river', name: '暗河', floors: ['B'], doors: E | W, symbols: ['event'], leaveCost: 1,
    text: '地基下竟有一条冰冷的暗河流过，河面上漂着一盏盏没点燃的河灯。\n离开这里需要多花 1 点移动。',
  },
  {
    id: 'coal-room', name: '煤房', floors: ['B'], doors: N | E, symbols: ['item'],
    text: '煤堆有半人高，铲子还插在上面。煤灰里印着一串小小的赤脚脚印，一直走进墙里。',
  },
  {
    id: 'water-prison', name: '水牢', floors: ['B'], doors: N, symbols: [], harmful: true,
    text: '铁栅栏后面是齐腰深的死水，墙上的铁环锈成了红褐色，水底有什么东西在轻轻拽你的裤脚。\n在这里结束回合时，进行力量检定 3+；失败受到 1 点物理伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'might', 3, '水牢：力量检定 3+');
      if (r < 3) yield* g.damage(s, 'physical', 1, '被拖进了水里');
    },
  },

  // ======================= 一楼 =======================
  {
    id: 'cellar-hatch', name: '地窖口', floors: ['G'], doors: N | S, symbols: ['event'],
    link: 'basement-landing',
    text: '地板上一块带铜环的活板门敞着，石阶陡直地没入黑暗，底下吹上来带霉味的风。\n此房间与地下室楼梯口相连。',
  },
  {
    id: 'kitchen', name: '厨房', floors: ['G'], doors: N | E, symbols: ['omen'],
    text: '灶台上的大铁锅还冒着热气，锅里炖着说不清是什么的肉，案板上的菜刀磨得锃亮。\n每人每局一次：在这里结束回合时，力量 +1。',
    onEndTurn: onceGain('kitchen', 'might'),
  },
  {
    id: 'dining', name: '餐厅', floors: ['G'], doors: N | E | S | W, symbols: ['omen'],
    text: '长条餐桌摆好了十二副银餐具，每个座位前都放着一碗冒尖的白米饭，上面直直插着一双筷子。',
  },
  {
    id: 'ballroom', name: '舞厅', floors: ['G'], doors: N | E | S | W, symbols: ['event'],
    text: '水晶吊灯蒙着蛛网，角落的留声机自己转了起来，咿咿呀呀放着一首没人听过的老歌。\n特殊行动（每人每局一次）：随乐起舞。速度检定 4+ 理智 +1；0–1 受到 1 点精神伤害。',
    action: {
      label: '随乐起舞',
      desc: '每人每局一次。速度 4+：理智 +1；0–1：1 点精神伤害',
      can: (g, s) => !used(g, s, 'ballroom'),
      ai: (g, s) => g.value(s, 'speed') >= 4,
      *run(g, s) {
        mark(g, s, 'ballroom');
        const r = yield* g.check(s, 'speed', 4, '舞厅：速度检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 跳完一曲，心里竟安定下来`, 'good');
          yield* g.gain(s, 'sanity', 1);
        } else if (r <= 1) {
          yield* g.damage(s, 'mental', 1, '舞伴的手冷得像冰');
        } else g.log(`${g.p(s).name} 踩错了几步，音乐戛然而止`, 'info');
      },
    },
  },
  {
    id: 'ancestral-hall', name: '祠堂', floors: ['G'], doors: N | E | S, symbols: ['omen'],
    text: '供桌上层层叠叠摆满了黑漆牌位，香炉里三炷香刚刚燃到一半，可这里明明没有人。\n特殊行动（每人每局一次）：上香。知识检定 4+ 抽一张物品；0–1 受到 1 点精神伤害。',
    action: {
      label: '上香',
      desc: '每人每局一次。知识 4+：抽一张物品；0–1：1 点精神伤害',
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
        } else g.log(`${g.p(s).name} 插上了香，什么也没发生`, 'info');
      },
    },
  },
  {
    id: 'garden', name: '后花园', floors: ['G'], doors: N | E | S, symbols: ['event'],
    text: '（室外）荒草没过膝盖，假山后的秋千还在自己晃。月光下，满园的月季开得红得发黑。\n特殊行动（每人每局一次）：在花丛里翻找。速度检定 4+ 抽一张物品；0–1 受到 1 点物理伤害。',
    action: {
      label: '在花丛里翻找',
      desc: '每人每局一次。速度 4+：抽一张物品；0–1：1 点物理伤害',
      can: (g, s) => !used(g, s, 'garden'),
      ai: (g, s) => g.value(s, 'speed') >= 4,
      *run(g, s) {
        mark(g, s, 'garden');
        const r = yield* g.check(s, 'speed', 4, '后花园：速度检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 在花根下摸到了什么东西`, 'good');
          yield* g.draw(s, 'item');
        } else if (r <= 1) {
          yield* g.damage(s, 'physical', 1, '花刺像牙齿一样咬住了手');
        } else g.log(`${g.p(s).name} 只翻出了一把湿泥`, 'info');
      },
    },
  },
  {
    id: 'opera-stage', name: '戏台', floors: ['G'], doors: N | S, symbols: ['omen'],
    text: '一座搭在洋楼里的老戏台，红绸幕布半掩，台口的锣鼓无人自响，后台隐约有人在吊嗓子。',
  },
  {
    id: 'servants', name: '佣人房', floors: ['G'], doors: N | E, symbols: ['item'],
    text: '窄小的屋里挤着四张木板床，床头都压着一张写了生辰八字的黄纸，被褥叠得整整齐齐。',
  },
  {
    id: 'main-hall', name: '正厅', floors: ['G'], doors: N | E | S | W, symbols: ['event'],
    text: '挑高的正厅挂满红绸，正中贴着一个褪色的大红囍字，太师椅上搭着一件小小的新娘嫁衣。',
  },

  // ======================= 二楼 =======================
  {
    id: 'master-bedroom', name: '主卧', floors: ['U'], doors: N | E | S, symbols: ['omen'],
    text: '雕花架子床挂着厚重的帐幔，帐子里传出均匀的呼吸声，掀开来却只有一个人形的凹痕。\n特殊行动（每人每局一次）：在床边歇一会儿，理智恢复到起始值（若低于起始值）。',
    action: {
      label: '歇一会儿',
      desc: '每人每局一次：理智恢复到起始值',
      can: (g, s) => !used(g, s, 'master-bedroom'),
      ai: (g, s) => g.value(s, 'sanity') <= 3,
      *run(g, s) {
        mark(g, s, 'master-bedroom');
        g.heal(s, 'sanity');
        g.log(`${g.p(s).name} 在床沿坐了片刻，呼吸渐渐平稳`, 'good');
      },
    },
  },
  {
    id: 'nursery', name: '儿童房', floors: ['U'], doors: N | E, symbols: ['event'], harmful: true,
    text: '摇篮轻轻摇着，床头的拨浪鼓咚咚两声，墙上用蜡笔画满了一家人——每张画里都多出一个没有脸的孩子。\n进入这里时，进行理智检定 3+；失败受到 1 点精神伤害。',
    *onEnter(g, s) {
      const r = yield* g.check(s, 'sanity', 3, '儿童房：理智检定 3+');
      if (r < 3) yield* g.damage(s, 'mental', 1, '有孩子在背后叫你');
    },
  },
  {
    id: 'attic', name: '阁楼', floors: ['U'], doors: N | S, symbols: ['event'],
    text: '斜顶下堆满了樟木箱，老鼠在梁上窸窣跑动，一只箱子的锁扣从里面被抓出了深深的划痕。',
  },
  {
    id: 'balcony', name: '露台', floors: ['U'], doors: N | E, symbols: ['omen'],
    text: '（室外）铸铁栏杆外是浓得化不开的雾，看不见院墙，也看不见来时的路，只听见远处有人在唱哭嫁歌。',
  },
  {
    id: 'dressing', name: '梳妆间', floors: ['U'], doors: N | E, symbols: ['omen'],
    text: '梳妆台上胭脂水粉摆得整整齐齐，象牙梳上缠着几根长发，椭圆镜面蒙着一层永远擦不掉的雾气。\n特殊行动（每人每局一次）：对镜梳头。理智检定 5+ 知识 +1；0–2 受到 1 点精神伤害。',
    action: {
      label: '对镜梳头',
      desc: '每人每局一次。理智 5+：知识 +1；0–2：1 点精神伤害',
      can: (g, s) => !used(g, s, 'dressing'),
      ai: (g, s) => g.value(s, 'sanity') >= 5,
      *run(g, s) {
        mark(g, s, 'dressing');
        const r = yield* g.check(s, 'sanity', 5, '梳妆间：理智检定 5+');
        if (r >= 5) {
          g.log(`${g.p(s).name} 在镜中看到了这栋楼过去的样子`, 'good');
          yield* g.gain(s, 'knowledge', 1);
        } else if (r <= 2) {
          yield* g.damage(s, 'mental', 1, '镜子里的人没有跟着你动');
        } else g.log(`${g.p(s).name} 只看见自己苍白的脸`, 'info');
      },
    },
  },
  {
    id: 'clock-tower', name: '钟楼', floors: ['U'], doors: N | S, symbols: ['event'],
    text: '巨大的齿轮咔哒咔哒地咬合着，钟摆却纹丝不动；表盘背面用朱砂写着一行倒着走的时辰。',
  },

  // ======================= 多楼层 =======================
  {
    id: 'library', name: '书房', floors: ['G', 'U'], doors: N | E, symbols: ['event'],
    text: '顶天立地的书架上中西典籍混放，书桌上摊开一本手抄的县志，墨迹还没干透。\n每人每局一次：在这里结束回合时，知识 +1。',
    onEndTurn: onceGain('library', 'knowledge'),
  },
  {
    id: 'chapel', name: '佛堂', floors: ['G', 'U'], doors: N, symbols: ['omen'],
    text: '小小的佛龛前供着一尊被红布蒙住头的菩萨，木鱼声从红布底下一下一下传出来。\n每人每局一次：在这里结束回合时，理智 +1。',
    onEndTurn: onceGain('chapel', 'sanity'),
  },
  {
    id: 'storeroom', name: '储藏间', floors: ['B', 'G', 'U'], doors: N | S, symbols: ['item'],
    text: '堆满了蒙着白布的旧家具，白布的轮廓高高低低，总像有谁蹲在里面。',
  },
  {
    id: 'collapsed', name: '坍塌的卧室', floors: ['G', 'U'], doors: N | E | S | W, symbols: [], harmful: true,
    text: '半边地板塌成一个大洞，焦黑的房梁斜插下来，洞底黑漆漆地看不到头。\n在这里结束回合时，进行速度检定 5+；失败则从破洞跌落到地下室楼梯口，受到 1 骰物理伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'speed', 5, '坍塌的卧室：速度检定 5+');
      if (r >= 5) return;
      g.moveTo(s, 'B:0,-2', '地板塌了！');
      const d = yield* g.roll(1, '坠落伤害', s);
      yield* g.damage(s, 'physical', d, '坠落');
    },
  },
  {
    id: 'laundry-chute', name: '洗衣槽', floors: ['G', 'U'], doors: N | S, symbols: [],
    text: '墙上开着一个黑洞洞的铁皮槽口，里面塞满了发霉的床单，深处传来湿漉漉的滑动声。\n在这里结束回合时，你会顺着槽滑到地下室楼梯口。',
    *onEndTurn(g, s) {
      if (g.p(s).tile === 'B:0,-2') return;
      g.moveTo(s, 'B:0,-2', '顺着洗衣槽滑了下去！');
      g.log(`${g.p(s).name} 被洗衣槽吞了下去，落在地下室楼梯口`, 'info');
    },
  },
  {
    id: 'dumbwaiter', name: '送菜梯', floors: ['B', 'G', 'U'], doors: N | E, symbols: [],
    text: '墙里嵌着一部手摇的小升降箱，刚好能蜷进一个人，麻绳上沾着油渍和暗红的污迹。\n在这里结束回合时，可以钻进去掷 2 骰：0–1 到地下室楼梯口，2 到一楼走廊，3–4 到二楼楼梯口。',
    *onEndTurn(g, s) {
      const c = yield* g.choose(s, '要钻进送菜梯吗？', ['不使用', '钻进去，掷 2 骰决定去哪一层']);
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
    text: '书架后面藏着一条仅容一人侧身的夹墙，墙缝里塞着成卷的符纸，尽头通向一楼走廊。\n此房间与走廊相连。',
  },
  {
    id: 'drill-room', name: '练功房', floors: ['B', 'G'], doors: N | E | S, symbols: [],
    text: '青砖地被踩得凹陷，梅花桩和木人桩上满是刀痕，墙角的石锁上还有温热的手印。\n每人每局一次：在这里结束回合时，速度 +1。',
    onEndTurn: onceGain('drill-room', 'speed'),
  },
  {
    id: 'bathroom', name: '浴室', floors: ['G', 'U'], doors: N | E, symbols: ['event'],
    text: '西洋铸铁浴缸里放满了水，水面浮着一层花瓣，水龙头还在滴答滴答地往下漏，水是温的。',
  },
  {
    id: 'darkroom', name: '暗房', floors: ['B', 'U'], doors: N, symbols: ['event'],
    text: '红灯下晾着一排还在滴水的相片，拍的全是这栋洋楼——每一张的窗户里都站着一个穿长衫的人。\n特殊行动（每人每局一次）：冲洗底片。知识检定 4+ 知识 +1；0–1 受到 1 点精神伤害。',
    action: {
      label: '冲洗底片',
      desc: '每人每局一次。知识 4+：知识 +1；0–1：1 点精神伤害',
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
    text: '黑色立式钢琴上摆着一把断了弦的琵琶，琴凳还留着余温，琴键上落着一层细细的香灰。\n特殊行动（每人每局一次）：弹奏一曲。知识检定 4+ 理智 +1；0–1 受到 1 点精神伤害。',
    action: {
      label: '弹奏一曲',
      desc: '每人每局一次。知识 4+：理智 +1；0–1：1 点精神伤害',
      can: (g, s) => !used(g, s, 'music-room'),
      ai: (g, s) => g.value(s, 'knowledge') >= 4,
      *run(g, s) {
        mark(g, s, 'music-room');
        const r = yield* g.check(s, 'knowledge', 4, '琴房：知识检定 4+');
        if (r >= 4) {
          g.log(`${g.p(s).name} 弹完一曲，屋里的寒意散去了些`, 'good');
          yield* g.gain(s, 'sanity', 1);
        } else if (r <= 1) {
          yield* g.damage(s, 'mental', 1, '另一双手按在了你的手上');
        } else g.log(`${g.p(s).name} 弹出几个走调的音`, 'info');
      },
    },
  },
  {
    id: 'guest-room', name: '客房', floors: ['G', 'U'], doors: N | S, symbols: ['event'],
    text: '床铺刚刚铺好，枕边放着一张写有你名字的请柬，落款日期是七十年前。',
  },
  {
    id: 'conservatory', name: '花房', floors: ['G', 'U'], doors: N | E | S, symbols: ['item'],
    text: '玻璃穹顶下的花草疯长成一片，藤蔓爬满了铁架，泥土里露出几截白色的、像是指骨的根。',
  },
  {
    id: 'vault', name: '保险库', floors: ['B', 'U'], doors: N, symbols: ['item', 'item'],
    text: '一扇半人高的德国造保险门虚掩着，里面码着银元、地契和一叠叠用红纸包好的冥币。',
  },
  {
    id: 'junk-room', name: '杂物间', floors: ['B', 'G', 'U'], doors: N | E | S, symbols: [],
    text: '破藤椅、断腿桌、缺角的花轿堆得顶到天花板，稍一碰就哗啦啦塌下来。\n发现时，在这里放置一个杂物障碍。',
    *onDiscover(g, s) {
      const key = g.p(s).tile;
      g.token(key, 'obstacle', '杂物', { obstacle: true, icon: 'obstacle' });
      g.log('杂物塌了一地，挡住了去路', 'info');
    },
  },
  {
    id: 'gallery', name: '画廊', floors: ['G', 'U'], doors: N | E | S | W, symbols: ['omen'],
    text: '长墙上挂满了这家人的油画像，从穿马褂的老太爷到穿洋装的小姐，所有人的眼珠都跟着你转。',
  },
  {
    id: 'armory', name: '兵器室', floors: ['B', 'G'], doors: N | E, symbols: [],
    text: '兵器架上刀枪剑戟落满灰尘，一杆老式猎枪挂在正中，枪托上刻着「镇宅」二字。\n发现时，从物品堆中找出一件武器给你。',
    *onDiscover(g, s) {
      const got = yield* g.searchDeck(s, 'item', (c) => !!c.weapon);
      if (!got) g.log('兵器架上已经空了', 'info');
    },
  },
  {
    id: 'tea-room', name: '茶室', floors: ['G', 'U'], doors: N | E, symbols: ['event'],
    text: '紫檀茶桌上摆着一套盖碗，茶刚刚斟满，碗沿留着一圈淡淡的口红印。\n特殊行动（每人每局一次）：喝下那碗茶。掷 2 骰：3+ 理智 +1；0 受到 1 点精神伤害。',
    action: {
      label: '喝下那碗茶',
      desc: '每人每局一次。掷 2 骰：3+ 理智 +1；0：1 点精神伤害',
      can: (g, s) => !used(g, s, 'tea-room'),
      ai: (g, s) => g.value(s, 'sanity') >= 3,
      *run(g, s) {
        mark(g, s, 'tea-room');
        const r = yield* g.roll(2, '茶室', s);
        if (r >= 3) {
          g.log(`${g.p(s).name} 喝下热茶，心神一定`, 'good');
          yield* g.gain(s, 'sanity', 1);
        } else if (r === 0) {
          yield* g.damage(s, 'mental', 1, '茶底沉着一颗眼珠');
        } else g.log(`${g.p(s).name} 只尝到满嘴苦涩`, 'info');
      },
    },
  },
  {
    id: 'mirror-corridor', name: '镜廊', floors: ['G', 'U'], doors: N | S, symbols: ['omen'], harmful: true,
    text: '两侧墙上镶满了大大小小的铜镜，镜中的走廊比实际的长得多，尽头站着一个背对你的红衣女人。\n在这里结束回合时，进行理智检定 4+；失败受到 1 点精神伤害。',
    *onEndTurn(g, s) {
      const r = yield* g.check(s, 'sanity', 4, '镜廊：理智检定 4+');
      if (r < 4) yield* g.damage(s, 'mental', 1, '镜中人转过了身');
    },
  },
];
