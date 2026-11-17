import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 40 祖传之玉（百年诅咒 × 血沁玉佩） */

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，露出通往地下室的石阶', 'haunt');
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
  intro: '玉里那缕红丝忽然动了，像一条活过来的血管。理智最清醒的那个人捧起玉佩，声音变得又老又慢：“一家人，就该整整齐齐的。都进来吧，进玉里来。”',
  hero: {
    goal: '击碎背叛者手里的祖传玉。',
    rules: [
      '背叛者不会直接伤你的身体，他会「摄魂」：和你力量对抗，你输了就失去等同于差值的理智（不能减免）。理智降到 0 的人会死去，并变成他的傀儡（怪物，力量 4）。',
      '在摄魂中你赢了，背叛者受到等同于差值的物理伤害。',
      '异变开始时，背叛者被玉光带到离你们最远的房间，身边还跟着几个先人魂（怪物，力量 3），受伤会被击晕。',
      '特殊行动「砸玉」：与背叛者同处一室时进行力量 5+ 检定，成功则玉上多一道裂纹；失败则玉光一闪，你失去 1 点理智。裂纹达到要求（3/4 人 3 道，5/6 人 4 道）时玉碎，你们获胜。',
      '祖传玉护着背叛者：你们不能用普通攻击伤害他（但可以攻击怪物）。他在摄魂中失手受伤而死，你们同样获胜。',
    ],
    win: '玉“啪”地碎成几瓣，红丝从裂口里流出来，像一滴滴陈年的血。被收进去的魂魄化成一阵风，从窗缝里散了出去。',
  },
  traitorSide: {
    goal: '把全家人的魂魄都收进玉里：所有幸存者死亡。',
    rules: [
      '你不能用普通攻击伤害幸存者；祖传玉也护着你，幸存者不能用普通攻击伤害你。',
      '特殊行动「摄魂」：和同一房间里的一名幸存者进行力量对抗。你赢了，他失去等同于差值的理智（不能减免）；他赢了，你受到等同于差值的物理伤害。',
      '理智降到 0 而死的幸存者会变成你的傀儡（怪物，速度 3、力量 4）。',
      '你控制先人魂和傀儡，它们在你的回合之后行动，能正常攻击幸存者。',
      '幸存者可以和你同处一室时「砸玉」，裂纹达到要求（3/4 人 3 道，5/6 人 4 道）你就输了。你在摄魂中失手受伤而死也会输。',
    ],
    win: '最后一缕魂魄也被吸进了玉里。玉佩里的红丝又粗了一圈，你把它挂回脖子上，轻轻拍了拍：“一家人，整整齐齐。”',
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
      id: 'soul', side: 'traitor', label: '摄魂', desc: '和同房间一名幸存者力量对抗，赢了他失去理智',
      can: (g, s) => g.heroes().some((o) => g.p(o).tile === g.p(s).tile),
      *run(g, s) {
        const list = g.heroes().filter((o) => g.p(o).tile === g.p(s).tile);
        list.sort((a, b) => g.value(a, 'sanity') - g.value(b, 'sanity'));
        const t = yield* g.choosePlayer(s, '摄谁的魂？', list);
        if (t == null) return;
        const a = yield* g.roll(g.value(s, 'might') + g.bonus(s, 'might', 'attack'), '摄魂', s);
        const d = yield* g.roll(g.value(t, 'might') + g.bonus(t, 'might', 'defend'), '抵抗', t);
        if (a > d) {
          g.log(`玉光罩住了 ${g.p(t).name}，他的魂魄被抽走了一截（${a} 对 ${d}）`, 'bad');
          yield* g.lose(t, 'sanity', a - d);
        } else if (d > a) {
          g.log(`${g.p(t).name} 挣脱了玉光，反手一击（${a} 对 ${d}）`, 'good');
          yield* g.damage(s, 'physical', d - a, '摄魂失败', t);
        } else g.log(`玉光一闪而灭（${a} 对 ${d}）`, 'info');
      },
    },
    {
      id: 'smash', side: 'hero', label: '砸玉', desc: '与背叛者同室：力量 5+，玉上多一道裂纹',
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
          g.log('玉光一闪，你的手像伸进了冰水里', 'bad', s);
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
    g.log(`${g.p(s).name} 的眼神空了，木然地转过身，站到了捧玉人的身后`, 'bad');
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
