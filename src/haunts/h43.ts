import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 43 桃木封印（百年诅咒 × 桃木剑） */

const START = ['entrance', 'hallway', 'stairs', 'upper-landing', 'basement-landing'];

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌了个洞，底下是去地下室的石阶', 'info');
  }
}

const seals = (g: Game) => g.tokens('seal');
const broken = (g: Game) => seals(g).filter((t) => !t.data?.fixed);
const fixedSeals = (g: Game) => seals(g).filter((t) => t.data?.fixed);
const complete = (g: Game) => !!g.hv.complete;
const bossId = (g: Game): number | null => (g.hv.boss ?? null) as number | null;
const awakeMax = (g: Game) => g.scale(9, 9, 8, 8);

function setSeal(g: Game, id: number, fixed: boolean) {
  const t = g.state.tokens.find((x) => x.id === id);
  if (!t) return;
  t.data = { ...(t.data ?? {}), fixed };
  t.label = fixed ? '封印符' : '残破的封印符';
}

function updateTrack(g: Game) {
  if (complete(g)) {
    const b = bossId(g) != null ? g.monster(bossId(g)!) : undefined;
    g.setTrack('大妖剩余血量', b?.hp ?? 0, g.hv.bossHp);
  } else g.setTrack('大妖苏醒', g.hv.awake ?? 0, awakeMax(g));
}

