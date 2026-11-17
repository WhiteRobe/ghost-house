import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const lives = (g: Game): number => g.hv.lives ?? 0;

function setLives(g: Game, n: number) {
  g.hv.lives = Math.max(0, n);
  g.setTrack('猫妖剩余的命', g.hv.lives, 9);
}

function* loseLives(g: Game, n: number, by: number | null) {
  const t = g.traitor();
  if (t == null || n <= 0) return;
  setLives(g, lives(g) - n);
  g.log(`猫妖惨叫一声，掉了 ${n} 条命（还剩 ${lives(g)} 条）`, 'good');
  if (lives(g) <= 0) {
    g.hv.slain = true;
    yield* g.kill(t, by);
  }
}

const TRAITS = ['speed', 'might', 'sanity', 'knowledge'] as const;

/** 把猫妖属性的下降还原成扣命。返回扣掉的命数 */
function absorb(g: Game): number {
  const t = g.traitor();
  if (t == null) return 0;
  const p = g.p(t);
  const snap: Record<string, number> = g.hs.h5snap ?? { ...p.traits };
  let lost = 0;
  for (const k of TRAITS) {
    if (p.traits[k] < snap[k]) { lost += snap[k] - p.traits[k]; p.traits[k] = snap[k]; }
    else snap[k] = p.traits[k];
  }
  g.hs.h5snap = snap;
  return lost;
}

function* settle(g: Game) {
  const t = g.traitor();
  if (t == null || g.p(t).dead) return;
  const n = absorb(g);
  if (n > 0) yield* loseLives(g, n, null);
}

/** 同层、无视墙壁、曼哈顿距离不超过 2 的幸存者 */
function pounceTargets(g: Game, s: number): number[] {
  const me = g.state.tiles[g.p(s).tile];
  if (!me) return [];
  return g.heroes().filter((o) => {
    const t = g.state.tiles[g.p(o).tile];
    return t && t.floor === me.floor && g.p(o).tile !== g.p(s).tile && Math.abs(t.x - me.x) + Math.abs(t.y - me.y) <= 2;
  });
}

/** 对抗：双方掷力量，返回差值（正数表示发起者赢） */
function* contest(g: Game, a: number, d: number, label: string) {
  const x = yield* g.check(a, 'might', undefined, label);
  const y = yield* g.check(d, 'might', undefined, label + '（抵挡）');
  return x - y;
}

