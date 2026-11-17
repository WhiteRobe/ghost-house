import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const START = 'G:0,0';
const HALL = 'G:0,-1';
const starts = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

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

const granny = (g: Game) => g.tokens('granny')[0];
const prison = (g: Game): string => g.hv.prison as string;

function lossNeed(g: Game) {
  return g.scale(2, 2, 2, 3);
}

/** 被老太太摸一下：速度 -1（最低降到 1 格）；已经最慢时改为受到 1 点物理伤害 */
function* touch(g: Game, s: number) {
  const p = g.p(s);
  if (g.isTraitor(s) || p.dead) return;
  if (p.flags.h17touch === g.state.round) return;
  p.flags.h17touch = g.state.round;
  g.log(`一只冰凉的小手摸了摸 ${p.name} 的脚踝`, 'bad', s);
  if (p.traits.speed > 1) yield* g.lose(s, 'speed', 1);
  else yield* g.damage(s, 'physical', 1, '脚底钻进一股寒气');
}

/** 老太太朝最近的幸存者挪一步 */
function stepGranny(g: Game) {
  const t = granny(g);
  if (!t) return;
  const heroes = g.heroes().map((h) => g.p(h).tile);
  if (!heroes.length || heroes.includes(t.tile)) return;
  const dist = (k: string) => Math.min(...heroes.map((h) => g.distance(k, h)));
  let best = t.tile;
  let bd = dist(t.tile);
  for (const n of g.neighbors(t.tile)) {
    const d = dist(n);
    if (d < bd) { bd = d; best = n; }
  }
  if (best !== t.tile) t.tile = best;
}

