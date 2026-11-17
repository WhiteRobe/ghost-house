import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';
import { TRAITS } from '../shared/types';

/** 22 血玉（失踪的朋友 × 血沁玉佩） */

const floorOf = (k: string) => k[0];

/** 有人掉进了走不通的地下室：打开地窖口或直接连通楼梯 */
function connect(g: Game) {
  for (const s of g.alive()) {
    const k = g.p(s).tile;
    if (g.distance('G:0,0', k) < Infinity) continue;
    if (k[0] === 'B') g.placeRoom('cellar-hatch');
    if (g.distance('G:0,0', k) < Infinity) continue;
    const landing = k[0] === 'B' ? 'B:0,-2' : k[0] === 'U' ? 'U:0,-2' : 'G:0,-1';
    if (g.distance('G:0,0', landing) === Infinity) g.link('G:0,-1', landing);
    if (g.distance('G:0,0', k) === Infinity) g.link(landing, k);
  }
}

function track(g: Game) {
  g.setTrack('血玉裂痕', g.hv.cracks ?? 0, g.hv.need ?? 2);
}

/** 同楼层的幸存者 */
function prey(g: Game, s: number): number[] {
  const f = floorOf(g.p(s).tile);
  return g.heroes().filter((h) => floorOf(g.p(h).tile) === f);
}

export const h22: HauntDef = {
  id: 22,
  title: '血玉',
  type: 'traitor',
  traitor: { type: 'highest', trait: 'might' },
  intro: '失踪朋友的外套塞在床底下，口袋里只有一块玉佩，摸着是温的，里面的红丝已经结成了网。力气最大的那位把它攥进手心，血从指缝里一滴一滴往下掉，他咧开嘴，露出的牙比平时多。',
  hero: {
    goal: '用「夺玉」在血玉上砸出 2 道裂痕（5/6 人局 3 道），或者杀死背叛者。',
    rules: [
      '背叛者是力量最高的人，血玉在他身上，抢不走也换不走。',
      '特殊行动「夺玉」：和背叛者在同一房间时，用力量攻击他，这算你本回合的攻击。你赢了，他照常受伤，你再做力量检定 3+，成功：血玉多 1 道裂痕。你输了，照常受伤。',
      '背叛者会「吸血」：和他同一楼层的每名幸存者理智检定 4+，失败受到 1 点伤害（自选属性），他借此恢复属性。不和他待在同一楼层就不会被吸。',
      '裂痕攒够，或者背叛者死亡时，你们获胜。死去的幸存者达到 2 人（5/6 人局 3 人）时，你们失败。',
    ],
    win: '血玉“啪”地碎成几瓣，红丝一下子缩回了碎片里。背叛者瘫在地上，手心只剩一道浅疤。',
  },
  traitorSide: {
    goal: '杀死 2 名幸存者（5/6 人局 3 名），赶在他们砸碎血玉之前。',
    rules: [
      '血玉在你身上，不能被抢走、交易或丢弃。',
      '特殊行动「吸血」：和你同一楼层的每名幸存者理智检定 4+，失败受到 1 点伤害（自选属性）。每有 1 人真的掉了属性，你当前最低的一项属性 +1 格，不超过起始值。',
      '幸存者用「夺玉」打赢你后，力量检定 3+ 就能给血玉添 1 道裂痕。裂痕到 2 道（5/6 人局 3 道），或者你死亡时，你失败。',
    ],
    win: '玉里的红丝又粗了一圈，盘成一团。你把它贴在耳朵上，里面在跳，跟你的心跳一个拍子。',
  },
  *setup(g) {
    g.hv.cracks = 0;
    g.hv.need = g.scale(2, 2, 3, 3);
    const t = g.traitor()!;
    g.hs.start = { ...g.p(t).traits };
    g.log(`${g.p(t).name} 手里的血玉亮了起来`, 'haunt');
    track(g);
  },
  actions: [
    {
      id: 'smash', side: 'hero', label: '夺玉', desc: '和背叛者同一房间：用力量攻击他（算本回合的攻击），赢了再做力量检定 3+ 砸玉',
      can: (g, s) => {
        const t = g.traitor();
        return t != null && !g.p(t).dead && !g.attacked && g.p(t).tile === g.p(s).tile;
      },
      *run(g, s) {
        const t = g.traitor()!;
        g.attacked = true;
        const r = yield* g.attack({ seat: s }, { seat: t });
        if (g.p(t).dead || !r.winner || !('seat' in r.winner) || r.winner.seat !== s) return;
        g.log(`${g.p(t).name} 被打翻在地，血玉从领口滑了出来`, 'good');
        const c = yield* g.check(s, 'might', 3, '砸血玉 3+');
        if (c < 3) {
          g.log('玉面一滑，这一下砸偏了', 'info');
          return;
        }
        g.hv.cracks = (g.hv.cracks ?? 0) + 1;
        track(g);
        g.log('血玉上多了一道裂痕', 'good');
      },
    },
    {
      id: 'drain', side: 'traitor', label: '吸血', desc: '同楼层每名幸存者理智检定 4+，失败受到 1 点伤害，你随之恢复',
      can: (g, s) => prey(g, s).length > 0,
      *run(g, s) {
        g.reveal('背叛者可以「吸血」：和他同一楼层的每名幸存者理智检定 4+，失败受到 1 点伤害，他随之恢复。');
        let fed = 0;
        for (const h of prey(g, s)) {
          const r = yield* g.check(h, 'sanity', 4, '抵抗吸血 4+');
          if (r >= 4) continue;
          const n = yield* g.damage(h, 'general', 1, '血玉吸血', s);
          if (n > 0) fed++;
        }
        const p = g.p(s);
        const start = g.hs.start as Record<string, number>;
        for (let i = 0; i < fed; i++) {
          let low = TRAITS[0];
          for (const tr of TRAITS) if (p.traits[tr] < p.traits[low]) low = tr;
          if (p.traits[low] >= start[low]) break;
          yield* g.gain(s, low, 1);
        }
        if (fed) g.log(`${p.name} 的脸色红了回来`, 'bad');
      },
    },
  ],
  *onRoundEnd(g) {
    connect(g);
  },
  checkWin(g) {
    if ((g.hv.cracks ?? 0) >= (g.hv.need ?? 2)) return { side: 'hero' };
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    const dead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (dead >= g.scale(2, 2, 3, 3)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g) => {
      const t = g.traitor();
      if (t == null) return {};
      return { goals: [g.p(t).tile], actions: ['smash'], targets: [t] };
    },
    traitor: (g, s) => {
      const hs = g.heroes();
      hs.sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
      return { goals: hs.map((h) => g.p(h).tile), actions: prey(g, s).length ? ['drain'] : [] };
    },
  },
};
