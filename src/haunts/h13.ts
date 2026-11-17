import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 地下室和楼上没连通时，开一道暗梯，免得有人被困死 */
function bridge(g: Game) {
  for (const p of g.state.players) {
    if (p.dead || g.distance('G:0,0', p.tile) < Infinity) continue;
    const to = g.distance('B:0,-2', p.tile) < Infinity ? 'B:0,-2' : p.tile;
    if (g.distance('G:0,0', to) === Infinity) {
      g.link('G:0,-1', to);
      g.log('走廊的地板裂开，露出一道通往下面的暗梯', 'info');
    }
  }
}

const START = 'G:0,0';
const HALL = 'G:0,-1';
const starts = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function reachable(g: Game, k: string): string {
  if (g.distance(START, k) === Infinity) g.link(HALL, k);
  return k;
}

/** 遗嘱持有者（-1 表示还藏着，-2 表示已被毁） */
const holder = (g: Game): number => g.hv.holder as number;

function setHolder(g: Game, s: number) {
  g.hv.holder = s;
  for (const t of g.tokens('will')) g.removeToken(t.id);
  if (s >= 0) g.hv.since ??= g.state.haunt?.round ?? 0;
  track(g);
}

function need(g: Game) {
  return g.scale(4, 5, 4, 4);
}

function track(g: Game) {
  const since = g.hv.since as number | undefined;
  const r = g.state.haunt?.round ?? 0;
  g.setTrack('守住遗嘱的轮数', since == null ? 0 : Math.max(0, r - since), need(g));
}

/** 已经公开身份的背叛者 */
function exposed(g: Game): number | null {
  const t = g.state.haunt?.traitor;
  return t != null && g.p(t).side === 'traitor' ? t : null;
}

function fires(g: Game): string[] {
  return ((g.hv.fire as string[] | undefined) ?? []).filter((k) => g.state.tiles[k]);
}

