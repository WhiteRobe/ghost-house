import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 38 纸人还魂（百年诅咒 × 纸人） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const CAP = 8;

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，露出通往地下室的石阶', 'haunt');
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
  intro: '纸人的眼睛是用朱砂点的，刚才还没有。揭示者身边那人忽然拿起纸人，对着它的耳朵说了句什么，满屋的纸灰都立了起来。百年前那个纸扎匠的手艺，今晚又要开张了。',
  hero: {
    goal: '找到纸扎匠的工作间，烧掉所有纸扎模子。',
    rules: [
      '纸扎匠的工作间（见日志，若未发现会自动出现）里放着若干个纸扎模子（标记，3 人 3 个，4/5 人 4 个，6 人 5 个）。',
      '特殊行动「烧模子」：在工作间进行知识 4+ 检定，成功则烧掉 1 个模子。',
      '只要还有模子，每轮结束时工作间都会糊出一个新纸人（场上最多 8 个）。纸人受伤会被击晕。',
      '纸人还魂：幸存者死亡时，他的尸身会变成一个更强的还魂纸人（力量 5），加入背叛者一方。',
    ],
    win: '最后一个模子在火里卷成了灰。屋里所有的纸人同时软了下去，朱砂点的眼睛一个个褪成了白色。',
  },
  traitorSide: {
    goal: '杀死所有幸存者，把他们都扎成纸人。',
    rules: [
      '你控制纸人（速度 3、力量 4）和还魂纸人（速度 3、力量 5），它们在你的回合之后行动。',
      '只要工作间里还有模子，每轮结束时那里会糊出一个新纸人（场上最多 8 个）。',
      '幸存者死亡时会变成还魂纸人，加入你这一方。',
      '特殊行动「补模子」：在工作间进行知识 4+ 检定，成功则补回 1 个被烧掉的模子。',
      '幸存者烧掉所有模子时你失败。',
    ],
    win: '天亮时，洋楼里多了几个新扎的纸人，穿着你们来时的衣服，脸上画着笑，整整齐齐地站在门厅里迎客。',
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
      id: 'burn', side: 'hero', label: '烧模子', desc: '在工作间：知识 4+，烧掉 1 个模子',
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
      id: 'mend', side: 'traitor', label: '补模子', desc: '在工作间：知识 4+，补回 1 个模子',
      can: (g, s) => g.p(s).tile === g.hv.shop && molds(g) > 0 && molds(g) < g.hv.total,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '补模子 4+');
        if (r < 4) return;
        g.token(g.hv.shop, 'mold', '纸扎模子', { icon: 'mold' });
        g.log('竹篾和白纸又糊出了一个模子', 'bad');
        track(g);
      },
    },
  ],
  *onDeath(g, s) {
    if (g.isTraitor(s)) return;
    const m = g.spawn('revenant', g.p(s).tile, { seat: s });
    if (m) m.name = `还魂纸人（${g.p(s).name}）`;
    g.log(`${g.p(s).name} 的尸身慢慢变白、变薄，站了起来……`, 'bad');
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
