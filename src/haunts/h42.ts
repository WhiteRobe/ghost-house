import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 42 族谱血书（百年诅咒 × 旧日记）：大乱斗 */

const NEED = 3;

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌开一个洞，露出通往地下室的石阶', 'info');
  }
}

const hall = (g: Game): string => g.hv.hall ?? 'G:0,0';
const holder = (g: Game): number | null => (g.hv.holder ?? null) as number | null;
const names = (g: Game): Record<string, number> => g.hv.names as Record<string, number>;

function bookTile(g: Game): string | null {
  const h = holder(g);
  if (h != null) return g.p(h).tile;
  return g.tokens('bloodbook')[0]?.tile ?? null;
}

function updateTrack(g: Game) {
  let best = 0;
  for (const v of Object.values(names(g))) best = Math.max(best, v);
  g.setTrack('族谱上写得最多的名字', best, NEED);
}

function drop(g: Game, s: number) {
  if (holder(g) !== s) return;
  g.hv.holder = null;
  g.token(g.p(s).tile, 'bloodbook', '血书', { icon: 'book' });
  g.log(`血书从 ${g.p(s).name} 手里掉在了${g.tileName(g.p(s).tile)}`, 'info');
}

export const h42: HauntDef = {
  id: 42,
  title: '族谱血书',
  type: 'ffa',
  traitor: { type: 'none' },
  intro: '旧日记的最后一页夹着一张发黑的族谱，末尾空着一行，墨迹是暗红色的。祠堂里所有的牌位同时转了过来，对着你们。这家只能再续一个人的香火——谁的名字落在血书上，谁就能活着走出去，其余的人都会被抹掉。',
  hero: {
    goal: '抢到血书，在祠堂把你的名字写上族谱。',
    rules: [
      '这是大乱斗：没有阵营，所有人都可以互相攻击。',
      '血书以标记的形式出现在离祠堂很远的房间（祠堂若尚未出现，会立即出现在一楼）。',
      '特殊行动「拿起血书」：在血书所在的房间拿起它。',
      '特殊行动「夺书」：与持书者在同一房间时，用力量对他发起攻击；你赢了就夺走血书（对方照常受到伤害）。这算作你本回合的攻击。',
      `特殊行动「写名字」：持书在祠堂时进行知识 4+ 检定，成功则你的名字多写下一笔。无论成败，你都要失去 1 点力量（以血为墨）。累计 ${NEED} 笔即可获胜。`,
      '已经写下的笔画不会因为血书易手而消失。持书者死亡时，血书掉落在他所在的房间。',
    ],
    win: '最后一笔落下，血书上的字迹慢慢渗进纸里。祠堂的门自己开了——只为一个人开。',
  },
  traitorSide: {
    goal: '抢到血书，在祠堂把你的名字写上族谱。',
    rules: [
      '这是大乱斗：没有阵营，所有人都可以互相攻击。',
      '血书以标记的形式出现在离祠堂很远的房间（祠堂若尚未出现，会立即出现在一楼）。',
      '特殊行动「拿起血书」：在血书所在的房间拿起它。',
      '特殊行动「夺书」：与持书者在同一房间时，用力量对他发起攻击；你赢了就夺走血书（对方照常受到伤害）。这算作你本回合的攻击。',
      `特殊行动「写名字」：持书在祠堂时进行知识 4+ 检定，成功则你的名字多写下一笔。无论成败，你都要失去 1 点力量（以血为墨）。累计 ${NEED} 笔即可获胜。`,
      '已经写下的笔画不会因为血书易手而消失。持书者死亡时，血书掉落在他所在的房间。',
      '如果只剩你一个人活着，你也获胜。',
    ],
    win: '最后一笔落下，血书上的字迹慢慢渗进纸里。祠堂的门自己开了——只为一个人开。',
  },
  *setup(g) {
    ensureBasement(g);
    const h = g.placeRoom('ancestral-hall') ?? 'G:0,0';
    g.hv.hall = h;
    g.hv.holder = null;
    g.hv.names = {};
    const pool = Object.keys(g.state.tiles).filter((k) => k !== h && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(pool);
    pool.sort((a, b) => g.distance(h, b) - g.distance(h, a));
    // 在最远的几个房间里随机挑一个
    const far = pool.slice(0, Math.min(3, pool.length));
    const at = far.length ? far[g.rng.int(far.length)] : 'U:0,-2';
    g.token(at, 'bloodbook', '血书', { icon: 'book' });
    g.log(`血书出现在了${g.tileName(at)}`, 'haunt');
    updateTrack(g);
  },
  actions: [
    {
      id: 'take', side: 'any', label: '拿起血书', desc: '拿起本房间的血书',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'bloodbook').length > 0,
      *run(g, s) {
        for (const t of g.tokensAt(g.p(s).tile, 'bloodbook')) g.removeToken(t.id);
        g.hv.holder = s;
        g.log(`${g.p(s).name} 拿起了血书`, 'haunt');
      },
    },
    {
      id: 'snatch', side: 'any', label: '夺书', desc: '用力量攻击持书者，赢了就夺走血书',
      can: (g, s) => {
        const h = holder(g);
        return h != null && h !== s && !g.attacked && g.p(h).tile === g.p(s).tile;
      },
      *run(g, s) {
        const h = holder(g)!;
        g.attacked = true;
        const r = yield* g.attack({ seat: s }, { seat: h });
        if (r.winner && 'seat' in r.winner && r.winner.seat === s && !g.p(s).dead) {
          if (holder(g) === h) {
            g.hv.holder = s;
            g.log(`${g.p(s).name} 从 ${g.p(h).name} 手里夺走了血书`, 'haunt');
          } else {
            for (const t of g.tokensAt(g.p(s).tile, 'bloodbook')) g.removeToken(t.id);
            g.hv.holder = s;
            g.log(`${g.p(s).name} 捡起了血书`, 'haunt');
          }
        }
      },
    },
    {
      id: 'write', side: 'any', label: '写名字', desc: `知识 4+ 检定，在族谱上写下一笔（失去 1 点力量）`,
      can: (g, s) => holder(g) === s && g.p(s).tile === hall(g),
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '写名字 4+');
        if (r >= 4) {
          const n = names(g);
          n[s] = (n[s] ?? 0) + 1;
          g.log(`${g.p(s).name} 的名字在族谱上多了一笔（${n[s]}/${NEED}）`, 'haunt');
          updateTrack(g);
        } else g.log('笔尖的血凝住了，什么也没写出来', 'info');
        if (names(g)[s] >= NEED) return;
        yield* g.lose(s, 'might', 1);
      },
    },
  ],
  *onDeath(g, s) {
    drop(g, s);
  },
  checkWin(g) {
    for (const [k, v] of Object.entries(names(g))) {
      const s = Number(k);
      if (v >= NEED && !g.p(s).dead) return { side: 'solo', seats: [s], text: `${g.p(s).name} 的名字落在了族谱最后一行。祠堂的门自己开了——只为一个人开。` };
    }
    return null;
  },
  ai: {
    hero: (g, s) => {
      const h = holder(g);
      if (h === s) {
        // 力量快见底就先别写，躲着走
        if (g.value(s, 'might') <= 1 && (names(g)[s] ?? 0) < NEED - 1) return { goals: [hall(g)], actions: [], attack: false };
        return { goals: [hall(g)], actions: ['write'], attack: false };
      }
      const t = bookTile(g);
      return { goals: t ? [t] : [hall(g)], actions: ['take', 'snatch'], targets: h != null ? [h] : undefined };
    },
  },
};
