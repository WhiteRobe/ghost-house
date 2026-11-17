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
  intro: '怀表的秒针“咔”地停了，窗外落到一半的槐花就挂在半空。失踪的朋友站在走廊尽头，抬着一只脚，一直没放下来。揭示者手里的怀表开始倒着走，他人走开了，影子还留在原地。',
  hero: {
    goal: '把 3 枚怀表零件全部带到钟楼装回去，或者杀死背叛者。',
    rules: [
      '地下室、一楼、二楼各有 1 枚「怀表零件」标记。钟楼还没被发现的话，异变开始时会直接放出来。',
      '特殊行动「拾零件」：拿起你所在房间的 1 枚零件，不用检定。一个人可以带好几枚。',
      '特殊行动「装零件」：在钟楼、身上带着零件时，知识检定 5+。成功：装回 1 枚。',
      '带着零件的人死亡时，零件掉在他死去的房间里，别人可以再捡。',
      '背叛者会「定格」你：理智检定 4+，失败就跳过你的下一个回合。跳过之后，到你再下一个回合开始前，他不能再定格你。',
      '背叛者带着停摆人（3/4 人局 1 个，5 人局 2 个，6 人局 3 个）。你们可以攻击背叛者和停摆人，停摆人被击败时只会被击晕。',
      '装回第 3 枚零件，或者背叛者死亡时，你们获胜。死去的幸存者达到 2 人（5/6 人局 3 人）时，你们失败。',
    ],
    win: '最后一枚齿轮咬上，钟楼的大钟“当”地响了一声。半空里的槐花落了一地，朋友那只脚踩了下来，喊出了你的名字。',
  },
  traitorSide: {
    goal: '杀死 2 名幸存者（5/6 人局 3 名），赶在他们装回 3 枚零件之前。',
    rules: [
      '你控制停摆人（3/4 人局 1 个，5 人局 2 个，6 人局 3 个），开始时在你的房间。它们在你的回合之后行动，被击败时只会被击晕。',
      '特殊行动「定格」：选 4 步以内一名幸存者，他理智检定 4+，失败就跳过他的下一个回合。他跳过之后，到他再下一个回合开始前，你不能再定格他。',
      '幸存者带着零件死去时，零件掉在原地。你看得到零件，但不能拿走或毁掉。',
      '幸存者装回第 3 枚零件，或者你死亡时，你失败。',
    ],
    win: '房子里所有的钟都停在三点十七分。走廊里多了几个人，抬手的抬手，张嘴的张嘴，一个都没动过。',
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
      id: 'pick', side: 'hero', label: '拾零件', desc: '拿起你所在房间的 1 枚零件',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'part').length > 0,
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'part')[0];
        if (!t) return;
        g.removeToken(t.id);
        g.p(s).flags.parts = parts(g, s) + 1;
        g.log(`${g.p(s).name} 捡起了一枚怀表零件`, 'good');
      },
    },
    {
      id: 'install', side: 'hero', label: '装零件', desc: '在钟楼知识检定 5+。成功：装回 1 枚零件',
      can: (g, s) => g.p(s).tile === g.hv.clock && parts(g, s) > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 5, '装零件 5+');
        if (r < 5) {
          g.log('齿轮对了半天，就是咬不上', 'info');
          return;
        }
        g.p(s).flags.parts = parts(g, s) - 1;
        g.hv.fixed = (g.hv.fixed ?? 0) + 1;
        track(g);
        g.log(`${g.p(s).name} 装回了一枚零件，钟摆晃了一下`, 'good');
      },
    },
    {
      id: 'freeze', side: 'traitor', label: '定格', desc: '选 4 步内一名幸存者，他理智检定 4+，失败就跳过下一个回合',
      can: (g, s) => g.heroes().some((h) => !g.p(h).flags.frozen && !g.p(h).flags.immune && g.distance(g.p(s).tile, g.p(h).tile) <= 4),
      *run(g, s) {
        const list = g.heroes().filter((h) => !g.p(h).flags.frozen && !g.p(h).flags.immune && g.distance(g.p(s).tile, g.p(h).tile) <= 4);
        const clock = g.hv.clock as string;
        list.sort((a, b) => parts(g, b) - parts(g, a) || g.distance(g.p(a).tile, clock) - g.distance(g.p(b).tile, clock));
        const h = yield* g.choosePlayer(s, '定格谁？', list);
        if (h == null) return;
        g.reveal('背叛者可以「定格」4 步内的幸存者：理智检定 4+，失败就跳过下一个回合。');
        const r = yield* g.check(h, 'sanity', 4, '抵抗定格 4+');
        if (r >= 4) {
          g.log(`${g.p(h).name} 一口咬破舌尖，脚又能动了`, 'good');
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
      g.log(`${p.name} 定在原地，这一回合动不了`, 'bad', s);
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
    g.log('零件叮叮当当滚了一地', 'info');
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
