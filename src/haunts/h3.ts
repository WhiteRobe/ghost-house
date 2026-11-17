import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

function clockTile(g: Game): string {
  if (g.hv.clock && g.state.tiles[g.hv.clock]) return g.hv.clock;
  const k = g.placeRoom('clock-tower') ?? g.findTile('upper-landing') ?? 'G:0,-2';
  g.hv.clock = k;
  return k;
}

const need = (g: Game) => g.scale(5, 6, 7, 7);
const limit = (g: Game) => g.scale(8, 8, 8, 8);

/** 3 零点循环（直播 × 停走的怀表）——合作 */
export const h3: HauntDef = {
  id: 3,
  title: '零点循环',
  type: 'coop',
  traitor: { type: 'none' },
  intro: '所有人的手机同时跳回了 00:00。直播回放里，你们一遍又一遍地推开门厅的大门，每一遍都比上一遍少了点什么。怀表在走，可时间不肯往前。走廊尽头，一个和你们一样高的影子在模仿你们走路。',
  hero: {
    goal: '在钟楼累计足够次数的知识检定成功（3 人局 5 次，4 人局 6 次，5/6 人局 7 次），拨停这场循环。',
    rules: [
      '钟楼一定会出现在二楼（若无法放置，则改为二楼楼梯口）。',
      '特殊行动「拨停指针」：在钟楼进行知识 5+ 检定，成功则计数轨 +1。每轮最多成功 2 次（时间只肯慢慢停下）。',
      '特殊行动「对表」：与另一名探险者同处一室时，进行知识 3+ 检定，成功则你们二人下一次「拨停指针」各多掷 1 颗骰（不叠加）。',
      '每轮结束时，随机一名存活的探险者被循环送回门厅，并失去 1 点理智。',
      '「循环的影子」会追杀你们（一个守在钟楼，一个从走廊出发）；它受伤只会被击晕。第 3 轮和第 6 轮结束时各会多出一个影子。',
      `第 8 轮结束时如果还没拨停时间，所有人都会永远困在这一夜。`,
    ],
    win: '钟楼的指针在 00:01 停了一下，然后“咔”地走了下去。天边泛白，手机终于收到了一条推送。',
  },
  monsters: {
    shadow: { name: '循环的影子', icon: 'shadow', speed: 4, might: 4 },
  },
  *setup(g) {
    g.placeRoom('cellar-hatch'); // 保证地下室与一楼相通
    const k = clockTile(g);
    g.hv.count = 0;
    g.hv.loop = 0;
    g.spawn('shadow', k);
    g.spawn('shadow', 'G:0,-1');
    if (g.n >= 5) g.spawn('shadow', g.findTile('basement-landing') ?? 'G:0,-1');
    g.reveal(`钟楼位于「${g.tileName(k)}」`);
    g.setTrack('拨停指针', 0, need(g));
  },
  actions: [
    {
      id: 'stop', side: 'hero', label: '拨停指针', desc: '知识 5+ 检定，成功则计数轨 +1',
      can: (g, s) => g.p(s).tile === clockTile(g) && (g.hv.thisRound ?? 0) < 2,
      *run(g, s) {
        const p = g.p(s);
        const extra = p.flags.h3sync ? 1 : 0;
        p.flags.h3sync = false;
        const r = yield* g.check(s, 'knowledge', 5, '拨停指针 5+', extra);
        if (r < 5) { g.log('指针从指尖滑开，又转了一圈', 'bad'); return; }
        g.hv.count = (g.hv.count ?? 0) + 1;
        g.hv.thisRound = (g.hv.thisRound ?? 0) + 1;
        g.setTrack('拨停指针', g.hv.count, need(g));
        g.log(`${p.name} 把指针往回扳了一格`, 'good');
      },
    },
    {
      id: 'sync', side: 'hero', label: '对表', desc: '知识 3+ 检定，成功则你和同房间的一名探险者下一次拨停指针多掷 1 颗骰',
      can: (g, s) => g.alive().some((o) => o !== s && g.p(o).tile === g.p(s).tile) && !g.p(s).flags.h3sync,
      *run(g, s) {
        const others = g.alive().filter((o) => o !== s && g.p(o).tile === g.p(s).tile);
        const o = yield* g.choosePlayer(s, '和谁对表？', others);
        if (o == null) return;
        const r = yield* g.check(s, 'knowledge', 3, '对表 3+');
        if (r < 3) return;
        g.p(s).flags.h3sync = true;
        g.p(o).flags.h3sync = true;
        g.log(`${g.p(s).name} 和 ${g.p(o).name} 对准了怀表`, 'good');
      },
    },
  ],
  *onRoundEnd(g) {
    const alive = g.alive();
    if (alive.length) {
      const s = alive[g.rng.int(alive.length)];
      g.moveTo(s, 'G:0,0', '被时间拽回了门厅');
      g.log(`${g.p(s).name} 眨了眨眼，发现自己又站在门厅里`, 'bad');
      yield* g.lose(s, 'sanity', 1);
    }
    const r = g.state.haunt!.round - 1; // 刚结束的轮
    if (r === 3 || r === 6) {
      g.spawn('shadow', 'G:0,0');
      g.log('门厅的地板上，又多出一个影子', 'bad');
    }
    g.hv.loop = r;
    g.hv.thisRound = 0;
  },
  checkWin(g) {
    if ((g.hv.count ?? 0) >= need(g)) return { side: 'hero' };
    if ((g.hv.loop ?? 0) >= limit(g)) return { side: 'none', text: '指针又一次跳回了 00:00。这一次，没有人再记得自己推开过那扇门。' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const k = clockTile(g);
      const actions = g.p(s).tile === k ? ['stop', 'sync'] : [];
      return { goals: [k], actions, attack: g.value(s, 'might') >= 5 };
    },
  },
};
