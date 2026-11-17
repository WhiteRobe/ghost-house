import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 39 百年钟声（百年诅咒 × 停走的怀表） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const NAMES = ['扎了红绳的草人', '写着生辰八字的木牌', '一缕剪下的头发', '一件旧寿衣', '一双小孩的布鞋', '一面裂开的小镜子', '一只纸扎的童子'];

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，露出通往地下室的石阶', 'haunt');
  }
}

function tower(g: Game): string {
  const k = g.placeRoom('clock-tower') ?? g.placeRoom('attic', ['U']) ?? g.placeRoom('balcony');
  if (k) return k;
  const u = Object.keys(g.state.tiles).filter((x) => x.startsWith('U:') && !START.includes(x));
  return u.length ? u[g.rng.int(u.length)] : 'U:0,-2';
}

const carried = (g: Game, s: number) => Number(g.p(s).flags.subs ?? 0);

function track(g: Game) {
  g.setTrack(`钟声 ${g.hv.toll}/${g.hv.limit}｜已献替身 ${g.hv.offered}/${g.hv.need}`, g.hv.toll, g.hv.limit);
}


export const h39: HauntDef = {
  id: 39,
  title: '百年钟声',
  type: 'coop',
  traitor: { type: 'none' },
  intro: '停了一百年的怀表忽然“嗒”地走了一格，楼顶传来一声闷钟。老辈人说过：这栋楼每过一百年要收一回人，钟敲够了数，就得有人留下。除非，你们给它找到替身。',
  hero: {
    goal: '在钟声敲够之前，把足够多的替身献到钟楼。',
    rules: [
      '每轮结束时钟响一次：每名活着的幸存者各掷 1 颗骰，点数总和再加上刚结束的轮数（钟声越来越急），累加到计数轨上。累计达到上限（3 人 6、4 人 7、5 人 8、6 人 9）时，房子收走理智最低的一名幸存者（他立即死亡），计数轨扣除上限后继续累计。',
      '替身（标记）散落在房子各处。特殊行动「请替身」：在有替身的房间进行理智 4+ 检定，成功则拿起 1 个。一个人可以带多个替身；持有替身的人死亡时，替身掉在原地。',
      '钟楼（若未发现则会出现在二楼）。特殊行动「献替身」：在钟楼把你身上所有的替身献出去。',
      '特殊行动「按住钟摆」：在钟楼进行力量 4+ 检定，成功则钟声计数 -2。',
      '献出的替身达到要求（3/4 人 4 个，5/6 人 5 个）时你们获胜。房子收走第 2 个人（5/6 人局为第 3 个人）时，你们失败。',
    ],
    win: '最后一个替身摆上钟楼的横梁，钟锤悬在半空，再也没有落下来。怀表的指针轻轻一跳，停回了三点十七分。',
  },
  *setup(g) {
    connect(g);
    const tw = tower(g);
    g.hv.tower = tw;
    g.hv.toll = 0;
    g.hv.limit = g.scale(6, 7, 8, 9);
    g.hv.need = g.scale(4, 4, 5, 5);
    g.hv.offered = 0;
    g.hv.taken = 0;
    g.hv.maxTaken = g.scale(2, 2, 3, 3);
    g.token(tw, 'bell', '百年铜钟', { icon: 'bell' });
    const tiles = Object.keys(g.state.tiles).filter((k) => k !== tw && !START.includes(k) && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(tiles);
    tiles.sort((a, b) => g.distance(tw, b) - g.distance(tw, a));
    const n = g.hv.need + 1;
    const pool = tiles.length ? tiles : START.slice(1);
    const names = g.rng.shuffle([...NAMES]);
    for (let i = 0; i < n; i++) g.token(pool[i % pool.length], 'sub', names[i % names.length], { icon: 'sub' });
    for (const p of g.state.players) p.flags.subs = 0;
    track(g);
  },
  actions: [
    {
      id: 'offer', side: 'hero', label: '献替身', desc: '在钟楼：献出身上所有替身',
      can: (g, s) => g.p(s).tile === g.hv.tower && carried(g, s) > 0,
      *run(g, s) {
        const n = carried(g, s);
        g.p(s).flags.subs = 0;
        g.hv.offered += n;
        g.log(`${g.p(s).name} 把 ${n} 个替身挂上了钟楼（${g.hv.offered}/${g.hv.need}）`, 'good');
        track(g);
      },
    },
    {
      id: 'take', side: 'hero', label: '请替身', desc: '理智 4+：拿起本房间的 1 个替身',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'sub').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '请替身 4+');
        if (r < 4) {
          g.log(`${g.p(s).name} 的手刚碰到替身，就像被烫了一下缩了回来`, 'bad');
          return;
        }
        const t = g.tokensAt(g.p(s).tile, 'sub')[0];
        g.removeToken(t.id);
        g.p(s).flags.subs = carried(g, s) + 1;
        g.log(`${g.p(s).name} 请起了替身：${t.label}`, 'good');
      },
    },
    {
      id: 'hold', side: 'hero', label: '按住钟摆', desc: '在钟楼：力量 4+，钟声计数 -2',
      can: (g, s) => g.p(s).tile === g.hv.tower && g.hv.toll > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '按住钟摆 4+');
        if (r < 4) return;
        g.hv.toll = Math.max(0, g.hv.toll - 2);
        g.log(`${g.p(s).name} 死死抱住了钟摆`, 'good');
        track(g);
      },
    },
  ],
  *onDeath(g, s) {
    const n = carried(g, s);
    if (n <= 0) return;
    g.p(s).flags.subs = 0;
    for (let i = 0; i < n; i++) g.token(g.p(s).tile, 'sub', '替身', { icon: 'sub' });
  },
  *onRoundEnd(g) {
    const alive = g.alive();
    const sum = (yield* g.roll(alive.length, '百年钟声')) + (g.state.haunt!.round - 1);
    g.hv.toll += sum;
    g.log(`钟声响了，余音在楼里回荡（+${sum}）`, 'haunt');
    while (g.hv.toll >= g.hv.limit && g.alive().length && !g.hv.lost) {
      g.hv.toll -= g.hv.limit;
      const list = [...g.alive()].sort((a, b) => g.value(a, 'sanity') - g.value(b, 'sanity') || a - b);
      const v = list[0];
      g.log(`钟敲够了数——${g.p(v).name} 的影子被钟声卷走了`, 'bad');
      g.hv.taken++;
      yield* g.kill(v, null);
      if (g.hv.taken >= g.hv.maxTaken) g.hv.lost = true;
    }
    track(g);
  },
  checkWin(g) {
    if (g.hv.offered >= g.hv.need) return { side: 'hero' };
    if (g.hv.lost) return { side: 'none', text: '钟声停了，楼里安静得出奇。房子收够了它的人，大门吱呀一声打开，只是再也没有人从里面走出来。' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const loose = g.tokens('sub').map((t) => t.tile);
      const mine = carried(g, s);
      const allCarried = g.alive().reduce((a, o) => a + carried(g, o), 0);
      const enough = g.hv.offered + allCarried >= g.hv.need;
      if (mine > 0 && (enough || !loose.length || mine >= 2)) return { goals: [g.hv.tower], actions: ['take', 'offer', 'hold'] };
      if (loose.length) {
        const here = g.p(s).tile;
        loose.sort((a, b) => g.distance(here, a) - g.distance(here, b));
        return { goals: loose, actions: ['take', 'offer'] };
      }
      return { goals: [g.hv.tower], actions: ['offer', 'hold'] };
    },
  },
};
