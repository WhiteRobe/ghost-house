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
  intro: '所有人的手机同时跳回 00:00。直播回放里，你们一遍又一遍推开门厅的大门，每一遍人都少一个。怀表的秒针在走，分针一格没动。走廊尽头有个影子，和你们一样高，学着你们的步子走。',
  hero: {
    goal: '在钟楼成功「拨停指针」足够次数：3 人局 5 次，4 人局 6 次，5/6 人局 7 次。',
    rules: [
      '这是合作剧本，没有背叛者。所有人一起赢，或一起输。',
      '钟楼会出现在二楼；放不下时，改用二楼楼梯口。位置会公开在日志里。',
      '特殊行动「拨停指针」：在钟楼，知识检定 5+，成功则计数轨 +1。全队每轮最多成功 2 次。',
      '特殊行动「对表」：和另一名探险者在同一个房间时，选一人，知识检定 3+：成功则你们两人下一次「拨停指针」各多掷 1 颗骰。不叠加；下一次拨停指针时无论成败都会用掉。',
      '每轮结束时，随机一名活着的探险者被送回门厅，失去 1 点理智。',
      '「循环的影子」一开始在钟楼和走廊各有一个，5 人以上再在地下室楼梯口放一个。第 3 轮、第 6 轮结束时，门厅各多出一个。影子受到伤害只会被击晕。',
      '失败条件：第 8 轮结束时还没完成，或所有人都死了。',
    ],
    win: '钟楼的指针在 00:01 顿了一下，“咔”地往下走了。窗外发白，手机震了一下，收到一条天气推送。',
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
      id: 'stop', side: 'hero', label: '拨停指针', desc: '知识检定 5+：计数轨 +1（全队每轮最多成功 2 次）',
      can: (g, s) => g.p(s).tile === clockTile(g) && (g.hv.thisRound ?? 0) < 2,
      *run(g, s) {
        const p = g.p(s);
        const extra = p.flags.h3sync ? 1 : 0;
        p.flags.h3sync = false;
        const r = yield* g.check(s, 'knowledge', 5, '拨停指针 5+', extra);
        if (r < 5) { g.log('指针从指尖滑脱，又转回了原处', 'bad'); return; }
        g.hv.count = (g.hv.count ?? 0) + 1;
        g.hv.thisRound = (g.hv.thisRound ?? 0) + 1;
        g.setTrack('拨停指针', g.hv.count, need(g));
        g.log(`${p.name} 把指针往回扳了一格`, 'good');
      },
    },
    {
      id: 'sync', side: 'hero', label: '对表', desc: '知识检定 3+：你和同房间的一名探险者下一次「拨停指针」各多掷 1 颗骰',
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
      g.moveTo(s, 'G:0,0', '被拽回了门厅');
      g.log(`${g.p(s).name} 一眨眼，又站在了门厅里`, 'bad');
      yield* g.lose(s, 'sanity', 1);
    }
    const r = g.state.haunt!.round - 1; // 刚结束的轮
    if (r === 3 || r === 6) {
      g.spawn('shadow', 'G:0,0');
      g.log('门厅地板上多了一个影子，没有人站在它上面', 'bad');
    }
    g.hv.loop = r;
    g.hv.thisRound = 0;
  },
  checkWin(g) {
    if ((g.hv.count ?? 0) >= need(g)) return { side: 'hero' };
    if ((g.hv.loop ?? 0) >= limit(g)) return { side: 'none', text: '指针又跳回了 00:00。门厅的大门再一次被推开，推门的人不记得自己来过。' };
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
