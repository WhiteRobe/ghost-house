import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const need = (g: Game) => g.scale(2, 3, 3, 4);
const partners = (g: Game): number[] => g.hs.partners ?? [];
const revealed = (g: Game) => g.state.haunt?.traitor != null;

function sync(g: Game) {
  g.setTrack('舞池里的舞伴', partners(g).length, need(g));
}

/** 某个幸存者确知谁是背叛者（被邀舞过） */
const knows = (g: Game, s: number): boolean => !!(g.hs.knows ?? {})[s];

/** 8 红舞鞋（直播 × 绣花鞋）——隐藏背叛者 */
export const h8: HauntDef = {
  id: 8,
  title: '红舞鞋',
  type: 'hidden',
  traitor: { type: 'hidden' },
  intro: '舞厅里的老留声机自己转了起来，放的是一支百乐门的老曲子。你们的脚底都开始发痒，脚跟想跟着打拍子。有人脚上换了一只湿透的绣花鞋，鞋面还在往下滴水。穿鞋的人在找舞伴。',
  hero: {
    goal: '找出穿绣花鞋的背叛者，杀死他。',
    rules: [
      '背叛者藏在你们中间，只有他自己知道。他死亡时身份公开，你们获胜。',
      '背叛者凑齐舞伴就赢：3 人局 2 名，4、5 人局 3 名，6 人局 4 名。计数轨公开舞伴人数，舞伴死了也算。',
      '背叛者可以邀同房间的人跳舞（速度对抗）。被邀过的人，不管有没有被拉进舞池，都会知道他是谁。',
      '每轮结束时，所有活着的人做速度检定 4+。失败：被拖进随机一个相邻房间，失去 1 点理智。',
      '背叛者现身之前，谁都不能攻击别人。',
      '特殊行动「揭穿」（背叛者现身前可用）：指认同房间的一个人，知识检定 5+；你被邀过舞的话只要 3+。成功：他是背叛者就当场现身；不是就公开他清白。失败没有后果。',
      '背叛者现身后，你们可以攻击他。',
    ],
    win: '唱针“嗤啦”一声划过唱片。绣花鞋从背叛者脚上掉下来，鞋底的水渗进了地板缝。',
  },
  traitorSide: {
    goal: '在死之前凑齐舞伴（3 人局 2 名，4、5 人局 3 名，6 人局 4 名），或者杀死所有幸存者。',
    rules: [
      '你是隐藏的背叛者，别人不知道你的身份。你死亡时身份公开，幸存者获胜。',
      '每轮结束的速度检定 4+ 你也要做，失败一样被拖走、失去 1 点理智。',
      '特殊行动「邀舞」：选同房间一名还不是舞伴的幸存者，双方掷速度对抗（骰子公开，但不显示你的名字；被邀的人名字会出现）。你点数更高：他成为你的舞伴（死了也算），受到 1 点精神伤害。不管成败，他都会知道你是谁，之后揭穿你只需 3+。',
      '你也可以用「揭穿」指认别人，成功只会公开对方清白，用来混淆视听。',
      '现身之前谁都不能攻击别人。被「揭穿」成功你就现身，之后双方可以互相攻击。',
    ],
    win: '曲子放了一遍又一遍。舞池里的人越转越快，最后地板上只剩几双空鞋，还在踩着拍子。',
  },
  *setup(g) {
    g.placeRoom('cellar-hatch');
    g.placeRoom('ballroom');
    g.hs.partners = [];
    g.hs.knows = {};
    g.hs.cleared = [];
    sync(g);
  },
  canAttack(g, s, target) {
    if (target.monster != null) return true;
    if (target.seat == null || target.seat === s || s < 0) return false;
    if (!revealed(g)) return false;
    return g.isTraitor(s) !== g.isTraitor(target.seat);
  },
  actions: [
    {
      id: 'invite', side: 'traitor', label: '邀舞', desc: '与同房间一名幸存者速度对抗，赢了他就成为你的舞伴',
      can: (g, s) => g.heroes().some((o) => g.p(o).tile === g.p(s).tile && !partners(g).includes(o)),
      *run(g, s) {
        const hs = g.heroes().filter((o) => g.p(o).tile === g.p(s).tile && !partners(g).includes(o));
        const o = yield* g.choosePlayer(s, '邀请谁跳舞？', hs);
        if (o == null) return;
        const a = yield* g.roll(g.value(s, 'speed'), '邀舞');
        const d = yield* g.roll(g.value(o, 'speed'), `${g.p(o).name} 挣扎`);
        g.hs.knows = { ...(g.hs.knows ?? {}), [o]: true };
        if (a > d) {
          g.hs.partners = [...partners(g), o];
          sync(g);
          g.log(`你拉着 ${g.p(o).name} 转了一圈，他成了你的舞伴`, 'haunt', s, 'traitor');
          g.log(`${g.p(o).name} 被人拽着跳了一支舞，舞伴又多了一个`, 'bad');
          yield* g.damage(o, 'mental', 1, '被迫起舞', s);
        } else {
          g.log(`${g.p(o).name} 甩开了一只冰凉的手`, 'info');
        }
      },
    },
    {
      id: 'accuse', side: 'any', label: '揭穿', desc: '指认同房间一个人，知识检定 5+（你被邀过舞则 3+）',
      can: (g, s) => !revealed(g) && g.alive().some((o) => o !== s && g.p(o).tile === g.p(s).tile),
      *run(g, s) {
        const here = g.p(s).tile;
        const cleared: number[] = g.hs.cleared ?? [];
        const kn = knows(g, s) && !g.isTraitor(s);
        // 确知的嫌疑人排在前面，其次是还没被证明清白的人
        const others = g.alive().filter((o) => o !== s && g.p(o).tile === here)
          .sort((a, b) => Number(kn && g.isTraitor(b)) - Number(kn && g.isTraitor(a)) || Number(cleared.includes(a)) - Number(cleared.includes(b)));
        const o = yield* g.choosePlayer(s, '指认谁？', others);
        if (o == null) return;
        g.log(`${g.p(s).name} 指着 ${g.p(o).name}：“是你！”`, 'haunt');
        const nd = kn ? 3 : 5;
        const r = yield* g.check(s, 'knowledge', nd, `揭穿 ${nd}+`);
        if (r < nd) { g.log('没找到证据', 'info'); return; }
        if (g.isTraitor(o)) {
          g.revealTraitor();
          g.log(`${g.p(o).name} 的裤脚底下露出一只湿透的绣花鞋！`, 'haunt');
        } else {
          g.hs.cleared = [...cleared, o];
          g.log(`${g.p(o).name} 脚上穿的是自己的鞋，他是清白的`, 'good');
        }
      },
    },
  ],
  *onRoundEnd(g) {
    for (const s of g.alive()) {
      const r = yield* g.check(s, 'speed', 4, '跟上节拍 4+');
      if (r >= 4) continue;
      const ns = g.neighbors(g.p(s).tile);
      if (ns.length) g.moveTo(s, ns[g.rng.int(ns.length)], '被曲子带着转进了隔壁');
      yield* g.lose(s, 'sanity', 1);
    }
  },
  checkWin(g) {
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    if (partners(g).length >= need(g)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const here = g.p(s).tile;
      const t = g.traitor()!;
      if (revealed(g)) return { goals: [g.p(t).tile], targets: [t] };
      if (knows(g, s)) return { goals: [g.p(t).tile], actions: ['accuse'] };
      // 去找还没被证明清白的人
      const cleared: number[] = g.hs.cleared ?? [];
      const sus = g.alive().filter((o) => o !== s && !cleared.includes(o)).map((o) => g.p(o).tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      return { goals: sus, actions: ['accuse'] };
    },
    traitor: (g, s) => {
      const here = g.p(s).tile;
      const free = g.heroes().filter((o) => !partners(g).includes(o)).map((o) => g.p(o).tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      if (revealed(g)) return { goals: free.length ? free : g.heroes().map((o) => g.p(o).tile), actions: ['invite'] };
      return { goals: free, actions: ['invite'], attack: false };
    },
  },
};
