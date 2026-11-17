import type { HauntDef } from '../engine/defs';
import type { Game, Gen } from '../engine/game';

/** 47 黑暗中的东西（事件「停电」触发）：合作 */

const START = ['entrance', 'hallway', 'stairs', 'upper-landing', 'basement-landing'];
const LIMIT = 12;

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌了个洞，底下是去地下室的石阶', 'info');
  }
}

const box = (g: Game): string => g.hv.box ?? 'B:0,-2';
const fuses = (g: Game) => g.hv.fuses as Record<string, number>;
const carried = (g: Game, s: number) => fuses(g)[s] ?? 0;
const need = (g: Game): number => g.hv.need ?? 3;
const things = (g: Game) => g.hs.things as string[];

/** 本轮的速度上限：第 1 轮 5，之后每轮降低 1，最低 1 */
function cap(g: Game) {
  const r = g.state.haunt?.round ?? 1;
  return Math.max(1, 6 - r);
}

function updateTrack(g: Game) {
  g.setTrack('已装好的保险丝', g.hv.installed ?? 0, need(g));
}

/** 显形：在它所在的格子放一个公开标记 */
function manifest(g: Game, i: number) {
  const k = things(g)[i];
  if (!g.tokensAt(k, 'shade').some((t) => t.data?.i === i)) g.token(k, 'shade', '黑暗中的东西', { icon: 'shade', data: { i } });
}

function* strike(g: Game, i: number, s: number): Gen {
  const round = g.state.haunt?.round ?? 0;
  const struck = (g.hs.struck ??= {}) as Record<string, number>;
  if (struck[i] === round) return;
  struck[i] = round;
  manifest(g, i);
  g.log(`一只冰凉的手搭上了 ${g.p(s).name} 的后颈`, 'bad');
  const a = yield* g.roll(4, '黑暗中的东西');
  const d = yield* g.check(s, 'might', undefined, '挣脱（力量）');
  if (a > d) yield* g.damage(s, 'physical', a - d, '黑暗中的东西');
  else g.log(`${g.p(s).name} 挣脱了`, 'good');
}

/** 朝最近的活人走 steps 步（只沿相通的门） */
function stepThing(g: Game, from: string, steps: number): string {
  const targets = g.alive().map((s) => g.p(s).tile);
  if (!targets.length) return from;
  let cur = from;
  for (let i = 0; i < steps; i++) {
    if (targets.includes(cur)) break;
    const d0 = Math.min(...targets.map((t) => g.distance(cur, t)));
    const opts = g.neighbors(cur).filter((n) => Math.min(...targets.map((t) => g.distance(n, t))) < d0);
    if (!opts.length) {
      // 够不着任何人：在黑暗里瞎转
      const any = g.neighbors(cur);
      if (!any.length) break;
      cur = any[g.rng.int(any.length)];
      continue;
    }
    cur = opts[g.rng.int(opts.length)];
  }
  return cur;
}

function farTile(g: Game): string {
  const players = g.alive().map((s) => g.p(s).tile);
  const pool = Object.keys(g.state.tiles).filter((k) => g.distance('G:0,0', k) < Infinity && !players.includes(k));
  if (!pool.length) return 'B:0,-2';
  g.rng.shuffle(pool);
  pool.sort((a, b) => Math.min(...players.map((p) => g.distance(p, b))) - Math.min(...players.map((p) => g.distance(p, a))));
  return pool[g.rng.int(Math.min(3, pool.length))];
}

