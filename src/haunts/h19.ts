import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const START = 'G:0,0';
const HALL = 'G:0,-1';
const starts = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const CAP = 8;

/** 地下室和楼上没连通时，开一道暗梯，免得有人被困死 */
function bridge(g: Game) {
  for (const p of g.state.players) {
    if (p.dead || g.distance(START, p.tile) < Infinity) continue;
    const to = g.distance('B:0,-2', p.tile) < Infinity ? 'B:0,-2' : p.tile;
    if (g.distance(START, to) === Infinity) {
      g.link(HALL, to);
      g.log('走廊的地板裂开，露出一道通往下面的暗梯', 'info');
    }
  }
}

function reachable(g: Game, k: string): string {
  if (g.distance(START, k) === Infinity) g.link(HALL, k);
  return k;
}

const total = (g: Game) => g.hv.total as number;
const step = (g: Game) => g.hv.step as number;

function deadline(g: Game) {
  return g.scale(10, 10, 11, 11);
}

/** 当前要拼的那面镜子 */
function current(g: Game) {
  return g.tokens('mirror').find((t) => t.data?.n === step(g) + 1) ?? null;
}

function track(g: Game) {
  g.setTrack('拼好的镜子', step(g), total(g));
}

/** 19 镜子里的朋友 */
export const h19: HauntDef = {
  id: 19,
  title: '镜子里的朋友',
  type: 'coop',
  traitor: { type: 'none' },
  intro: '失踪的朋友找到了，在镜子里。他拿巴掌拍镜面，嘴一张一合，一点声音也没有。他身后是一条镜子拼成的走廊，最近的那面镜子里，有只手正扒着镜框往外探。',
  hero: {
    goal: '按编号顺序拼好所有镜子，在期限内把朋友接出来。这是合作剧本，没有背叛者。',
    rules: [
      '房子里放了带编号的「镜子」标记：3/4 人局 4 面，5/6 人局 5 面。优先放在镜廊、梳妆间、浴室、画廊，不够时放在别的房间。',
      '特殊行动「拼镜」：站在下一面要拼的镜子所在房间，知识检定 4+。成功：这面镜子拼好，标记移除。失败：受到 1 点精神伤害。',
      '必须按编号顺序拼。每轮最多拼好 1 面，拼好后下一面要到下一轮才能拼。',
      '开始时第 1 面镜子所在房间有 1 个镜鬼。每轮结束时，从还没拼好的镜子里随机爬出镜鬼：3/4 人局 2 个，5/6 人局 3 个，场上最多 8 个。镜鬼由系统控制，被击败时只会被击晕。',
      '拼好最后一面镜子时，你们获胜。',
      '3/4 人局第 10 轮、5/6 人局第 11 轮结束时还没拼完，你们失败。所有人都死亡也算失败。',
    ],
    win: '最后一面镜子“咔”地合上缝。朋友一头从镜面里栽出来，砸在你们身上，浑身冰凉，心口还在咚咚跳。',
  },
  monsters: {
    wraith: { name: '镜鬼', icon: 'wraith', speed: 3, might: 3 },
  },
  *setup(g) {
    bridge(g);
    const n = g.scale(4, 4, 5, 5);
    const spots: string[] = [];
    const ids = ['mirror-corridor', 'dressing', 'bathroom', 'gallery'];
    for (const id of ids) {
      const k = g.findTile(id);
      if (k && g.distance(START, k) < Infinity && !spots.includes(k)) spots.push(k);
    }
    for (const id of ids) {
      if (spots.length >= n) break;
      if (g.findTile(id)) continue;
      const k = g.placeRoom(id);
      if (k) spots.push(reachable(g, k));
    }
    const others = Object.keys(g.state.tiles).filter((k) => !starts.includes(k) && !spots.includes(k) && g.distance(START, k) < Infinity);
    g.rng.shuffle(others);
    while (spots.length < n) spots.push(others.pop() ?? (spots.includes(HALL) ? (spots.includes('U:0,-2') ? 'G:0,-2' : 'U:0,-2') : HALL));
    g.rng.shuffle(spots);
    spots.slice(0, n).forEach((k, i) => g.token(k, 'mirror', `镜子 ${i + 1}`, { icon: 'mirror', data: { n: i + 1 } }));
    g.hv.total = n;
    g.hv.step = 0;
    track(g);
    const cur = current(g);
    if (cur) g.spawn('wraith', cur.tile);
  },
  actions: [
    {
      id: 'mend', side: 'hero', label: '拼镜', desc: '在下一面要拼的镜子处知识检定 4+。失败：受到 1 点精神伤害。每轮最多拼好 1 面',
      can: (g, s) => current(g)?.tile === g.p(s).tile && g.hv.lit !== g.state.round,
      *run(g, s) {
        const cur = current(g);
        if (!cur) return;
        const r = yield* g.check(s, 'knowledge', 4, `拼镜 ${step(g) + 1} 4+`);
        if (r < 4) {
          g.log('镜片划破了手指，镜子里那张脸冲你咧开了嘴', 'bad');
          yield* g.damage(s, 'mental', 1, '镜中人');
          return;
        }
        g.removeToken(cur.id);
        g.hv.step = step(g) + 1;
        g.hv.lit = g.state.round;
        track(g);
        g.log(`${g.p(s).name} 拼好了第 ${step(g)} 面镜子，镜子里的朋友往前挪了一步`, 'good');
        const next = current(g);
        if (next) g.log(`第 ${step(g) + 1} 面镜子在「${g.tileName(next.tile)}」，下一轮才能拼`, 'haunt');
      },
    },
  ],
  *onRoundEnd(g) {
    bridge(g);
    const left = g.tokens('mirror');
    for (let i = 0; i < g.scale(2, 2, 3, 3) && left.length; i++) {
      if (g.state.monsters.length >= CAP) break;
      const t = left[g.rng.int(left.length)];
      g.spawn('wraith', t.tile);
    }
  },
  checkWin(g) {
    if (step(g) >= total(g)) return { side: 'hero' };
    if ((g.state.haunt?.round ?? 1) - 1 >= deadline(g)) return { side: 'none', text: '镜面上的手印一点点干了。朋友看了你们一眼，转身往走廊尽头走去。' };
    return null;
  },
  ai: {
    hero: (g) => {
      const cur = current(g);
      return { goals: cur ? [cur.tile] : [], actions: ['mend'] };
    },
    monster: (g) => {
      // 镜鬼守着当前那面镜子，顺手追附近的人
      const cur = current(g);
      const heroes = g.heroes().map((h) => g.p(h).tile);
      if (!cur) return { goals: heroes };
      const near = heroes.filter((k) => g.distance(k, cur.tile) <= 2);
      return { goals: near.length ? near : heroes };
    },
  },
};
