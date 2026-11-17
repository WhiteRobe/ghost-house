import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 44 绣鞋娘子（百年诅咒 × 绣花鞋） */

type Shoe = 'left' | 'right';
const SHOES: Shoe[] = ['left', 'right'];
const SHOE_NAME: Record<Shoe, string> = { left: '左脚绣鞋', right: '右脚绣鞋' };
const START = ['entrance', 'hallway', 'stairs', 'upper-landing', 'basement-landing'];

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌开一个洞，露出通往地下室的石阶', 'info');
  }
}

const dressing = (g: Game): string => g.hv.dressing ?? 'U:0,-2';
const carry = (g: Game) => g.hv.carry as Record<Shoe, number | null>;
const table = (g: Game) => g.hv.table as Shoe[];
const mine = (g: Game, s: number) => SHOES.filter((x) => carry(g)[x] === s);
const printCap = (g: Game) => g.scale(4, 5, 6, 6);

function reachableTiles(g: Game, exclude: string[] = []) {
  return Object.keys(g.state.tiles).filter((k) => !exclude.includes(k) && g.distance('G:0,0', k) < Infinity);
}

function dropShoe(g: Game, shoe: Shoe, at: string) {
  g.token(at, 'shoe', SHOE_NAME[shoe], { icon: 'shoe', data: { shoe } });
}

function updateTrack(g: Game) {
  g.setTrack('梳妆台上的绣鞋', table(g).length, 2);
}