/** 17 小脚老太 */
export const h17: HauntDef = {
  id: 17,
  title: '小脚老太',
  type: 'traitor',
  traitor: { type: 'lowest', trait: 'speed' },
  intro: '遗嘱上写着：“老太太的鞋，谁穿得下，谁就是她的孙媳。”话音刚落，楼梯上传来“笃、笃、笃”的声音——一个裹着小脚的老太太，正一步一步地挪下来。走得最慢的那个人，低头看见自己的脚正在缩小。',
  hero: {
    goal: '把小脚老太太引进水牢，关上牢门。',
    rules: [
      '「老太太」是一个标记，她走得很慢，而且不会受伤，也不能被攻击。',
      '每轮结束时，老太太朝离她最近的幸存者挪动 1 个房间，第 3 轮起每轮挪 2 个房间。她总是去找最近的人。',
      '被她摸到就会失去 1 点速度（不是伤害，不能减免，但最多降到速度轨最低一格）；速度已经在最低一格时，改为受到 1 点物理伤害。走进她所在的房间、回合开始时和她同处一室、或者她挪到你身边时都会被摸到（每人每轮最多一次）。',
      '水牢有「牢门」标记（水牢不在房子里时，改为另一个房间）。',
      '特殊行动「关牢门」：老太太在牢门所在房间时，你在那个房间或相邻房间进行力量 5+ 检定，成功则把她锁在里面，你们获胜。',
      '死去的幸存者达到 2 人（6 人局 3 人）时你们失败。',
    ],
    win: '铁门“哐当”一声锁上。门后的“笃、笃”声转了几圈，渐渐沉进了水里。',
  },
  traitorSide: {
    goal: '让 2 名幸存者（6 人局 3 名）死去。',
    rules: [
      '你不会被老太太摸到。她每轮结束时朝离她最近的幸存者挪动（第 3 轮起每次挪 2 个房间），不受任何人控制。',
      '特殊行动「搀老太太」（每回合一次）：老太太在你所在房间或相邻房间时，把她搀到你身边。',
      '特殊行动「缠足布」（每回合一次）：对同一房间的一名幸存者甩出裹脚布，他需要通过速度 4+ 检定，否则失去 1 点速度（已经最慢时改为受到 1 点物理伤害）。',
      '老太太被关进水牢时你失败。',
    ],
    win: '“笃、笃、笃”，老太太又上楼去了。走廊上多了几双小小的绣花鞋，摆得整整齐齐。',
  },
  *setup(g) {
    bridge(g);
    let k = g.findTile('water-prison') ?? g.placeRoom('water-prison') ?? g.findTile('storeroom') ?? g.findTile('junk-room');
    const t = g.traitor()!;
    if (!k) {
      const tiles = Object.keys(g.state.tiles).filter((x) => !starts.includes(x) && g.distance(START, x) < Infinity);
      k = tiles.length ? tiles[g.rng.int(tiles.length)] : 'G:0,-2';
    }
    g.hv.prison = reachable(g, k);
    g.token(k, 'cell', '牢门', { icon: 'door' });
    // 老太太从背叛者身边出现，但不能直接出现在牢里
    let spawn = g.p(t).tile;
    if (spawn === k || g.distance(spawn, k) <= 1) {
      const far = Object.keys(g.state.tiles).filter((x) => g.distance(x, k) >= 2 && g.distance(START, x) < Infinity);
      spawn = far.length ? far[g.rng.int(far.length)] : 'U:0,-2';
    }
    g.token(spawn, 'granny', '小脚老太', { icon: 'granny' });
  },
  actions: [
    {
      id: 'lock', side: 'hero', label: '关牢门', desc: '老太太在水牢时，在水牢或相邻房间力量 5+ 检定',
      can: (g, s) => {
        const t = granny(g);
        if (!t || t.tile !== prison(g)) return false;
        const here = g.p(s).tile;
        return here === prison(g) || g.neighbors(prison(g)).includes(here);
      },
      *run(g, s) {
        const r = yield* g.check(s, 'might', 5, '关牢门 5+');
        if (r >= 5) {
          g.hv.locked = true;
          g.log(`${g.p(s).name} 用肩膀顶上了锈死的牢门！`, 'good');
        } else g.log('牢门锈住了，只推动了一条缝', 'info');
      },
    },
    {
      id: 'lead', side: 'traitor', label: '搀老太太', desc: '把所在或相邻房间的老太太搀到你身边',
      can: (g, s) => {
        const t = granny(g);
        if (!t) return false;
        const here = g.p(s).tile;
        return t.tile !== here && g.neighbors(here).includes(t.tile);
      },
      *run(g, s) {
        const t = granny(g);
        if (!t) return;
        t.tile = g.p(s).tile;
        g.log(`${g.p(s).name} 搀着老太太，慢慢走了过来`, 'bad');
        for (const h of g.heroes()) if (g.p(h).tile === t.tile) yield* touch(g, h);
      },
    },
    {
      id: 'bind', side: 'traitor', label: '缠足布', desc: '同一房间一名幸存者速度 4+，否则失去 1 点速度',
      can: (g, s) => g.heroes().some((h) => g.p(h).tile === g.p(s).tile),
      *run(g, s) {
        const hs = g.heroes().filter((h) => g.p(h).tile === g.p(s).tile);
        const h = yield* g.choosePlayer(s, '把裹脚布甩向谁？', hs);
        if (h == null) return;
        const r = yield* g.check(h, 'speed', 4, '躲开裹脚布 4+');
        if (r < 4) {
          g.log(`裹脚布缠住了 ${g.p(h).name} 的脚`, 'bad');
          if (g.p(h).traits.speed > 1) yield* g.lose(h, 'speed', 1);
          else yield* g.damage(h, 'physical', 1, '裹脚布勒紧', s);
        }
      },
    },
  ],
  *onEnter(g, s) {
    const t = granny(g);
    if (t && g.p(s).tile === t.tile) yield* touch(g, s);
  },
  *onTurnStart(g, s) {
    const t = granny(g);
    if (t && g.p(s).tile === t.tile) yield* touch(g, s);
  },
  *onRoundEnd(g) {
    bridge(g);
    const steps = (g.state.haunt?.round ?? 1) > 3 ? 2 : 1;
    const before = granny(g)?.tile;
    for (let i = 0; i < steps; i++) stepGranny(g);
    const t = granny(g);
    if (!t) return;
    if (t.tile !== before) g.log(`“笃、笃”，老太太挪到了「${g.tileName(t.tile)}」`, 'haunt');
    for (const h of g.heroes()) if (g.p(h).tile === t.tile) yield* touch(g, h);
  },
  checkWin(g) {
    if (g.hv.locked) return { side: 'hero' };
    const dead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (dead >= lossNeed(g)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g) => {
      const t = granny(g);
      const p = prison(g);
      const adj = g.neighbors(p);
      if (t && t.tile === p) return { goals: [p, ...adj], actions: ['lock'], attack: true };
      // 大家都躲进水牢，她自然会跟过来
      return { goals: [p], attack: true };
    },
    traitor: (g, s) => {
      const t = granny(g);
      const heroes = g.heroes().map((h) => g.p(h).tile);
      // 把老太太往远离水牢的地方搀，顺手打人
      if (t && t.tile !== g.p(s).tile && g.distance(t.tile, prison(g)) <= 2) return { goals: [t.tile, ...g.neighbors(t.tile)], actions: ['lead', 'bind'] };
      return { goals: heroes, actions: ['bind'] };
    },
  },
};
