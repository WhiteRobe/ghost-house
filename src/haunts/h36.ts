import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 36 楼塌了（拆迁前夜 × 红盖头） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
/** 第几轮结束时哪一层塌 */
const UPPER_AT = 2;
const BASE_AT = 4;
const END_AT = 7;

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，露出通往地下室的石阶', 'haunt');
  }
}

function spot(g: Game, ids: string[]): string {
  for (const id of ids) {
    const k = g.placeRoom(id, ['G']);
    if (k) return k;
  }
  const t = Object.keys(g.state.tiles).filter((k) => k.startsWith('G:') && !START.includes(k));
  return t.length ? t[g.rng.int(t.length)] : 'G:0,-1';
}

function track(g: Game) {
  const r = g.state.haunt!.round;
  const next = r <= UPPER_AT ? `二楼坍塌（第 ${UPPER_AT} 轮末）` : r <= BASE_AT ? `地下室坍塌（第 ${BASE_AT} 轮末）` : `整栋楼塌完（第 ${END_AT} 轮末）`;
  g.setTrack(`拜堂进度 ${g.hv.rite}/${g.hv.need}｜下一次：${next}`, g.hv.rite, g.hv.need);
}

const fallen = (g: Game, tile: string) => (tile.startsWith('U:') && g.hv.upper) || (tile.startsWith('B:') && g.hv.base);

function* collapse(g: Game, floor: 'U' | 'B') {
  const name = floor === 'U' ? '二楼' : '地下室';
  g.log(`轰隆一声，${name}塌了！`, 'haunt');
  for (const s of g.alive()) {
    const p = g.p(s);
    if (!p.tile.startsWith(floor + ':')) continue;
    g.moveTo(s, floor === 'U' ? 'G:0,-2' : 'G:0,-1', `从${name}的废墟里爬了出来`);
    if (!g.isTraitor(s)) yield* g.damage(s, 'physical', 3, `${name}坍塌`);
  }
  for (const m of g.state.monsters) if (m.tile.startsWith(floor + ':')) g.moveMonster(m.id, g.hv.hall);
}

export const h36: HauntDef = {
  id: 36,
  title: '楼塌了',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '承重墙裂开了一道缝，灰土簌簌往下落。揭示者头上的红盖头无风自动，正厅里不知何时点起了一对龙凤喜烛——楼塌之前，这场婚礼一定要办完。',
  hero: {
    goal: '阻止正厅的婚礼，并在一楼撑到整栋楼塌完。',
    rules: [
      `楼从上往下塌：第 ${UPPER_AT} 轮结束时二楼坍塌，第 ${BASE_AT} 轮结束时地下室坍塌。坍塌时还在那一层的幸存者受到 3 点物理伤害，并被甩到一楼。之后任何人进入已坍塌的楼层都会被弹回一楼并受到 1 点物理伤害。`,
      '背叛者在正厅（若未发现则会出现在一楼）一次次「拜堂」，计数轨显示拜堂进度。进度达到要求（3/4 人 4 次，5/6 人 5 次）时婚礼完成。',
      '抬轿鬼守在正厅附近，受伤会被击晕。',
      '特殊行动「砸喜堂」：在正厅进行力量 4+ 检定，成功则拜堂进度 -1。',
      `第 ${END_AT} 轮结束时，如果婚礼还没完成且还有幸存者活着，你们获胜。杀死背叛者也能立即获胜。`,
    ],
    win: '最后一根房梁落下来的时候，你们缩在一楼的门洞里。喜烛被砸灭在瓦砾中，红盖头埋在了废墟最底下，再也没人掀开它。',
  },
  traitorSide: {
    goal: '在楼塌完之前，在正厅完成婚礼。',
    rules: [
      '特殊行动「拜堂」：在正厅进行理智 4+ 检定，成功则拜堂进度 +1。进度达到要求（3/4 人 4 次，5/6 人 5 次）时你获胜。',
      '你控制抬轿鬼（速度 3、力量 4），它们在你的回合之后行动。',
      '楼层坍塌不会伤到你，但同样会把你甩回一楼。',
      '幸存者可以在正厅「砸喜堂」（力量 4+）让进度 -1。',
      `第 ${END_AT} 轮结束时婚礼仍未完成，你失败。所有幸存者死亡你也获胜。`,
    ],
    win: '三拜礼成的一瞬间，整栋楼轰然塌下。尘土散尽后，废墟中央只剩一对喜烛还在燃烧，烛光里有两个人影并肩站着。',
  },
  monsters: {
    bearer: { name: '抬轿鬼', icon: 'bearer', speed: 3, might: 4 },
  },
  *setup(g) {
    connect(g);
    const hall = spot(g, ['main-hall', 'ballroom', 'dining']);
    g.hv.hall = hall;
    g.hv.rite = 0;
    g.hv.need = g.scale(4, 4, 5, 5);
    g.hv.upper = false;
    g.hv.base = false;
    g.token(hall, 'candle', '龙凤喜烛', { icon: 'candle' });
    for (let i = 0; i < g.scale(1, 2, 2, 3); i++) g.spawn('bearer', hall);
    track(g);
  },
  actions: [
    {
      id: 'rite', side: 'traitor', label: '拜堂', desc: '在正厅：理智 4+，拜堂进度 +1',
      can: (g, s) => g.p(s).tile === g.hv.hall,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '拜堂 4+');
        if (r < 4) return;
        g.hv.rite++;
        g.log(`唢呐一响：“${['一拜天地', '二拜高堂', '夫妻对拜', '送入洞房', '礼成'][Math.min(4, g.hv.rite - 1)]}——”（${g.hv.rite}/${g.hv.need}）`, 'bad');
        track(g);
      },
    },
    {
      id: 'smash', side: 'hero', label: '砸喜堂', desc: '在正厅：力量 4+，拜堂进度 -1',
      can: (g, s) => g.p(s).tile === g.hv.hall && g.hv.rite > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '砸喜堂 4+');
        if (r < 4) return;
        g.hv.rite--;
        g.log(`${g.p(s).name} 一脚踹翻了供桌（${g.hv.rite}/${g.hv.need}）`, 'good');
        track(g);
      },
    },
  ],
  *onEnter(g, s) {
    const p = g.p(s);
    if (!fallen(g, p.tile)) return;
    g.moveTo(s, 'G:0,-2', '脚下一空，又摔回了一楼');
    yield* g.damage(s, 'physical', 1, '踩进废墟');
  },
  *onRoundEnd(g) {
    const r = g.state.haunt!.round - 1; // 刚结束的那一轮
    if (r === UPPER_AT && !g.hv.upper) {
      g.hv.upper = true;
      yield* collapse(g, 'U');
    }
    if (r === BASE_AT && !g.hv.base) {
      g.hv.base = true;
      yield* collapse(g, 'B');
    }
    if (r >= END_AT) g.hv.over = true;
    track(g);
  },
  checkWin(g) {
    if (g.hv.rite >= g.hv.need) return { side: 'traitor' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    if (g.hv.over) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g) => {
      const t = g.traitor()!;
      const targets = [t, ...g.state.monsters.map((m) => `m${m.id}` as const)];
      return { goals: [g.hv.hall], actions: ['smash'], targets };
    },
    traitor: (g) => ({ goals: [g.hv.hall], actions: ['rite'] }),
    monster: (g) => {
      const near = g.heroes().map((s) => g.p(s).tile).filter((k) => g.distance(k, g.hv.hall) <= 2);
      return { goals: near.length ? near : [g.hv.hall] };
    },
  },
};
