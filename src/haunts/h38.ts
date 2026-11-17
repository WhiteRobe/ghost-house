import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 38 纸人还魂（百年诅咒 × 纸人） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const CAP = 8;

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊地板塌了个洞，底下是去地下室的石阶', 'haunt');
  }
}

function spot(g: Game, ids: string[], avoid: string): string {
  for (const id of ids) {
    const have = g.findTile(id);
    if (have && have !== avoid) return have;
    if (!have) {
      const k = g.placeRoom(id);
      if (k && k !== avoid) return k;
    }
  }
  const t = Object.keys(g.state.tiles).filter((k) => !START.includes(k) && k !== avoid);
  return t.length ? t[g.rng.int(t.length)] : 'U:0,-2';
}

const molds = (g: Game) => g.tokens('mold').length;

function track(g: Game) {
  g.setTrack('剩余纸扎模子', molds(g), g.hv.total);
}

export const h38: HauntDef = {
  id: 38,
  title: '纸人还魂',
  type: 'traitor',
  traitor: { type: 'left' },
  intro: '纸人的眼睛是朱砂点的，刚才还没点。揭示者左手边那人拿起纸人，凑到它耳边说了句什么，地上的纸灰一片片竖了起来。',
  hero: {
    goal: '到纸扎匠的工作间，烧掉所有纸扎模子。',
    rules: [
      '纸扎匠的工作间在哪，日志里会写（还没发现会直接放到地图上）。里面有纸扎模子标记：3 人局 3 个，4/5 人局 4 个，6 人局 5 个。',
      '特殊行动「烧模子」：在工作间执行，知识检定 4+，成功烧掉 1 个模子。模子全部烧掉，你们获胜。',
      '只要还有模子，每轮结束时工作间就会多出 1 个纸人（纸人和还魂纸人合计最多 8 个）。纸人受伤只会被击晕。',
      '幸存者死亡时，原地站起一个还魂纸人（力量 5），归背叛者控制。',
    ],
    win: '最后一个模子在火盆里卷成了灰。屋里的纸人一下子全软了，眼睛上的朱砂褪成了白纸色。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '你控制纸人（速度 3、力量 4）和还魂纸人（速度 3、力量 5），它们在你的回合之后行动。异变开始时你身边有 2 个纸人（5/6 人局 3 个）。',
      '只要工作间里还有模子，每轮结束时那里多出 1 个纸人（纸人和还魂纸人合计最多 8 个）。',
      '幸存者死亡时，原地站起一个还魂纸人，归你控制。',
      '特殊行动「补模子」：工作间里还剩模子、且有模子被烧掉过时，在工作间执行，知识检定 4+，成功补回 1 个。',
      '模子全部被烧掉，你失败。你死亡不算失败，纸人会继续自己行动。',
    ],
    win: '天亮时，门厅里多了几个新扎的纸人，穿着你们来时的衣服，脸上画着笑，一排站着迎客。',
  },
  monsters: {
    paper: { name: '纸人', icon: 'paper', speed: 3, might: 4 },
    revenant: { name: '还魂纸人', icon: 'revenant', speed: 3, might: 5 },
  },
  *setup(g) {
    connect(g);
    const t = g.traitor()!;
    const shop = spot(g, ['attic', 'darkroom', 'servants', 'storeroom'], g.p(t).tile);
    g.hv.shop = shop;
    g.hv.total = g.scale(3, 4, 4, 5);
    for (let i = 0; i < g.hv.total; i++) g.token(shop, 'mold', '纸扎模子', { icon: 'mold' });
    g.log(`纸扎匠的工作间在「${g.tileName(shop)}」`, 'haunt');
    for (let i = 0; i < g.scale(2, 2, 3, 3); i++) g.spawn('paper', g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'burn', side: 'hero', label: '烧模子', desc: '在工作间：知识检定 4+，烧掉 1 个模子',
      can: (g, s) => g.p(s).tile === g.hv.shop && molds(g) > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '烧模子 4+');
        if (r < 4) return;
        const m = g.tokens('mold')[0];
        if (m) g.removeToken(m.id);
        g.log(`${g.p(s).name} 把一个纸扎模子扔进了火盆（剩 ${molds(g)} 个）`, 'good');
        track(g);
      },
    },
    {
      id: 'mend', side: 'traitor', label: '补模子', desc: '在工作间：知识检定 4+，补回 1 个模子',
      can: (g, s) => g.p(s).tile === g.hv.shop && molds(g) > 0 && molds(g) < g.hv.total,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '补模子 4+');
        if (r < 4) return;
        g.token(g.hv.shop, 'mold', '纸扎模子', { icon: 'mold' });
        g.log('竹篾一扎，白纸一糊，又是一个模子', 'bad');
        track(g);
      },
    },
  ],
  *onDeath(g, s) {
    if (g.isTraitor(s)) return;
    const m = g.spawn('revenant', g.p(s).tile, { seat: s });
    if (m) m.name = `还魂纸人（${g.p(s).name}）`;
    g.log(`${g.p(s).name} 的尸体越来越白、越来越薄，然后站了起来`, 'bad');
  },
  *onRoundEnd(g) {
    if (molds(g) > 0 && g.state.monsters.length < CAP) g.spawn('paper', g.hv.shop);
    track(g);
  },
  checkWin(g) {
    if (molds(g) === 0) return { side: 'hero' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g) => {
      const t = g.traitor()!;
      return { goals: [g.hv.shop], actions: ['burn'], targets: [t, ...g.state.monsters.map((m) => `m${m.id}` as const)] };
    },
    traitor: (g) => {
      const near = g.heroes().some((s) => g.distance(g.p(s).tile, g.hv.shop) <= 1);
      if (near || molds(g) < g.hv.total) return { goals: [g.hv.shop], actions: ['mend'] };
      return { goals: g.heroes().map((s) => g.p(s).tile), actions: ['mend'] };
    },
    monster: (g, id) => {
      const m = g.monster(id);
      const heroes = g.heroes().map((s) => g.p(s).tile);
      // 一半守工作间，一半追人
      if (m && m.id % 2 === 0) {
        const near = heroes.filter((k) => g.distance(k, g.hv.shop) <= 2);
        return { goals: near.length ? near : [g.hv.shop] };
      }
      return { goals: heroes };
    },
  },
};
