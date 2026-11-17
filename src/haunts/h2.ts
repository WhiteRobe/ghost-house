import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

type Floor = 'B' | 'G' | 'U';
const FLOOR_NAME: Record<Floor, string> = { B: '地下室', G: '一楼', U: '二楼' };
const LANDING: Record<Floor, string> = { B: 'B:0,-2', G: 'G:0,-1', U: 'U:0,-2' };
const FALLBACK_ROOM: Record<Floor, string[]> = { B: ['coal-room', 'furnace', 'storeroom'], G: ['servants', 'storeroom', 'kitchen'], U: ['attic', 'storeroom', 'nursery'] };
const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function switchTile(g: Game, f: Floor): string {
  const own = Object.keys(g.state.tiles).filter((k) => g.state.tiles[k].floor === f && !START.includes(k));
  if (own.length) return own[g.rng.int(own.length)];
  for (const id of FALLBACK_ROOM[f]) {
    const k = g.placeRoom(id, [f]);
    if (k && g.state.tiles[k]?.floor === f) return k;
  }
  return g.state.tiles[LANDING[f]] ? LANDING[f] : 'G:0,-1';
}

const switchesOn = (g: Game) => g.tokens('h2-switch').filter((t) => !t.data?.off);
const switchesOff = (g: Game) => g.tokens('h2-switch').filter((t) => t.data?.off);

function sync(g: Game) {
  g.setTrack('已拉下的电闸', switchesOff(g).length, 3);
}

