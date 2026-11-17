import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 23 猫领路（失踪的朋友 × 黑猫） */

function landing(k: string) {
  return k[0] === 'B' ? 'B:0,-2' : k[0] === 'U' ? 'U:0,-2' : 'G:0,-1';
}

function reachable(g: Game, k: string) {
  if (g.distance('G:0,0', k) < Infinity) return;
  if (k[0] === 'B') g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', k) < Infinity) return;
  const l = landing(k);
  if (g.distance('G:0,0', l) === Infinity) g.link('G:0,-1', l);
  if (g.distance('G:0,0', k) === Infinity) g.link(l, k);
}

const escaped = (g: Game) => g.heroes(true).filter((s) => g.p(s).flags.escaped).length;
const killed = (g: Game) => g.heroes(true).filter((s) => g.p(s).dead && !g.p(s).flags.escaped).length;
const catOf = (g: Game) => g.hv.cat as number | null;
const isCat = (g: Game, s: number) => catOf(g) === s && !g.p(s).dead;

function track(g: Game) {
  g.setTrack('逃出露台的人', escaped(g), g.hv.need);
}

/** 黑猫跑到下一个地方留下爪印 */
function nextPaw(g: Game) {
  for (const t of g.tokens('paw')) g.removeToken(t.id);
  const c = catOf(g);
  if (c == null) return;
  const left = (g.hv.trail as number) - (g.hv.paws as number);
  if (left <= 0) {
    g.log('黑猫抬头看了看楼上，喵了一声，朝露台跑去', 'good');
    return;
  }
  const here = g.p(c).tile;
  const all = Object.keys(g.state.tiles).filter((k) => k !== g.hv.balcony && k !== here && g.distance('G:0,0', k) < Infinity);
  let far = all.filter((k) => g.distance(here, k) >= 3);
  if (!far.length) far = all.filter((k) => g.distance(here, k) >= 2);
  if (!far.length) far = all;
  if (!far.length) {
    g.hv.paws = g.hv.trail;
    return;
  }
  const k = far[g.rng.int(far.length)];
  g.token(k, 'paw', '猫爪印', { icon: 'paw' });
  g.log(`黑猫窜了出去，在${g.tileName(k)}留下一串爪印`, 'info');
}

function giveCat(g: Game, from: number) {
  const here = g.p(from).tile;
  const rest = g.heroes().filter((h) => h !== from);
  if (!rest.length) {
    g.hv.cat = null;
    return;
  }
  rest.sort((a, b) => g.distance(here, g.p(a).tile) - g.distance(here, g.p(b).tile));
  g.hv.cat = rest[0];
  if (g.tokens('paw').length && g.distance(g.p(rest[0]).tile, g.tokens('paw')[0].tile) < 2) nextPaw(g);
  g.log(`黑猫一溜烟跑到了 ${g.p(rest[0]).name} 脚边`, 'info');
}

