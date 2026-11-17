import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 地下室和楼上没连通时，开一道暗梯，免得有人被困死 */
function bridge(g: Game) {
  for (const p of g.state.players) {
    if (p.dead || g.distance('G:0,0', p.tile) < Infinity) continue;
    const to = g.distance('B:0,-2', p.tile) < Infinity ? 'B:0,-2' : p.tile;
    if (g.distance('G:0,0', to) === Infinity) {
      g.link('G:0,-1', to);
      g.log('走廊地板裂开，下面有一道暗梯', 'info');
    }
  }
}

const START = 'G:0,0';
const HALL = 'G:0,-1';
const starts = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const NEED = 3;
const CAP = 7;

function reachable(g: Game, k: string): string {
  if (g.distance(START, k) === Infinity) g.link(HALL, k);
  return k;
}

const shrine = (g: Game): string => g.hv.shrine as string;

function ghostMight(g: Game) {
  return 2 + (g.hv.done as number);
}

function spawnGhost(g: Game) {
  if (g.state.monsters.length >= CAP) return;
  const m = g.spawn('ancestor', shrine(g));
  if (m) m.traits.might = ghostMight(g);
}

function lossNeed(g: Game) {
  return g.scale(2, 2, 2, 3);
}

/** 15 家谱 */
export const h15: HauntDef = {
  id: 15,
  title: '家谱',
  type: 'traitor',
  traitor: { type: 'left' },
  intro: '遗嘱最后一页夹着一张家谱，纸都黄了，上面好几个名字被朱笔圈掉。祠堂里的牌位“咔咔”转了个向，一排排冲着你们。揭示者左手边那个人翻到最后，在上面看见了自己的名字。',
  hero: {
    goal: '在牌位前祭拜成功 3 次，把祖先送回去。',
    rules: [
      '「牌位」标记放在祠堂；祠堂不在房子里时，依次改放佛堂、正厅，都没有就随机放一个房间。',
      '特殊行动「祭拜」（每回合一次）：在牌位所在房间，理智检定 4+；房间里有没被击晕的亡魂时改为 5+。成功：祭拜进度 +1。每轮只能成功 1 次，本轮已有人成功后，其他人不能再祭拜。',
      '每成功祭拜 1 次（第 3 次除外），所有亡魂力量 +1，牌位前再出现 1 个亡魂。',
      '亡魂速度 2，力量 2 起。亡魂受伤只会被击晕，不会被消灭。每轮结束时牌位前出现 1 个新亡魂，场上最多 7 个。',
      '祭拜进度到 3，你们获胜。死掉 2 名幸存者（6 人局 3 名），你们失败。',
    ],
    win: '第三炷香插进香炉，牌位一块接一块转了回去。家谱上那几圈朱笔印子褪得只剩一点红。',
  },
  traitorSide: {
    goal: '杀死 2 名幸存者（6 人局 3 名）。',
    rules: [
      '你控制祖先亡魂，它们在你的回合之后行动。亡魂速度 2，力量 2 起，受伤只会被击晕，不会被消灭。',
      '每轮结束时牌位前出现 1 个新亡魂，场上最多 7 个。幸存者每成功祭拜 1 次，所有亡魂力量 +1，并再出现 1 个。',
      '特殊行动「请祖宗」（每回合一次）：在牌位所在房间，知识检定 4+。成功：牌位前出现 1 个亡魂。场上已有 7 个时不能用。',
      '幸存者祭拜成功 3 次，你失败。牌位前有没被击晕的亡魂时，他们祭拜更难。',
    ],
    win: '朱笔落下，家谱上又圈掉一个名字。供桌上多了一块新牌位，漆还没干。',
  },
  monsters: {
    ancestor: { name: '祖先亡魂', icon: 'ancestor', speed: 2, might: 2 },
  },
  *setup(g) {
    bridge(g);
    let k = g.findTile('ancestral-hall') ?? g.placeRoom('ancestral-hall') ?? g.findTile('chapel') ?? g.findTile('main-hall');
    if (!k) {
      const t = g.traitor()!;
      const tiles = Object.keys(g.state.tiles).filter((x) => !starts.includes(x) && x !== g.p(t).tile && g.distance(START, x) < Infinity);
      k = tiles.length ? tiles[g.rng.int(tiles.length)] : 'G:0,-2';
    }
    g.hv.shrine = reachable(g, k);
    g.token(k, 'tablet', '牌位', { icon: 'tablet' });
    g.hv.done = 0;
    for (let i = 0; i < g.scale(1, 2, 2, 3); i++) spawnGhost(g);
    g.setTrack('祭拜进度', 0, NEED);
  },
  actions: [
    {
      id: 'worship', side: 'hero', label: '祭拜', desc: '理智检定 4+，房间里有没被击晕的亡魂时 5+。成功：祭拜进度 +1',
      can: (g, s) => g.p(s).tile === shrine(g) && g.hv.lastRound !== g.state.round,
      *run(g, s) {
        const blocked = g.monstersAt(shrine(g)).some((m) => !m.stunned);
        const need = blocked ? 5 : 4;
        const r = yield* g.check(s, 'sanity', need, `祭拜 ${need}+`);
        if (r < need) {
          g.log('香刚点着就灭了', 'info');
          return;
        }
        g.hv.done = (g.hv.done as number) + 1;
        g.hv.lastRound = g.state.round;
        g.setTrack('祭拜进度', g.hv.done, NEED);
        g.log(`${g.p(s).name} 磕了三个头，一块牌位转了回去`, 'good');
        if ((g.hv.done as number) >= NEED) return;
        for (const m of g.state.monsters) if (m.kind === 'ancestor') m.traits.might = ghostMight(g);
        spawnGhost(g);
        g.log('亡魂力量 +1，牌位前又站出来一个', 'bad');
      },
    },
    {
      id: 'summon', side: 'traitor', label: '请祖宗', desc: '知识检定 4+。成功：牌位前出现 1 个亡魂',
      can: (g, s) => g.p(s).tile === shrine(g) && g.state.monsters.length < CAP,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '请祖宗 4+');
        if (r < 4) return;
        spawnGhost(g);
        g.log('牌位后面又走出来一个穿寿衣的人', 'bad');
      },
    },
  ],
  *onRoundEnd(g) {
    bridge(g);
    spawnGhost(g);
  },
  checkWin(g) {
    if ((g.hv.done as number) >= NEED) return { side: 'hero' };
    const dead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (dead >= lossNeed(g)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g) => ({ goals: [shrine(g)], actions: ['worship'] }),
    traitor: (g, s) => {
      const heroes = g.heroes().map((h) => g.p(h).tile);
      const here = g.p(s).tile;
      // 守在牌位边上请祖宗，有人来就打
      if (g.state.monsters.length < CAP && here !== shrine(g)) return { goals: [shrine(g)], actions: ['summon'] };
      return { goals: heroes.includes(shrine(g)) ? [shrine(g)] : heroes, actions: ['summon'] };
    },
    monster: (g) => {
      // 一半亡魂守着牌位，一半追人
      const heroes = g.heroes().map((h) => g.p(h).tile);
      const near = heroes.filter((k) => g.distance(k, shrine(g)) <= 2);
      return { goals: near.length ? near : heroes };
    },
  },
};
