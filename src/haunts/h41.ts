import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 41 猫祟（百年诅咒 × 黑猫） */

const RELICS = ['collar', 'tablet', 'incense'] as const;
type Relic = (typeof RELICS)[number];
const RELIC_NAME: Record<Relic, string> = { collar: '铜铃项圈', tablet: '猫仙牌位', incense: '安魂香' };
const START = ['entrance', 'hallway', 'stairs', 'upper-landing', 'basement-landing'];

function reachable(g: Game, k: string) {
  return g.distance('G:0,0', k) < Infinity;
}

/** 地下室若与一楼不通，补上地窖口（放不下就临时打通走廊与地下室楼梯口） */
function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌了个洞，底下是去地下室的石阶', 'info');
  }
}

function hallTile(g: Game): string {
  return g.hv.hall ?? 'G:0,0';
}

/** 背叛者能扑到的幸存者：3 步以内、不在同一格 */
function pounceTargets(g: Game, s: number): number[] {
  const here = g.p(s).tile;
  return g.heroes()
    .filter((h) => g.p(h).tile !== here && g.distance(here, g.p(h).tile) <= 3)
    .sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
}

function carrying(g: Game, s: number): Relic[] {
  const c = (g.hv.carry ?? {}) as Record<string, number | null>;
  return RELICS.filter((r) => c[r] === s);
}

function updateTrack(g: Game) {
  g.setTrack('已供奉的祭品', (g.hv.offered as string[]).length, 3);
}

