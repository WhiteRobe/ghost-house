import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 40 祖传之玉（百年诅咒 × 血沁玉佩） */

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊地板塌了个洞，底下是去地下室的石阶', 'haunt');
  }
}

function track(g: Game) {
  g.setTrack('祖传玉上的裂纹', g.hv.cracks, g.hv.need);
}

export const h40: HauntDef = {
  id: 40,
  title: '祖传之玉',
  type: 'traitor',
  traitor: { type: 'highest', trait: 'sanity' },
  intro: '玉里那缕红丝动了一下，又动了一下。理智最高的那个人把玉佩捧起来，开口是个老太太的声音，又慢又哑：“一家人，就该整整齐齐的。都进来，进玉里来。”',
  hero: {
    goal: '砸碎背叛者手里的祖传玉，或者让背叛者死掉。',
    rules: [
      '背叛者不能用普通攻击打你，他用「摄魂」：你和他各掷力量，你点数低就失去等于差值的理智。理智降到 0 而死的人，原地变成他的傀儡（怪物，力量 4）。',
      '摄魂时你点数更高，背叛者受到等于差值的物理伤害。点数相同，什么都不发生。',
      '异变开始时，背叛者被带到离你们最远的房间，身边跟着先人魂（怪物，力量 3，3/4/5/6 人局分别 1/2/2/3 个）。先人魂受伤只会被击晕。',
      '特殊行动「砸玉」：和背叛者在同一房间时执行，力量检定 5+，成功玉上多 1 道裂纹，失败你失去 1 点理智。裂纹达到 3 道（3/4 人局）或 4 道（5/6 人局），玉碎，你们获胜。',
      '祖传玉护着背叛者，你们不能攻击他，只能攻击怪物。背叛者死亡（比如摄魂失手受伤而死），你们获胜。',
    ],
    win: '玉“啪”地碎成几瓣，红丝从裂口里淌出来，是黑红色的。窗缝里呼地灌进一阵风，又呼地出去了。',
  },
  traitorSide: {
    goal: '把所有人的魂都收进玉里：所有幸存者死亡。',
    rules: [
      '你不能攻击幸存者，幸存者也不能攻击你。',
      '特殊行动「摄魂」：选同房间一名幸存者，你和他各掷力量。你点数高，他失去等于差值的理智；他点数高，你受到等于差值的物理伤害；相同则无事发生。',
      '理智降到 0 而死的幸存者，原地变成你的傀儡（怪物，速度 3、力量 4）。',
      '你控制先人魂（速度 3、力量 3）和傀儡，它们在你的回合之后行动，可以攻击幸存者。',
      '幸存者和你在同一房间时可以「砸玉」（力量检定 5+），裂纹达到 3 道（3/4 人局）或 4 道（5/6 人局），你失败。你死亡也算失败。',
    ],
    win: '最后一个人的魂也进了玉。玉里的红丝粗了一圈，你把玉佩挂回脖子上，拍了拍：“一家人，整整齐齐。”',
  },
  monsters: {
    ancestor: { name: '先人魂', icon: 'ancestor', speed: 3, might: 3 },
    puppet: { name: '傀儡', icon: 'puppet', speed: 3, might: 4 },
  },
  *setup(g) {
    connect(g);
    g.hv.cracks = 0;
    g.hv.need = g.scale(3, 3, 4, 4);
    const t = g.traitor()!;
    // 捧玉人被玉光带走，出现在离众人最远的房间
    const here = g.heroes().map((o) => g.p(o).tile);
    const far = Object.keys(g.state.tiles)
      .filter((k) => here.every((h) => g.distance(h, k) < Infinity))
      .sort((a, b) => Math.min(...here.map((h) => g.distance(h, b))) - Math.min(...here.map((h) => g.distance(h, a))) || (a < b ? -1 : 1));
    if (far.length) g.moveTo(t, far[0], '被一团玉光裹走了');
    g.log(`${g.p(t).name} 被玉光裹走，出现在「${g.tileName(g.p(t).tile)}」`, 'haunt');
    for (let i = 0; i < g.scale(1, 2, 2, 3); i++) g.spawn('ancestor', g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'soul', side: 'traitor', label: '摄魂', desc: '和同房间一名幸存者各掷力量，你点数高他失去理智',
      can: (g, s) => g.heroes().some((o) => g.p(o).tile === g.p(s).tile),
      *run(g, s) {
        const list = g.heroes().filter((o) => g.p(o).tile === g.p(s).tile);
        list.sort((a, b) => g.value(a, 'sanity') - g.value(b, 'sanity'));
        const t = yield* g.choosePlayer(s, '摄谁的魂？', list);
        if (t == null) return;
        const a = yield* g.roll(g.value(s, 'might') + g.bonus(s, 'might', 'attack'), '摄魂', s);
        const d = yield* g.roll(g.value(t, 'might') + g.bonus(t, 'might', 'defend'), '抵抗', t);
        if (a > d) {
          g.log(`玉光罩住了 ${g.p(t).name}，他眼神空了一下（${a} 对 ${d}）`, 'bad');
          yield* g.lose(t, 'sanity', a - d);
        } else if (d > a) {
          g.log(`${g.p(t).name} 挣开玉光，反手一拳（${a} 对 ${d}）`, 'good');
          yield* g.damage(s, 'physical', d - a, '摄魂失败', t);
        } else g.log(`玉光亮了一下就灭了（${a} 对 ${d}）`, 'info');
      },
    },
    {
      id: 'smash', side: 'hero', label: '砸玉', desc: '和背叛者在同一房间：力量检定 5+，玉上多 1 道裂纹',
      can: (g, s) => {
        const t = g.traitor();
        return t != null && !g.p(t).dead && g.p(t).tile === g.p(s).tile;
      },
      *run(g, s) {
        const r = yield* g.check(s, 'might', 5, '砸玉 5+');
        if (r >= 5) {
          g.hv.cracks++;
          g.log(`${g.p(s).name} 一拳砸在玉上，“咔”的一声（裂纹 ${g.hv.cracks}/${g.hv.need}）`, 'good');
          track(g);
        } else {
          g.log('玉光一闪，你的手冰得发麻', 'bad', s);
          yield* g.lose(s, 'sanity', 1);
        }
      },
    },
  ],
  *onDeath(g, s) {
    if (g.isTraitor(s)) return;
    if (g.p(s).traits.sanity !== 0) return;
    const m = g.spawn('puppet', g.p(s).tile, { seat: s });
    if (m) m.name = `傀儡（${g.p(s).name}）`;
    g.log(`${g.p(s).name} 眼神空了，转过身，站到了捧玉人身后`, 'bad');
  },
  canAttack(g, seat, target) {
    if (seat === -1) return true;
    if (target.monster != null) return !g.isTraitor(seat);
    const ts = target.seat!;
    if (ts === seat || g.sideOf(seat) === g.sideOf(ts)) return false;
    // 背叛者不能用普通攻击伤害幸存者；幸存者也伤不到被玉护着的背叛者
    return false;
  },
  checkWin(g) {
    if (g.hv.cracks >= g.hv.need) return { side: 'hero' };
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g) => {
      const t = g.traitor()!;
      return { goals: [g.p(t).tile], actions: ['smash'], targets: [...g.state.monsters.map((m) => `m${m.id}` as const)] };
    },
    traitor: (g) => {
      const hs = [...g.heroes()].sort((a, b) => g.value(a, 'sanity') - g.value(b, 'sanity'));
      return { goals: hs.map((s) => g.p(s).tile), actions: ['soul'], attack: false };
    },
  },
};
