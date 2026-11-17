import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 31 地基里的玉（拆迁前夜 × 血沁玉佩） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function spot(g: Game, ids: string[]): string {
  for (const id of ids) {
    const k = g.placeRoom(id);
    if (k) return k;
  }
  const b = Object.keys(g.state.tiles).filter((k) => k.startsWith('B:') && !START.includes(k));
  return b.length ? b[g.rng.int(b.length)] : 'B:0,-2';
}

function reachable(g: Game, k: string) {
  if (g.distance('G:0,0', k) === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板裂开一道口子，露出通往地下的石阶', 'haunt');
  }
}

const LIMIT = 12;

function track(g: Game) {
  const left = Math.max(0, LIMIT - g.state.haunt!.round + 1);
  const door = g.hv.opened ? '石门已开' : `石门 ${g.hv.open}/${g.hv.need}`;
  g.setTrack(`${door}｜地基塌陷倒计时`, left, LIMIT);
}

function dropJade(g: Game, tile: string) {
  g.hv.carrier = null;
  g.token(tile, 'jade', '血沁玉佩', { icon: 'jade' });
  g.log('血沁玉佩滚落在地上', 'bad');
}

function pickUp(g: Game, s: number) {
  if (g.isTraitor(s) || g.p(s).dead) return;
  const t = g.tokensAt(g.p(s).tile, 'jade')[0];
  if (!t) return;
  g.removeToken(t.id);
  g.hv.carrier = s;
  g.log(`${g.p(s).name} 捡起了血沁玉佩`, 'good');
}

