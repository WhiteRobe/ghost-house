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

const catSeat = (g: Game): number => g.hv.cat as number;

function need(g: Game) {
  return g.scale(6, 6, 6, 7);
}

function track(g: Game) {
  g.setTrack('黑猫撑过的轮数', Math.min(need(g), (g.state.haunt?.round ?? 1) - 1), need(g));
}

/** 离亲戚们尽量远、并且还能走到的格子 */
function safeTiles(g: Game, from: string): string[] {
  const ms = g.state.monsters.filter((m) => !m.stunned).map((m) => m.tile);
  if (!ms.length) return [];
  const r = g.reach(from, Math.max(1, g.value(g.hv.cat as number, 'speed')), { seat: g.hv.cat as number });
  let best: string[] = [];
  let top = -1;
  for (const k of r.keys()) {
    const d = Math.min(...ms.map((m) => g.distance(m, k)));
    const score = d === Infinity ? 50 : d;
    if (score > top) { top = score; best = [k]; } else if (score === top) best.push(k);
  }
  return best;
}

function spawnAt(g: Game): string {
  const t = g.findTile('dining') ?? g.findTile('main-hall') ?? START;
  return t;
}

/** 14 猫的继承人 */
export const h14: HauntDef = {
  id: 14,
  title: '猫的继承人',
  type: 'coop',
  traitor: { type: 'none' },
  intro: '律师念完最后一句，所有人都愣住了：老太太把全部家产留给了那只黑猫。门外传来砸门声——那些闻讯赶来的远房亲戚，眼睛都红了。黑猫“喵”了一声，跳进了你们怀里。',
  hero: {
    goal: '保护黑猫，让它活过足够多的轮数（3/4/5 人局 6 轮，6 人局 7 轮）。',
    rules: [
      '一名幸存者抱着黑猫（持有黑猫凶兆的人；没人持有时由揭示者抱着）。',
      '「贪心的亲戚」从餐厅（或正厅、门厅）涌进来，每三轮多来一个。他们只追抱猫的人，也只攻击抱猫的人。亲戚被击败时只会被击晕。',
      '特殊行动「递猫」：把黑猫交给同一房间的另一名幸存者。',
      '特殊行动「撒猫粮」（每人每局一次）：在你所在的房间撒一把猫粮。亲戚们闻到味道会互相争抢：这一轮里，进入这个房间的亲戚立刻被击晕。',
      '抱猫的人死去时，黑猫会跳到同一房间的另一名幸存者怀里；如果没人接住，黑猫被亲戚抓走，你们失败。',
      '所有人都死亡时你们失败。',
    ],
    win: '天亮了，亲戚们骂骂咧咧地散去。黑猫舔了舔爪子，蹲在遗嘱上睡着了——这栋楼从今天起，是它的。',
  },
  monsters: {
    kin: { name: '贪心的亲戚', icon: 'kin', speed: 3, might: 3 },
  },
  *setup(g) {
    bridge(g);
    const h = g.holder('cat');
    g.hv.cat = h != null && !g.p(h).dead ? h : g.state.haunt!.revealer;
    g.log(`黑猫蜷在 ${g.p(catSeat(g)).name} 的怀里`, 'haunt');
    const k = spawnAt(g);
    for (let i = 0; i < g.scale(2, 3, 3, 3); i++) g.spawn('kin', k);
    g.hv.bait = {};
    track(g);
  },
  actions: [
    {
      id: 'pass', side: 'hero', label: '递猫', desc: '把黑猫交给同一房间的另一名幸存者',
      can: (g, s) => catSeat(g) === s && g.playersAt(g.p(s).tile).some((o) => o !== s),
      ai: () => false,
      *run(g, s) {
        const others = g.playersAt(g.p(s).tile).filter((o) => o !== s);
        others.sort((a, b) => g.value(b, 'might') + g.value(b, 'speed') - g.value(a, 'might') - g.value(a, 'speed'));
        const o = yield* g.choosePlayer(s, '把黑猫交给谁？', others);
        if (o == null) return;
        g.hv.cat = o;
        g.log(`${g.p(s).name} 把黑猫塞进了 ${g.p(o).name} 怀里`, 'info');
      },
    },
    {
      id: 'bait', side: 'hero', label: '撒猫粮', desc: '每人每局一次：本轮进入这里的亲戚立刻被击晕',
      can: (g, s) => !g.p(s).flags.h14bait,
      ai: () => false,
      *run(g, s) {
        g.p(s).flags.h14bait = true;
        const k = g.p(s).tile;
        (g.hv.bait as Record<string, number>)[k] = g.state.round;
        g.token(k, 'bait', '猫粮', { icon: 'bait' });
        for (const m of g.monstersAt(k)) g.stun(m.id);
        g.log(`${g.p(s).name} 撒了一地猫粮，亲戚们扑上去抢`, 'good');
      },
    },
  ],
  *onRoundEnd(g) {
    bridge(g);
    track(g);
    for (const t of g.tokens('bait')) g.removeToken(t.id);
    g.hv.bait = {};
    const r = g.state.haunt?.round ?? 1;
    if (r % 3 === 0) {
      g.spawn('kin', spawnAt(g));
      g.log('又一个亲戚挤进了门', 'bad');
    }
  },
  *onTurnStart(g) {
    // 亲戚移动时踩进猫粮：在下一个人回合开始时击晕
    const bait = g.hv.bait as Record<string, number>;
    for (const m of g.state.monsters) if (bait[m.tile] != null) g.stun(m.id);
  },
  *onDeath(g, seat) {
    if (catSeat(g) !== seat) return;
    const others = g.playersAt(g.p(seat).tile).filter((o) => o !== seat);
    if (others.length) {
      g.hv.cat = others[0];
      g.log(`黑猫跳进了 ${g.p(others[0]).name} 怀里`, 'haunt');
    } else {
      g.hv.cat = -1;
      g.log('黑猫被亲戚一把揪住尾巴拎走了！', 'bad');
    }
  },
  canAttack(g, s, t) {
    if (s === -1) return t.seat != null && t.seat === catSeat(g);
    return t.monster != null;
  },
  checkWin(g) {
    if (catSeat(g) < 0) return { side: 'none', text: '黑猫被拎走了。亲戚们挥舞着遗嘱，在楼梯上吵成一团，谁也没注意到墙上的影子越来越多。' };
    if ((g.state.haunt?.round ?? 1) - 1 >= need(g)) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const c = catSeat(g);
      if (c === s) {
        const here = g.p(s).tile;
        // 身边有更能打的同伴就递过去；亲戚扑到跟前就撒猫粮
        const better = g.playersAt(here).some((o) => o !== s && g.value(o, 'might') > g.value(s, 'might') + 1);
        const danger = g.monstersAt(here).some((m) => !m.stunned) || g.neighbors(here).some((k) => g.monstersAt(k).some((m) => !m.stunned));
        const actions = [...(better ? ['pass'] : []), ...(danger ? ['bait'] : [])];
        return { goals: safeTiles(g, here), actions, attack: true };
      }
      const ms = g.state.monsters.filter((m) => !m.stunned && g.distance(m.tile, g.p(c).tile) <= 2).map((m) => m.tile);
      const goals = ms.length ? ms : [g.p(c).tile];
      const nearCat = g.p(s).tile === g.p(c).tile && g.monstersAt(g.p(s).tile).some((m) => !m.stunned);
      return { goals, actions: nearCat ? ['bait'] : [], attack: true };
    },
    monster: (g) => (catSeat(g) >= 0 ? { goals: [g.p(catSeat(g)).tile] } : {}),
  },
};