export const h43: HauntDef = {
  id: 43,
  title: '桃木封印',
  type: 'traitor',
  traitor: { type: 'lowest', trait: 'might' },
  intro: '桃木剑烫得握不住，剑脊上的朱砂符一道道褪成了粉色。地底下有东西长长吸了口气，地板跟着鼓起来又落下去。你们当中力量最低的那个人听见它在叫自己的名字。',
  hero: {
    goal: '修好三处封印符结成封印阵，再打死大妖。',
    rules: [
      '大妖在地宫（地宫放不进地图时，在背叛者所在房间）。它有血量（3/4/5/6 人局分别 6/8/10/12），受伤扣血，不会被击晕，血量归零被消灭。',
      '房子里有三处残破的封印符标记，尽量分在三层楼。封印阵结成之前，大妖不受任何伤害。',
      '特殊行动「重画封印符」：在有残破封印符的房间执行，知识检定 5+，成功修好它。背叛者能把修好的符重新弄破。三处同时修好时封印阵结成，之后不能再被破坏。',
      '封印阵结成后，大妖力量 -2，你们攻击时多掷 1 颗骰。',
      `封印阵结成之前，每轮结束时大妖苏醒 +1。苏醒达到 9（3/4 人局）或 8（5/6 人局），背叛者获胜。杀死背叛者不会让你们获胜。`,
    ],
    win: '最后一剑扎进大妖眉心，它化成一滩发臭的黑泥，顺着地缝渗了下去。桃木剑上的朱砂又红了。',
  },
  traitorSide: {
    goal: '拖到大妖完全苏醒，或者杀死所有幸存者。',
    rules: [
      '你控制大妖（速度 3、力量 6），它在你的回合之后行动。封印阵结成之前，大妖不受任何伤害。',
      `封印阵结成之前，每轮结束时大妖苏醒 +1。苏醒达到 9（3/4 人局）或 8（5/6 人局），你获胜。`,
      '特殊行动「抹去封印符」：在有修好封印符的房间执行，理智检定 4+，成功把它重新弄破。三处同时修好、封印阵结成后，就不能再抹了。',
      '封印阵结成后，大妖力量 -2，幸存者攻击时多掷 1 颗骰。大妖血量归零，你失败。你死亡不算失败。',
    ],
    win: '地宫的石板一块块翻起来。大妖伸了个懒腰，脑袋顶穿了一楼的地板。',
  },
  monsters: {
    boss: { name: '大妖', icon: 'boss', speed: 3, might: 6, sanity: 5, hp: 6 },
  },
  *setup(g) {
    ensureBasement(g);
    const t = g.traitor()!;
    const lair = g.placeRoom('crypt') ?? g.p(t).tile;
    const hp = g.scale(6, 8, 10, 12);
    const m = g.spawn('boss', lair);
    if (m) {
      m.hp = hp;
      g.hv.boss = m.id;
    }
    g.hv.bossHp = hp;
    g.hv.awake = 0;
    g.hv.complete = false;
    // 三处封印符：尽量分散到三层，避开大妖巢穴
    const pool = Object.keys(g.state.tiles).filter((k) => k !== lair && !START.includes(g.state.tiles[k].room) && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(pool);
    const picks: string[] = [];
    for (const f of ['U', 'G', 'B']) {
      const k = pool.find((x) => x.startsWith(f + ':'));
      if (k) picks.push(k);
    }
    for (const k of pool) if (picks.length < 3 && !picks.includes(k)) picks.push(k);
    for (const k of ['U:0,-2', 'G:0,-1', 'G:0,0']) if (picks.length < 3 && !picks.includes(k)) picks.push(k);
    for (const k of picks.slice(0, 3)) g.token(k, 'seal', '残破的封印符', { icon: 'seal', data: { fixed: false } });
    updateTrack(g);
  },
  actions: [
    {
      id: 'redraw', side: 'hero', label: '重画封印符', desc: '知识检定 5+：修好这个房间的封印符',
      can: (g, s) => !complete(g) && g.tokensAt(g.p(s).tile, 'seal').some((t) => !t.data?.fixed),
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 5, '重画封印符 5+');
        if (r < 5) {
          g.log('朱砂洇开了，符没画成', 'bad');
          return;
        }
        const t = g.tokensAt(g.p(s).tile, 'seal').find((x) => !x.data?.fixed)!;
        setSeal(g, t.id, true);
        g.log(`${g.p(s).name} 重画了${g.tileName(t.tile)}的封印符`, 'good');
        if (broken(g).length === 0) {
          g.hv.complete = true;
          const b = bossId(g) != null ? g.monster(bossId(g)!) : undefined;
          if (b) b.traits.might = Math.max(1, (b.traits.might ?? 6) - 2);
          g.reveal('三道封印符同时亮了，封印阵结成。地底一声惨叫。大妖力量 -2，现在可以伤到它了。');
        }
        updateTrack(g);
      },
    },
    {
      id: 'smear', side: 'traitor', label: '抹去封印符', desc: '理智检定 4+：把这个房间修好的封印符重新弄破',
      can: (g, s) => !complete(g) && g.tokensAt(g.p(s).tile, 'seal').some((t) => t.data?.fixed),
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '抹去封印符 4+');
        if (r < 4) return;
        const t = g.tokensAt(g.p(s).tile, 'seal').find((x) => x.data?.fixed)!;
        setSeal(g, t.id, false);
        g.log(`${g.tileName(t.tile)}的封印符被抹花了`, 'bad');
        updateTrack(g);
      },
    },
  ],
  *onMonsterHurt(g, id) {
    const m = g.monster(id);
    if (m?.kind === 'boss' && !complete(g)) {
      g.log('砍在大妖身上，跟砍进一团雾差不多，它毫发无伤', 'bad');
      return true;
    }
    return false;
  },
  rollBonus(g, s, _trait, purpose) {
    return complete(g) && purpose === 'attack' && !g.isTraitor(s) ? 1 : 0;
  },
  *onRoundEnd(g) {
    if (complete(g)) return;
    if (broken(g).length > 0) {
      g.hv.awake = (g.hv.awake ?? 0) + 1;
      g.log(`地底的喘气声又粗了一点（大妖苏醒 ${g.hv.awake}/${awakeMax(g)}）`, 'haunt');
    }
    updateTrack(g);
  },
  *onTurnEnd(g) {
    updateTrack(g);
  },
  checkWin(g) {
    if (g.heroes().length === 0) return { side: 'traitor' };
    if (complete(g) && !g.state.monsters.some((m) => m.kind === 'boss')) return { side: 'hero' };
    if (!complete(g) && (g.hv.awake ?? 0) >= awakeMax(g)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g) => {
      const t = g.traitor();
      if (!complete(g)) return { goals: broken(g).map((x) => x.tile), actions: ['redraw'], targets: t != null ? [t] : [] };
      const b = bossId(g);
      const boss = b != null ? g.monster(b) : undefined;
      if (boss) return { goals: [boss.tile], targets: [`m${boss.id}`] };
      return {};
    },
    traitor: (g) => {
      if (!complete(g)) {
        const f = fixedSeals(g).map((x) => x.tile);
        if (f.length) return { goals: f, actions: ['smear'] };
      }
      return { goals: g.heroes().map((s) => g.p(s).tile), actions: ['smear'] };
    },
    monster: (g) => {
      // 大妖去守最近修好的封印符；没有就追人
      if (!complete(g)) {
        const heroesAtSeals = g.heroes().map((s) => g.p(s).tile).filter((k) => g.tokensAt(k, 'seal').length);
        if (heroesAtSeals.length) return { goals: heroesAtSeals };
      }
      return { goals: g.heroes().map((s) => g.p(s).tile) };
    },
  },
};