export const h41: HauntDef = {
  id: 41,
  title: '猫祟',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '屋梁上一声猫叫，拖得很长。揭示者的瞳孔竖成了一条缝。老辈人说，这家人当年在祠堂底下活埋过一只黑猫，压了一百年。今晚它借了一副人身，回来讨债。',
  hero: {
    goal: '找齐猫的三样遗物（铜铃项圈、猫仙牌位、安魂香），在祠堂供上，再为它超度。',
    rules: [
      '三样遗物是标记，分散在离祠堂较远的房间里。祠堂还没发现的话，会直接放到地图上。',
      '特殊行动「拾取遗物」：在有遗物的房间执行，理智检定 4+。成功拿起这个房间所有遗物，失败受到 1 点精神伤害。带着遗物的人死亡，遗物掉在原地。',
      '特殊行动「供奉」：在祠堂执行，把你带着的遗物全部供上。',
      '特殊行动「超度」：三样遗物都供上之后，在祠堂执行，理智检定 5+，成功你们获胜。杀死背叛者不会让你们获胜。',
      '背叛者速度 +2、力量 +1，用力量攻击时多掷 2 颗骰，还能从 3 步以内扑到你所在的房间。背叛者在祠堂能把供上的遗物打翻到随机房间。',
    ],
    win: '安魂香烧到了底，青烟绕着牌位转了三圈，散了。屋梁上没再有猫叫，项圈上的铜铃叮地响了一下。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '异变开始时，你的速度 +2、力量 +1。',
      '你用力量攻击时多掷 2 颗骰。',
      '特殊行动「扑击」：你的房间里没有幸存者时，选 3 步以内的一名幸存者，立刻移动到他的房间。扑完仍然可以攻击。',
      '特殊行动「打翻供品」：在祠堂执行，理智检定 4+，成功把最后供上的那件遗物甩到随机一个房间。',
      '你不能拾取遗物。幸存者超度成功，你失败；你死亡不算失败。',
    ],
    win: '最后一个人倒下，屋梁上亮起一对对绿眼睛，一只接一只地叫起来。',
  },
  *setup(g) {
    const t = g.traitor()!;
    ensureBasement(g);
    yield* g.gain(t, 'speed', 2);
    yield* g.gain(t, 'might', 1);
    const hall = g.placeRoom('ancestral-hall') ?? g.findTile('ancestral-hall') ?? 'G:0,0';
    g.hv.hall = hall;
    g.hv.carry = { collar: null, tablet: null, incense: null };
    g.hv.offered = [];
    // 遗物：尽量分散到不同楼层，避开起始房间、祠堂和背叛者所在房间
    const pool = Object.keys(g.state.tiles).filter((k) => !START.includes(g.state.tiles[k].room) && k !== hall && k !== g.p(t).tile && reachable(g, k));
    g.rng.shuffle(pool);
    // 离祠堂越远越好
    pool.sort((a, b) => g.distance(hall, b) - g.distance(hall, a));
    const floors = ['U', 'B', 'G'];
    const picks: string[] = [];
    for (const f of floors) {
      const k = pool.find((x) => x.startsWith(f + ':') && !picks.includes(x));
      if (k) picks.push(k);
    }
    for (const k of pool) if (picks.length < 3 && !picks.includes(k)) picks.push(k);
    const fallback = ['U:0,-2', 'G:0,-1', 'G:0,0'];
    for (let i = 0; picks.length < 3; i++) picks.push(fallback[i]);
    RELICS.forEach((r, i) => g.token(picks[i], 'relic', RELIC_NAME[r], { icon: 'relic', data: { relic: r } }));
    updateTrack(g);
  },
  actions: [
    {
      id: 'pickup', side: 'hero', label: '拾取遗物', desc: '理智检定 4+：拿起这个房间的遗物',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'relic').length > 0,
      *run(g, s) {
        const roll = yield* g.check(s, 'sanity', 4, '拾取遗物 4+');
        if (roll < 4) {
          yield* g.damage(s, 'mental', 1, '猫的怨气');
          return;
        }
        for (const tk of g.tokensAt(g.p(s).tile, 'relic')) {
          const r = tk.data!.relic as Relic;
          g.removeToken(tk.id);
          g.hv.carry[r] = s;
          g.log(`${g.p(s).name} 拾起了「${RELIC_NAME[r]}」`, 'good');
        }
      },
    },
    {
      id: 'offer', side: 'hero', label: '供奉', desc: '在祠堂：把带着的遗物全部供上',
      can: (g, s) => g.p(s).tile === hallTile(g) && carrying(g, s).length > 0,
      *run(g, s) {
        for (const r of carrying(g, s)) {
          g.hv.carry[r] = null;
          (g.hv.offered as string[]).push(r);
          g.log(`${g.p(s).name} 把「${RELIC_NAME[r]}」摆在了牌位前`, 'good');
        }
        updateTrack(g);
      },
    },
    {
      id: 'release', side: 'hero', label: '超度', desc: '三样遗物都供上后，在祠堂：理智检定 5+，获胜',
      can: (g, s) => g.p(s).tile === hallTile(g) && (g.hv.offered as string[]).length >= 3,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 5, '超度 5+');
        if (r >= 5) g.hv.released = true;
        else g.log('香灰断了一截掉下来，猫还不肯走', 'bad');
      },
    },
    {
      id: 'pounce', side: 'traitor', label: '扑击', desc: '移动到 3 步以内一名幸存者的房间',
      publicText: '猫祟弓起背一蹿，越过了好几个房间',
      can: (g, s) => g.heroes().every((h) => g.p(h).tile !== g.p(s).tile) && pounceTargets(g, s).length > 0,
      *run(g, s) {
        const t = yield* g.choosePlayer(s, '扑向谁？', pounceTargets(g, s));
        if (t != null) g.moveTo(s, g.p(t).tile, '一团黑影扑了过来');
      },
    },
    {
      id: 'knock', side: 'traitor', label: '打翻供品', desc: '在祠堂：理智检定 4+，把最后供上的遗物甩到随机房间',
      can: (g, s) => g.p(s).tile === hallTile(g) && (g.hv.offered as string[]).length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '打翻供品 4+');
        if (r < 4) return;
        const off = g.hv.offered as Relic[];
        const relic = off.pop()!;
        const tiles = Object.keys(g.state.tiles).filter((k) => k !== hallTile(g) && reachable(g, k));
        const to = tiles.length ? tiles[g.rng.int(tiles.length)] : 'G:0,0';
        g.token(to, 'relic', RELIC_NAME[relic], { icon: 'relic', data: { relic } });
        g.log(`供桌被掀翻，「${RELIC_NAME[relic]}」滚到了${g.tileName(to)}`, 'bad');
        updateTrack(g);
      },
    },
  ],
  *onDeath(g, s) {
    for (const r of carrying(g, s)) {
      g.hv.carry[r] = null;
      g.token(g.p(s).tile, 'relic', RELIC_NAME[r], { icon: 'relic', data: { relic: r } });
      g.log(`「${RELIC_NAME[r]}」掉在了${g.tileName(g.p(s).tile)}`, 'info');
    }
  },
  rollBonus(g, s, trait, purpose) {
    if (!g.isTraitor(s) || trait !== 'might') return 0;
    return purpose === 'attack' ? 2 : 0;
  },
  checkWin(g) {
    if (g.hv.released) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const hall = hallTile(g);
      const loose = g.tokens('relic').map((t) => t.tile);
      const mine = carrying(g, s);
      if ((g.hv.offered as string[]).length >= 3) return { goals: [hall], actions: ['release'] };
      if (mine.length && (!loose.length || mine.length >= 2)) return { goals: [hall], actions: ['offer', 'pickup'] };
      if (loose.length) return { goals: loose, actions: ['pickup', 'offer'] };
      return { goals: [hall], actions: ['offer', 'pickup'] };
    },
    traitor: (g, s) => {
      const heroes = g.heroes();
      const carriers = heroes.filter((h) => carrying(g, h).length);
      const targets = carriers.length ? carriers : heroes;
      const actions = ['knock', 'pounce'];
      return { goals: targets.map((h) => g.p(h).tile), actions };
    },
  },
};
