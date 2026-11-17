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
  intro: '直播间的在线人数开始疯涨，弹幕刷满了同一句话：“我们来看你了。”门厅的大门吱呀一声开了，一个个画着笑脸的纸扎人排着队挤了进来。背叛者举着手机，满脸都是被打赏的狂喜。',
  hero: {
    goal: '拉下分布在地下室、一楼、二楼的三个电闸，彻底掐断这场直播。',
    rules: [
      '三层楼各有一个「电闸」标记。',
      '特殊行动「拉电闸」：在有未拉下电闸的房间进行力量或知识 4+ 检定（任选较高者），成功则拉下这个电闸。',
      '每轮结束时，纸扎观众会从门厅涌进来，而且越来越多（第 1、2 轮各 1 个，之后每两轮多 1 个，场上最多若干个）。',
      '纸扎观众很脆弱：受伤即被击晕。',
      '背叛者可以把拉下的电闸重新推上去，但每个电闸只能被推回一次。',
    ],
    win: '最后一个电闸“咔哒”一声落下，整栋楼陷入黑暗。纸扎观众像被抽走了线，一个个软倒在地上。',
  },
  traitorSide: {
    goal: '让直播继续下去：杀死足够多的幸存者（3/4 人局 2 人，5/6 人局 3 人；幸存者不足时全部杀死）。',
    rules: [
      '你控制纸扎观众，它们在你的回合之后行动。每轮结束时会有新的观众从门厅涌入，越来越多。',
      '特殊行动「推回电闸」：在已拉下的电闸所在房间进行理智 4+ 检定，成功则重新推上它。每个电闸只能被推回一次。',
    ],
    win: '直播间的人数还在上涨。新的观众坐满了洋楼的每一个房间，它们一动不动，盯着屏幕。',
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
      id: 'pull', side: 'hero', label: '拉电闸', desc: '力量或知识（取较高）4+ 检定，成功则拉下本房间的电闸',
      can: (g, s) => switchesOn(g).some((t) => t.tile === g.p(s).tile),
      *run(g, s) {
        const trait = g.value(s, 'might') >= g.value(s, 'knowledge') ? 'might' : 'knowledge';
        const r = yield* g.check(s, trait, 4, '拉电闸 4+');
        if (r < 4) { g.log('电闸卡死了，纹丝不动', 'bad'); return; }
        const tok = switchesOn(g).find((t) => t.tile === g.p(s).tile)!;
        tok.data = { ...tok.data, off: true };
        tok.label = tok.label.replace('（已拉下）', '') + '（已拉下）';
        sync(g);
        g.log(`${g.p(s).name} 拉下了${tok.label.replace('（已拉下）', '')}`, 'good');
      },
    },
    {
      id: 'reset', side: 'traitor', label: '推回电闸', desc: '理智 4+ 检定，重新推上本房间已拉下的电闸（每个限一次）',
      can: (g, s) => switchesOff(g).some((t) => t.tile === g.p(s).tile && !t.data?.reset),
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '推回电闸 4+');
        if (r < 4) return;
        const tok = switchesOff(g).find((t) => t.tile === g.p(s).tile && !t.data?.reset)!;
        tok.data = { ...tok.data, off: false, reset: true };
        tok.label = tok.label.replace('（已拉下）', '');
        sync(g);
        g.log('直播信号又恢复了，弹幕重新刷了起来', 'bad');
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
