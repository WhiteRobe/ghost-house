import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const pagesNeed = (g: Game) => g.scale(4, 5, 6, 6);
const killNeed = (g: Game) => g.scale(1, 2, 2, 3);

function libraryTile(g: Game): string {
  if (g.hv.library && g.state.tiles[g.hv.library]) return g.hv.library;
  const k = g.placeRoom('library') ?? g.placeRoom('tea-room') ?? 'G:0,-1';
  g.hv.library = k;
  return k;
}

function pick(g: Game, s: number) {
  const toks = g.tokensAt(g.p(s).tile, 'h6-page').slice(0, 1);
  if (!toks.length) return;
  for (const t of toks) g.removeToken(t.id);
  g.hv.pages = (g.hv.pages ?? 0) + toks.length;
  sync(g);
  g.log(`${g.p(s).name} 捡到了 ${toks.length} 张日记残页`, 'good');
}

function sync(g: Game) {
  g.setTrack('收集到的日记残页', g.hv.pages ?? 0, pagesNeed(g));
}

/** 6 预言日记（直播 × 旧日记） */
export const h6: HauntDef = {
  id: 6,
  title: '预言日记',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '旧日记自己翻到了空白的一页，墨迹一点点洇出来：今晚的日期，后面跟着一个房间的名字。背叛者捧着日记，嘴唇跟着字一张一合。',
  hero: {
    goal: '凑齐日记残页，然后在书房把日记烧掉。',
    rules: [
      '房子里散落着「日记残页」标记，比你们要凑的数量多 1 张。要凑的数量看计数轨：3 人局 4 张，4 人局 5 张，5、6 人局 6 张。',
      '特殊行动「拾起残页」：在有残页的房间知识检定 4+，成功捡起 1 张，计数轨大家共用。',
      '书房一定会出现（放不下时换成茶室或别的房间），位置会公开。',
      '残页凑够后，特殊行动「焚烧日记」：在书房理智检定 4+，成功你们就赢了。杀死背叛者不算获胜。',
      '背叛者每轮可以秘密写下一个有幸存者的房间。写下后的那一轮结束时预言公开，留在那个房间的每名幸存者受到 4 点伤害（可以分摊到任意属性）。日志里出现「日记上又多了一行字」，就说明有人被写上了。',
      '别在同一个房间连着待两轮。',
    ],
    win: '日记扔进火盆，纸页卷起来，最后一行字没写完就烧没了。',
  },
  traitorSide: {
    goal: '杀死足够多的幸存者：3 人局 1 人，4、5 人局 2 人，6 人局 3 人。',
    rules: [
      '特殊行动「写下预言」：秘密选择一个此刻有幸存者的房间。写下后的那一轮结束时预言公开，留在那里的每名幸存者受到 4 点伤害（可以分摊到任意属性）。结算前不能再写新的。',
      '特殊行动「撕毁残页」：在有残页的房间知识检定 4+，成功把它撕掉。场上剩下的残页只比幸存者还缺的数量多时才能撕。',
      '你可以正常攻击幸存者。',
      '幸存者凑齐残页后在书房通过理智检定 4+，你就输了。',
    ],
    win: '最后一行字写完了。日记合上，封皮上多了几个名字，墨还没干。',
  },
  *setup(g) {
    g.placeRoom('cellar-hatch');
    const lib = libraryTile(g);
    const t = g.traitor()!;
    const all = Object.keys(g.state.tiles).filter((k) => !START.includes(k) && k !== lib && k !== g.p(t).tile);
    g.rng.shuffle(all);
    // 远离门厅的房间优先
    all.sort((a, b) => Math.min(g.distance('G:0,0', b), 20) - Math.min(g.distance('G:0,0', a), 20));
    const n = pagesNeed(g) + 1;
    const spots = all.slice(0, n);
    while (spots.length < n) spots.push(START[spots.length % START.length]);
    for (const k of spots) g.token(k, 'h6-page', '日记残页', { icon: 'page' });
    g.hv.pages = 0;
    g.reveal(`书房位于「${g.tileName(lib)}」`);
    sync(g);
  },
  actions: [
    {
      id: 'prophecy', side: 'traitor', label: '写下预言', desc: '秘密选择一个此刻有幸存者的房间，下一轮结束时留在那里的幸存者受到 4 点伤害',
      can: (g) => !g.hs.prophecy && g.heroes().length > 0,
      *run(g, s) {
        const tiles = [...new Set(g.heroes().map((o) => g.p(o).tile))];
        // 人最多的房间排在前面
        tiles.sort((a, b) => g.heroes().filter((o) => g.p(o).tile === b).length - g.heroes().filter((o) => g.p(o).tile === a).length);
        const k = yield* g.chooseTile(s, '在日记上写下哪个房间？', tiles);
        if (!k) return;
        g.hs.prophecy = k;
        g.log(`你在日记上写下了「${g.tileName(k)}」`, 'haunt', s, 'traitor');
        g.log('日记上又多了一行字', 'haunt');
      },
    },
    {
      id: 'tear', side: 'traitor', label: '撕毁残页', desc: '知识检定 4+，撕掉本房间的残页',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'h6-page').length > 0 && g.tokens('h6-page').length > pagesNeed(g) - (g.hv.pages ?? 0),
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '撕毁残页 4+');
        if (r < 4) return;
        g.removeToken(g.tokensAt(g.p(s).tile, 'h6-page')[0].id);
        g.log('一张日记残页被撕碎了', 'bad');
      },
    },
    {
      id: 'pick', side: 'hero', label: '拾起残页', desc: '知识检定 4+，捡起本房间的 1 张残页',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'h6-page').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '辨认残页 4+');
        if (r >= 4) pick(g, s);
        else g.log('纸上的字一看就往旁边跑，认不出来', 'bad');
      },
    },
    {
      id: 'burn', side: 'hero', label: '焚烧日记', desc: '在书房理智检定 4+，成功即获胜',
      can: (g, s) => (g.hv.pages ?? 0) >= pagesNeed(g) && g.p(s).tile === libraryTile(g),
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '焚烧日记 4+');
        if (r >= 4) g.hv.burned = true;
        else g.log('火苗舔了舔纸页，又缩了回去', 'bad');
      },
    },
  ],
  *onRoundEnd(g) {
    const k = g.hs.due as string | undefined;
    g.hs.due = g.hs.prophecy ?? null;
    g.hs.prophecy = null;
    if (!k) return;
    g.reveal(`日记上的预言：「${g.tileName(k)}」`);
    const victims = g.heroes().filter((o) => g.p(o).tile === k);
    if (!victims.length) { g.log('预言落空了，那个房间里没人', 'good'); return; }
    for (const v of victims) yield* g.damage(v, 'general', 4, '预言应验', g.traitor());
  },
  checkWin(g) {
    if (g.hv.burned) return { side: 'hero' };
    const all = g.heroes(true);
    const dead = all.filter((s) => g.p(s).dead).length;
    if (dead >= Math.min(all.length, killNeed(g))) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const here = g.p(s).tile;
      if ((g.hv.pages ?? 0) >= pagesNeed(g)) return { goals: [libraryTile(g)], actions: ['burn'] };
      const goals = g.tokens('h6-page').map((t) => t.tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      return { goals, actions: ['pick', 'burn'] };
    },
    traitor: (g, s) => {
      const here = g.p(s).tile;
      const pages = g.tokens('h6-page').map((t) => t.tile);
      const actions = ['prophecy', 'tear'];
      if (pages.includes(here) || g.heroes().every((o) => g.distance(here, g.p(o).tile) > 3)) {
        const goals = [...pages, ...g.heroes().map((o) => g.p(o).tile)].sort((a, b) => g.distance(here, a) - g.distance(here, b));
        return { goals, actions };
      }
      return { goals: g.heroes().map((o) => g.p(o).tile), actions };
    },
  },
};
