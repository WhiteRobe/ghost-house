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
  intro: '你们终于在床底下找到了失踪朋友的外套，口袋里只剩一块温热的玉佩，玉里的红丝已经长成了一张网。力气最大的那位把它攥在手心，指缝里渗出血来——他笑了，那不是你们认识的笑。',
  hero: {
    goal: '击败背叛者，趁他倒下时砸碎他身上的血玉（3/4 人局需砸出 2 道裂痕，5/6 人局 3 道）。',
    rules: [
      '血玉一直在背叛者身上，无法被抢走或交易。',
      '特殊行动「夺玉」（代替你本回合的攻击）：与背叛者同格时，用力量攻击他。若你获胜，紧接着进行力量 3+ 检定，成功则血玉多一道裂痕。',
      '背叛者每回合可以吸取与他同一楼层的所有幸存者：每人进行理智 4+ 检定，失败受到 1 点伤害（自选属性），他借此恢复自己。远离他所在的楼层可以躲开。',
      '背叛者死亡也算你们获胜。',
    ],
    win: '血玉“啪”地碎成几瓣，红丝像受惊的蚯蚓一样缩回了碎片里。背叛者瘫倒在地，手心里只剩一道浅浅的疤。',
  },
  traitorSide: {
    goal: '用血玉喂饱自己：杀死足够多的幸存者（3/4 人局 2 人，5/6 人局 3 人；或者杀光所有幸存者）。',
    rules: [
      '血玉在你身上，不能被抢走、交易或丢弃。',
      '特殊行动「吸血」（每回合一次）：与你同一楼层的每名幸存者进行理智 4+ 检定，失败受到 1 点伤害（各自选择属性）；每有一人确实受伤，你最低的一项属性恢复 1 格（不超过起始值）。',
      '幸存者用「夺玉」击败你后会尝试砸玉，裂痕攒满你就输了。你死亡也算输。',
    ],
    win: '玉里的红丝又粗了一圈，像吃饱的蛇一样慢慢盘起来。房子里安静了，只剩你一个人的心跳——还有玉的。',
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
      id: 'smash', side: 'hero', label: '夺玉', desc: '与背叛者同格：用力量攻击他，获胜后进行力量 3+ 检定砸玉',
      can: (g, s) => {
        const t = g.traitor();
        return t != null && !g.p(t).dead && !g.attacked && g.p(t).tile === g.p(s).tile;
      },
      *run(g, s) {
        const t = g.traitor()!;
        g.attacked = true;
        const r = yield* g.attack({ seat: s }, { seat: t });
        if (g.p(t).dead || !r.winner || !('seat' in r.winner) || r.winner.seat !== s) return;
        g.log(`${g.p(t).name} 被打倒在地，血玉从衣领里滑了出来`, 'good');
        const c = yield* g.check(s, 'might', 3, '砸血玉 3+');
        if (c < 3) {
          g.log('玉面滑腻，这一下砸偏了', 'info');
          return;
        }
        g.hv.cracks = (g.hv.cracks ?? 0) + 1;
        track(g);
        g.log('血玉上多了一道裂痕！', 'good');
      },
    },
    {
      id: 'drain', side: 'traitor', label: '吸血', desc: '同楼层每名幸存者受到 1 点伤害，你随之恢复',
      can: (g, s) => prey(g, s).length > 0,
      *run(g, s) {
        g.reveal('背叛者可以「吸血」：与他同一楼层的每名幸存者受到 1 点伤害，他随之恢复。');
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
        if (fed) g.log(`${p.name} 的脸色红润了起来`, 'bad');
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
