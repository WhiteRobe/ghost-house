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
  intro: '桃木剑上的符文一道接一道烧黑了。揭示者手背上的皮裂开口子，屋里热得像蒸笼。他扯开衣领，胸口有三个旧疤，都是钉子的形状。你们那个失踪的朋友，就是在阁楼里被这股热气烤干的。',
  hero: {
    goal: '找到三根桃木钉，全部钉进旱魃（背叛者）身上；或者杀死他。',
    rules: [
      '地下室、一楼、二楼各有一个房间放着一根桃木钉（标记）。',
      '特殊行动「拾钉」（每回合一次）：在有桃木钉的房间拿起 1 根。你可以带好几根。你死亡时，身上的钉子全部掉在你所在的房间。',
      '特殊行动「钉入」（算作你本回合的攻击）：身上有桃木钉、和背叛者在同一房间时，用力量攻击他。你赢了，照常造成伤害，并钉入 1 根钉子；你输了，钉子还在你身上。',
      '热浪：背叛者的回合结束时，和他在同一房间的每名幸存者受到 1 点物理伤害。你在背叛者所在的房间结束回合时，也受到 1 点物理伤害。',
      '钉入 3 根，或背叛者死亡，你们获胜。旱尸（怪物）被击败时只会被击晕。',
    ],
    win: '第三根钉子敲进去，旱魃干嚎了一声，塌成一地焦土。窗外下雨了。',
  },
  traitorSide: {
    goal: '杀死足够多的幸存者：3/4 人局 2 人，5/6 人局 3 人。',
    rules: [
      '异变开始时你力量 +1。你控制旱尸（3/4 人局 1 只，5/6 人局 2 只），它们在你的回合之后行动，被击败时只会被击晕。',
      '热浪：你的回合结束时，和你在同一房间的每名幸存者受到 1 点物理伤害。幸存者在你所在的房间结束回合时，也受到 1 点物理伤害。',
      '特殊行动「扑咬」（算作你本回合的攻击）：攻击同一房间里一名带着桃木钉的幸存者。你赢了，照常造成伤害，并把他的 1 根钉子打飞到随机一个其他房间。',
      '被钉入 3 根桃木钉，或者你死亡，你就输了。',
    ],
    win: '水缸见了底。房子没起火，墙一摸烫手。',
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
      id: 'nail', side: 'hero', label: '钉入', desc: '身上有钉子时攻击背叛者，赢了钉入 1 根',
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
        g.log(`${g.p(s).name} 把一根桃木钉敲进了旱魃的胸口`, 'good');
      },
    },
    {
      id: 'bite', side: 'traitor', label: '扑咬', desc: '攻击同房间带钉子的幸存者，赢了打飞他 1 根钉子',
      can: (g, s) => !g.attacked && g.heroes().some((h) => g.p(h).tile === g.p(s).tile && nails(g, h) > 0),
      *run(g, s) {
        const list = g.heroes().filter((h) => g.p(h).tile === g.p(s).tile && nails(g, h) > 0);
        const h = yield* g.choosePlayer(s, '扑向谁？', list);
        if (h == null) return;
        g.attacked = true;
        g.reveal('背叛者「扑咬」赢了，会把对方的 1 根桃木钉打飞到随机房间。');
        const r = yield* g.attack({ seat: s }, { seat: h });
        if (!r.winner || !('seat' in r.winner) || r.winner.seat !== s || nails(g, h) <= 0) return;
        if (g.p(h).dead) return;
        const tiles = Object.keys(g.state.tiles).filter((k) => k !== g.p(s).tile && g.distance('G:0,0', k) < Infinity);
        const k = tiles.length ? tiles[g.rng.int(tiles.length)] : g.p(s).tile;
        dropNail(g, h, k);
        g.log(`桃木钉被打飞，掉进了「${g.tileName(k)}」`, 'bad');
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
