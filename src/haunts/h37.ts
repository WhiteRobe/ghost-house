import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 37 照妖镜（百年诅咒 × 铜镜） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，露出通往地下室的石阶', 'haunt');
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
  intro: '铜镜背面的铭文忽然发烫：“百年一劫，妖附人身。”镜面里映出你们几个人的脸——其中一张，嘴角比别人多弯了一点。镜子一晃，那张脸又不见了。',
  hero: {
    goal: '用照妖镜照出藏在你们中间的妖物。',
    rules: [
      '你们之中藏着一个被妖物附身的背叛者。他需要和幸存者单独相处来完成献祭。',
      '照妖镜：异变开始时由持有铜镜的幸存者拿着；如果没有，它会出现在某个房间里（标记），幸存者进入或在那里开始回合时自动拿起。持镜者死亡时镜子掉在原地。',
      '特殊行动「照镜」：持镜者对同一房间里一名还没被照过的探险者进行理智 5+ 检定。成功时：若他是妖物，他被照出原形，你们立即获胜；否则他被公开证明清白。',
      '照镜很耗心神：持镜者每次照镜失败受到 1 点精神伤害。',
      '在这场异变中，任何人都不能攻击别人。',
      '如果有人在某个房间里只和另一个人独处时打了个寒战（日志里会出现），那多半是献祭——但你未必知道是谁干的。',
    ],
    win: '镜光一照，那人的影子在墙上扭成了一只长尾的东西，尖叫着缩进了镜子里。铜镜“咔”地裂开一道缝，再也照不出任何东西。',
  },
  traitorSide: {
    goal: '在被照出原形之前，完成 3 次献祭。',
    rules: [
      '你是隐藏的背叛者，其他人看你仍然是幸存者。你不能拿照妖镜。',
      '特殊行动「献祭」：当你所在的房间里只有你和一名幸存者（没有其他人）时，进行理智 3+ 检定。成功则献祭 +1，那名幸存者受到 1 点精神伤害（日志只会说他打了个寒战）。',
      '完成 3 次献祭时你立即获胜。同一名幸存者可以被献祭多次。所有幸存者死亡你也获胜。',
      '持镜者对你「照镜」成功（理智 5+）时你会被照出原形，立即失败。',
      '在这场异变中，任何人都不能攻击别人。',
    ],
    win: '第三滴血落进香炉的时候，照妖镜里所有人的脸都换成了同一张。百年一劫，这一次，它赢了。',
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
      g.log(`照妖镜从持有者手中飞出，落在了「${g.tileName(k)}」`, 'haunt');
    }
    track(g);
  },
  actions: [
    {
      id: 'shine', side: 'hero', label: '照镜', desc: '理智 5+：照同房间一名未被照过的人',
      can: (g, s) => g.hv.holder === s && g.playersAt(g.p(s).tile).some((o) => o !== s && !clear(g, o)),
      *run(g, s) {
        const list = g.playersAt(g.p(s).tile).filter((o) => o !== s && !clear(g, o));
        const t = yield* g.choosePlayer(s, '照谁？', list);
        if (t == null) return;
        const r = yield* g.check(s, 'sanity', 5, '照镜 5+');
        if (r < 5) {
          g.log(`镜面一片模糊，${g.p(s).name} 头痛欲裂`, 'bad');
          yield* g.damage(s, 'mental', 1, '照镜反噬');
          return;
        }
        if (g.isTraitor(t)) {
          g.log(`镜中映出的不是 ${g.p(t).name}，而是一张长满白毛的脸！`, 'haunt');
          g.revealTraitor();
          g.hv.exposed = true;
        } else {
          g.p(t).flags.clear = true;
          g.log(`镜中的 ${g.p(t).name} 就是 ${g.p(t).name} 本人，清白`, 'good');
          track(g);
        }
      },
    },
    {
      id: 'sacrifice', side: 'traitor', label: '献祭', desc: '与一名幸存者独处：理智 3+，献祭 +1',
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
        g.log(`${g.p(v).name} 忽然打了个寒战，觉得有什么东西从身上被抽走了`, 'bad');
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
    if (t != null && g.p(t).dead) return { side: 'hero', text: '妖物附着的那具身体倒下了，一缕白烟从七窍里钻出来，被铜镜吸了进去。' };
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
