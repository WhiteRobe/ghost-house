import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 37 照妖镜（百年诅咒 × 铜镜） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊地板塌了个洞，底下是去地下室的石阶', 'haunt');
  }
}

const clear = (g: Game, s: number) => !!g.p(s).flags.clear;

function track(g: Game) {
  g.setTrack('已被照过、证明清白的人', g.state.players.filter((p) => p.flags.clear).length, g.n - 1);
}

function dropMirror(g: Game, tile: string) {
  g.hv.holder = null;
  g.token(tile, 'mirror', '照妖镜', { icon: 'mirror' });
  g.log('照妖镜掉在了地上', 'info');
}

function pickUp(g: Game, s: number) {
  if (g.hv.holder != null || g.p(s).dead) return;
  const t = g.tokensAt(g.p(s).tile, 'mirror')[0];
  if (!t) return;
  if (g.isTraitor(s)) return; // 妖物不敢碰镜子，但旁人看不出来
  g.removeToken(t.id);
  g.hv.holder = s;
  g.log(`${g.p(s).name} 拿起了照妖镜`, 'good');
}

export const h37: HauntDef = {
  id: 37,
  title: '照妖镜',
  type: 'hidden',
  traitor: { type: 'hidden' },
  intro: '铜镜背面的铭文烫手：“百年一劫，妖附人身。”镜子里是你们几个人的脸，其中一张的嘴角比别人多弯了一点。镜子一晃，再看又都一样了。',
  hero: {
    goal: '用照妖镜照出藏在你们中间的妖物。',
    rules: [
      '你们中间藏着一个被妖物附身的背叛者。他要趁和一名幸存者单独待在一个房间时献祭，献祭满 3 次他就获胜。献祭次数只有他自己知道。',
      '照妖镜：异变开始时，手里有铜镜的幸存者拿着它；没有这样的人，照妖镜会掉在随机一个房间（有标记），幸存者进入那里或在那里开始回合时自动拿起。持镜者死亡，镜子掉在原地。',
      '特殊行动「照镜」：持镜者选同房间一名还没被证明清白的探险者，理智检定 5+。成功：他是妖物，你们立即获胜；不是，公开证明他清白。',
      '照镜失败：持镜者受到 1 点精神伤害。',
      '这场异变里谁都不能攻击别人。背叛者因为别的原因死亡，你们也获胜。',
      '日志里有人「打了个寒战」，就是他刚被献祭了一次。当时和他单独待在同一个房间的，就是妖物。',
    ],
    win: '镜子一照，那人墙上的影子拖出一条长尾巴，尖叫着钻进了镜子。铜镜“咔”地裂了道缝。',
  },
  traitorSide: {
    goal: '被照出原形之前，完成 3 次献祭。',
    rules: [
      '你是隐藏的背叛者，在别人看来你还是幸存者。你捡不起照妖镜。',
      '特殊行动「献祭」：你的房间里只有你和一名幸存者时，理智检定 3+。成功献祭 +1，他受到 1 点精神伤害，日志会公开说他打了个寒战，但不会说是谁干的。',
      '完成 3 次献祭，你立即获胜。同一名幸存者可以被献祭多次。幸存者全部死亡你也获胜。',
      '持镜者对你「照镜」成功（理智检定 5+），你被照出原形，立即失败。你死亡也算失败。',
      '这场异变里谁都不能攻击别人。',
    ],
    win: '第三滴血落进香炉，照妖镜里每个人的脸都变成了同一张，嘴角多弯了一点。',
  },
  *setup(g) {
    connect(g);
    g.hs.sac = 0;
    g.hv.need = 3;
    const heroes = g.heroes();
    const h = heroes.find((s) => g.has(s, 'mirror'));
    if (h != null) {
      g.hv.holder = h;
      g.log(`${g.p(h).name} 握着照妖镜`, 'haunt');
    } else {
      g.hv.holder = null;
      const tiles = Object.keys(g.state.tiles).filter((k) => !START.includes(k));
      const k = tiles.length ? tiles[g.rng.int(tiles.length)] : 'G:0,-1';
      g.token(k, 'mirror', '照妖镜', { icon: 'mirror' });
      g.log(`照妖镜从持有者手里滑脱，掉在了「${g.tileName(k)}」`, 'haunt');
    }
    track(g);
  },
  actions: [
    {
      id: 'shine', side: 'hero', label: '照镜', desc: '理智检定 5+：照同房间一名没被证明清白的人',
      can: (g, s) => g.hv.holder === s && g.playersAt(g.p(s).tile).some((o) => o !== s && !clear(g, o)),
      *run(g, s) {
        const list = g.playersAt(g.p(s).tile).filter((o) => o !== s && !clear(g, o));
        const t = yield* g.choosePlayer(s, '照谁？', list);
        if (t == null) return;
        const r = yield* g.check(s, 'sanity', 5, '照镜 5+');
        if (r < 5) {
          g.log(`镜面糊成一片，${g.p(s).name} 太阳穴一跳一跳地疼`, 'bad');
          yield* g.damage(s, 'mental', 1, '照镜反噬');
          return;
        }
        if (g.isTraitor(t)) {
          g.log(`镜子里没有 ${g.p(t).name}，只有一张长满白毛的脸`, 'haunt');
          g.revealTraitor();
          g.hv.exposed = true;
        } else {
          g.p(t).flags.clear = true;
          g.log(`镜子里就是 ${g.p(t).name} 本人，清白`, 'good');
          track(g);
        }
      },
    },
    {
      id: 'sacrifice', side: 'traitor', label: '献祭', desc: '和一名幸存者单独在一个房间：理智检定 3+，献祭 +1',
      can: (g, s) => {
        const here = g.playersAt(g.p(s).tile);
        return here.length === 2 && here.some((o) => o !== s && !g.isTraitor(o));
      },
      *run(g, s) {
        const v = g.playersAt(g.p(s).tile).find((o) => o !== s)!;
        const r = yield* g.check(s, 'sanity', 3, '献祭 3+');
        if (r < 3) return;
        g.hs.sac++;
        g.p(v).flags.chilled = true;
        g.log(`${g.p(v).name} 打了个寒战，后脖子凉了一下`, 'bad');
        g.log(`献祭完成（${g.hs.sac}/${g.hv.need}）`, 'bad', s, 'traitor');
        yield* g.damage(v, 'mental', 1, '一阵寒意');
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
    if (g.hv.holder === s) dropMirror(g, g.p(s).tile);
  },
  canAttack: () => false,
  checkWin(g) {
    if (g.hv.exposed) return { side: 'hero' };
    if ((g.hs.sac ?? 0) >= g.hv.need) return { side: 'traitor' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero', text: '妖物附着的那具身体倒下了，一缕白烟从鼻孔里钻出来，被铜镜吸了进去。' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const holder = g.hv.holder as number | null;
      if (holder === s) {
        const sus = g.alive().filter((o) => o !== s && !clear(g, o)).map((o) => g.p(o).tile);
        return { goals: sus, actions: ['shine'], attack: false };
      }
      const mirror = g.tokens('mirror')[0];
      if (mirror) return { goals: [mirror.tile], attack: false };
      // 不拿镜子的人照常探索；寒战过的人去找持镜者
      if (holder != null && g.p(s).flags.chilled) return { goals: [g.p(holder).tile], attack: false };
      return { attack: false };
    },
    traitor: (g, s) => {
      const holder = g.hv.holder as number | null;
      const lonely = g.heroes().filter((o) => o !== holder && g.playersAt(g.p(o).tile).length === 1);
      const goals = lonely.map((o) => g.p(o).tile);
      // 离持镜者远一点：没有可下手的人就待在原地
      return { goals: goals.length ? goals : [g.p(s).tile], actions: ['sacrifice'], attack: false };
    },
  },
};