export const h47: HauntDef = {
  id: 47,
  title: '黑暗中的东西',
  type: 'coop',
  traitor: { type: 'none' },
  intro: '“啪”一声，整栋楼的灯全灭了。手机屏幕只照得见自己的脚尖。墙那边有指甲刮墙纸的声音，刮一下，停一下，近了一点。配电箱里的保险丝全被拧走了。',
  hero: {
    goal: '第 12 轮结束前，找齐保险丝，在配电箱全部装好。',
    rules: [
      '配电箱在煤房（煤房放不进地图时，在地下室楼梯口），有「配电箱」标记。保险丝标记散在离配电箱较远的房间，3 人局 3 根，4/5 人局 4 根，6 人局 5 根，全部要装上。',
      '停电：每回合你的移动点数不能超过速度上限。第 1 轮上限是 5，之后每轮 -1，最低 1。',
      '黑暗中的东西（3/4 人局 2 个，5/6 人局 3 个）：位置不公开。每轮结束时，每个东西朝最近的人走 2 步，走到有人的房间就随机攻击其中一人。你走进它所在的房间，也会被它攻击，并且你的回合立即结束。攻击：它掷 4 颗骰，你掷力量，它点数更高你受到差值的物理伤害。每个东西每轮最多攻击一次。攻击过之后它会显形（出现标记），直到下一轮结束。',
      '特殊行动「拾取保险丝」：在有保险丝的房间执行，拿起这里所有保险丝，不用检定。带着保险丝的人死亡，保险丝掉在原地。',
      '特殊行动「装保险丝」：在配电箱执行，知识检定 5+，成功装好你带着的 1 根。保险丝全部装好，你们获胜。',
      '特殊行动「驱散」：和显形的东西在同一房间时执行，理智检定 5+，成功把这个房间里显形的东西都赶到离所有人很远的地方，重新藏起来。',
      `第 ${LIMIT} 轮结束时保险丝还没装齐，所有人都输。`,
    ],
    win: '最后一根保险丝推进卡槽，“嗡”一声，满楼的灯泡全亮了。墙角有几个高高瘦瘦的影子没来得及躲，被灯一照，地上只剩几撮灰。',
  },
  *setup(g) {
    ensureBasement(g);
    const b = g.placeRoom('coal-room') ?? 'B:0,-2';
    g.hv.box = b;
    g.token(b, 'fusebox', '配电箱', { icon: 'fusebox' });
    g.hv.need = g.scale(3, 4, 4, 5);
    g.hv.installed = 0;
    g.hv.fuses = {};
    const players = g.alive().map((s) => g.p(s).tile);
    const pool = Object.keys(g.state.tiles).filter((k) => k !== b && !START.includes(g.state.tiles[k].room) && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(pool);
    pool.sort((a, c) => g.distance(b, c) - g.distance(b, a));
    const picks: string[] = [];
    for (const f of ['U', 'G', 'U', 'G', 'B']) {
      const k = pool.find((x) => x.startsWith(f + ':') && !picks.includes(x));
      if (k) picks.push(k);
    }
    for (const k of pool) if (picks.length < need(g) && !picks.includes(k)) picks.push(k);
    for (const k of ['U:0,-2', 'G:0,-1', 'G:0,-2', 'G:0,0']) if (picks.length < need(g) && !picks.includes(k)) picks.push(k);
    for (const k of picks.slice(0, need(g))) g.token(k, 'fuse', '保险丝', { icon: 'fuse' });
    // 黑暗中的东西：藏在离人远的地方
    const n = g.scale(2, 2, 3, 3);
    g.hs.things = [];
    for (let i = 0; i < n; i++) {
      const pool2 = Object.keys(g.state.tiles).filter((k) => !players.includes(k) && g.distance('G:0,0', k) < Infinity);
      pool2.sort((a, c) => Math.min(...players.map((p) => g.distance(p, c))) - Math.min(...players.map((p) => g.distance(p, a))));
      const k = pool2.length ? pool2[g.rng.int(Math.min(3, pool2.length))] : 'B:0,-2';
      things(g).push(k);
    }
    g.hv.cap = cap(g);
    g.reveal(`停电了：本轮速度上限 ${cap(g)}`);
    updateTrack(g);
  },
  actions: [
    {
      id: 'pick', side: 'hero', label: '拾取保险丝', desc: '拿起这个房间的保险丝',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'fuse').length > 0,
      *run(g, s) {
        for (const t of g.tokensAt(g.p(s).tile, 'fuse')) {
          g.removeToken(t.id);
          fuses(g)[s] = carried(g, s) + 1;
        }
        g.log(`${g.p(s).name} 摸到了保险丝（身上 ${carried(g, s)} 根）`, 'good');
      },
    },
    {
      id: 'install', side: 'hero', label: '装保险丝', desc: '在配电箱：知识检定 5+，装好 1 根保险丝',
      can: (g, s) => g.p(s).tile === box(g) && carried(g, s) > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 5, '装保险丝 5+');
        if (r < 5) {
          g.log('手一抖，保险丝没对准卡槽', 'bad');
          return;
        }
        fuses(g)[s] = carried(g, s) - 1;
        g.hv.installed = (g.hv.installed ?? 0) + 1;
        g.log(`配电箱里亮起一盏小红灯（${g.hv.installed}/${need(g)}）`, 'good');
        updateTrack(g);
      },
    },
    {
      id: 'repel', side: 'hero', label: '驱散', desc: '理智检定 5+：把这个房间显形的东西赶到远处',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'shade').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 5, '驱散 5+');
        if (r < 5) {
          g.log('你喊出来的声音在抖，它没退', 'bad');
          return;
        }
        const here = g.p(s).tile;
        for (const t of g.tokensAt(here, 'shade')) {
          g.removeToken(t.id);
          const i = t.data!.i as number;
          things(g)[i] = farTile(g);
        }
        g.log('那东西尖叫一声，退回了远处', 'good');
      },
    },
  ],
  *onTurnStart(g) {
    const c = cap(g);
    if (g.state.moveLeft > c) g.state.moveLeft = c;
  },
  *onEnter(g, s) {
    const here = g.p(s).tile;
    const list = things(g);
    for (let i = 0; i < list.length; i++) {
      if (list[i] !== here || g.p(s).dead) continue;
      const struck = (g.hs.struck ?? {}) as Record<string, number>;
      if (struck[i] === (g.state.haunt?.round ?? 0)) {
        manifest(g, i);
        continue;
      }
      yield* strike(g, i, s);
      g.endTurn();
      return;
    }
  },
  *onRoundEnd(g) {
    for (const t of g.tokens('shade')) g.removeToken(t.id);
    const list = things(g);
    for (let i = 0; i < list.length; i++) {
      list[i] = stepThing(g, list[i], 2);
      const here = g.playersAt(list[i]);
      if (here.length) yield* strike(g, i, here[g.rng.int(here.length)]);
    }
    if (g.hv.cap !== cap(g)) {
      g.hv.cap = cap(g);
      g.log(`手机电量又掉了一格：速度上限降为 ${cap(g)}`, 'haunt');
    }
    const r = g.state.haunt?.round ?? 0;
    if (r > LIMIT) g.hv.dark = true;
    else if (r === LIMIT) g.log('最后一根蜡烛只剩指甲盖那么长了，这是最后一轮', 'haunt');
  },
  *onDeath(g, s) {
    const n = carried(g, s);
    if (n > 0) {
      fuses(g)[s] = 0;
      for (let i = 0; i < n; i++) g.token(g.p(s).tile, 'fuse', '保险丝', { icon: 'fuse' });
      g.log(`保险丝滚到了${g.tileName(g.p(s).tile)}的地上`, 'info');
    }
  },
  checkWin(g) {
    if ((g.hv.installed ?? 0) >= need(g)) return { side: 'hero' };
    if (g.hv.dark) return { side: 'none', text: '蜡烛灭了。每个人肩膀上都搭上了一只手。' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const b = box(g);
      const loose = g.tokens('fuse').map((t) => t.tile);
      const mine = carried(g, s);
      const totalCarried = Object.values(fuses(g)).reduce((a, x) => a + x, 0);
      const actions = ['repel', 'install', 'pick'];
      if (mine > 0 && (!loose.length || mine >= 2)) return { goals: [b], actions };
      if (loose.length) return { goals: loose, actions };
      if (mine > 0 || totalCarried > 0) return { goals: [b], actions };
      return { goals: [b], actions };
    },
  },
};