/** 13 律师的秘密 */
export const h13: HauntDef = {
  id: 13,
  title: '律师的秘密',
  type: 'hidden',
  traitor: { type: 'hidden' },
  intro: '宣读遗嘱的“律师”合上公文包，说遗嘱是假的，真的那份早被老爷藏了起来。可他袖口沾着的纸灰，分明是刚烧过什么东西。你们之中有一个人，根本不是来分遗产的。',
  hero: {
    goal: '找到真遗嘱，并让它在幸存者手里保存足够多轮（3 人局 4 轮，4 人局 5 轮，5/6 人局 4 轮）。',
    rules: [
      '真遗嘱藏在「遗嘱」标记所在的房间（书房或保险库；都没有时在另一个房间）。',
      '特殊行动「搜寻遗嘱」：在遗嘱所在房间进行知识 4+ 检定，成功则拿到遗嘱。任何人都能搜寻——包括那个假律师。',
      '特殊行动「抢遗嘱」：与遗嘱持有者同一房间时，对他发起力量攻击，你赢了就把遗嘱抢过来（照常造成伤害）。',
      '特殊行动「递遗嘱」：持有者可以把遗嘱交给同一房间的另一名幸存者。',
      '背叛者只能在有「火」标记的房间毁掉遗嘱，一旦动手就会暴露身份。',
      '你们之中藏着一个背叛者，他在公开身份前和你们看起来一模一样。你可以攻击任何人，但小心误伤。',
      '遗嘱第一次被人拿到后开始计数（计数轨）。计满时如果遗嘱在幸存者手里，你们获胜。',
      '背叛者死亡时你们也获胜。遗嘱持有者若被背叛者杀死，你们失败；因别的原因死去时，遗嘱掉在原地，可以重新搜寻。',
    ],
    win: '天亮时，遗嘱依然在你们手里。上面的火漆完好，老爷的签名清清楚楚——假律师早已不见了踪影。',
  },
  traitorSide: {
    goal: '毁掉真遗嘱，或者杀死遗嘱的持有者。',
    rules: [
      '你是隐藏的背叛者（假律师），其他人不知道你的身份。',
      '你和幸存者一样可以「搜寻遗嘱」「抢遗嘱」，这些行动不会暴露你。',
      '特殊行动「毁掉遗嘱」：遗嘱在你手里、你在有「火」标记的房间（厨房、锅炉房；都没有时是另一个房间）、且不是这回合刚拿到时，进行理智 4+ 检定，成功则遗嘱被毁，你获胜。无论成败，你的身份都会暴露。',
      '你亲手杀死遗嘱持有者时，遗嘱被血浸透，你同样获胜。持有者因别的原因死去时，遗嘱掉在他倒下的房间，可以重新搜寻。',
      '你死亡则幸存者获胜。',
    ],
    win: '火苗吞掉了最后一行字。“律师”拍了拍袖口的灰，笑着说：“现在，一切都按我说的分。”',
  },
  *setup(g) {
    bridge(g);
    let k: string | null = null;
    for (const id of ['library', 'vault']) {
      k = g.findTile(id);
      if (k) break;
    }
    if (!k) for (const id of ['library', 'vault']) {
      k = g.placeRoom(id);
      if (k) break;
    }
    if (!k) {
      const tiles = Object.keys(g.state.tiles).filter((x) => !starts.includes(x) && g.distance(START, x) < Infinity);
      k = tiles.length ? tiles[g.rng.int(tiles.length)] : 'G:0,-2';
    }
    reachable(g, k);
    g.token(k, 'will', '遗嘱', { icon: 'scroll' });
    const fires: string[] = [];
    for (const id of ['kitchen', 'furnace']) {
      const f = g.findTile(id) ?? g.placeRoom(id);
      if (f) fires.push(reachable(g, f));
    }
    if (!fires.length) {
      const tiles = Object.keys(g.state.tiles).filter((x) => x !== k && !starts.includes(x) && g.distance(START, x) < Infinity);
      fires.push(tiles.length ? tiles[g.rng.int(tiles.length)] : HALL);
    }
    for (const f of fires) g.token(f, 'fire', '火', { icon: 'fire' });
    g.hv.fire = fires;
    g.hv.holder = -1;
    g.hv.since = undefined;
    track(g);
  },
  actions: [
    {
      id: 'search', side: 'any', label: '搜寻遗嘱', desc: '知识 4+ 检定，成功则拿到遗嘱',
      can: (g, s) => holder(g) === -1 && g.tokensAt(g.p(s).tile, 'will').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '搜寻遗嘱 4+');
        if (r < 4) {
          g.log(`${g.p(s).name} 翻了个底朝天，什么也没找到`, 'info');
          return;
        }
        setHolder(g, s);
        g.hs.gotAt = `${g.state.round}:${g.state.turn}`;
        g.log(`${g.p(s).name} 从夹层里抽出了一份火漆封口的遗嘱！`, 'haunt');
      },
    },
    {
      id: 'snatch', side: 'any', label: '抢遗嘱', desc: '对同一房间的遗嘱持有者发起力量攻击，赢了就抢过来',
      can: (g, s) => {
        const h = holder(g);
        return h >= 0 && h !== s && !g.p(h).dead && g.p(h).tile === g.p(s).tile;
      },
      *run(g, s) {
        const h = holder(g);
        g.log(`${g.p(s).name} 扑向 ${g.p(h).name} 手里的遗嘱！`, 'bad');
        const r = yield* g.attack({ seat: s }, { seat: h });
        if (r.winner && 'seat' in r.winner && r.winner.seat === s && !g.p(s).dead && holder(g) === h) {
          setHolder(g, s);
          g.hs.gotAt = `${g.state.round}:${g.state.turn}`;
          g.log(`遗嘱到了 ${g.p(s).name} 手里`, 'haunt');
        }
      },
    },
    {
      id: 'pass', side: 'any', label: '递遗嘱', desc: '把遗嘱交给同一房间的另一个人',
      can: (g, s) => holder(g) === s && g.playersAt(g.p(s).tile).some((o) => o !== s),
      ai: () => false,
      *run(g, s) {
        const others = g.playersAt(g.p(s).tile).filter((o) => o !== s);
        const o = yield* g.choosePlayer(s, '把遗嘱交给谁？', others);
        if (o == null) return;
        setHolder(g, o);
        g.log(`${g.p(s).name} 把遗嘱交给了 ${g.p(o).name}`, 'info');
      },
    },
    {
      id: 'destroy', side: 'traitor', label: '毁掉遗嘱', desc: '理智 4+ 检定，成功则遗嘱被毁；无论成败都会暴露身份',
      can: (g, s) => holder(g) === s && g.hs.gotAt !== `${g.state.round}:${g.state.turn}` && fires(g).includes(g.p(s).tile),
      *run(g, s) {
        g.revealTraitor();
        g.log(`${g.p(s).name} 掏出火柴，凑向遗嘱！`, 'haunt');
        const r = yield* g.check(s, 'sanity', 4, '毁掉遗嘱 4+');
        if (r >= 4) {
          g.hv.holder = -2;
          g.log('遗嘱烧着了，火光里那张脸笑得很难看', 'bad');
        } else g.log('火柴受潮，怎么也划不着', 'good');
      },
    },
  ],
  *onDeath(g, seat, killer) {
    if (holder(g) !== seat) return;
    if (!g.isTraitor(seat) && killer != null && g.isTraitor(killer)) {
      g.hv.holder = -3;
      return;
    }
    // 遗嘱掉在地上，谁都可以再去搜
    g.hv.holder = -1;
    g.token(g.p(seat).tile, 'will', '遗嘱', { icon: 'scroll' });
    track(g);
  },
  *onRoundEnd(g) {
    bridge(g);
    track(g);
  },
  canAttack(g, s, t) {
    if (t.monster != null) return true;
    if (t.seat == null || t.seat === s) return false;
    return true;
  },
  checkWin(g) {
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    const h = holder(g);
    if (h === -2 || h === -3) return { side: 'traitor' };
    const since = g.hv.since as number | undefined;
    if (since != null && (g.state.haunt?.round ?? 0) - since >= need(g) && h >= 0 && !g.isTraitor(h)) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const h = holder(g);
      const t = exposed(g);
      const wills = g.tokens('will').map((x) => x.tile);
      if (h === s) {
        // 持有者：躲着已暴露的背叛者，靠近同伴
        const friends = g.heroes().filter((o) => o !== s && o !== t).map((o) => g.p(o).tile);
        return { goals: friends, actions: [], targets: t != null ? [t] : [], attack: t != null };
      }
      if (h === -1) return { goals: wills, actions: ['search'], targets: t != null ? [t] : [], attack: t != null };
      if (t != null && h === t) return { goals: [g.p(t).tile], actions: ['snatch'], targets: [t] };
      if (t != null) return { goals: [g.p(t).tile], targets: [t] };
      // 背叛者还没暴露：守在持有者身边
      return { goals: h >= 0 ? [g.p(h).tile] : wills, attack: false };
    },
    traitor: (g, s) => {
      const h = holder(g);
      const wills = g.tokens('will').map((x) => x.tile);
      if (h === s) return { goals: fires(g), actions: ['destroy'], attack: false };
      if (h === -1) return { goals: wills, actions: ['search'], attack: false };
      return { goals: [g.p(h).tile], actions: ['snatch'], attack: g.p(s).side === 'traitor', targets: [h] };
    },
  },
};