export const h44: HauntDef = {
  id: 44,
  title: '绣鞋娘子',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '湿漉漉的脚印从楼梯一路延伸上来，每一个都只有巴掌大，鞋尖绣着并蒂莲。揭示者低头看自己的脚——不知什么时候，已经穿上了一只红缎绣鞋。她生前只差一只鞋就能出嫁，如今她要找一双合脚的人。',
  hero: {
    goal: '找齐一对绣花鞋（左脚、右脚），放回二楼梳妆间的梳妆台上配成一对。',
    rules: [
      '左脚绣鞋穿在绣鞋娘子（背叛者）脚上；右脚绣鞋沉在房子里某一处水渍里（水渍以标记显示，只有一处是真的）。梳妆间若尚未出现，会立即出现在二楼。',
      '特殊行动「摸索水渍」：在有水渍的房间进行知识 3+ 检定，成功则清掉这处水渍，如果鞋在这里你就拿到右脚绣鞋。',
      '特殊行动「夺鞋」：与持鞋的对手在同一房间时，用力量攻击他；你赢了就夺下一只鞋（对方照常受伤）。这算作你本回合的攻击。',
      '特殊行动「拾鞋」：在有绣鞋标记的房间拿起它（无需检定）。携带绣鞋的人死亡时，鞋掉在他所在的房间。',
      '特殊行动「放回梳妆台」：在梳妆间把你携带的绣鞋放上梳妆台。两只都在台上时，进行理智 5+ 检定把它们配成一对，成功即获胜；失败则下回合可以再试。',
      '湿鞋印：绣鞋娘子每个回合结束都会在她所在的房间留下一个湿鞋印。你进入有湿鞋印的房间时失去 1 点速度（不会因此降到最低格以下），鞋印消失，并且她会感知到你的位置。',
      '绣鞋娘子用力量攻击时多掷 2 颗骰。',
    ],
    win: '两只绣鞋并排摆在梳妆台上，鞋尖对着镜子。镜子里的新娘终于笑了一下，连同满地的水渍一起淡去了。',
  },
  traitorSide: {
    goal: '杀死所有幸存者，别让任何人把鞋配成一对。',
    rules: [
      '你用力量攻击时多掷 2 颗骰。',
      '你每个回合结束时自动在所在房间留下一个湿鞋印（已有则不再留）。场上鞋印有上限，超出时最早的那个干掉。',
      '幸存者踩到湿鞋印会失去 1 点速度，并且你会感知到他。',
      '特殊行动「循迹」：你所在房间没有幸存者时，立刻移动到最近一个被你感知到的幸存者所在的房间。',
      '特殊行动「藏鞋」：在有绣鞋标记的房间，或在梳妆台上有鞋的梳妆间，进行理智 4+ 检定，成功则把一只鞋藏到房子里随机一个房间。',
      '左脚绣鞋穿在你脚上。幸存者可以用「夺鞋」从你身上抢走它；你也可以用「夺鞋」攻击持鞋的幸存者：赢了就把左脚绣鞋穿回去，或把右脚绣鞋甩到随机房间。这算作你本回合的攻击。',
      '你不能拾鞋，也不能摸索水渍。',
    ],
    win: '最后一个人也穿上了红缎绣鞋，一步一步走进了梳妆间的镜子。镜子里，送亲的队伍排得很长很长。',
  },
  *setup(g) {
    ensureBasement(g);
    const t = g.traitor()!;
    const d = g.placeRoom('dressing') ?? 'U:0,-2';
    g.hv.dressing = d;
    g.hv.carry = { left: null, right: null };
    g.hv.table = [];
    g.hv.sensed = null;
    const pool = reachableTiles(g, [d, g.p(t).tile]).filter((k) => !START.includes(g.state.tiles[k].room));
    g.rng.shuffle(pool);
    pool.sort((a, b) => g.distance(d, b) - g.distance(d, a));
    const n = g.scale(3, 3, 4, 4);
    const spots = pool.slice(0, n);
    for (const k of ['B:0,-2', 'G:0,-1', 'G:0,0', 'U:0,-2']) if (spots.length < n && !spots.includes(k) && k !== d) spots.push(k);
    for (const k of spots) g.token(k, 'puddle', '水渍', { icon: 'puddle' });
    g.hs.realPuddle = spots[g.rng.int(spots.length)];
    // 左脚绣鞋穿在绣鞋娘子脚上
    g.hv.carry.left = t;
    g.token(g.p(t).tile, 'print', '湿鞋印', { icon: 'print' });
    updateTrack(g);
  },
  actions: [
    {
      id: 'grope', side: 'hero', label: '摸索水渍', desc: '知识 3+ 检定，在本房间的水渍里摸索绣鞋',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'puddle').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 3, '摸索水渍 3+');
        if (r < 3) {
          g.log('水冷得刺骨，什么也没摸到', 'info');
          return;
        }
        const here = g.p(s).tile;
        for (const t of g.tokensAt(here, 'puddle')) g.removeToken(t.id);
        if (g.hs.realPuddle === here) {
          carry(g).right = s;
          g.log(`${g.p(s).name} 从水渍里捞出了「右脚绣鞋」`, 'good');
        } else g.log('水渍底下只有一层青苔', 'info');
        // 只剩一处水渍时，鞋一定在那里
      },
    },
    {
      id: 'snatch', side: 'any', label: '夺鞋', desc: '用力量攻击同一房间里持有绣鞋的对手，赢了就夺走一只鞋',
      can: (g, s) => !g.attacked && g.playersAt(g.p(s).tile).some((o) => o !== s && g.sideOf(o) !== g.sideOf(s) && mine(g, o).length > 0),
      *run(g, s) {
        g.attacked = true;
        const opts = g.playersAt(g.p(s).tile).filter((o) => o !== s && g.sideOf(o) !== g.sideOf(s) && mine(g, o).length > 0);
        const o = yield* g.choosePlayer(s, '从谁身上夺鞋？', opts);
        if (o == null) return;
        const r = yield* g.attack({ seat: s }, { seat: o });
        if (!r.winner || !('seat' in r.winner) || r.winner.seat !== s || g.p(s).dead) return;
        const shoe = mine(g, o)[0] ?? SHOES.find((x) => g.tokensAt(g.p(s).tile, 'shoe').some((t) => t.data?.shoe === x));
        if (!shoe) return;
        for (const t of g.tokensAt(g.p(s).tile, 'shoe')) if (t.data?.shoe === shoe) g.removeToken(t.id);
        if (g.isTraitor(s)) {
          if (shoe === 'left') {
            carry(g).left = s;
            g.log('绣鞋娘子把左脚绣鞋重新穿回了脚上', 'bad');
          } else {
            carry(g).right = null;
            const pool = reachableTiles(g, [g.p(s).tile, dressing(g)]);
            const to = pool.length ? pool[g.rng.int(pool.length)] : 'G:0,0';
            dropShoe(g, shoe, to);
            g.log(`「${SHOE_NAME[shoe]}」被一把夺走，甩到了${g.tileName(to)}`, 'bad');
          }
        } else {
          carry(g)[shoe] = s;
          g.log(`${g.p(s).name} 夺下了「${SHOE_NAME[shoe]}」`, 'good');
        }
      },
    },
    {
      id: 'pick', side: 'hero', label: '拾鞋', desc: '拿起本房间的绣鞋',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'shoe').length > 0,
      *run(g, s) {
        for (const tk of g.tokensAt(g.p(s).tile, 'shoe')) {
          const shoe = tk.data!.shoe as Shoe;
          g.removeToken(tk.id);
          carry(g)[shoe] = s;
          g.log(`${g.p(s).name} 拾起了「${SHOE_NAME[shoe]}」，鞋里还是湿的`, 'good');
        }
      },
    },
    {
      id: 'restore', side: 'hero', label: '放回梳妆台', desc: '把携带的绣鞋放上梳妆台；两只都在时理智 5+ 检定配成一对',
      can: (g, s) => g.p(s).tile === dressing(g) && (mine(g, s).length > 0 || table(g).length === 2),
      *run(g, s) {
        for (const shoe of mine(g, s)) {
          carry(g)[shoe] = null;
          table(g).push(shoe);
          g.log(`${g.p(s).name} 把「${SHOE_NAME[shoe]}」放上了梳妆台`, 'good');
        }
        updateTrack(g);
        if (table(g).length < 2) return;
        const r = yield* g.check(s, 'sanity', 5, '配成一对 5+');
        if (r >= 5) g.hv.paired = true;
        else g.log('两只鞋怎么摆都摆不正，鞋尖总是朝着门外', 'bad');
      },
    },
    {
      id: 'track', side: 'traitor', label: '循迹', desc: '移动到被你感知到的幸存者身边',
      publicText: '湿鞋印的主人顺着水渍找了过来！',
      can: (g, s) => {
        const t = g.hv.sensed as number | null;
        return t != null && !g.p(t).dead && g.p(t).tile !== g.p(s).tile && g.heroes().every((h) => g.p(h).tile !== g.p(s).tile);
      },
      *run(g, s) {
        const t = g.hv.sensed as number;
        g.hv.sensed = null;
        g.moveTo(s, g.p(t).tile, '水渍里浮出一双小脚');
      },
    },
    {
      id: 'hide', side: 'traitor', label: '藏鞋', desc: '理智 4+ 检定，把一只鞋藏到随机房间',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'shoe').length > 0 || (g.p(s).tile === dressing(g) && table(g).length > 0),
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '藏鞋 4+');
        if (r < 4) return;
        const here = g.p(s).tile;
        let shoe: Shoe;
        const tk = g.tokensAt(here, 'shoe')[0];
        if (tk) {
          shoe = tk.data!.shoe as Shoe;
          g.removeToken(tk.id);
        } else {
          shoe = table(g).pop()!;
          updateTrack(g);
        }
        const pool = reachableTiles(g, [here, dressing(g)]);
        const to = pool.length ? pool[g.rng.int(pool.length)] : 'G:0,0';
        dropShoe(g, shoe, to);
        g.log(`「${SHOE_NAME[shoe]}」不见了……有人说在${g.tileName(to)}听见了水声`, 'bad');
      },
    },
  ],
  *onEnter(g, s) {
    if (g.isTraitor(s)) return;
    const prints = g.tokensAt(g.p(s).tile, 'print');
    if (!prints.length) return;
    for (const t of prints) g.removeToken(t.id);
    if (g.p(s).traits.speed > 1) yield* g.lose(s, 'speed', 1);
    g.hv.sensed = s;
    g.log(`${g.p(s).name} 踩进了湿鞋印，脚底一阵冰凉——有什么东西知道你在这里了`, 'bad');
  },
  *onTurnEnd(g, s) {
    if (!g.isTraitor(s)) return;
    const here = g.p(s).tile;
    if (g.tokensAt(here, 'print').length) return;
    g.token(here, 'print', '湿鞋印', { icon: 'print' });
    const all = g.tokens('print');
    if (all.length > printCap(g)) g.removeToken(all[0].id);
  },
  *onDeath(g, s) {
    for (const shoe of mine(g, s)) {
      carry(g)[shoe] = null;
      dropShoe(g, shoe, g.p(s).tile);
      g.log(`「${SHOE_NAME[shoe]}」掉在了${g.tileName(g.p(s).tile)}`, 'info');
    }
  },
  rollBonus(g, s, trait, purpose) {
    return g.isTraitor(s) && trait === 'might' && purpose === 'attack' ? 2 : 0;
  },
  checkWin(g) {
    if (g.hv.paired) return { side: 'hero' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const d = dressing(g);
      if (table(g).length === 2) return { goals: [d], actions: ['restore'] };
      if (mine(g, s).length) return { goals: [d], actions: ['restore', 'pick'], attack: false };
      const goals = [...g.tokens('shoe').map((t) => t.tile), ...g.tokens('puddle').map((t) => t.tile)];
      const t = g.traitor();
      if (t != null && carry(g).left === t) goals.push(g.p(t).tile);
      if (!goals.length) return { goals: [d], actions: ['restore'] };
      return { goals, actions: ['pick', 'grope', 'snatch', 'restore'] };
    },
    traitor: (g) => {
      const heroes = g.heroes();
      const carriers = heroes.filter((h) => mine(g, h).length);
      const goals = table(g).length ? [dressing(g)] : (carriers.length ? carriers : heroes).map((h) => g.p(h).tile);
      return { goals, actions: ['hide', 'snatch', 'track'] };
    },
  },
};
