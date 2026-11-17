import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';
import type { Floor } from '../shared/types';

/** 21 冻结的时间（失踪的朋友 × 停走的怀表） */

const LANDING: Record<Floor, string> = { B: 'B:0,-2', G: 'G:0,-1', U: 'U:0,-2' };
const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

/** 保证某格能从门厅走到 */
function reachable(g: Game, key: string) {
  if (g.distance('G:0,0', key) < Infinity) return;
  const f = key[0] as Floor;
  if (f === 'B') g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', key) < Infinity) return;
  if (f === 'B' && g.distance('G:0,0', 'B:0,-2') === Infinity) g.link('G:0,-1', 'B:0,-2');
  if (g.distance('G:0,0', key) === Infinity) g.link(LANDING[f], key);
}

function room(g: Game, id: string, fallback: string): string {
  const k = g.placeRoom(id) ?? fallback;
  reachable(g, k);
  return k;
}

/** 某楼层找一个放标记的房间 */
function spot(g: Game, floor: Floor, avoid: string[], extra: string[]): string {
  const have = Object.keys(g.state.tiles).filter((k) => k[0] === floor && !START.includes(k) && !avoid.includes(k));
  if (have.length) {
    const k = have[g.rng.int(have.length)];
    reachable(g, k);
    return k;
  }
  for (const id of extra) {
    const k = g.placeRoom(id, [floor]);
    if (k && !avoid.includes(k)) {
      reachable(g, k);
      return k;
    }
  }
  reachable(g, LANDING[floor]);
  return LANDING[floor];
}

/** 有人掉进走不通的地方时打通道路 */
function connect(g: Game) {
  for (const s of g.alive()) reachable(g, g.p(s).tile);
  for (const t of g.tokens('part')) reachable(g, t.tile);
}

const parts = (g: Game, s: number) => (g.p(s).flags.parts as number) ?? 0;

function track(g: Game) {
  g.setTrack('已装回的零件', g.hv.fixed ?? 0, 3);
}

