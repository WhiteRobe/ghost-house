import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const need = (g: Game) => g.scale(3, 4, 4, 4);
const frags = (g: Game, s: number): number => Number(g.p(s).flags.h10 ?? 0);

function hallTile(g: Game): string {
  if (g.hv.hall && g.state.tiles[g.hv.hall]) return g.hv.hall;
  const k = g.placeRoom('main-hall') ?? g.placeRoom('dining') ?? 'G:0,-1';
  g.hv.hall = k;
  return k;
}

function setFrags(g: Game, s: number, n: number) {
  g.p(s).flags.h10 = Math.max(0, n);
}

function pickUp(g: Game, s: number) {
  const toks = g.tokensAt(g.p(s).tile, 'h10-frag');
  if (!toks.length) return;
  for (const t of toks) g.removeToken(t.id);
  setFrags(g, s, frags(g, s) + toks.length);
  g.log(`${g.p(s).name} 捡到了 ${toks.length} 片遗嘱（共 ${frags(g, s)} 片）`, 'info');
}

/** 10 遗嘱碎片（遗嘱宣读 × 铜镜）——大乱斗 */
export const h10: HauntDef = {
  id: 10,
  title: '遗嘱碎片',
  type: 'ffa',
  traitor: { type: 'none' },
  intro: '律师刚念出“兹将全部家产留给——”，铜镜里伸出一只枯手，把遗嘱撕得粉碎。纸片像白蛾一样飞散到洋楼的各个角落。镜子里的老太爷咯咯笑着：谁先把它拼起来念完，家产就归谁。你看了一眼身边的人，他们也正看着你。',
  hero: {
    goal: '集齐遗嘱碎片（3 人局 3 片，4 人以上 4 片），回到正厅宣读，独得遗产。',
    rules: [
      '人人为己：所有人都可以互相攻击，没有背叛者。',
      '房子里散落着若干片「遗嘱碎片」标记，进入有碎片的房间会自动捡起；已经在房间里时也可以用行动「捡碎片」。',
      '特殊行动「抢遗嘱」：与持有碎片的人同处一室时，双方各掷力量对抗；你点数更高就抢走他 1 片碎片，否则你受到 1 点物理伤害。',
      '死者身上的碎片会全部掉落在他所在的房间。',
      '特殊行动「宣读遗嘱」：碎片够数时在正厅进行知识 4+ 检定，成功即独自获胜。',
      '如果只剩一人存活，他同样独得遗产。',
    ],
    win: '你清了清嗓子，把拼好的遗嘱念完了最后一个字。镜子里的老太爷满意地点点头，消失了。整栋洋楼，从此归你。',
  },
  traitorSide: {
    goal: '集齐遗嘱碎片（3 人局 3 片，4 人以上 4 片），回到正厅宣读，独得遗产。',
    rules: [
      '人人为己：所有人都可以互相攻击，没有背叛者。',
      '房子里散落着若干片「遗嘱碎片」标记，进入有碎片的房间会自动捡起；已经在房间里时也可以用行动「捡碎片」。',
      '特殊行动「抢遗嘱」：与持有碎片的人同处一室时，双方各掷力量对抗；你点数更高就抢走他 1 片碎片，否则你受到 1 点物理伤害。',
      '死者身上的碎片会全部掉落在他所在的房间。',
      '特殊行动「宣读遗嘱」：碎片够数时在正厅进行知识 4+ 检定，成功即独自获胜。',
      '如果只剩一人存活，他同样独得遗产。',
    ],
    win: '你清了清嗓子，把拼好的遗嘱念完了最后一个字。镜子里的老太爷满意地点点头，消失了。整栋洋楼，从此归你。',
  },
  *setup(g) {
    g.placeRoom('cellar-hatch');
    const hall = hallTile(g);
    const all = Object.keys(g.state.tiles).filter((k) => !START.includes(k) && k !== hall);
    g.rng.shuffle(all);
    // 离正厅越远越先放
    all.sort((a, b) => Math.min(g.distance(hall, b), 20) - Math.min(g.distance(hall, a), 20));
    const n = g.n + 3;
    const spots = all.slice(0, n);
    while (spots.length < n) spots.push(START[spots.length % START.length]);
    for (const k of spots) g.token(k, 'h10-frag', '遗嘱碎片', { icon: 'page' });
    for (const s of g.alive()) setFrags(g, s, 0);
    g.reveal(`正厅位于「${g.tileName(hall)}」`);
    g.setTrack('散落的遗嘱碎片', g.tokens('h10-frag').length);
  },
  actions: [
    {
      id: 'pick', side: 'any', label: '捡碎片', desc: '捡起本房间的遗嘱碎片',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'h10-frag').length > 0,
      *run(g, s) {
        pickUp(g, s);
        g.setTrack('散落的遗嘱碎片', g.tokens('h10-frag').length);
      },
    },
    {
      id: 'rob', side: 'any', label: '抢遗嘱', desc: '与同房间持有碎片的人力量对抗，胜则抢走 1 片',
      can: (g, s) => g.alive().some((o) => o !== s && g.p(o).tile === g.p(s).tile && frags(g, o) > 0),
      *run(g, s) {
        const os = g.alive().filter((o) => o !== s && g.p(o).tile === g.p(s).tile && frags(g, o) > 0)
          .sort((a, b) => frags(g, b) - frags(g, a));
        const o = yield* g.choosePlayer(s, '抢谁的遗嘱？', os);
        if (o == null) return;
        const a = yield* g.check(s, 'might', undefined, '抢遗嘱');
        const d = yield* g.check(o, 'might', undefined, '护遗嘱');
        if (a > d) {
          setFrags(g, o, frags(g, o) - 1);
          setFrags(g, s, frags(g, s) + 1);
          g.log(`${g.p(s).name} 从 ${g.p(o).name} 手里抢走了一片遗嘱`, 'bad');
        } else {
          yield* g.damage(s, 'physical', 1, '抢夺失手', o);
        }
      },
    },
    {
      id: 'read', side: 'any', label: '宣读遗嘱', desc: '碎片够数时在正厅知识 4+ 检定，成功即获胜',
      can: (g, s) => frags(g, s) >= need(g) && g.p(s).tile === hallTile(g),
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '宣读遗嘱 4+');
        if (r >= 4) g.hv.heir = s;
        else g.log('纸片上的字迹模糊了，念不下去', 'info');
      },
    },
  ],
  *onEnter(g, s) {
    if (!g.tokensAt(g.p(s).tile, 'h10-frag').length) return;
    pickUp(g, s);
    g.setTrack('散落的遗嘱碎片', g.tokens('h10-frag').length);
  },
  *onDeath(g, s) {
    const n = frags(g, s);
    if (!n) return;
    setFrags(g, s, 0);
    for (let i = 0; i < n; i++) g.token(g.p(s).tile, 'h10-frag', '遗嘱碎片', { icon: 'page' });
    g.setTrack('散落的遗嘱碎片', g.tokens('h10-frag').length);
    g.log(`${n} 片遗嘱从 ${g.p(s).name} 身上散落下来`, 'info');
  },
  checkWin(g) {
    const h = g.hv.heir;
    if (h != null) return { side: 'solo', seats: [h], text: `${g.p(h).name} 念完了遗嘱。整栋洋楼，从此归他。` };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const here = g.p(s).tile;
      const mine = frags(g, s);
      if (mine >= need(g)) return { goals: [hallTile(g)], actions: ['read', 'pick'], attack: false };
      const loose = g.tokens('h10-frag').map((t) => t.tile);
      const rich = g.alive().filter((o) => o !== s && frags(g, o) > 0 && g.value(o, 'might') <= g.value(s, 'might') + 1).map((o) => g.p(o).tile);
      const goals = [...loose, ...rich].sort((a, b) => g.distance(here, a) - g.distance(here, b));
      // 碎片拿完了又抢不动别人，就去正厅堵人
      return { goals: goals.length ? goals : [hallTile(g)], actions: ['pick', 'rob'] };
    },
  },
};
