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
    g.log('走廊的地板裂开，露出一段往下的石阶', 'haunt');
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
  intro: '推土机还没来，地基先裂了。裂缝底下传来石头蹭石头的闷响，百年前封死的地宫在开门。有人兜里的玉佩烫得握不住，玉里那道血丝一直往一个方向爬，指着脚下。',
  hero: {
    goal: '撬开地宫石门，让持玉者把血沁玉佩放上供台。',
    rules: [
      '「供台」标记放在地宫（还没发现就直接放进地下室）。地宫放不下时依次改用储藏间、酒窖，再不行就是地下室的一个随机房间。下文的「地宫」都指有供台的那个房间。',
      '异变开始时，一名幸存者拿着血沁玉佩，日志里会写是谁。持玉者死亡时玉佩掉在原地，幸存者进入那个房间或在那里开始回合时自动捡起。背叛者不能拿玉佩。',
      '特殊行动「撬石门」（每回合一次）：在地宫里，知识或力量检定（取较高者）4+，成功则石门进度 +1。进度到 2（3/4 人局）或 3（5/6 人局）时石门打开。',
      '特殊行动「供玉」：持玉者在石门已开的地宫里，且地宫里没有地宫守卫（被击晕的也算在场）时，理智检定 3+，成功你们立即获胜。失败下回合可以再试。',
      '地宫守卫（怪物）从地宫出发，追着持玉者走。它有血量（3/4/5/6 人局分别 6/7/8/9 点），受到伤害就扣血，扣到 0 才被消灭。',
      '背叛者死亡时，地宫守卫的剩余血量减半（向上取整）。你们不会因此直接获胜。',
      `计数轨显示地基塌陷倒计时：第 ${LIMIT} 轮结束时玉佩还没放上供台，你们失败。所有幸存者死亡，你们也失败。`,
    ],
    win: '玉佩落进供台的凹槽，严丝合缝。地底的轰隆声停了，裂缝里吹上来一阵暖风。',
  },
  traitorSide: {
    goal: '不让玉佩回到供台：杀光所有幸存者，或者撑过第 12 轮。',
    rules: [
      '你控制地宫守卫（力量 5，速度 3，血量 6/7/8/9 点对应 3/4/5/6 人局），它在你的回合之后行动。',
      '特殊行动「封石门」（每回合一次）：在地宫里，知识检定 4+，成功则石门进度 -1。石门完全打开后不能再封。',
      '持玉者死后玉佩掉在原地，你拿不走，但可以守在那里。',
      '地宫里只要有守卫（哪怕被击晕），持玉者就不能供玉。',
      '你死亡时守卫的剩余血量减半，但它会继续行动；之后所有幸存者死亡或撑过时限，你照样获胜。',
      `第 ${LIMIT} 轮结束时玉佩还没归位，你获胜。`,
    ],
    win: '最后一道裂缝合拢，整栋洋楼像一块豆腐陷了下去。地宫的石门在底下合上，供台上还是空的。',
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
      id: 'pry', side: 'hero', label: '撬石门', desc: '在地宫：知识或力量检定（取较高者）4+，石门进度 +1',
      can: (g, s) => !g.hv.opened && g.p(s).tile === g.hv.crypt,
      *run(g, s) {
        const trait = g.value(s, 'knowledge') >= g.value(s, 'might') ? 'knowledge' : 'might';
        const r = yield* g.check(s, trait, 4, '撬石门 4+');
        if (r < 4) return;
        g.hv.open++;
        if (g.hv.open >= g.hv.need) {
          g.hv.opened = true;
          g.log('石门轰的一声退进墙里，露出了供台', 'good');
        } else g.log(`石门又挪开了一点（${g.hv.open}/${g.hv.need}）`, 'good');
        track(g);
      },
    },
    {
      id: 'offer', side: 'hero', label: '供玉', desc: '持玉者在石门已开、没有守卫的地宫：理智检定 3+，成功即获胜',
      can: (g, s) => g.hv.opened && g.hv.carrier === s && g.p(s).tile === g.hv.crypt && g.monstersAt(g.hv.crypt, 'guard').length === 0,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 3, '供玉 3+');
        if (r >= 3) g.hv.done = true;
        else g.log(`${g.p(s).name} 的手抖得厉害，玉佩磕在凹槽边上滑开了`, 'bad');
      },
    },
    {
      id: 'seal', side: 'traitor', label: '封石门', desc: '在地宫：知识检定 4+，石门进度 -1',
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
      g.log('背叛者倒下了，地宫守卫身上崩掉一大块，血量减半', 'good');
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