export const h21: HauntDef = {
  id: 21,
  title: '冻结的时间',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '怀表的秒针“咔”地一声停住，窗外飘落的槐花也停在半空。你们失踪的朋友就站在走廊尽头，一动不动，像一张被冲洗坏了的照片。揭示者手里的怀表开始倒着走，他的影子却没有跟着动。',
  hero: {
    goal: '找回散落在三层楼里的三枚怀表零件，带到钟楼装回去，让时间重新走起来。',
    rules: [
      '三枚零件（标记）分别藏在地下室、一楼、二楼的某个房间里。钟楼若尚未被发现，异变开始时会出现。',
      '特殊行动「拾零件」：在有零件的房间里直接拿起它（可以同时携带多枚）。',
      '特殊行动「装零件」：在钟楼携带零件时进行知识 5+ 检定，成功则装回一枚。',
      '携带零件的人死亡时，零件掉落在他倒下的房间里。',
      '被背叛者「定格」的人会跳过自己的下一个回合；刚被定格过的人在下一次自己的回合开始前不会再被定格。',
      '你们可以正常攻击背叛者和「停摆人」；停摆人被击败时只会被击晕。',
    ],
    win: '最后一枚齿轮咬合，钟楼的大钟“当”地响了一声。半空中的槐花落了地，朋友眨了眨眼，喊出了你的名字。',
  },
  traitorSide: {
    goal: '让时间永远停在今夜：杀死足够多的幸存者（3/4 人局 2 人，5/6 人局 3 人；或者杀光所有幸存者）。',
    rules: [
      '你控制「停摆人」，它们在你的回合之后行动，被击败时只会被击晕。',
      '特殊行动「定格」（每回合一次）：选择距离你 4 步以内的一名幸存者，他进行理智 4+ 检定，失败则跳过他的下一个回合。刚被定格过的人在他下一次自己的回合开始前不能再被定格。',
      '零件掉落在地上时你可以看到它们，但无法毁掉它们。',
    ],
    win: '所有的钟都停在三点十七分。房子里多了几张一动不动的人像，它们会一直站在那里，等下一批客人。',
  },
  monsters: {
    still: { name: '停摆人', icon: 'still', speed: 3, might: 4 },
  },
  *setup(g) {
    const t = g.traitor()!;
    const clock = room(g, 'clock-tower', 'U:0,-2');
    g.hv.clock = clock;
    g.hv.fixed = 0;
    const used: string[] = [clock];
    const extra: Record<Floor, string[]> = {
      B: ['coal-room', 'wine-cellar', 'storeroom', 'morgue'],
      G: ['servants', 'dining', 'kitchen', 'tea-room'],
      U: ['attic', 'nursery', 'dressing', 'guest-room'],
    };
    for (const f of ['B', 'G', 'U'] as Floor[]) {
      const k = spot(g, f, used, extra[f]);
      used.push(k);
      g.token(k, 'part', '怀表零件', { icon: 'gear' });
    }
    const n = g.scale(1, 1, 2, 3);
    for (let i = 0; i < n; i++) g.spawn('still', g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'pick', side: 'hero', label: '拾零件', desc: '拿起本房间的怀表零件',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'part').length > 0,
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'part')[0];
        if (!t) return;
        g.removeToken(t.id);
        g.p(s).flags.parts = parts(g, s) + 1;
        g.log(`${g.p(s).name} 拾起了一枚怀表零件`, 'good');
      },
    },
    {
      id: 'install', side: 'hero', label: '装零件', desc: '在钟楼进行知识 5+ 检定，成功装回一枚零件',
      can: (g, s) => g.p(s).tile === g.hv.clock && parts(g, s) > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 5, '装零件 5+');
        if (r < 5) {
          g.log('齿轮怎么也对不上齿……', 'info');
          return;
        }
        g.p(s).flags.parts = parts(g, s) - 1;
        g.hv.fixed = (g.hv.fixed ?? 0) + 1;
        track(g);
        g.log(`${g.p(s).name} 装回了一枚零件，钟摆轻轻晃了一下`, 'good');
      },
    },
    {
      id: 'freeze', side: 'traitor', label: '定格', desc: '选择 4 步内一名幸存者：他理智 4+ 检定，失败则跳过下一回合',
      can: (g, s) => g.heroes().some((h) => !g.p(h).flags.frozen && !g.p(h).flags.immune && g.distance(g.p(s).tile, g.p(h).tile) <= 4),
      *run(g, s) {
        const list = g.heroes().filter((h) => !g.p(h).flags.frozen && !g.p(h).flags.immune && g.distance(g.p(s).tile, g.p(h).tile) <= 4);
        const clock = g.hv.clock as string;
        list.sort((a, b) => parts(g, b) - parts(g, a) || g.distance(g.p(a).tile, clock) - g.distance(g.p(b).tile, clock));
        const h = yield* g.choosePlayer(s, '定格谁？', list);
        if (h == null) return;
        g.reveal('背叛者可以「定格」4 步内的幸存者：理智 4+ 检定失败就会跳过下一回合。');
        const r = yield* g.check(h, 'sanity', 4, '抵抗定格 4+');
        if (r >= 4) {
          g.log(`${g.p(h).name} 咬破舌尖，挣脱了停滞的时间`, 'good');
          return;
        }
        g.p(h).flags.frozen = true;
        g.log(`${g.p(h).name} 被定格在了原地`, 'bad');
      },
    },
  ],
  *onTurnStart(g, s) {
    const p = g.p(s);
    if (p.flags.frozen) {
      p.flags.frozen = false;
      p.flags.immune = true;
      g.log(`${p.name} 一动不动，这一回合被时间吞掉了`, 'bad', s);
      g.endTurn();
      return;
    }
    p.flags.immune = false;
  },
  *onRoundEnd(g) {
    connect(g);
  },
  *onDeath(g, s) {
    const n = parts(g, s);
    if (n <= 0) return;
    g.p(s).flags.parts = 0;
    for (let i = 0; i < n; i++) g.token(g.p(s).tile, 'part', '怀表零件', { icon: 'gear' });
    g.log('零件叮叮当当地滚落在地上', 'info');
  },
  checkWin(g) {
    if ((g.hv.fixed ?? 0) >= 3) return { side: 'hero' };
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    const dead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (dead >= g.scale(2, 2, 3, 3)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const clock = g.hv.clock as string;
      const here = g.p(s).tile;
      const toks = g.tokens('part').map((t) => t.tile);
      const carried = g.heroes().reduce((a, h) => a + parts(g, h), 0);
      if (parts(g, s) > 0) {
        const near = toks.length ? Math.min(...toks.map((k) => g.distance(here, k))) : Infinity;
        if (!toks.length || g.distance(here, clock) <= near) return { goals: [clock], actions: ['install', 'pick'] };
      }
      if (toks.length) {
        toks.sort((a, b) => g.distance(here, a) - g.distance(here, b));
        return { goals: toks, actions: ['pick', 'install'] };
      }
      if (carried > 0) return { goals: [clock], actions: ['install'] };
      return { actions: ['pick'] };
    },
    traitor: (g) => {
      const hs = g.heroes();
      const carriers = hs.filter((h) => parts(g, h) > 0);
      return { goals: (carriers.length ? carriers : hs).map((h) => g.p(h).tile), actions: ['freeze'] };
    },
    monster: (g) => {
      const hs = g.heroes();
      const carriers = hs.filter((h) => parts(g, h) > 0);
      return { goals: [...(carriers.length ? carriers : hs).map((h) => g.p(h).tile)] };
    },
  },
};
