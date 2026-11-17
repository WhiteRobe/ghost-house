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
  intro: '黑猫弓起背，冲楼上叫了一声，尾巴一甩就往前走，走两步还回头看你们跟没跟上。朋友当初就是跟着这只猫进来的。揭示者左手边那位没有动，他手里多了两根狗绳，绳子另一头在楼梯底下的黑影里，一扯一扯的。',
  hero: {
    goal: '跟着黑猫找到露台的出口，让一半幸存者（向上取整）翻出去：3 人局 1 人，4 人局 2 人，5 人局 2 人，6 人局 3 人。',
    rules: [
      '黑猫跟着一名幸存者，他就是猫主人（看日志）。优先给拿着「黑猫」凶兆的人，其次是揭示者。猫主人死亡或逃出时，猫跑到离他最近的幸存者身边。',
      '露台还没被发现的话，异变开始时会直接放出来。',
      '第 1 步，追爪印：猫在房子里留下「猫爪印」标记。特殊行动「跟上猫」：猫主人在有爪印的房间理智检定 3+，成功：爪印换到 3 步外的另一个房间。成功 2 次（5/6 人局 3 次）后，猫跑向露台，不再留爪印。',
      '第 2 步，找出口：特殊行动「找出口」，爪印追完后，猫主人走到露台即可使用，不用检定。之后露台出口一直开着。',
      '第 3 步，逃出去：特殊行动「翻出露台」，出口开着时，任何幸存者在露台速度检定 3+，成功：逃出鬼屋，离开游戏，你的回合结束。',
      '特殊行动「猫钻暗道」：猫主人在露台以外的房间理智检定 4+，成功：这个房间和露台之间开一条暗道，谁都能 1 步走过去。每个房间只能开 1 条。',
      '看门狗被击败时只会被击晕。',
      '逃出的人数够了，你们获胜。死去的人多到剩下的人不够逃出（3/4 人局死 2 人，5/6 人局死 3 人）时，你们失败。',
    ],
    win: '你们顺着排水管滑到院子里。回头看，黑猫还蹲在露台栏杆上，舔了两下爪子，钻回了窗帘后面。',
  },
  traitorSide: {
    goal: '在他们逃出去之前杀死幸存者：3/4 人局 2 人，5/6 人局 3 人。',
    rules: [
      '你控制 2 条看门狗，开始时在你的房间。它们在你的回合之后行动，移动掷 5 颗骰，被击败时只会被击晕。',
      '黑猫跟着一名幸存者（猫主人）。他要先追完爪印，再到露台让猫找出口，之后其他幸存者才能从露台翻出去。盯住猫主人能拖慢他们。',
      '猫主人能开直通露台的暗道。出口一旦找到就封不上。',
      '逃出露台的幸存者离开游戏，不算死亡。逃出的人达到一半（向上取整）时，你失败。',
    ],
    win: '狗不叫了。黑猫跳上露台栏杆，蹲下来，盯着院门口的路。',
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
      id: 'tunnel', side: 'hero', label: '猫钻暗道', desc: '猫主人：理智检定 4+，成功则这里和露台之间开一条暗道',
      can: (g, s) => isCat(g, s) && g.p(s).tile !== g.hv.balcony && !g.tokensAt(g.p(s).tile, 'tunnel').length,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '猫钻暗道 4+');
        if (r < 4) {
          g.log('黑猫在墙根嗅了嗅，甩甩尾巴走开了', 'info');
          return;
        }
        const here = g.p(s).tile;
        g.link(here, g.hv.balcony);
        g.token(here, 'tunnel', '暗道', { icon: 'tunnel' });
        g.token(g.hv.balcony, 'tunnel', '暗道', { icon: 'tunnel' });
        g.log(`黑猫钻进护墙板的缝，${g.tileName(here)}里多了一条通往露台的暗道`, 'good');
      },
    },
    {
      id: 'follow', side: 'hero', label: '跟上猫', desc: '猫主人在有爪印的房间：理智检定 3+，成功则猫跑向下一处',
      can: (g, s) => isCat(g, s) && g.tokensAt(g.p(s).tile, 'paw').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 3, '跟上猫 3+');
        if (r < 3) {
          g.log('黑猫蹲着舔爪子，不肯走', 'info');
          return;
        }
        g.hv.paws = (g.hv.paws as number) + 1;
        nextPaw(g);
      },
    },
    {
      id: 'find', side: 'hero', label: '找出口', desc: '爪印追完后，猫主人在露台：打开露台出口',
      can: (g, s) => isCat(g, s) && !g.hv.exit && g.p(s).tile === g.hv.balcony && g.hv.paws >= g.hv.trail,
      *run(g) {
        g.hv.exit = true;
        g.log('黑猫跳上栏杆，扒开爬山虎，底下是一根粗排水管', 'good');
      },
    },
    {
      id: 'escape', side: 'hero', label: '翻出露台', desc: '出口开着时在露台：速度检定 3+，成功即逃出',
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
        g.log(`${p.name} 顺着排水管滑了下去，逃出了鬼屋`, 'good');
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