export const h23: HauntDef = {
  id: 23,
  title: '猫领路',
  type: 'traitor',
  traitor: { type: 'left' },
  intro: '黑猫忽然弓起背，冲着楼上低低地叫了一声，然后头也不回地往前走——它认得路。你们的朋友就是跟着这只猫进来的，却再也没出去。可揭示者身边那位同伴，正牵着两条看不清模样的狗，挡在了楼梯口。',
  hero: {
    goal: '跟着黑猫找到出口，从二楼露台逃出去：至少一半的幸存者（向上取整）逃出即获胜。',
    rules: [
      '黑猫跟在一名幸存者身边（见日志，异变开始时优先给原本持有黑猫的人）。黑猫的主人死亡时，猫会跑到离他最近的幸存者身边。',
      '露台若尚未被发现，异变开始时会出现。',
      '特殊行动「猫钻暗道」（黑猫的主人，每回合一次）：进行理智 4+ 检定，成功则在当前房间发现一条直通露台的暗道（之后所有人都能从这里一步走到露台，反之亦然）。',
      '黑猫会先在房子里乱跑，留下爪印（标记）。特殊行动「跟上猫」：黑猫的主人在有爪印的房间进行理智 3+ 检定，成功则猫跑向下一处爪印。跟上足够多次（3/4 人局 2 次，5/6 人局 3 次）后，猫会跑向露台。',
      '特殊行动「找出口」：猫已跑向露台、且黑猫的主人在露台时，猫会找到翻出去的路。之后露台的出口一直开着。',
      '特殊行动「翻出露台」：出口找到后，在露台进行速度 3+ 检定，成功即逃出鬼屋（离开游戏，不再受伤害）。',
      '看门狗被击败时只会被击晕。',
    ],
    win: '你们顺着排水管滑到院子里，回头看时，露台上蹲着那只黑猫，它舔了舔爪子，转身消失在窗帘后面。',
  },
  traitorSide: {
    goal: '不让他们跟着猫出去：杀死的幸存者多到他们不可能再有一半人逃出。',
    rules: [
      '你控制「看门狗」，它们在你的回合之后行动，速度很快，被击败时只会被击晕。',
      '黑猫的主人可以发现直通露台的暗道；出口一旦被猫找到就无法再封上。',
      '逃出露台的幸存者离开游戏。',
    ],
    win: '狗叫声停了。黑猫蹲在露台的栏杆上，等着下一个跟它进来的人。',
  },
  monsters: {
    dog: { name: '看门狗', icon: 'dog', speed: 5, might: 4 },
  },
  *setup(g) {
    const t = g.traitor()!;
    let balcony = g.placeRoom('balcony');
    if (!balcony) balcony = 'U:0,-2';
    reachable(g, balcony);
    g.hv.balcony = balcony;
    const hs = g.heroes();
    const holder = g.holder('cat');
    const rev = g.state.haunt!.revealer;
    g.hv.cat = holder != null && hs.includes(holder) ? holder : hs.includes(rev) ? rev : hs[0];
    g.log(`黑猫跟在 ${g.p(g.hv.cat).name} 身边`, 'haunt');
    g.hv.total = hs.length;
    g.hv.need = Math.ceil(hs.length / 2);
    g.hv.exit = false;
    g.hv.paws = 0;
    g.hv.trail = g.scale(2, 2, 3, 3);
    nextPaw(g);
    const n = g.scale(2, 2, 2, 2);
    for (let i = 0; i < n; i++) g.spawn('dog', g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'tunnel', side: 'hero', label: '猫钻暗道', desc: '黑猫的主人：理智 4+ 检定，成功则此处出现直通露台的暗道',
      can: (g, s) => isCat(g, s) && g.p(s).tile !== g.hv.balcony && !g.tokensAt(g.p(s).tile, 'tunnel').length,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '猫钻暗道 4+');
        if (r < 4) {
          g.log('黑猫在墙根嗅了嗅，摇了摇尾巴走开了', 'info');
          return;
        }
        const here = g.p(s).tile;
        g.link(here, g.hv.balcony);
        g.token(here, 'tunnel', '暗道', { icon: 'tunnel' });
        g.token(g.hv.balcony, 'tunnel', '暗道', { icon: 'tunnel' });
        g.log(`黑猫钻进护墙板的缝隙——${g.tileName(here)}里有一条通往露台的暗道！`, 'good');
      },
    },
    {
      id: 'follow', side: 'hero', label: '跟上猫', desc: '黑猫的主人在有爪印的房间：理智 3+ 检定，成功则猫跑向下一处',
      can: (g, s) => isCat(g, s) && g.tokensAt(g.p(s).tile, 'paw').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 3, '跟上猫 3+');
        if (r < 3) {
          g.log('黑猫蹲在那里舔爪子，似乎还不想走', 'info');
          return;
        }
        g.hv.paws = (g.hv.paws as number) + 1;
        nextPaw(g);
      },
    },
    {
      id: 'find', side: 'hero', label: '找出口', desc: '黑猫的主人在露台：让猫找到翻出去的路',
      can: (g, s) => isCat(g, s) && !g.hv.exit && g.p(s).tile === g.hv.balcony && g.hv.paws >= g.hv.trail,
      *run(g) {
        g.hv.exit = true;
        g.log('黑猫跳上栏杆，用爪子拨开了爬山虎——下面是一根结实的排水管', 'good');
      },
    },
    {
      id: 'escape', side: 'hero', label: '翻出露台', desc: '出口已找到：速度 3+ 检定，成功即逃出',
      can: (g, s) => !!g.hv.exit && g.p(s).tile === g.hv.balcony,
      *run(g, s) {
        const r = yield* g.check(s, 'speed', 3, '翻出露台 3+');
        if (r < 3) {
          g.log(`${g.p(s).name} 脚下一滑，又被拽回了露台`, 'info');
          return;
        }
        const p = g.p(s);
        if (isCat(g, s)) giveCat(g, s);
        p.flags.escaped = true;
        p.cards = [];
        p.dead = true;
        g.endTurn();
        g.log(`${p.name} 顺着排水管滑了下去，逃出了鬼屋！`, 'good');
        track(g);
      },
    },
  ],
  *onDeath(g, s) {
    if (g.p(s).flags.escaped) return;
    if (catOf(g) === s) giveCat(g, s);
  },
  *onRoundEnd(g) {
    for (const s of g.alive()) reachable(g, g.p(s).tile);
  },
  checkWin(g) {
    const need = g.hv.need as number;
    if (escaped(g) >= need) return { side: 'hero' };
    if (killed(g) > (g.hv.total as number) - need) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const b = g.hv.balcony as string;
      const far = g.distance(g.p(s).tile, b) > 2;
      const acts = ['escape', 'find', 'follow'];
      if (far && g.hv.paws >= g.hv.trail) acts.push('tunnel');
      const paw = g.tokens('paw')[0];
      if (!g.hv.exit) {
        if (isCat(g, s)) return { goals: [paw ? paw.tile : b], actions: acts };
        const c = catOf(g);
        // 其他人护着猫主人，顺便靠近露台
        return { goals: c != null ? [g.p(c).tile] : [b], actions: acts };
      }
      return { goals: [b], actions: acts };
    },
    traitor: (g) => {
      const b = g.hv.balcony as string;
      const hs = g.heroes();
      hs.sort((a, c) => (isCat(g, c) ? 1 : 0) - (isCat(g, a) ? 1 : 0) || g.distance(g.p(a).tile, b) - g.distance(g.p(c).tile, b));
      return { goals: hs.map((h) => g.p(h).tile) };
    },
    monster: (g) => {
      const b = g.hv.balcony as string;
      const c = catOf(g);
      if (!g.hv.exit && c != null) return { goals: [g.p(c).tile] };
      const hs = g.heroes();
      hs.sort((a, c) => g.distance(g.p(a).tile, b) - g.distance(g.p(c).tile, b));
      return { goals: [...hs.slice(0, 2).map((h) => g.p(h).tile), b] };
    },
  },
};