/** 2 纸扎观众（直播 × 纸人） */
export const h2: HauntDef = {
  id: 2,
  title: '纸扎观众',
  type: 'traitor',
  traitor: { type: 'left' },
  intro: '在线人数一下涨到了五位数，弹幕全是同一句：“我们来看你了。”门厅的大门开了，纸扎人一个跟一个往里挤，脸上的笑是用红颜料画的。背叛者举着手机，打赏提示音响个不停，他笑得合不拢嘴。',
  hero: {
    goal: '拉下地下室、一楼、二楼的三个电闸，掐断直播。',
    rules: [
      '获胜条件：三个电闸同时处于拉下状态。',
      '地下室、一楼、二楼各有一个「电闸」标记，已拉下的数量见计数轨。',
      '特殊行动「拉电闸」：在有未拉下电闸的房间，用力量和知识中较高的一项检定 4+，成功就拉下这个电闸。每回合一次。',
      '背叛者能把拉下的电闸推回去，每个电闸最多被推回一次。被推回的电闸可以再拉。',
      '每轮结束时，门厅会进来新的纸扎观众：前两轮各 1 个，之后每两轮多 1 个，最多一次 3 个。场上观众总数上限：3/4/5/6 人局为 5/6/7/8 个。',
      '纸扎观众受到伤害只会被击晕。',
      '失败条件：死亡的幸存者达到 3/4 人局 2 人、5/6 人局 3 人（幸存者不够这么多时，全部死亡）。',
    ],
    win: '最后一个电闸“咔哒”落下，整栋楼黑了。纸扎观众一个接一个软倒在地上，压扁了好几个。',
  },
  traitorSide: {
    goal: '在三个电闸全被拉下之前，杀死足够多的幸存者：3/4 人局 2 人，5/6 人局 3 人（幸存者不够这么多时，全部杀死）。',
    rules: [
      '你控制纸扎观众，它们在你的回合之后行动。观众受到伤害只会被击晕。',
      '每轮结束时，门厅会进来新的观众：前两轮各 1 个，之后每两轮多 1 个，最多一次 3 个。场上总数上限：3/4/5/6 人局为 5/6/7/8 个。',
      '特殊行动「推回电闸」：在有已拉下电闸的房间，理智检定 4+，成功就把它推回去。每个电闸最多推回一次，每回合一次。',
      '三个电闸同时拉下，你就输了。',
    ],
    win: '在线人数还在涨。洋楼每个房间都坐满了纸扎观众，脸全朝着手机那边。',
  },
  monsters: {
    audience: { name: '纸扎观众', icon: 'effigy', speed: 3, might: 3 },
  },
  *setup(g) {
    g.placeRoom('cellar-hatch'); // 保证地下室与一楼相通
    for (const f of ['B', 'G', 'U'] as Floor[]) {
      const k = switchTile(g, f);
      g.token(k, 'h2-switch', `${FLOOR_NAME[f]}电闸`, { icon: 'switch', data: { off: false, reset: false } });
    }
    const t = g.traitor()!;
    g.spawn('audience', 'G:0,0');
    if (g.n >= 5) g.spawn('audience', g.p(t).tile);
    sync(g);
  },
  actions: [
    {
      id: 'pull', side: 'hero', label: '拉电闸', desc: '力量或知识（取较高）检定 4+：拉下这个房间的电闸',
      can: (g, s) => switchesOn(g).some((t) => t.tile === g.p(s).tile),
      *run(g, s) {
        const trait = g.value(s, 'might') >= g.value(s, 'knowledge') ? 'might' : 'knowledge';
        const r = yield* g.check(s, trait, 4, '拉电闸 4+');
        if (r < 4) { g.log('电闸卡住了，拉不动', 'bad'); return; }
        const tok = switchesOn(g).find((t) => t.tile === g.p(s).tile)!;
        tok.data = { ...tok.data, off: true };
        tok.label = tok.label.replace('（已拉下）', '') + '（已拉下）';
        sync(g);
        g.log(`${g.p(s).name} 拉下了${tok.label.replace('（已拉下）', '')}`, 'good');
      },
    },
    {
      id: 'reset', side: 'traitor', label: '推回电闸', desc: '理智检定 4+：推回这个房间已拉下的电闸（每个电闸最多一次）',
      can: (g, s) => switchesOff(g).some((t) => t.tile === g.p(s).tile && !t.data?.reset),
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '推回电闸 4+');
        if (r < 4) return;
        const tok = switchesOff(g).find((t) => t.tile === g.p(s).tile && !t.data?.reset)!;
        tok.data = { ...tok.data, off: false, reset: true };
        tok.label = tok.label.replace('（已拉下）', '');
        sync(g);
        g.log('直播信号回来了，弹幕又开始刷', 'bad');
      },
    },
  ],
  *onRoundEnd(g) {
    const r = g.state.haunt!.round; // 已经 +1
    const n = Math.min(3, 1 + Math.floor((r - 2) / 2));
    const cap = g.scale(5, 6, 7, 8);
    let made = 0;
    for (let i = 0; i < n && g.state.monsters.length < cap; i++) {
      g.spawn('audience', 'G:0,0');
      made++;
    }
    if (made) g.log(`门厅又挤进来 ${made} 个纸扎观众`, 'bad');
  },
  checkWin(g) {
    if (switchesOff(g).length >= 3) return { side: 'hero' };
    const all = g.heroes(true);
    const dead = all.filter((s) => g.p(s).dead).length;
    if (dead >= Math.min(all.length, g.scale(2, 2, 3, 3))) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const here = g.p(s).tile;
      const goals = switchesOn(g).map((t) => t.tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      return { goals, actions: ['pull'] };
    },
    traitor: (g, s) => {
      const here = g.p(s).tile;
      const off = switchesOff(g).filter((t) => !t.data?.reset).map((t) => t.tile);
      if (off.length >= 2 || off.includes(here)) return { goals: off.sort((a, b) => g.distance(here, a) - g.distance(here, b)), actions: ['reset'] };
      return { goals: g.heroes().map((x) => g.p(x).tile), actions: ['reset'] };
    },
    monster: (g) => {
      // 观众优先守住还没拉下的电闸附近的幸存者
      const on = switchesOn(g).map((t) => t.tile);
      const near = g.heroes().map((x) => g.p(x).tile).filter((k) => on.some((o) => g.distance(o, k) <= 2));
      return { goals: near };
    },
  },
};
