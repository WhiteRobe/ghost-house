import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 33 补偿款（拆迁前夜 × 旧日记） */

const EXIT = 'G:0,0';

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，底下是通往地下室的石阶', 'haunt');
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
  intro: '日记里夹着一张发黄的房契，背面写着：“这房子底下的地，是我们家的。”拆迁补偿款按地契给，谁凑齐证据，钱就归谁。你们在走廊里互相看了一眼，有人把手电关了。',
  hero: {
    goal: '凑齐 4 页证据，带着它们走出门厅。',
    rules: [
      '大乱斗：每个人只为自己，可以互相攻击。',
      '证据页（标记）一共有人数 × 3 张，散在门厅以外的房间，离门厅越远放得越多。',
      '进入有证据页的房间，或在那里开始回合时，自动捡起 1 页。每回合最多捡 1 页。',
      '特殊行动「抢证据」（每回合一次）：选同一房间里一名有证据页的人，双方各掷力量骰。你点数高：抢走他 1 页，他不受伤。他点数高：你受到差值的物理伤害。平手：什么也不发生。',
      '有人死亡时，他身上的证据页全部掉在原地，谁都能去捡。',
      '特殊行动「走出门厅」：你有至少 4 页证据时，在门厅执行，你独自获胜。',
      '只剩你一个人活着，你也获胜。',
    ],
    win: '你推开门厅的铁门，天已经亮了，手里攥着一沓发黄的纸。身后楼里还有人在吵。',
  },
  traitorSide: {
    goal: '凑齐 4 页证据，带着它们走出门厅。',
    rules: [
      '大乱斗：每个人只为自己，可以互相攻击。',
      '证据页（标记）一共有人数 × 3 张，散在门厅以外的房间，离门厅越远放得越多。',
      '进入有证据页的房间，或在那里开始回合时，自动捡起 1 页。每回合最多捡 1 页。',
      '特殊行动「抢证据」（每回合一次）：选同一房间里一名有证据页的人，双方各掷力量骰。你点数高：抢走他 1 页，他不受伤。他点数高：你受到差值的物理伤害。平手：什么也不发生。',
      '有人死亡时，他身上的证据页全部掉在原地，谁都能去捡。',
      '特殊行动「走出门厅」：你有至少 4 页证据时，在门厅执行，你独自获胜。',
      '只剩你一个人活着，你也获胜。',
    ],
    win: '你推开门厅的铁门，天已经亮了，手里攥着一沓发黄的纸。身后楼里还有人在吵。',
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
      id: 'leave', side: 'any', label: '走出门厅', desc: '有至少 4 页证据时，在门厅执行：你独自获胜',
      can: (g, s) => g.p(s).tile === EXIT && pages(g, s) >= g.hv.need,
      *run(g, s) {
        g.hv.winner = s;
      },
    },
    {
      id: 'rob', side: 'any', label: '抢证据', desc: '和同房间一名有证据的人比力量骰：赢了抢走 1 页，输了受到差值的物理伤害',
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
        } else g.log(`两人扭成一团，谁也没抢到（${a} 对 ${d}）`, 'info');
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
    if (g.hv.winner != null) return { side: 'solo', seats: [g.hv.winner], text: `${g.p(g.hv.winner).name} 带着证据走出了门厅。天已经亮了，身后楼里还有人在吵。` };
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
