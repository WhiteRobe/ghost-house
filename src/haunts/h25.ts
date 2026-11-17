import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';
import type { Floor } from '../shared/types';

/** 25 桃木钉（失踪的朋友 × 桃木剑） */

const LANDING: Record<Floor, string> = { B: 'B:0,-2', G: 'G:0,-1', U: 'U:0,-2' };
const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function reachable(g: Game, key: string) {
  if (g.distance('G:0,0', key) < Infinity) return;
  const f = key[0] as Floor;
  if (f === 'B') g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', key) < Infinity) return;
  if (f === 'B' && g.distance('G:0,0', 'B:0,-2') === Infinity) g.link('G:0,-1', 'B:0,-2');
  if (g.distance('G:0,0', key) === Infinity) g.link(LANDING[f], key);
}

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

const nails = (g: Game, s: number) => (g.p(s).flags.nails as number) ?? 0;

function track(g: Game) {
  g.setTrack('钉入的桃木钉', g.hv.driven ?? 0, 3);
}

function dropNail(g: Game, s: number, k: string) {
  g.p(s).flags.nails = nails(g, s) - 1;
  g.token(k, 'nail', '桃木钉', { icon: 'nail' });
}

export const h25: HauntDef = {
  id: 25,
  title: '桃木钉',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '桃木剑上的符文一道道褪成焦黑。揭示者的皮肤开始干裂，像晒了一百个夏天的河床，房里的温度陡然升高——他胸口有三个旧伤疤，形状正好是钉子。你们的朋友，就是被这股热浪烤干在阁楼里的。',
  hero: {
    goal: '找到散落的三根桃木钉，在与旱魃搏斗得手时把它们一根根钉回他身上。',
    rules: [
      '三根桃木钉（标记）分别藏在地下室、一楼和二楼的某个房间里。',
      '特殊行动「拾钉」：在有桃木钉的房间拿起它（可以携带多根）。携带者死亡时，钉子掉在原地。',
      '特殊行动「钉入」（代替本回合的攻击）：携带桃木钉、与背叛者同格时用力量攻击他；若你获胜，除了正常造成伤害，还钉入一根桃木钉。',
      '热浪：背叛者的回合结束时，与他同格的每名幸存者受到 1 点物理伤害；你在背叛者所在的房间结束回合时，也受到 1 点物理伤害。',
      '旱魃（背叛者）死亡也算你们获胜。「旱尸」被击败时只会被击晕。',
    ],
    win: '第三根桃木钉没入胸口，旱魃发出一声干裂的嘶吼，碎成了一地焦土。窗外下起了雨。',
  },
  traitorSide: {
    goal: '把这栋房子烤成一座窑：杀死足够多的幸存者（3/4 人局 2 人，5/6 人局 3 人；或者杀光所有幸存者）。',
    rules: [
      '异变开始时你力量 +1。你控制「旱尸」，它们在你的回合之后行动，被击败时只会被击晕。',
      '热浪：你的回合结束时，与你同格的每名幸存者受到 1 点物理伤害；幸存者在你所在的房间结束回合时也会受到 1 点物理伤害。',
      '特殊行动「扑咬」（代替本回合的攻击）：攻击同格一名携带桃木钉的幸存者；若你获胜，除了正常造成伤害，他身上的一根桃木钉被打飞到随机房间。',
      '被钉入三根桃木钉或死亡，你就输了。',
    ],
    win: '最后一滴水汽也蒸干了。房子安安静静地烧着，没有火苗，只有越来越烫的墙。',
  },
  monsters: {
    corpse: { name: '旱尸', icon: 'corpse', speed: 2, might: 4 },
  },
  *setup(g) {
    const t = g.traitor()!;
    g.hv.driven = 0;
    const used: string[] = [];
    const extra: Record<Floor, string[]> = {
      B: ['crypt', 'morgue', 'storeroom', 'wine-cellar'],
      G: ['ancestral-hall', 'servants', 'dining', 'garden'],
      U: ['attic', 'master-bedroom', 'nursery', 'dressing'],
    };
    for (const f of ['B', 'G', 'U'] as Floor[]) {
      const k = spot(g, f, used, extra[f]);
      used.push(k);
      g.token(k, 'nail', '桃木钉', { icon: 'nail' });
    }
    yield* g.gain(t, 'might', 1);
    const n = g.scale(1, 1, 2, 2);
    for (let i = 0; i < n; i++) g.spawn('corpse', g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'pick', side: 'hero', label: '拾钉', desc: '拿起本房间的桃木钉',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'nail').length > 0,
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'nail')[0];
        if (!t) return;
        g.removeToken(t.id);
        g.p(s).flags.nails = nails(g, s) + 1;
        g.log(`${g.p(s).name} 拾起了一根桃木钉`, 'good');
      },
    },
    {
      id: 'nail', side: 'hero', label: '钉入', desc: '携带桃木钉：攻击背叛者，获胜则钉入一根',
      can: (g, s) => {
        const t = g.traitor();
        return t != null && !g.attacked && nails(g, s) > 0 && g.p(t).tile === g.p(s).tile && !g.p(t).dead;
      },
      *run(g, s) {
        const t = g.traitor()!;
        g.attacked = true;
        const r = yield* g.attack({ seat: s }, { seat: t });
        if (!r.winner || !('seat' in r.winner) || r.winner.seat !== s || g.p(s).dead) return;
        g.p(s).flags.nails = nails(g, s) - 1;
        g.hv.driven = (g.hv.driven ?? 0) + 1;
        track(g);
        g.log(`${g.p(s).name} 把一根桃木钉狠狠钉进了旱魃的胸口！`, 'good');
      },
    },
    {
      id: 'bite', side: 'traitor', label: '扑咬', desc: '攻击同格携带桃木钉的幸存者，获胜则打飞一根钉子',
      can: (g, s) => !g.attacked && g.heroes().some((h) => g.p(h).tile === g.p(s).tile && nails(g, h) > 0),
      *run(g, s) {
        const list = g.heroes().filter((h) => g.p(h).tile === g.p(s).tile && nails(g, h) > 0);
        const h = yield* g.choosePlayer(s, '扑向谁？', list);
        if (h == null) return;
        g.attacked = true;
        g.reveal('背叛者「扑咬」得手时，会把对方身上的桃木钉打飞到随机房间。');
        const r = yield* g.attack({ seat: s }, { seat: h });
        if (!r.winner || !('seat' in r.winner) || r.winner.seat !== s || nails(g, h) <= 0) return;
        if (g.p(h).dead) return;
        const tiles = Object.keys(g.state.tiles).filter((k) => k !== g.p(s).tile && g.distance('G:0,0', k) < Infinity);
        const k = tiles.length ? tiles[g.rng.int(tiles.length)] : g.p(s).tile;
        dropNail(g, h, k);
        g.log(`桃木钉被打飞了，落进了${g.tileName(k)}`, 'bad');
      },
    },
  ],
  *onTurnEnd(g, s) {
    const t = g.traitor();
    if (t == null || g.p(t).dead) return;
    if (s === t) {
      for (const h of g.heroes()) if (g.p(h).tile === g.p(t).tile) yield* g.damage(h, 'physical', 1, '旱魃的热浪', t);
    } else if (!g.isTraitor(s) && g.p(s).tile === g.p(t).tile) {
      yield* g.damage(s, 'physical', 1, '旱魃的热浪', t);
    }
  },
  *onDeath(g, s) {
    const n = nails(g, s);
    for (let i = 0; i < n; i++) dropNail(g, s, g.p(s).tile);
  },
  *onRoundEnd(g) {
    for (const s of g.alive()) reachable(g, g.p(s).tile);
    for (const t of g.tokens('nail')) reachable(g, t.tile);
  },
  checkWin(g) {
    if ((g.hv.driven ?? 0) >= 3) return { side: 'hero' };
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    const dead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (dead >= g.scale(2, 2, 3, 3)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const t = g.traitor();
      const here = g.p(s).tile;
      const toks = g.tokens('nail').map((x) => x.tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      if (t == null) return {};
      // 带钉的人去找旱魃，没钉的人先去找钉
      if (nails(g, s) > 0 && (!toks.length || nails(g, s) >= 2 || g.distance(here, g.p(t).tile) <= g.distance(here, toks[0]))) {
        return { goals: [g.p(t).tile], actions: ['nail', 'pick'], targets: [t] };
      }
      if (toks.length) return { goals: toks, actions: ['pick', 'nail'] };
      return { goals: [g.p(t).tile], actions: ['nail'], targets: [t] };
    },
    traitor: (g) => {
      const hs = g.heroes();
      hs.sort((a, b) => nails(g, b) - nails(g, a) || g.value(a, 'might') - g.value(b, 'might'));
      return { goals: hs.map((h) => g.p(h).tile), actions: ['bite'] };
    },
  },
};
