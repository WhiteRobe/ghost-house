import type { HauntDef } from '../engine/defs';

/** 46 纸人娶亲（事件「唢呐声」触发） */
export const h46: HauntDef = {
  id: 46,
  title: '纸人娶亲',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '唢呐越吹越近，一顶纸扎的花轿落在门厅正中，轿帘掀着，里面是空的。揭示者脸上多了两团腮红，圆圆的，像画上去的。',
  hero: {
    goal: '撕掉房子里所有的「喜」字。',
    rules: [
      '异变开始时，房子里随机 3 个房间各贴着一张「喜」字，计数轨显示还剩几张。背叛者能补贴，但场上最多 3 张。',
      '特殊行动「撕喜字」：在有「喜」字的房间执行，知识检定 4+，成功撕掉它。全部撕完，你们获胜。',
      '纸轿夫（速度 3、力量 4）受伤只会被击晕。幸存者死亡人数达到 1 人（3/4 人局）或 2 人（5/6 人局），背叛者获胜。杀死背叛者不会让你们获胜。',
    ],
    win: '最后一张「喜」字撕下来，花轿“噗”地烧成了灰，唢呐卡在半个音上没了。',
  },
  traitorSide: {
    goal: '让幸存者“上轿”（死亡）：3/4 人局 1 人，5/6 人局 2 人。',
    rules: [
      '你控制纸轿夫（速度 3、力量 4，3/4 人局 2 个，5/6 人局 3 个），它们在你的回合之后行动。',
      '特殊行动「贴喜字」：在没有「喜」字的房间执行，理智检定 4+，成功贴上一张。场上最多 3 张；一张都不剩时你已经输了。',
      '你可以无视房间的有害效果。「喜」字全部被撕掉，你失败。',
    ],
    win: '花轿抬起来了，轿帘放下，里面坐着人。唢呐又响起来，一路吹进了墙里。',
  },
  monsters: {
    bearer: { name: '纸轿夫', icon: 'bearer', speed: 3, might: 4 },
  },
  *setup(g) {
    const traitor = g.traitor()!;
    const tiles = Object.keys(g.state.tiles).filter((k) => k !== g.p(traitor).tile);
    g.rng.shuffle(tiles);
    for (const k of tiles.slice(0, 3)) g.token(k, 'xi', '喜', { icon: 'xi' });
    const n = g.scale(2, 2, 3, 3);
    for (let i = 0; i < n; i++) g.spawn('bearer', g.p(traitor).tile);
    g.setTrack('剩余「喜」字', g.tokens('xi').length);
    g.hv.dead = 0;
  },
  actions: [
    {
      id: 'tear', side: 'hero', label: '撕喜字', desc: '知识检定 4+：撕掉这个房间的「喜」字',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'xi').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '撕喜字 4+');
        if (r < 4) return;
        for (const t of g.tokensAt(g.p(s).tile, 'xi')) g.removeToken(t.id);
        g.setTrack('剩余「喜」字', g.tokens('xi').length);
        g.log(`${g.p(s).name} 撕下了一张「喜」字`, 'good');
      },
    },
    {
      id: 'post', side: 'traitor', label: '贴喜字', desc: '理智检定 4+：在这个房间贴一张「喜」字',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'xi').length === 0 && g.tokens('xi').length < 3 && g.tokens('xi').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '贴喜字 4+');
        if (r < 4) return;
        g.token(g.p(s).tile, 'xi', '喜', { icon: 'xi' });
        g.setTrack('剩余「喜」字', g.tokens('xi').length);
        g.log('墙上又多了一张「喜」字', 'bad');
      },
    },
  ],
  *onDeath(g) {
    g.hv.dead = (g.hv.dead ?? 0) + 1;
  },
  checkWin(g) {
    if (g.tokens('xi').length === 0) return { side: 'hero' };
    const need = g.scale(1, 1, 2, 2);
    const heroDead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (heroDead >= need) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g) => ({ goals: g.tokens('xi').map((t) => t.tile), actions: ['tear'] }),
    traitor: (g) => ({ goals: g.heroes().map((s) => g.p(s).tile), actions: ['post'] }),
  },
};