export const h31: HauntDef = {
  id: 31,
  title: '地基里的玉',
  type: 'traitor',
  traitor: { type: 'highest', trait: 'knowledge' },
  intro: '推土机还没来，地基先裂了。裂缝深处传来石门挪动的闷响，那是百年前封住的地宫。手里的玉佩烫得握不住——它想回家，回到地宫的供台上去。',
  hero: {
    goal: '撬开地宫的石门，把血沁玉佩放回地宫的供台。',
    rules: [
      '异变开始时，一名幸存者拿着血沁玉佩（见日志）。持玉者死亡时玉佩掉在原地，任何幸存者进入该房间或在该房间开始回合时自动捡起。背叛者不能拿玉佩。',
      '地宫（若未发现则会出现在地下室）里有一座供台。地宫守卫从地宫醒来，它有血量，受到伤害只会扣血，血量归零才被消灭。',
      '背叛者死亡时，地宫守卫的剩余血量减半，但它不会停下。',
      '特殊行动「撬石门」：在地宫中进行知识或力量检定（取较高者）4+，成功则石门进度 +1。进度达到要求（3/4 人 2 次，5/6 人 3 次）后石门打开。',
      '特殊行动「供玉」：持玉者在石门已开的地宫中，且地宫里没有地宫守卫时，进行理智 3+ 检定，成功即胜利。',
      `计数轨显示地基塌陷倒计时：第 ${LIMIT} 轮结束时玉佩仍未归位，整栋楼会塌进地宫。`,
    ],
    win: '玉佩落进供台的凹槽，严丝合缝。地底的轰鸣声渐渐平息，裂缝里吹出一阵暖风，像是有人长长地松了口气。',
  },
  traitorSide: {
    goal: '阻止玉佩回到供台：杀死所有幸存者，或者撑到地基塌陷。',
    rules: [
      '你控制地宫守卫（血量很高，力量 5），它在你的回合之后行动，会追着持玉者走。',
      '如果你死了，地宫守卫的剩余血量减半，但仍会继续行动；所有幸存者死亡时你依然获胜。',
      '特殊行动「封石门」：在地宫中进行知识 4+ 检定，成功则石门进度 -1（石门完全打开后无效）。',
      '持玉者死后玉佩会掉在地上，你不能拿走它，但可以守在那里。',
      `第 ${LIMIT} 轮结束时如果玉佩仍未归位，你获胜。`,
    ],
    win: '最后一道裂缝合拢时，整栋洋楼像一块豆腐一样陷了下去。地宫的石门在黑暗中缓缓关上，供台上依旧空空如也。',
  },
  monsters: {
    guard: { name: '地宫守卫', icon: 'guard', speed: 3, might: 5, hp: 6 },
  },
  *setup(g) {
    const crypt = spot(g, ['crypt', 'storeroom', 'wine-cellar']);
    reachable(g, crypt);
    g.hv.crypt = crypt;
    g.hv.open = 0;
    g.hv.need = g.scale(2, 2, 3, 3);
    g.hv.opened = false;
    g.token(crypt, 'altar', '供台', { icon: 'altar' });
    const heroes = g.heroes();
    let carrier = heroes.find((s) => g.has(s, 'jade'));
    if (carrier == null) {
      const tt = g.p(g.traitor()!).tile;
      carrier = [...heroes].sort((a, b) => g.distance(g.p(a).tile, tt) - g.distance(g.p(b).tile, tt))[0];
    }
    g.hv.carrier = carrier;
    g.log(`${g.p(carrier).name} 拿着血沁玉佩`, 'haunt');
    const m = g.spawn('guard', crypt);
    if (m) m.hp = g.scale(6, 7, 8, 9);
    track(g);
  },
  actions: [
    {
      id: 'pry', side: 'hero', label: '撬石门', desc: '在地宫：知识或力量（取较高）4+，石门进度 +1',
      can: (g, s) => !g.hv.opened && g.p(s).tile === g.hv.crypt,
      *run(g, s) {
        const trait = g.value(s, 'knowledge') >= g.value(s, 'might') ? 'knowledge' : 'might';
        const r = yield* g.check(s, trait, 4, '撬石门 4+');
        if (r < 4) return;
        g.hv.open++;
        if (g.hv.open >= g.hv.need) {
          g.hv.opened = true;
          g.log('地宫的石门轰然打开，供台露了出来！', 'good');
        } else g.log(`石门又挪开了一点（${g.hv.open}/${g.hv.need}）`, 'good');
        track(g);
      },
    },
    {
      id: 'offer', side: 'hero', label: '供玉', desc: '持玉者在打开的地宫且无守卫：理智 3+ 即胜利',
      can: (g, s) => g.hv.opened && g.hv.carrier === s && g.p(s).tile === g.hv.crypt && g.monstersAt(g.hv.crypt, 'guard').length === 0,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 3, '供玉 3+');
        if (r >= 3) g.hv.done = true;
        else g.log(`${g.p(s).name} 的手抖得厉害，玉佩没能放进凹槽`, 'bad');
      },
    },
    {
      id: 'seal', side: 'traitor', label: '封石门', desc: '在地宫：知识 4+，石门进度 -1',
      can: (g, s) => !g.hv.opened && g.hv.open > 0 && g.p(s).tile === g.hv.crypt,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '封石门 4+');
        if (r < 4) return;
        g.hv.open--;
        g.log('石门又合上了一些', 'bad');
        track(g);
      },
    },
  ],
  *onTurnStart(g, s) {
    pickUp(g, s);
  },
  *onEnter(g, s) {
    pickUp(g, s);
  },
  *onDeath(g, s) {
    if (g.hv.carrier === s) dropJade(g, g.p(s).tile);
    if (g.isTraitor(s)) {
      for (const m of g.state.monsters) if (m.hp != null) m.hp = Math.max(1, Math.ceil(m.hp / 2));
      g.log('背叛者倒下了，地宫守卫的身形黯淡了一半', 'good');
    }
  },
  *onRoundEnd(g) {
    track(g);
  },
  checkWin(g) {
    if (g.hv.done) return { side: 'hero' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    if (g.state.haunt!.round > LIMIT) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const crypt = g.hv.crypt as string;
      const guards = g.state.monsters.map((m) => `m${m.id}` as const);
      const t = g.traitor();
      const targets = [...guards, ...(t != null ? [t] : [])];
      if (g.hv.carrier === s) {
        // 持玉者：门没开或守卫在场时，在附近等
        if (!g.hv.opened || g.monstersAt(crypt, 'guard').length) {
          return { goals: [crypt], actions: ['pry'], targets };
        }
        return { goals: [crypt], actions: ['offer'], targets };
      }
      const jade = g.tokens('jade')[0];
      if (jade) return { goals: [jade.tile], actions: ['pry'], targets };
      return { goals: [crypt], actions: ['pry'], targets };
    },
    traitor: (g) => {
      const c = g.hv.carrier as number | null;
      const goals = c != null ? [g.p(c).tile] : g.tokens('jade').map((t) => t.tile);
      if (!g.hv.opened && g.hv.open > 0) goals.unshift(g.hv.crypt);
      return { goals, actions: ['seal'] };
    },
    monster: (g) => {
      const c = g.hv.carrier as number | null;
      if (c != null) return { goals: [g.p(c).tile] };
      return { goals: [g.hv.crypt] };
    },
  },
};
