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
      g.log('走廊地板裂开，下面有一道暗梯', 'info');
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
  else yield* g.damage(s, 'physical', 1, '脚底发凉');
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
  intro: '遗嘱上写着：“老太太的鞋，谁穿得下，谁就是她的孙媳。”楼梯上跟着响起“笃、笃、笃”，一个裹小脚的老太太扶着栏杆往下挪。你们当中速度最慢的那个人低头一看，自己的鞋松了一圈。',
  hero: {
    goal: '把老太太引进有牢门的房间，关上牢门。',
    rules: [
      '「小脚老太」是一个标记，不是怪物：不能攻击她，她也不会受伤。',
      '每轮结束时，老太太朝离她最近的幸存者挪 1 个房间；从第 3 轮结束时起，每轮挪 2 个房间。已经和幸存者在同一房间时，她不动。',
      '以下情况你会被她摸到：走进她所在的房间；回合开始时和她在同一房间；每轮结束时和她在同一房间；背叛者把她搀到你所在的房间。每人每轮最多被摸 1 次。被摸到：失去 1 点速度（不能减免，最低降到速度轨第 1 格）；速度已在第 1 格时，改为受到 1 点物理伤害。',
      '「牢门」标记放在水牢；水牢不在房子里时，依次改放储藏间、杂物间，都没有就随机放一个房间。',
      '特殊行动「关牢门」（每回合一次）：老太太在牢门所在房间时，你在这个房间或相邻房间，力量检定 5+。成功：你们获胜。她会追最近的人，所以可以拿自己当诱饵，把她带进去。',
      '死掉 2 名幸存者（6 人局 3 名），你们失败。',
    ],
    win: '铁门“哐当”一声锁上。门后“笃、笃”转了几圈，接着是“扑通”一声。',
  },
  traitorSide: {
    goal: '杀死 2 名幸存者（6 人局 3 名）。',
    rules: [
      '你不会被老太太摸到。每轮结束时她自己朝离她最近的幸存者挪 1 个房间，从第 3 轮结束时起挪 2 个，你控制不了她怎么走。她摸到幸存者会让对方失去 1 点速度，速度已在第 1 格时改为受到 1 点物理伤害。',
      '特殊行动「搀老太太」（每回合一次）：老太太在相邻房间时，把她搀到你所在的房间，这里的幸存者会被她摸到。',
      '特殊行动「缠足布」（每回合一次）：选同一房间的一名幸存者，他进行速度检定 4+。失败：失去 1 点速度；速度已在第 1 格时，改为受到 1 点物理伤害。',
      '幸存者关上牢门，你失败。老太太离牢门越远越好。',
    ],
    win: '“笃、笃、笃”，老太太又上楼去了。走廊上多了几双绣花小鞋，鞋尖冲着墙，摆得整整齐齐。',
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
      id: 'lock', side: 'hero', label: '关牢门', desc: '老太太在牢门所在房间时，在这里或相邻房间力量检定 5+。成功：你们获胜',
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
          g.log(`${g.p(s).name} 用肩膀顶上了生锈的牢门`, 'good');
        } else g.log('牢门锈住了，只推动一条缝', 'info');
      },
    },
    {
      id: 'lead', side: 'traitor', label: '搀老太太', desc: '把相邻房间的老太太搀到你所在的房间',
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
        g.log(`${g.p(s).name} 搀着老太太走了过来`, 'bad');
        for (const h of g.heroes()) if (g.p(h).tile === t.tile) yield* touch(g, h);
      },
    },
    {
      id: 'bind', side: 'traitor', label: '缠足布', desc: '同一房间一名幸存者速度检定 4+，失败失去 1 点速度',
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
