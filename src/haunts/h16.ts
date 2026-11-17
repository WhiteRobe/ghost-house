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

const arts = (g: Game, s: number) => Number(g.p(s).flags.h16art ?? 0);

function setTrackHp(g: Game) {
  g.setTrack('鬼将军的将魂', Math.max(0, g.hv.hp as number), g.hv.maxHp as number);
}

/** 同一房间里幸存者身上的法器总数 */
function artsHere(g: Game, tile: string) {
  return g.heroes().filter((h) => g.p(h).tile === tile).reduce((n, h) => n + arts(g, h), 0);
}

/** 16 镇宅之剑 */
export const h16: HauntDef = {
  id: 16,
  title: '镇宅之剑',
  type: 'traitor',
  traitor: { type: 'holder', card: 'sword' },
  intro: '遗嘱上说，镇宅之剑谁拔出来，宅子就归谁。剑一出鞘，满屋的灯笼全变成了绿色。握剑的人身上披上了一层锈迹斑斑的铠甲，喉咙里发出不属于他的声音：“擅入者，斩。”',
  hero: {
    goal: '打散鬼将军的将魂（计数轨归零）。',
    rules: [
      '背叛者化身鬼将军，拥有「将魂」（计数轨，3/4/5/6 人局为 6/7/8/9 点）。你们不能用普通攻击伤害他。',
      '房子里藏着两件能镇住他的法器（「法器」标记，多在佛堂、祠堂）。特殊行动「取法器」：在有法器的房间直接拿起它。',
      '特殊行动「递法器」：把身上的一件法器交给同一房间的另一名幸存者。',
      '特殊行动「斩将」（每回合一次）：与鬼将军同一房间时，你和他各掷力量骰。你点数高：如果你和同一房间的同伴身上合计凑齐了两件法器，他失去等于点数差的将魂；否则只能削掉 1 点。他点数高：你受到点数差的物理伤害。',
      '鬼将军还带着鬼兵，鬼兵被击败时只会被击晕。',
    ],
    win: '最后一缕将魂被打散，锈甲“哗啦”一声散落一地。镇宅剑插回了剑鞘，变得和一根普通的木棍没什么两样。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '你是鬼将军，拥有「将魂」（计数轨，3/4/5/6 人局为 6/7/8/9 点）。幸存者不能用普通攻击伤害你，只能用特殊行动「斩将」削你的将魂，将魂归零你就会死。',
      '幸存者如果在同一房间凑齐两件法器，斩将时能削掉你大量将魂；否则每次最多削 1 点。',
      '你攻击时多掷 1 颗骰。',
      '你控制鬼兵，它们在你的回合之后行动。鬼兵被击败时只会被击晕。',
    ],
    win: '最后一个擅入者倒在剑下。鬼将军拄着剑站在门厅里，像一尊守了几百年的石像。',
  },
  monsters: {
    soldier: { name: '鬼兵', icon: 'soldier', speed: 3, might: 3 },
  },
  *setup(g) {
    bridge(g);
    const t = g.traitor()!;
    g.hv.maxHp = g.scale(6, 7, 8, 9);
    g.hv.hp = g.hv.maxHp;
    setTrackHp(g);
    const used: string[] = [];
    for (const id of ['chapel', 'ancestral-hall']) {
      const k = g.findTile(id) ?? g.placeRoom(id);
      if (k && !used.includes(k)) used.push(reachable(g, k));
    }
    const tiles = Object.keys(g.state.tiles).filter((k) => !starts.includes(k) && !used.includes(k) && k !== g.p(t).tile && g.distance(START, k) < Infinity);
    g.rng.shuffle(tiles);
    while (used.length < 2) used.push(tiles.pop() ?? (used.includes(HALL) ? 'G:0,-2' : HALL));
    for (const k of used) g.token(k, 'artifact', '法器', { icon: 'artifact' });
    for (let i = 0; i < g.scale(1, 1, 2, 2); i++) g.spawn('soldier', g.p(t).tile);
  },
  actions: [
    {
      id: 'pick', side: 'hero', label: '取法器', desc: '拿起这里的法器',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'artifact').length > 0,
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'artifact')[0];
        if (!t) return;
        g.removeToken(t.id);
        g.p(s).flags.h16art = arts(g, s) + 1;
        g.log(`${g.p(s).name} 拿起了一件法器，指尖一阵发麻`, 'good');
      },
    },
    {
      id: 'give', side: 'hero', label: '递法器', desc: '把一件法器交给同一房间的另一名幸存者',
      can: (g, s) => arts(g, s) > 0 && g.heroes().some((o) => o !== s && g.p(o).tile === g.p(s).tile),
      ai: () => false,
      *run(g, s) {
        const others = g.heroes().filter((o) => o !== s && g.p(o).tile === g.p(s).tile);
        const o = yield* g.choosePlayer(s, '把法器交给谁？', others);
        if (o == null) return;
        g.p(s).flags.h16art = arts(g, s) - 1;
        g.p(o).flags.h16art = arts(g, o) + 1;
        g.log(`${g.p(s).name} 把法器递给了 ${g.p(o).name}`, 'info');
      },
    },
    {
      id: 'smite', side: 'hero', label: '斩将', desc: '与鬼将军对掷力量：凑齐两件法器时造成全额伤害',
      can: (g, s) => {
        const t = g.traitor();
        return t != null && !g.p(t).dead && g.p(t).tile === g.p(s).tile;
      },
      *run(g, s) {
        const t = g.traitor()!;
        const mine = yield* g.roll(g.value(s, 'might') + g.bonus(s, 'might', 'attack'), `${g.p(s).name} 斩将`, s);
        const his = yield* g.roll(g.value(t, 'might'), '鬼将军招架', t);
        g.log(`${g.p(s).name} 斩向鬼将军：${mine} 对 ${his}`, 'info');
        if (mine > his) {
          const full = artsHere(g, g.p(s).tile) >= 2;
          const n = full ? mine - his : 1;
          g.hv.hp = (g.hv.hp as number) - n;
          setTrackHp(g);
          g.log(full ? `两件法器同时亮起，将魂被削去 ${n} 点！` : '法器不全，只削下了 1 点将魂', 'good');
          if ((g.hv.hp as number) <= 0) yield* g.kill(t, s);
        } else if (his > mine) {
          yield* g.damage(s, 'physical', his - mine, '鬼将军反击', t);
        }
      },
    },
  ],
  *onRoundEnd(g) {
    bridge(g);
  },
  *onDeath(g, seat) {
    // 死去的幸存者把法器掉在原地
    const n = arts(g, seat);
    if (n > 0 && !g.isTraitor(seat)) {
      g.p(seat).flags.h16art = 0;
      for (let i = 0; i < n; i++) g.token(g.p(seat).tile, 'artifact', '法器', { icon: 'artifact' });
    }
  },
  rollBonus: (g, s, _t, purpose) => (purpose === 'attack' && g.isTraitor(s) ? 1 : 0),
  canAttack(g, s, t) {
    if (s === -1) return true;
    if (t.monster != null) return !g.isTraitor(s);
    if (t.seat == null || t.seat === s) return false;
    // 幸存者不能普通攻击鬼将军
    if (g.isTraitor(s)) return !g.isTraitor(t.seat);
    return false;
  },
  checkWin(g) {
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const t = g.traitor()!;
      const floor = g.tokens('artifact').map((x) => x.tile);
      const holders = g.heroes().filter((h) => arts(g, h) > 0);
      const total = holders.reduce((n, h) => n + arts(g, h), 0);
      // 还有法器在地上：最近的人去拿
      if (floor.length && arts(g, s) === 0) return { goals: floor, actions: ['pick'] };
      // 法器分散在两个人身上：先碰头，递到一个人手里
      if (total >= 2 && arts(g, s) === 1 && holders.length > 1) {
        const mate = holders.find((h) => h !== s)!;
        if (g.p(mate).tile === g.p(s).tile && s > mate) return { goals: [g.p(t).tile], actions: ['give', 'smite'] };
        return { goals: [g.p(mate).tile], actions: ['smite', 'pick'] };
      }
      return { goals: [g.p(t).tile], actions: ['smite', 'pick'] };
    },
    traitor: (g) => {
      const holders = g.heroes().filter((h) => arts(g, h) > 0).map((h) => g.p(h).tile);
      return { goals: holders.length ? holders : g.heroes().map((h) => g.p(h).tile), attack: true };
    },
  },
};
