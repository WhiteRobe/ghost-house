import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const START = 'G:0,0';
const HALL = 'G:0,-1';
const starts = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

/** 地下室和楼上没连通时，开一道暗梯，免得有人被困死 */
function bridge(g: Game) {
  for (const p of g.state.players) {
    if (p.dead || g.distance(START, p.tile) < Infinity) continue;
    const to = g.distance('B:0,-2', p.tile) < Infinity ? 'B:0,-2' : p.tile;
    if (g.distance(START, to) === Infinity) {
      g.link(HALL, to);
      g.log('走廊的地板裂开，露出一道通往下面的暗梯', 'info');
    }
  }
}

function reachable(g: Game, k: string): string {
  if (g.distance(START, k) === Infinity) g.link(HALL, k);
  return k;
}

const fires = (g: Game): string[] => ((g.hv.fire as string[] | undefined) ?? []).filter((k) => g.state.tiles[k]);
const paper = (g: Game): Record<number, boolean> => (g.hs.paper ??= {});
const hasTorch = (g: Game, s: number) => !!g.p(s).flags.h20torch;
const cleared = (g: Game, s: number) => !!g.p(s).flags.h20clear;

/** 已经公开身份的背叛者 */
function exposed(g: Game): number | null {
  const t = g.state.haunt?.traitor;
  return t != null && g.p(t).side === 'traitor' ? t : null;
}

function lossNeed(g: Game) {
  return g.scale(2, 2, 3, 3);
}

/** 被纸化的活人 + 死去的幸存者 */
function lost(g: Game) {
  const pp = paper(g);
  return g.heroes(true).filter((s) => g.p(s).dead || pp[s]).length;
}

