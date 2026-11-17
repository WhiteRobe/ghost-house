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

function reachable(g: Game, k: string): string {
  if (g.distance(START, k) === Infinity) g.link(HALL, k);
  return k;
}

/** 能拨动指针的地方 */
function clocks(g: Game): string[] {
  return ((g.hv.clocks as string[] | undefined) ?? [HALL]).filter((k) => g.state.tiles[k]);
}

const MAX = 12;

function setHand(g: Game, v: number) {
  g.hv.hand = Math.max(0, Math.min(MAX, v));
  g.setTrack('座钟指针', g.hv.hand, MAX);
}

/** 12 老座钟 */
export const h12: HauntDef = {
  id: 12,
  title: '老座钟',
  type: 'traitor',
  traitor: { type: 'highest', trait: 'knowledge' },
  intro: '遗嘱里写着：“座钟敲满十二下，宅子归守钟人。”走廊尽头那座停了几十年的挂钟忽然“咔哒”一声走了起来，钟楼上的大钟跟着应和。读懂了遗嘱的那个人，嘴角露出了笑。',
  hero: {
    goal: '把座钟的指针拨回到零。',
    rules: [
      '计数轨「座钟指针」从人数决定的位置开始（3/4/5/6 人局为 2/6/6/7），最大 12。每轮结束时指针自动前进 1 格；从第 15 轮起，每轮多前进 1 格。',
      '能拨动指针的地方有「钟」标记：走廊的挂钟，以及钟楼（钟楼不在房子里时，改为另一间房里的落地钟）。',
      '每个钟每轮只能被成功拨回一次——时间不会被同一只手连拧两次。',
      '特殊行动「拨回指针」（每回合一次）：在有「钟」标记的房间进行知识检定：4–5 点指针后退 1 格，6 点以上后退 2 格，0–1 点被钟声震得受到 1 点精神伤害。',
      '背叛者也能去拨钟，他会把指针往前拨。',
      '背叛者死后，他的魂钻进了钟里：此后每轮结束指针多前进 1 格。',
      '指针被拨回 0 时，钟停摆，你们获胜；指针走到 12 时，你们失败。',
    ],
    win: '指针倒转回零点，钟摆“当”地一声停住。钟面裂开一道缝，里面掉出一张发黄的遗嘱——上面的继承人一栏是空的。',
  },
  traitorSide: {
    goal: '让座钟的指针走到 12。',
    rules: [
      '计数轨「座钟指针」从人数决定的位置开始（3/4/5/6 人局为 2/6/6/7），最大 12。每轮结束时指针自动前进 1 格；从第 15 轮起，每轮多前进 1 格。',
      '能拨动指针的地方有「钟」标记：走廊的挂钟，以及钟楼（钟楼不在房子里时，改为另一间房里的落地钟）。',
      '特殊行动「拨快指针」（每回合一次）：在有「钟」标记的房间进行知识检定：4–5 点指针前进 1 格，6 点以上前进 2 格。',
      '特殊行动「上发条」（每回合一次）：在有「钟」标记的房间进行力量 4+ 检定，成功则这个钟被锁住，直到本轮结束前幸存者都不能在这里拨回指针。',
      '你死后魂魄会钻进钟里：此后每轮结束指针多前进 1 格。',
      '指针回到 0 时你失败。',
    ],
    win: '第十二声钟响在楼里回荡。所有人的影子都被钉在了墙上，只有守钟人的影子还在走。',
  },
  *setup(g) {
    bridge(g);
    const clockList = [HALL];
    const tower = g.findTile('clock-tower') ?? g.placeRoom('clock-tower');
    if (tower) clockList.push(reachable(g, tower));
    else {
      // 钟楼放不出来：别的房间里还有一座落地钟
      const alt = ['library', 'gallery', 'master-bedroom', 'main-hall'].map((id) => g.findTile(id)).find((k) => k && g.distance(START, k) < Infinity);
      const tiles = Object.keys(g.state.tiles).filter((k) => k !== HALL && k !== START && g.distance(START, k) < Infinity);
      const k = alt ?? (tiles.length ? tiles[g.rng.int(tiles.length)] : null);
      if (k) clockList.push(k);
    }
    g.hv.clocks = clockList;
    for (const k of clockList) g.token(k, 'clock', '钟', { icon: 'clock' });
    g.hv.locked = {};
    g.hv.done = {};
    setHand(g, g.scale(2, 6, 6, 7));
  },
  actions: [
    {
      id: 'rewind', side: 'hero', label: '拨回指针', desc: '知识检定：4–5 后退 1，6+ 后退 2，0–1 受 1 点精神伤害',
      can: (g, s) => clocks(g).includes(g.p(s).tile) && !(g.hv.locked as Record<string, number>)[g.p(s).tile] && !(g.hv.done as Record<string, boolean>)[g.p(s).tile],
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '拨回指针');
        if (r >= 4) (g.hv.done as Record<string, boolean>)[g.p(s).tile] = true;
        if (r >= 6) setHand(g, g.hv.hand - 2);
        else if (r >= 4) setHand(g, g.hv.hand - 1);
        else if (r <= 1) yield* g.damage(s, 'mental', 1, '钟声', null);
        if (r >= 4) g.log(`${g.p(s).name} 硬生生把指针往回掰`, 'good');
        else g.log('指针纹丝不动', 'info');
      },
    },
    {
      id: 'forward', side: 'traitor', label: '拨快指针', desc: '知识检定：4–5 前进 1，6+ 前进 2',
      can: (g, s) => clocks(g).includes(g.p(s).tile),
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '拨快指针');
        if (r >= 6) setHand(g, g.hv.hand + 2);
        else if (r >= 4) setHand(g, g.hv.hand + 1);
        g.log(r >= 4 ? '钟摆摆得更快了' : '指针卡了一下', r >= 4 ? 'bad' : 'info');
      },
    },
    {
      id: 'wind', side: 'traitor', label: '上发条', desc: '力量 4+：锁住这个钟到本轮结束',
      can: (g, s) => clocks(g).includes(g.p(s).tile) && !(g.hv.locked as Record<string, number>)[g.p(s).tile],
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '上发条 4+');
        if (r < 4) return;
        (g.hv.locked as Record<string, number>)[g.p(s).tile] = 1;
        g.log(`「${g.tileName(g.p(s).tile)}」的钟被上紧了发条，指针拨不动了`, 'bad');
      },
    },
  ],
  *onRoundEnd(g) {
    bridge(g);
    g.hv.done = {};
    const locked = g.hv.locked as Record<string, number>;
    for (const k of Object.keys(locked)) {
      locked[k]--;
      if (locked[k] <= 0) delete locked[k];
    }
    const t = g.traitor();
    const step = 1 + (t != null && g.p(t).dead ? 1 : 0) + ((g.state.haunt?.round ?? 0) > 14 ? 1 : 0);
    setHand(g, g.hv.hand + step);
    g.log(`钟敲了 ${g.hv.hand} 下`, 'haunt');
  },
  checkWin(g) {
    if (g.hv.hand >= MAX) return { side: 'traitor' };
    if (g.hv.hand <= 0) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const locked = g.hv.locked as Record<string, number>;
      const done = g.hv.done as Record<string, boolean>;
      const open = clocks(g).filter((k) => !locked[k] && !done[k]);
      return { goals: open.length ? open : clocks(g), actions: ['rewind'] };
    },
    traitor: (g) => {
      // 去幸存者多的钟捣乱
      const cs = clocks(g);
      const score = (k: string) => g.heroes().filter((h) => g.p(h).tile === k).length;
      const best = [...cs].sort((a, b) => score(b) - score(a));
      return { goals: best, actions: ['wind', 'forward'] };
    },
  },
};
