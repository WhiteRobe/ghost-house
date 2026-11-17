import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 48 午夜来电（事件「午夜来电」触发） */

const BASEMENT_ROOMS = ['wine-cellar', 'morgue', 'water-prison', 'coal-room', 'well', 'crypt', 'furnace'];

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌开一个洞，露出通往地下室的石阶', 'info');
  }
}

const calls = (g: Game) => g.hv.calls as Record<string, number>;
const lineTiles = (g: Game) => g.tokens('line').map((t) => t.tile);
const phoneTiles = (g: Game) => g.tokens('phone').map((t) => t.tile);

function wireTargets(g: Game, s: number): string[] {
  const here = g.p(s).tile;
  const spots = [...new Set([...phoneTiles(g), ...lineTiles(g)])].filter((k) => k !== here);
  return spots.filter((k) => g.heroes().some((h) => g.p(h).tile === k));
}

export const h48: HauntDef = {
  id: 48,
  title: '午夜来电',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '走廊里那台黑色的老式转盘电话响了，一声接一声，没有人去接它也不停。揭示者拿起听筒，里面传来自己的声音：“下一个是你。”他慢慢放下听筒，转过身来，嘴角挂着电话那头的笑。',
  hero: {
    goal: '找到电话线在地下室的另一头，把它剪断。',
    rules: [
      '房子里有几台电话（标记）。地下室里有几处「电话线」标记，其中只有一处是真正的线头。',
      '点名：每轮结束时，电话那头会点一名幸存者的名字。被点名的人受到精神伤害，伤害等于他被点名的总次数 +1（最多 4 点）。',
      '特殊行动「接电话」：在有电话的房间进行知识 3+ 检定，成功则电话里的声音会说漏嘴，排除一处假的线头。但接过电话的人，必定是下一轮被点名的人。',
      '背叛者用力量攻击时多掷 1 颗骰。',
      '剪线钳（标记）放在二楼某处。特殊行动「拿起剪线钳」：在它所在的房间拿起它。持有者死亡时剪线钳掉在原地。',
      '特殊行动「剪断电话线」：持有剪线钳时，在有电话线标记的房间进行力量 4+ 检定，成功则剪断它：如果是真的线头就获胜；假的就移除这个标记，并且你受到 1 点物理伤害。',
    ],
    win: '钳子“咔”地咬断了线头，整栋楼的电话同时发出一声长长的忙音，然后彻底哑了。听筒里再也没有人说话。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '点名：每轮结束时，你点一名幸存者的名字（如果有人接过电话，就必须点他）。被点名的人受到精神伤害，伤害等于他被点名的总次数 +1（最多 4 点）。',
      '特殊行动「顺着电话线」：当你在有电话或电话线标记的房间、且房间里没有幸存者时，可以立刻移动到另一处有幸存者的电话或电话线所在的房间。',
      '你知道哪一处线头是真的。',
      '你用力量攻击时多掷 1 颗骰。',
    ],
    win: '电话又响了。这一次，屋子里已经没有活人可以接了。听筒自己抬了起来，里面传出很多人的声音：“下一个……”',
  },
  *setup(g) {
    ensureBasement(g);
    g.hv.calls = {};
    g.hv.forced = null;
    // 电话：走廊一台，再随机两台
    const phones = ['G:0,-1'];
    const pool = Object.keys(g.state.tiles).filter((k) => !k.startsWith('B:') && k !== 'G:0,-1' && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(pool);
    for (const k of pool.slice(0, 2)) phones.push(k);
    for (const k of phones) g.token(k, 'phone', '老式电话', { icon: 'phone' });
    // 线头：地下室三处
    const want = g.scale(3, 4, 4, 5);
    const basement = () => Object.keys(g.state.tiles).filter((k) => k.startsWith('B:') && k !== 'B:0,-2' && g.distance('G:0,0', k) < Infinity);
    for (const r of BASEMENT_ROOMS) {
      if (basement().length >= want) break;
      g.placeRoom(r);
    }
    const spots = basement();
    g.rng.shuffle(spots);
    const picks = spots.slice(0, want);
    if (picks.length < 2) picks.push('B:0,-2');
    for (const k of picks) g.token(k, 'line', '电话线', { icon: 'wire' });
    g.hs.real = picks[g.rng.int(picks.length)];
    const t = g.traitor();
    if (t != null) g.log(`真正的线头在${g.tileName(g.hs.real)}`, 'info', t, 'traitor');
    g.setTrack('剩余线头', picks.length);
    // 剪线钳：放在二楼离地下室最远的地方
    const up = Object.keys(g.state.tiles).filter((k) => k.startsWith('U:') && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(up);
    up.sort((a, b) => g.distance('B:0,-2', b) - g.distance('B:0,-2', a));
    const plierAt = up[0] ?? 'U:0,-2';
    g.token(plierAt, 'pliers', '剪线钳', { icon: 'pliers' });
    g.hv.pliers = null;
  },
  actions: [
    {
      id: 'take', side: 'hero', label: '拿起剪线钳', desc: '拿起本房间的剪线钳',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'pliers').length > 0,
      *run(g, s) {
        for (const t of g.tokensAt(g.p(s).tile, 'pliers')) g.removeToken(t.id);
        g.hv.pliers = s;
        g.log(`${g.p(s).name} 拿起了剪线钳`, 'good');
      },
    },
    {
      id: 'answer', side: 'hero', label: '接电话', desc: '知识 3+ 检定，排除一处假线头；你会成为下一个被点名的人',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'phone').length > 0 && g.tokens('line').some((t) => t.tile !== g.hs.real),
      *run(g, s) {
        g.hv.forced = s;
        const r = yield* g.check(s, 'knowledge', 3, '接电话 3+');
        if (r < 3) {
          g.log('听筒里只有沙沙的杂音，和一声轻笑', 'bad');
          return;
        }
        const fakes = g.tokens('line').filter((t) => t.tile !== g.hs.real);
        const f = fakes[g.rng.int(fakes.length)];
        g.removeToken(f.id);
        g.log(`电话里的声音说漏了嘴：线头不在${g.tileName(f.tile)}`, 'good');
        g.setTrack('剩余线头', g.tokens('line').length);
      },
    },
    {
      id: 'cut', side: 'hero', label: '剪断电话线', desc: '持剪线钳，力量 4+ 检定，剪断本房间的电话线',
      can: (g, s) => g.hv.pliers === s && g.tokensAt(g.p(s).tile, 'line').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '剪断电话线 4+');
        if (r < 4) {
          g.log('电话线比想象的粗，怎么也剪不断', 'bad');
          return;
        }
        const here = g.p(s).tile;
        if (here === g.hs.real) {
          g.hv.cut = true;
          return;
        }
        for (const t of g.tokensAt(here, 'line')) g.removeToken(t.id);
        g.log('剪断了——可电话还在响。这不是那一根', 'bad');
        yield* g.damage(s, 'physical', 1, '线头里窜出一股电流');
        g.setTrack('剩余线头', g.tokens('line').length);
      },
    },
    {
      id: 'wire', side: 'traitor', label: '顺着电话线', desc: '移动到另一处有幸存者的电话或电话线所在的房间',
      publicText: '听筒里传来一阵忙音，背叛者的身影顺着电话线消失了！',
      can: (g, s) => {
        const here = g.p(s).tile;
        if (!g.tokensAt(here, 'phone').length && !g.tokensAt(here, 'line').length) return false;
        if (g.heroes().some((h) => g.p(h).tile === here)) return false;
        return wireTargets(g, s).length > 0;
      },
      *run(g, s) {
        const to = yield* g.chooseTile(s, '顺着电话线去哪里？', wireTargets(g, s));
        if (to) g.moveTo(s, to, '电话铃声里');
      },
    },
  ],
  *onDeath(g, s) {
    if (g.hv.pliers === s) {
      g.hv.pliers = null;
      g.token(g.p(s).tile, 'pliers', '剪线钳', { icon: 'pliers' });
      g.log(`剪线钳掉在了${g.tileName(g.p(s).tile)}`, 'info');
    }
  },
  *onRoundEnd(g) {
    const heroes = g.heroes();
    if (!heroes.length) return;
    let target: number | null = null;
    const forced = g.hv.forced as number | null;
    if (forced != null && !g.p(forced).dead) target = forced;
    g.hv.forced = null;
    const t = g.traitor();
    if (target == null) {
      if (t == null || g.p(t).dead) target = heroes[g.rng.int(heroes.length)];
      else {
        const order = [...heroes].sort((a, b) => g.value(a, 'sanity') + g.value(a, 'knowledge') - g.value(b, 'sanity') - g.value(b, 'knowledge'));
        target = yield* g.choosePlayer(t, '这一轮点谁的名字？', order);
      }
    }
    if (target == null) return;
    const c = calls(g);
    c[target] = (c[target] ?? 0) + 1;
    g.log(`所有电话同时响了。听筒里一字一顿：“${g.p(target).name}。”`, 'haunt');
    yield* g.damage(target, 'mental', Math.min(4, c[target] + 1), '被点名');
  },
  rollBonus(g, s, trait, purpose) {
    return g.isTraitor(s) && trait === 'might' && purpose === 'attack' ? 1 : 0;
  },
  checkWin(g) {
    if (g.hv.cut) return { side: 'hero' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const lines = lineTiles(g);
      const phones = phoneTiles(g);
      const heroes = g.heroes();
      const pl = g.hv.pliers as number | null;
      const plTok = g.tokens('pliers').map((t) => t.tile);
      if (pl === s) return { goals: lines, actions: ['cut', 'answer'] };
      // 离剪线钳最近的人去拿
      if (pl == null && plTok.length) {
        const fetcher = heroes.reduce((a, b) => (g.distance(g.p(b).tile, plTok[0]) < g.distance(g.p(a).tile, plTok[0]) ? b : a));
        if (fetcher === s) return { goals: plTok, actions: ['take', 'answer'] };
      }
      // 其余人：线头多于 1 处时去接电话缩小范围，否则护送持钳人
      if (lines.length > 1 && g.hv.forced == null && phones.length) return { goals: phones, actions: ['answer', 'take'] };
      if (pl != null) return { goals: [g.p(pl).tile], actions: ['take', 'answer'] };
      return { goals: lines, actions: ['take', 'answer'] };
    },
    traitor: (g) => {
      const heroes = g.heroes();
      const pl = g.hv.pliers as number | null;
      const goals = pl != null ? [g.p(pl).tile] : heroes.map((h) => g.p(h).tile);
      return { goals, actions: ['wire'], targets: pl != null ? [pl] : undefined };
    },
  },
};