/** 20 他不是他 */
export const h20: HauntDef = {
  id: 20,
  title: '他不是他',
  type: 'hidden',
  traitor: { type: 'hidden' },
  intro: '你们找到了失踪的朋友，他就站在你们中间，笑着说一切都好。可他的手摸起来像糊窗户的纸，影子也比别人薄了一层。你们之中，有一个已经不是他自己了。',
  hero: {
    goal: '用火验出谁是纸人，然后消灭他。',
    rules: [
      '你们之中藏着一个纸人（隐藏的背叛者）。他每轮可以悄悄在一名同一房间的幸存者背后画一笔，画满两笔这个人就成了纸人：速度和力量各 -1（最多降到最低一格）。被画的人不会被告知。',
      '有火的房间带「火」标记（厨房、锅炉房；都没有时是另一个房间）。',
      '特殊行动「点火把」：在有火的房间点起一支火把（每人身上最多一支），然后你的回合立即结束。',
      '特殊行动「举火验身」：用掉火把，照一照同一房间里的另一个人。纸人会当场露出真面目并被烧伤（受到 1 点物理伤害）；被画过的幸存者背后的墨痕会消失；已经成了纸人的幸存者会冒出纸灰，受到 1 点物理伤害，但诅咒解除，速度和力量各 +1；真正的活人则会被确认清白。',
      '在纸人露出真面目之前，谁都不能攻击别人；之后你们可以攻击他。纸人身子轻飘飘的，防御时多掷 1 颗骰。',
      '纸人死亡时你们获胜。被点成纸人的人加上死去的幸存者达到 2 人（5/6 人局 3 人）时你们失败。',
    ],
    win: '火舌卷上他的衣角，整个人“呼”地烧成了一团。纸灰里，掉出一张写着朋友生辰八字的黄纸。',
  },
  traitorSide: {
    goal: '把足够多的幸存者点成纸人：被点成纸人的人加上死去的幸存者达到 2 人（5/6 人局 3 人）。',
    rules: [
      '你是隐藏的背叛者（纸人），其他人不知道你的身份。',
      '特殊行动「点纸」（每轮一次，不公开）：在同一房间一名还不是纸人的幸存者背后画一笔。画满两笔他就成了纸人，速度和力量各 -1（最多降到最低一格）。',
      '幸存者可以在有火的房间点火把，再「举火验身」：被火照到你会露出真面目，并受到 1 点物理伤害；被你点成纸人的人被照到会解除诅咒。',
      '你防御时多掷 1 颗骰。',
      '露出真面目之前你不能攻击别人，别人也不能攻击你；之后可以正常战斗。',
      '你死亡时你失败。',
    ],
    win: '最后一个活人的笑容也僵在了脸上，嘴角弯得和你一模一样。你们手拉着手，走进了纸扎铺的橱窗。',
  },
  *setup(g) {
    bridge(g);
    const list: string[] = [];
    for (const id of ['kitchen', 'furnace']) {
      const k = g.findTile(id) ?? g.placeRoom(id);
      if (k) list.push(reachable(g, k));
    }
    if (!list.length) {
      const tiles = Object.keys(g.state.tiles).filter((x) => !starts.includes(x) && g.distance(START, x) < Infinity);
      list.push(tiles.length ? tiles[g.rng.int(tiles.length)] : HALL);
    }
    for (const k of list) g.token(k, 'fire', '火', { icon: 'fire' });
    g.hv.fire = list;
    g.hs.paper = {};
    g.setTrack('失去的人', 0, lossNeed(g));
  },
  actions: [
    {
      id: 'torch', side: 'any', label: '点火把', desc: '在有火的房间点一支火把，然后回合结束',
      can: (g, s) => !hasTorch(g, s) && fires(g).includes(g.p(s).tile),
      *run(g, s) {
        g.endTurn();
        g.p(s).flags.h20torch = true;
        g.log(`${g.p(s).name} 点起了一支火把`, 'info');
      },
    },
    {
      id: 'test', side: 'hero', label: '举火验身', desc: '用掉火把，照一照同一房间里的另一个人',
      can: (g, s) => hasTorch(g, s) && g.playersAt(g.p(s).tile).some((o) => o !== s && !cleared(g, o)),
      *run(g, s) {
        const others = g.playersAt(g.p(s).tile).filter((o) => o !== s && !cleared(g, o));
        const o = yield* g.choosePlayer(s, '用火照谁？', others);
        if (o == null) return;
        g.p(s).flags.h20torch = false;
        g.log(`${g.p(s).name} 举起火把，凑近了 ${g.p(o).name} 的脸`, 'haunt');
        if (g.isTraitor(o)) {
          g.revealTraitor();
          g.log(`${g.p(o).name} 的脸皮被火烤得卷了起来——底下是一层白纸！`, 'haunt');
          yield* g.damage(o, 'physical', 1, '火烧纸身', s);
          return;
        }
        const pp = paper(g);
        const strokes: Record<number, number> = (g.hs.strokes ??= {});
        if (!pp[o] && strokes[o]) {
          strokes[o] = 0;
          g.log(`${g.p(o).name} 背后的一道墨痕被火烤得冒烟，消失了`, 'good');
        }
        if (pp[o]) {
          pp[o] = false;
          strokes[o] = 0;
          g.log(`${g.p(o).name} 身上冒出一股纸灰，人却清醒了过来`, 'good');
          yield* g.damage(o, 'physical', 1, '烧掉纸皮', s);
          yield* g.gain(o, 'speed', 1);
          yield* g.gain(o, 'might', 1);
          g.setTrack('失去的人', lost(g), lossNeed(g));
          return;
        }
        g.p(o).flags.h20clear = true;
        g.log(`火光下，${g.p(o).name} 的影子又浓又实——是活人`, 'good');
      },
    },
    {
      id: 'paper', side: 'traitor', label: '点纸', desc: '每轮一次：在同一房间一名幸存者背后画一笔，两笔成纸人（不公开）',
      can: (g, s) => g.hs.lastPaper !== g.state.round && g.heroes().some((h) => g.p(h).tile === g.p(s).tile && !paper(g)[h]),
      *run(g, s) {
        const targets = g.heroes().filter((h) => g.p(h).tile === g.p(s).tile && !paper(g)[h]);
        const h = yield* g.choosePlayer(s, '把谁点成纸人？', targets);
        if (h == null) return;
        g.hs.lastPaper = g.state.round;
        const strokes: Record<number, number> = (g.hs.strokes ??= {});
        strokes[h] = (strokes[h] ?? 0) + 1;
        if (strokes[h] < 2) {
          g.log(`你悄悄在 ${g.p(h).name} 背后画了第一笔`, 'info', s, 'traitor');
          return;
        }
        paper(g)[h] = true;
        g.log(`你在 ${g.p(h).name} 背后画完了最后一笔，他已经是纸人了`, 'info', s, 'traitor');
        const p = g.p(h);
        if (p.traits.speed > 1) yield* g.lose(h, 'speed', 1);
        if (p.traits.might > 1) yield* g.lose(h, 'might', 1);
        g.setTrack('失去的人', lost(g), lossNeed(g));
      },
    },
  ],
  *onRoundEnd(g) {
    bridge(g);
    g.setTrack('失去的人', lost(g), lossNeed(g));
  },
  rollBonus: (g, s, _t, purpose) => (purpose === 'defend' && g.isTraitor(s) ? 1 : 0),
  canAttack(g, s, t) {
    if (t.monster != null) return true;
    if (t.seat == null || t.seat === s) return false;
    const e = exposed(g);
    if (e == null) return false;
    return s === e || t.seat === e;
  },
  checkWin(g) {
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    if (lost(g) >= lossNeed(g)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const e = exposed(g);
      if (e != null) return { goals: [g.p(e).tile], targets: [e], actions: [] };
      if (hasTorch(g, s)) {
        const suspects = g.alive().filter((o) => o !== s && !cleared(g, o)).map((o) => g.p(o).tile);
        return { goals: suspects, actions: ['test'], attack: false };
      }
      return { goals: fires(g), actions: ['torch'], attack: false };
    },
    traitor: (g, s) => {
      const e = exposed(g);
      const pp = paper(g);
      const targets = g.heroes().filter((h) => !pp[h]).map((h) => g.p(h).tile);
      if (e != null) return { goals: targets.length ? targets : g.heroes().map((h) => g.p(h).tile), actions: ['paper'], attack: true };
      // 装作在找火：混在人堆里点纸
      return { goals: targets, actions: ['paper'], attack: false };
    },
  },
};
