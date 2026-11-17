import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 48 午夜来电（事件「午夜来电」触发） */

const BASEMENT_ROOMS = ['wine-cellar', 'morgue', 'water-prison', 'coal-room', 'well', 'crypt', 'furnace'];

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌了个洞，底下是去地下室的石阶', 'info');
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
  intro: '走廊里那台黑色转盘电话响了，一声接一声，没人接也不停。揭示者拿起听筒，里面是他自己的声音：“下一个是你。”他把听筒放回去，转过身，脸上在笑。',
  hero: {
    goal: '拿到剪线钳，找出地下室里真正的线头，剪断它。',
    rules: [
      '房子里有 3 台电话标记（走廊一台，另外两台在地下室以外的随机房间）。地下室有「电话线」标记，3 人局 3 处，4/5 人局 4 处，6 人局 5 处（地下室房间不够时会少），只有一处是真线头。背叛者知道是哪一处。',
      '点名：每轮结束时，背叛者点一名幸存者的名字（背叛者死了就随机点）。被点名的人受到精神伤害，点数等于他被点名的总次数 +1，最多 4 点。',
      '特殊行动「接电话」：在有电话的房间、还剩假线头时执行，知识检定 3+，成功随机排除一处假线头。不管成没成，本轮结束时点名都会点你。',
      '背叛者用力量攻击时多掷 1 颗骰。杀死背叛者不会让你们获胜。',
      '剪线钳标记在二楼离地下室最远的房间。特殊行动「拿起剪线钳」：在它所在的房间执行，拿起它。拿着剪线钳的人死亡，剪线钳掉在原地。',
      '特殊行动「剪断电话线」：拿着剪线钳在有电话线的房间执行，力量检定 4+。成功剪断：是真线头你们获胜；是假的就移除这个标记，你受到 1 点物理伤害。',
    ],
    win: '钳子“咔”地咬断了线头。整栋楼的电话一起响了声长长的忙音，然后没声了。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '点名：每轮结束时，你点一名幸存者的名字。本轮有人接过电话，就自动点他（几个人都接过，点最后接的那个）。被点名的人受到精神伤害，点数等于他被点名的总次数 +1，最多 4 点。',
      '特殊行动「顺着电话线」：你在有电话或电话线标记的房间、且房间里没有幸存者时，立刻移动到另一处有电话或电话线、并且有幸存者的房间。',
      '你知道哪一处线头是真的。幸存者剪断真线头，你失败；你死亡不算失败。',
      '你用力量攻击时多掷 1 颗骰。',
    ],
    win: '电话又响了，楼里已经没有人能接。听筒自己抬了起来，里面好几个人一起说：“下一个。”',
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
      id: 'take', side: 'hero', label: '拿起剪线钳', desc: '拿起这个房间的剪线钳',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'pliers').length > 0,
      *run(g, s) {
        for (const t of g.tokensAt(g.p(s).tile, 'pliers')) g.removeToken(t.id);
        g.hv.pliers = s;
        g.log(`${g.p(s).name} 拿起了剪线钳`, 'good');
      },
    },
    {
      id: 'answer', side: 'hero', label: '接电话', desc: '知识检定 3+：排除一处假线头。本轮结束时你会被点名',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'phone').length > 0 && g.tokens('line').some((t) => t.tile !== g.hs.real),
      *run(g, s) {
        g.hv.forced = s;
        const r = yield* g.check(s, 'knowledge', 3, '接电话 3+');
        if (r < 3) {
          g.log('听筒里沙沙响，有人笑了一声', 'bad');
          return;
        }
        const fakes = g.tokens('line').filter((t) => t.tile !== g.hs.real);
        const f = fakes[g.rng.int(fakes.length)];
        g.removeToken(f.id);
        g.log(`电话那头说漏了嘴：线头不在${g.tileName(f.tile)}`, 'good');
        g.setTrack('剩余线头', g.tokens('line').length);
      },
    },
    {
      id: 'cut', side: 'hero', label: '剪断电话线', desc: '拿着剪线钳：力量检定 4+，剪断这个房间的电话线',
      can: (g, s) => g.hv.pliers === s && g.tokensAt(g.p(s).tile, 'line').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '剪断电话线 4+');
        if (r < 4) {
          g.log('电话线比看着粗，钳子咬不动', 'bad');
          return;
        }
        const here = g.p(s).tile;
        if (here === g.hs.real) {
          g.hv.cut = true;
          return;
        }
        for (const t of g.tokensAt(here, 'line')) g.removeToken(t.id);
        g.log('剪断了，可电话还在响。不是这一根', 'bad');
        yield* g.damage(s, 'physical', 1, '线头窜出一股电');
        g.setTrack('剩余线头', g.tokens('line').length);
      },
    },
    {
      id: 'wire', side: 'traitor', label: '顺着电话线', desc: '移动到另一处有电话或电话线、并且有幸存者的房间',
      publicText: '听筒里一阵忙音，背叛者不见了，另一台电话响了起来',
      can: (g, s) => {
        const here = g.p(s).tile;
        if (!g.tokensAt(here, 'phone').length && !g.tokensAt(here, 'line').length) return false;
        if (g.heroes().some((h) => g.p(h).tile === here)) return false;
        return wireTargets(g, s).length > 0;
      },
      *run(g, s) {
        const to = yield* g.chooseTile(s, '顺着电话线去哪里？', wireTargets(g, s));
        if (to) g.moveTo(s, to, '跟着电话铃声');
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
    g.log(`所有电话一起响了。听筒里一个字一个字地念：“${g.p(target).name}。”`, 'haunt');
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
