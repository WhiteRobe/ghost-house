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
  intro: '舞厅里那台老留声机自己转了起来，咿咿呀呀放着一支百乐门的老曲子。所有人的脚都开始发痒，像有人在鞋里塞了一根看不见的线。你们之中有人穿上了那只湿漉漉的绣花鞋——它在找舞伴。',
  hero: {
    goal: '找出穿着绣花鞋的背叛者并杀死他。',
    rules: [
      '每轮结束时，所有存活的探险者进行速度 4+ 检定；失败的人被音乐拖着随机走进一个相邻房间，并失去 1 点理智。',
      '背叛者是隐藏的。他可以悄悄邀请同房间的人跳舞，被他邀舞的人（无论成败）会知道他的身份；邀舞成功则多了一个“舞伴”（计数轨公开舞伴人数，舞伴死后仍然算数）。',
      '背叛者现身之前，任何探险者都不能互相攻击。',
      '特殊行动「揭穿」：与另一名探险者同处一室时，指认他并进行知识 5+ 检定（如果他曾邀你跳舞，你心里有数，只需 3+）。成功时：如果他是背叛者，他立刻现身；否则大家知道他是清白的。',
      '背叛者现身后，你们可以攻击他；他死亡即获胜。',
    ],
    win: '留声机的唱针“嗤啦”一声划破了唱片。绣花鞋从背叛者脚上脱落，鞋底的水一点点渗进了地板。',
  },
  traitorSide: {
    goal: '在被杀死之前凑齐舞伴（3 人局 2 人，4/5 人局 3 人，6 人局 4 人），或者杀死所有幸存者。',
    rules: [
      '你是隐藏的背叛者，别人不知道你的身份。每轮结束的速度检定你也要做（以免露馅）。',
      '特殊行动「邀舞」：与一名还不是舞伴的幸存者同处一室时，双方各掷速度对抗（不显示是谁掷的）。你点数更高时他成为你的舞伴（死后仍算数），并受到 1 点精神伤害；无论成败他都会知道你的身份。',
      '现身之前任何人都不能互相攻击；现身之后你可以正常攻击幸存者。被「揭穿」成功时你会现身。',
    ],
    win: '曲子一遍又一遍地放着。舞池里的人越转越快，越转越轻，最后只剩下一双双空鞋，还在踩着拍子。',
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
      id: 'invite', side: 'traitor', label: '邀舞', desc: '与同房间一名幸存者速度对抗，胜则他成为你的舞伴',
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
          g.log(`${g.p(o).name} 被人拉着跳了一支舞，舞池里又多了一个舞伴`, 'bad');
          yield* g.damage(o, 'mental', 1, '被迫起舞', s);
        } else {
          g.log(`${g.p(o).name} 甩开了一只冰凉的手`, 'info');
        }
      },
    },
    {
      id: 'accuse', side: 'any', label: '揭穿', desc: '指认同房间的一名探险者，知识 5+ 检定（被他邀过舞的人只需 3+）',
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
        if (r < nd) { g.log('可惜没有找到证据', 'info'); return; }
        if (g.isTraitor(o)) {
          g.revealTraitor();
          g.log(`${g.p(o).name} 的裤脚下露出了一只湿漉漉的绣花鞋！`, 'haunt');
        } else {
          g.hs.cleared = [...cleared, o];
          g.log(`${g.p(o).name} 脚上穿的是自己的鞋——他是清白的`, 'good');
        }
      },
    },
  ],
  *onRoundEnd(g) {
    for (const s of g.alive()) {
      const r = yield* g.check(s, 'speed', 4, '跟上节拍 4+');
      if (r >= 4) continue;
      const ns = g.neighbors(g.p(s).tile);
      if (ns.length) g.moveTo(s, ns[g.rng.int(ns.length)], '被音乐拖着转进了隔壁');
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
