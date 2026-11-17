import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 28 推土机来了（拆迁前夜 × 铜镜） */

const ENTRANCE = 'G:0,0';
const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function landing(k: string) {
  return k[0] === 'B' ? 'B:0,-2' : k[0] === 'U' ? 'U:0,-2' : 'G:0,-1';
}

function reachable(g: Game, k: string) {
  if (g.distance(ENTRANCE, k) < Infinity) return;
  if (k[0] === 'B') g.placeRoom('cellar-hatch');
  if (g.distance(ENTRANCE, k) < Infinity) return;
  const l = landing(k);
  if (g.distance(ENTRANCE, l) === Infinity) g.link('G:0,-1', l);
  if (g.distance(ENTRANCE, k) === Infinity) g.link(l, k);
}

const escaped = (g: Game) => g.heroes(true).filter((s) => g.p(s).flags.escaped).length;
const killed = (g: Game) => g.heroes(true).filter((s) => g.p(s).dead && !g.p(s).flags.escaped).length;
const open = (g: Game) => (g.hv.pry ?? 0) >= g.hv.needPry;
const left = (g: Game) => Math.max(0, (g.hv.dawn as number) - (g.state.haunt?.round ?? 1) + 1);

function track(g: Game) {
  if (open(g)) g.setTrack(`前门已撬开 · 离天亮 ${left(g)} 轮 · 已逃出`, escaped(g), g.hv.needOut);
  else g.setTrack(`撬门进度 · 离天亮 ${left(g)} 轮`, g.hv.pry ?? 0, g.hv.needPry);
}

/** 离门厅最远的几个房间 */
function farTiles(g: Game): string[] {
  const all = Object.keys(g.state.tiles).filter((k) => g.distance(ENTRANCE, k) < Infinity && g.distance(ENTRANCE, k) >= 3);
  return all.length ? all : Object.keys(g.state.tiles).filter((k) => k !== ENTRANCE && g.distance(ENTRANCE, k) < Infinity);
}

