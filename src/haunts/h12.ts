import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 地下室和楼上没连通时，开一道暗梯，免得有人被困死 */
function bridge(g: Game) {
  for (const p of g.state.players) {
    if (p.dead || g.distance('G:0,0', p.tile) < Infinity) continue;
    const to = g.distance('B:0,-2', p.tile) < Infinity ? 'B:0,-2' : p.tile;
    if (g.distance('G:0,0', to) === Infinity) {
      g.link('G:0,-1', to);
      g.log('走廊地板裂开一条缝，底下是一道往下走的暗梯', 'info');
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
  intro: '遗嘱最后一行写着：“钟敲满十二下，宅子归守钟人。”走廊尽头那座停了几十年的挂钟“咔哒”一声走了起来，钟楼上的大钟跟着响了一下。看懂遗嘱的那个人把遗嘱折好，揣进了口袋。',
  hero: {
    goal: '把座钟指针拨回 0。',
    rules: [
      '指针回到 0，你们立刻获胜；指针走到 12，你们立刻失败。所有幸存者都死了也算失败。',
      '计数轨「座钟指针」起始值：3/4/5/6 人局为 2/6/6/7，最大 12。每轮结束时指针前进 1 格；第 14 轮结束起，每轮多前进 1 格。',
      '有「钟」标记的房间才能拨指针：走廊的挂钟，加上钟楼（钟楼放不进房子时，改为另一间房里的落地钟）。',
      '特殊行动「拨回指针」（每回合一次）：在有「钟」的房间做知识检定。4–5：指针后退 1 格；6+：后退 2 格；2–3：没有效果；0–1：受到 1 点精神伤害。',
      '同一个钟每轮只能被成功拨回一次，本轮结束后重置。被背叛者上了发条的钟，本轮不能拨回。',
      '背叛者会去钟那里把指针往前拨，还能给钟上发条。',
      '背叛者死后，每轮结束时指针多前进 1 格。杀他不能直接获胜，只会让钟走得更快。',
    ],
    win: '指针倒回零点，钟摆“当”地停住。钟面裂开，掉出一张发黄的遗嘱，继承人那一栏是空的。',
  },
  traitorSide: {
    goal: '让座钟指针走到 12，或者杀死所有幸存者。',
    rules: [
      '指针走到 12，或所有幸存者都死了，你立刻获胜；指针回到 0，你立刻失败。',
      '计数轨「座钟指针」起始值：3/4/5/6 人局为 2/6/6/7，最大 12。每轮结束时指针前进 1 格；第 14 轮结束起，每轮多前进 1 格。',
      '有「钟」标记的房间才能拨指针：走廊的挂钟，加上钟楼（钟楼放不进房子时，改为另一间房里的落地钟）。',
      '特殊行动「拨快指针」（每回合一次）：在有「钟」的房间做知识检定。4–5：指针前进 1 格；6+：前进 2 格。',
      '特殊行动「上发条」（每回合一次）：在有「钟」且还没上发条的房间做力量检定 4+。成功：本轮结束前，幸存者不能在这个钟拨回指针。',
      '幸存者每人每回合可以在钟那里拨回指针，同一个钟每轮只能被成功拨回一次。',
      '你死了也没输：此后每轮结束时指针多前进 1 格。',
    ],
    win: '第十二下钟响完，墙上的影子都不动了，只有守钟人的影子还在往楼梯口走。',
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
      id: 'rewind', side: 'hero', label: '拨回指针', desc: '知识检定。4–5：指针后退 1；6+：后退 2；0–1：受到 1 点精神伤害',
      can: (g, s) => clocks(g).includes(g.p(s).tile) && !(g.hv.locked as Record<string, number>)[g.p(s).tile] && !(g.hv.done as Record<string, boolean>)[g.p(s).tile],
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '拨回指针');
        if (r >= 4) (g.hv.done as Record<string, boolean>)[g.p(s).tile] = true;
        if (r >= 6) setHand(g, g.hv.hand - 2);
        else if (r >= 4) setHand(g, g.hv.hand - 1);
        else if (r <= 1) yield* g.damage(s, 'mental', 1, '钟声', null);
        if (r >= 4) g.log(`${g.p(s).name} 把指针往回掰了`, 'good');
        else g.log('指针掰不动', 'info');
      },
    },
    {
      id: 'forward', side: 'traitor', label: '拨快指针', desc: '知识检定。4–5：指针前进 1；6+：前进 2',
      can: (g, s) => clocks(g).includes(g.p(s).tile),
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '拨快指针');
        if (r >= 6) setHand(g, g.hv.hand + 2);
        else if (r >= 4) setHand(g, g.hv.hand + 1);
        g.log(r >= 4 ? '指针往前跳了' : '指针卡住了，没拨动', r >= 4 ? 'bad' : 'info');
      },
    },
    {
      id: 'wind', side: 'traitor', label: '上发条', desc: '力量检定 4+：本轮结束前，幸存者不能拨回这个钟',
      can: (g, s) => clocks(g).includes(g.p(s).tile) && !(g.hv.locked as Record<string, number>)[g.p(s).tile],
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '上发条 4+');
        if (r < 4) return;
        (g.hv.locked as Record<string, number>)[g.p(s).tile] = 1;
        g.log(`「${g.tileName(g.p(s).tile)}」的钟上紧了发条，本轮拨不回去了`, 'bad');
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
