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
  intro: '遗嘱上写着：镇宅剑谁拔出来，宅子就归谁。剑一出鞘，满屋灯笼都变成了绿的。握着桃木剑的那个人身上长出一层生锈的铠甲，开口是个老男人的嗓子：“擅入者，斩。”',
  hero: {
    goal: '用「斩将」把鬼将军的将魂削到 0。',
    rules: [
      '背叛者（持有桃木剑的人，没人持有则为揭示者）变成鬼将军，有「将魂」6/7/8/9 点（3/4/5/6 人局，见计数轨）。你不能攻击鬼将军，只能用「斩将」削他的将魂。将魂到 0，他就死了，你们获胜。',
      '房子里有 2 件「法器」标记，放在佛堂和祠堂；这两间不在房子里时，改放随机房间。特殊行动「取法器」：在有法器的房间拿起 1 件，不用检定。',
      '特殊行动「递法器」：把你身上的 1 件法器交给同一房间的另一名幸存者。幸存者死亡时，身上的法器掉在原地，可以再拿。',
      '特殊行动「斩将」（每回合一次）：与鬼将军同一房间时，你和他各掷力量值颗骰。你点数高：这个房间里幸存者身上的法器合计有 2 件时，他失去等于点数差的将魂；不到 2 件，只失去 1 点。他点数高：你受到点数差的物理伤害。平手无事。',
      '鬼将军攻击时多掷 1 颗骰。他还带着 1/1/2/2 个鬼兵（速度 3，力量 3），鬼兵受伤只会被击晕。',
    ],
    win: '最后一点将魂削掉，锈甲“哗啦”一声散了一地。地上那把桃木剑，看着就是根普通木棍。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '你是鬼将军，有「将魂」6/7/8/9 点（3/4/5/6 人局，见计数轨）。幸存者不能攻击你，只能和你同房间时用「斩将」削将魂：双方掷力量值颗骰，他点数高你失去将魂，你点数高他受到点数差的物理伤害。将魂到 0 你就死了。',
      '斩将的房间里，幸存者身上的法器合计有 2 件时，你失去等于点数差的将魂；不到 2 件，每次只失去 1 点。法器有 2 件，盯住拿着法器的人。',
      '你攻击时多掷 1 颗骰。',
      '你控制鬼兵（速度 3，力量 3），它们在你的回合之后行动。鬼兵受伤只会被击晕。',
    ],
    win: '最后一个擅入者倒下了。鬼将军拄着剑站回门厅，铠甲上的锈又厚了一层。',
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
        g.log(`${g.p(s).name} 拿起了一件法器，指尖发麻`, 'good');
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
      id: 'smite', side: 'hero', label: '斩将', desc: '与鬼将军对掷力量。你赢：本房间幸存者合计有 2 件法器时削去点数差的将魂，否则削 1 点。你输：受到点数差的物理伤害',
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
          g.log(full ? `两件法器同时亮了，将魂被削去 ${n} 点` : '法器不到 2 件，只削下 1 点将魂', 'good');
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
