import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 33 补偿款（拆迁前夜 × 旧日记） */

const EXIT = 'G:0,0';

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，露出通往地下室的石阶', 'haunt');
  }
}

const pages = (g: Game, s: number) => Number(g.p(s).flags.pages ?? 0);
const setPages = (g: Game, s: number, n: number) => { g.p(s).flags.pages = n; };

function track(g: Game) {
  g.setTrack('散落的证据页', g.tokens('page').length);
}

function pickUp(g: Game, s: number) {
  const p = g.p(s);
  if (p.dead) return;
  if (p.flags.pickedRound === g.state.round) return;
  const here = g.tokensAt(p.tile, 'page');
  if (!here.length) return;
  g.removeToken(here[0].id);
  p.flags.pickedRound = g.state.round;
  setPages(g, s, pages(g, s) + 1);
  g.log(`${p.name} 捡起了 1 页证据（现有 ${pages(g, s)} 页）`, 'info');
  track(g);
}

export const h33: HauntDef = {
  id: 33,
  title: '补偿款',
  type: 'ffa',
  traitor: { type: 'none' },
  intro: '日记里夹着一张发黄的房契，还有一句话：“这房子底下的地，是我们家的。”谁能凑齐证据，谁就能拿走那笔天价拆迁补偿。走廊里，大家互相看了一眼，谁也没说话。',
  hero: {
    goal: '收集足够的证据页，带着它们走出门厅。',
    rules: [
      '这是大乱斗：每个人都只为自己，可以互相攻击。',
      '证据页（标记）散落在房子各处。进入有证据页的房间，或在那里开始回合时，自动捡起其中 1 页（每回合最多捡 1 页）。',
      '特殊行动「抢证据」：对同一房间里一名持有证据页的探险者发起力量攻击；你赢了就不造成伤害，改为抢走他 1 页证据（他输了也不受伤）。若你输了，照常受伤。',
      '探险者死亡时，身上的证据页全部掉在原地。',
      '特殊行动「走出门厅」：持有至少 4 页证据时在门厅执行，立即独自获胜。',
    ],
    win: '你推开门厅的铁门，晨光照在一沓发黄的纸上。身后的楼里传来争吵声，但那已经和你没有关系了。',
  },
  traitorSide: {
    goal: '收集至少 4 页证据页，带着它们走出门厅。',
    rules: [
      '这是大乱斗：每个人都只为自己，可以互相攻击。',
      '证据页（标记）散落在房子各处。进入有证据页的房间，或在那里开始回合时，自动捡起其中 1 页（每回合最多捡 1 页）。',
      '特殊行动「抢证据」：对同一房间里一名持有证据页的探险者发起力量攻击；你赢了就不造成伤害，改为抢走他 1 页证据（他输了也不受伤）。若你输了，照常受伤。',
      '探险者死亡时，身上的证据页全部掉在原地。',
      '特殊行动「走出门厅」：持有至少 4 页证据时在门厅执行，立即独自获胜。',
      '如果只剩你一个人活着，你也获胜。',
    ],
    win: '你推开门厅的铁门，晨光照在一沓发黄的纸上。身后的楼里传来争吵声，但那已经和你没有关系了。',
  },
  *setup(g) {
    connect(g);
    g.hv.need = 4;
    const tiles = Object.keys(g.state.tiles).filter((k) => k !== EXIT);
    g.rng.shuffle(tiles);
    const total = g.n * 3;
    // 离门厅越远越好：按距离排序后优先放远处
    const far = [...tiles].sort((a, b) => g.distance(EXIT, b) - g.distance(EXIT, a));
    for (let i = 0; i < total; i++) {
      const k = far.length ? far[i % far.length] : EXIT;
      g.token(k, 'page', '证据页', { icon: 'page' });
    }
    for (const p of g.state.players) setPages(g, p.seat, 0);
    // 开局就在证据页上的人不立即捡，等到回合开始
    track(g);
  },
  actions: [
    {
      id: 'leave', side: 'any', label: '走出门厅', desc: '持有 4 页以上证据：在门厅独自获胜',
      can: (g, s) => g.p(s).tile === EXIT && pages(g, s) >= g.hv.need,
      *run(g, s) {
        g.hv.winner = s;
      },
    },
    {
      id: 'rob', side: 'any', label: '抢证据', desc: '力量攻击同房间一名有证据的人；赢了抢走 1 页',
      can: (g, s) => g.playersAt(g.p(s).tile).some((o) => o !== s && pages(g, o) > 0),
      *run(g, s) {
        const list = g.playersAt(g.p(s).tile).filter((o) => o !== s && pages(g, o) > 0);
        list.sort((a, b) => pages(g, b) - pages(g, a));
        const t = yield* g.choosePlayer(s, '抢谁的证据？', list);
        if (t == null) return;
        const a = (yield* g.roll(g.value(s, 'might') + g.bonus(s, 'might', 'attack'), `${g.p(s).name} 抢夺`, s));
        const d = (yield* g.roll(g.value(t, 'might') + g.bonus(t, 'might', 'defend'), `${g.p(t).name} 护住`, t));
        if (a > d) {
          setPages(g, t, pages(g, t) - 1);
          setPages(g, s, pages(g, s) + 1);
          g.log(`${g.p(s).name} 从 ${g.p(t).name} 手里抢走 1 页证据（${a} 对 ${d}）`, 'bad');
        } else if (d > a) {
          g.log(`${g.p(t).name} 一把推开了 ${g.p(s).name}（${a} 对 ${d}）`, 'info');
          yield* g.damage(s, 'physical', d - a, '抢夺失败', t);
        } else g.log(`两人扭作一团，谁也没抢到（${a} 对 ${d}）`, 'info');
      },
    },
  ],
  *onTurnStart(g, s) {
    pickUp(g, s);
  },
  *onEnter(g, s) {
    pickUp(g, s);
  },
  *onDeath(g, s) {
    const n = pages(g, s);
    if (n <= 0) return;
    setPages(g, s, 0);
    for (let i = 0; i < n; i++) g.token(g.p(s).tile, 'page', '证据页', { icon: 'page' });
    g.log(`${g.p(s).name} 身上的 ${n} 页证据散落一地`, 'info');
    track(g);
  },
  checkWin(g) {
    if (g.hv.winner != null) return { side: 'solo', seats: [g.hv.winner], text: `${g.p(g.hv.winner).name} 带着证据走出了门厅。晨光照在一沓发黄的纸上，身后的楼里还传来争吵声，但那已经和你没有关系了。` };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const mine = pages(g, s);
      if (mine >= g.hv.need) return { goals: [EXIT], actions: ['leave'], attack: false };
      const here = g.p(s).tile;
      const loose = g.tokens('page').map((t) => t.tile);
      const rich = g.alive().filter((o) => o !== s && pages(g, o) > 0).map((o) => g.p(o).tile);
      // 先去最近的散页；没有散页了就去找持页最多的人
      const all = [...loose, ...rich].sort((a, b) => g.distance(here, a) - g.distance(here, b));
      const leader = g.alive().filter((o) => o !== s && pages(g, o) >= g.hv.need - 1);
      return {
        goals: all.length ? all : [EXIT],
        actions: ['rob'],
        attack: leader.length > 0,
        targets: leader,
      };
    },
  },
};