/** 5 九命猫妖（直播 × 黑猫） */
export const h5: HauntDef = {
  id: 5,
  title: '九命猫妖',
  type: 'traitor',
  traitor: { type: 'holder', card: 'cat' },
  intro: '黑猫从背叛者怀里跳下来，影子却留在了他身上。他弓起背，瞳孔竖成一条线，指甲在地板上划出九道白痕。老人们说，猫有九条命——借来的那九条，总要有人还。',
  hero: {
    goal: '把猫妖的九条命全部打光。',
    rules: [
      '猫妖（背叛者）有 9 条命（见计数轨）。普通的攻击对它无效，你们不能对它发起普通攻击。',
      '特殊行动「扑打猫妖」：与猫妖同处一室时，双方各掷力量对抗。你点数更高时，猫妖失去等于差值的命；否则你受到等于差值的物理伤害（平局无事）。',
      '猫妖受到任何伤害都只会掉命，不会降低属性；命用完才会死。',
      '猫妖可以穿墙：它能扑向同楼层、无视墙壁两格以内的幸存者。',
    ],
    win: '第九条命也被打散了。黑猫的影子从背叛者身上剥落，蹿进墙缝，再也没有出来。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '你有 9 条命（见计数轨）。你受到的伤害只扣命，不降低属性；命用完你才会死。',
      '你与幸存者之间不能发起普通攻击，改用下面的特殊行动。',
      '特殊行动「扑击」：与一名幸存者同处一室时，双方各掷力量对抗；你点数更高时对方受到差值 +1 的物理伤害，否则你失去等于差值的命（平局无事）。',
      '特殊行动「穿墙」：移动到同楼层、无视墙壁和门、横竖距离合计不超过 2 格的一名幸存者所在的房间（不花移动）。',
    ],
    win: '最后一声尖叫被猫叫盖了过去。洋楼里安安静静，只有一只黑猫在舔爪子，它的命又攒满了。',
  },
  *setup(g) {
    g.placeRoom('cellar-hatch');
    setLives(g, 9);
    const t = g.traitor()!;
    // 猫妖的属性至少要像样
    const p = g.p(t);
    if (g.value(t, 'might') < 4) yield* g.gain(t, 'might', 1);
    if (g.value(t, 'speed') < 4) yield* g.gain(t, 'speed', 1);
    g.hs.h5snap = { ...p.traits };
    g.log(`${p.name} 化作了九命猫妖`, 'haunt');
  },
  canAttack(g, s, target) {
    if (target.monster != null) return !g.isTraitor(s);
    if (target.seat == null || target.seat === s || s < 0) return false;
    return false; // 猫妖与幸存者之间都用特殊行动
  },
  actions: [
    {
      id: 'swat', side: 'hero', label: '扑打猫妖', desc: '与猫妖力量对抗：赢则它失去差值条命，输则你受差值物理伤害',
      can: (g, s) => { const t = g.traitor(); return t != null && !g.p(t).dead && g.p(t).tile === g.p(s).tile; },
      *run(g, s) {
        const t = g.traitor()!;
        const d = yield* contest(g, s, t, '扑打猫妖');
        if (d > 0) yield* loseLives(g, d, s);
        else if (d < 0) yield* g.damage(s, 'physical', -d, '猫爪', t);
        else g.log('猫妖一扭身躲开了', 'info');
      },
    },
    {
      id: 'pounce', side: 'traitor', label: '扑击', desc: '与同房间一名幸存者力量对抗：赢则对方受差值 +1 物理伤害，输则你失去差值条命',
      can: (g, s) => g.heroes().some((o) => g.p(o).tile === g.p(s).tile),
      *run(g, s) {
        const hs = g.heroes().filter((o) => g.p(o).tile === g.p(s).tile).sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
        const o = yield* g.choosePlayer(s, '扑向谁？', hs);
        if (o == null) return;
        const d = yield* contest(g, s, o, '扑击');
        if (d > 0) yield* g.damage(o, 'physical', d + 1, '猫妖扑击', s);
        else if (d < 0) yield* loseLives(g, -d, o);
        else g.log(`${g.p(o).name} 堪堪躲过了一爪`, 'info');
      },
    },
    {
      id: 'phase', side: 'traitor', label: '穿墙', desc: '无视墙壁，移动到同楼层两格以内一名幸存者所在的房间',
      can: (g, s) => pounceTargets(g, s).length > 0,
      *run(g, s) {
        const o = yield* g.choosePlayer(s, '穿墙扑向谁？', pounceTargets(g, s));
        if (o != null) g.moveTo(s, g.p(o).tile, '从墙里钻了出来');
      },
    },
  ],
  // 猫妖受到的伤害只扣命：在受伤导致死亡时把属性还回去。
  *onDeath(g, s, killer) {
    if (!g.isTraitor(s) || g.hv.slain) return;
    g.p(s).dead = false;
    const n = absorb(g);
    yield* loseLives(g, Math.max(1, n), killer);
  },
  *onTurnStart(g) { yield* settle(g); },
  *onTurnEnd(g) { yield* settle(g); },
  *onRoundEnd(g) { yield* settle(g); },
  checkWin(g) {
    if (g.hv.slain || lives(g) <= 0) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g) => {
      const t = g.traitor()!;
      return { goals: [g.p(t).tile], actions: ['swat'] };
    },
    traitor: (g, s) => {
      const here = g.p(s).tile;
      const together = g.heroes().some((o) => g.p(o).tile === here);
      return { goals: g.heroes().map((o) => g.p(o).tile), actions: together ? ['pounce'] : ['phase', 'pounce'] };
    },
  },
};