export const h28: HauntDef = {
  id: 28,
  title: '推土机来了',
  type: 'traitor',
  traitor: { type: 'left' },
  intro: '窗外柴油机突突地响，拆迁队说天一亮就推平这里。前门被人从外面钉上了木板。铜镜里照出的门厅，比真的多站着一个人。揭示者左手边的同伴对着镜子理了理衣领：“这么好的房子，大家都留下来陪它吧。”',
  hero: {
    goal: '天亮前撬开前门，让至少一半的幸存者（向上取整）从门厅逃出去。',
    rules: [
      '计数轨显示离天亮还剩几轮：3 人局 10 轮，4/5 人局 9 轮，6 人局 8 轮。归零时逃出的人还不够一半，你们失败。',
      '特殊行动「撬门」（每回合一次）：在门厅力量检定 5+（带着撬棍 4+），成功撬门进度 +1。进度到 3 人局 4、4/5 人局 5、6 人局 6 时，前门撬开，之后一直开着。',
      '撬棍（标记）在离门厅 3 格以上的某个房间。特殊行动「拿撬棍」：在那个房间拿起它。撬棍不是卡牌，不能交易；你死亡时它掉在原地，你逃出时它留在门厅。',
      '特殊行动「逃出」：前门撬开后，在门厅逃出鬼屋。你离开游戏，回合立即结束，手牌一起移出游戏。',
      '死亡的幸存者多到凑不够一半人逃出时，你们失败。镜中人（怪物）被击败时只会被击晕。',
    ],
    win: '你们一头扎进晨雾里。身后铲斗落下，那面铜镜在瓦砾堆里闪了一下。',
  },
  traitorSide: {
    goal: '拖到天亮（计数归零）时逃出的幸存者还不到一半；或者杀死足够多的幸存者，让活着的人加上已逃出的人凑不够一半。',
    rules: [
      '你控制镜中人（3/4 人局 1 只，5/6 人局 2 只），它们在你的回合之后行动，被击败时只会被击晕。',
      '特殊行动「加固」（每回合一次）：前门还没撬开、进度大于 0 时，在门厅力量或知识检定（取高者）4+，成功撬门进度 -1。',
      '特殊行动「摄入镜中」（每回合一次）：选一名和你在同一房间或在你视线内的幸存者，他理智检定 4+。失败就被铜镜吞进去，出现在离门厅 3 格以上的随机房间。',
      '天亮时你和房子一起被埋，这不影响你获胜。',
    ],
    win: '铲斗落下的时候，你站在门厅正中，对着镜子笑。镜子里一个人都没少。',
  },
  monsters: {
    mirror: { name: '镜中人', icon: 'mirror-man', speed: 3, might: 3 },
  },
  *setup(g) {
    const t = g.traitor()!;
    const hs = g.heroes();
    g.hv.dawn = g.scale(10, 9, 9, 8);
    g.hv.pry = 0;
    g.hv.needPry = g.scale(4, 5, 5, 6);
    g.hv.total = hs.length;
    g.hv.needOut = Math.ceil(hs.length / 2);
    // 撬棍藏在离门厅较远的地方
    let spots = Object.keys(g.state.tiles).filter((k) => !START.includes(k) && g.distance(ENTRANCE, k) >= 3 && g.distance(ENTRANCE, k) < Infinity);
    if (!spots.length) {
      for (const id of ['storeroom', 'junk-room', 'coal-room', 'attic']) {
        const k = g.placeRoom(id);
        if (k) {
          reachable(g, k);
          spots = [k];
          break;
        }
      }
    }
    if (!spots.length) spots = ['U:0,-2'];
    const bar = spots[g.rng.int(spots.length)];
    g.token(bar, 'crowbar', '撬棍', { icon: 'crowbar' });
    const n = g.scale(1, 1, 2, 2);
    for (let i = 0; i < n; i++) g.spawn('mirror', g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'leave', side: 'hero', label: '逃出', desc: '前门已撬开：从门厅逃出鬼屋',
      can: (g, s) => open(g) && g.p(s).tile === ENTRANCE,
      *run(g, s) {
        const p = g.p(s);
        if (p.flags.crowbar) {
          p.flags.crowbar = false;
          g.token(ENTRANCE, 'crowbar', '撬棍', { icon: 'crowbar' });
        }
        p.flags.escaped = true;
        p.cards = [];
        p.dead = true;
        g.endTurn();
        g.log(`${p.name} 从撬开的门缝里钻了出去`, 'good');
        track(g);
      },
    },
    {
      id: 'pry', side: 'hero', label: '撬门', desc: '在门厅力量检定 5+（带撬棍 4+），成功撬门进度 +1',
      can: (g, s) => !open(g) && g.p(s).tile === ENTRANCE,
      *run(g, s) {
        const need = g.p(s).flags.crowbar ? 4 : 5;
        const r = yield* g.check(s, 'might', need, `撬门 ${need}+`);
        if (r < need) {
          g.log('木板纹丝不动', 'info');
          return;
        }
        g.hv.pry = (g.hv.pry ?? 0) + 1;
        g.log(`${g.p(s).name} 撬松了一块木板`, 'good');
        if (open(g)) g.reveal('前门撬开了，幸存者可以从门厅逃出。');
        track(g);
      },
    },
    {
      id: 'bar', side: 'hero', label: '拿撬棍', desc: '拿起本房间的撬棍',
      can: (g, s) => !g.p(s).flags.crowbar && g.tokensAt(g.p(s).tile, 'crowbar').length > 0,
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'crowbar')[0];
        if (!t) return;
        g.removeToken(t.id);
        g.p(s).flags.crowbar = true;
        g.log(`${g.p(s).name} 拿起了一根生锈的撬棍`, 'good');
      },
    },
    {
      id: 'brace', side: 'traitor', label: '加固', desc: '在门厅力量或知识检定（取高者）4+，成功撬门进度 -1',
      can: (g, s) => !open(g) && (g.hv.pry ?? 0) > 0 && g.p(s).tile === ENTRANCE,
      *run(g, s) {
        g.reveal('背叛者可以在门厅「加固」前门，让撬门进度倒退。');
        const trait = g.value(s, 'might') >= g.value(s, 'knowledge') ? 'might' : 'knowledge';
        const r = yield* g.check(s, trait, 4, '加固 4+');
        if (r < 4) return;
        g.hv.pry = Math.max(0, (g.hv.pry ?? 0) - 1);
        g.log('又一块木板被钉了回去', 'bad');
        track(g);
      },
    },
    {
      id: 'swallow', side: 'traitor', label: '摄入镜中', desc: '同房间或视线内一名幸存者理智检定 4+，失败被送到离门厅 3 格以上的房间',
      can: (g, s) => g.heroes().some((h) => g.lineOfSight(g.p(s).tile, g.p(h).tile)),
      *run(g, s) {
        const list = g.heroes().filter((h) => g.lineOfSight(g.p(s).tile, g.p(h).tile));
        list.sort((a, b) => (g.p(b).flags.crowbar ? 1 : 0) - (g.p(a).flags.crowbar ? 1 : 0) || g.value(b, 'might') - g.value(a, 'might'));
        const h = yield* g.choosePlayer(s, '把谁摄入镜中？', list);
        if (h == null) return;
        g.reveal('背叛者可以把视线内的幸存者「摄入镜中」，送到离门厅 3 格以上的房间。');
        const r = yield* g.check(h, 'sanity', 4, '抵抗铜镜 4+');
        if (r >= 4) {
          g.log(`${g.p(h).name} 移开了视线，没有被镜子吸进去`, 'good');
          return;
        }
        const far = farTiles(g);
        const k = far[g.rng.int(far.length)];
        g.moveTo(h, k, '被镜子吞了进去');
        g.log(`${g.p(h).name} 被铜镜吞了进去，从「${g.tileName(k)}」的镜子里跌了出来`, 'bad');
      },
    },
  ],
  *onDeath(g, s) {
    const p = g.p(s);
    if (p.flags.crowbar && !p.flags.escaped) {
      p.flags.crowbar = false;
      g.token(p.tile, 'crowbar', '撬棍', { icon: 'crowbar' });
    }
  },
  *onRoundEnd(g) {
    for (const s of g.alive()) reachable(g, g.p(s).tile);
    track(g);
    if (left(g) <= 0 && !g.state.winner) {
      g.log('天亮了。推土机的铲斗砸穿了屋顶。', 'haunt');
    }
  },
  checkWin(g) {
    const need = g.hv.needOut as number;
    if (escaped(g) >= need) return { side: 'hero' };
    if (killed(g) > (g.hv.total as number) - need) return { side: 'traitor' };
    if (left(g) <= 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const here = g.p(s).tile;
      if (open(g)) return { goals: [ENTRANCE], actions: ['leave'], attack: false };
      const bar = g.tokens('crowbar')[0];
      if (bar && !g.p(s).flags.crowbar) {
        const hs = g.heroes().filter((h) => !g.p(h).flags.crowbar);
        hs.sort((a, b) => g.distance(g.p(a).tile, bar.tile) - g.distance(g.p(b).tile, bar.tile));
        if (hs[0] === s) return { goals: [bar.tile], actions: ['bar', 'pry'] };
      }
      return { goals: [ENTRANCE], actions: ['pry', 'bar'], attack: here === ENTRANCE ? true : undefined };
    },
    traitor: () => ({ goals: [ENTRANCE], actions: ['brace', 'swallow'] }),
    monster: (g) => {
      const hs = g.heroes();
      hs.sort((a, b) => g.distance(g.p(a).tile, ENTRANCE) - g.distance(g.p(b).tile, ENTRANCE));
      return { goals: hs.length ? hs.map((h) => g.p(h).tile) : [ENTRANCE] };
    },
  },
};
