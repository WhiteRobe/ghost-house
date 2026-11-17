import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 26 湿鞋印（失踪的朋友 × 绣花鞋） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function landing(k: string) {
  return k[0] === 'B' ? 'B:0,-2' : k[0] === 'U' ? 'U:0,-2' : 'G:0,-1';
}

function reachable(g: Game, k: string) {
  if (g.distance('G:0,0', k) < Infinity) return;
  if (k[0] === 'B') g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', k) < Infinity) return;
  const l = landing(k);
  if (g.distance('G:0,0', l) === Infinity) g.link('G:0,-1', l);
  if (g.distance('G:0,0', k) === Infinity) g.link(l, k);
}

const victim = (g: Game) => (g.hv.victim as number | null) ?? null;
const carrying = (g: Game, s: number) => !!g.p(s).flags.stone;

function track(g: Game) {
  g.setTrack('填进井里的石块', g.hv.filled ?? 0, g.hv.need);
}

function release(g: Game, text: string) {
  const v = victim(g);
  if (v == null) return;
  g.hv.victim = null;
  g.log(text, 'good');
}

function dropStone(g: Game, s: number) {
  if (!carrying(g, s)) return;
  g.p(s).flags.stone = false;
  g.token(g.p(s).tile, 'stone', '石块', { icon: 'stone' });
}

export const h26: HauntDef = {
  id: 26,
  title: '湿鞋印',
  type: 'traitor',
  traitor: { type: 'highest', trait: 'speed' },
  intro: '一串湿脚印从地下室踩上楼梯，脚印里沾着井底的青苔。你们的朋友就是顺着这串脚印下去的，再没上来。跑得最快的那个同伴低头一看，自己右脚上套着一只绣花鞋，鞋口正往外冒水。',
  hero: {
    goal: '把石块搬到古井投进去，把井填满：3 人局 4 块，4 人局 5 块，5/6 人局 6 块。',
    rules: [
      '古井还没被发现的话，异变开始时它出现在地下室。石块（标记）散落在各个房间，比需要的多 1 块。古井里有水猴子（怪物）：3 人局没有，4/5 人局 1 只，6 人局 2 只，被击败时只会被击晕。',
      '特殊行动「搬石块」：在有石块的房间搬起 1 块。你一次只能搬 1 块。搬着石块时，你每回合的移动 -1（最少 1）。',
      '特殊行动「填井」：搬着石块走到古井，把它投进井里，计数 +1。',
      '被水鬼（背叛者）拖住的人不能移动，也不能搬石块，水鬼走到哪他跟到哪。他可以用特殊行动「挣脱」：力量检定 5+。和他在同一房间的其他幸存者可以用特殊行动「拉人」：力量检定 4+。成功就不再被拖住。',
      '被拖住时，你手里的石块掉在原地。背叛者带着被拖住的人在古井结束回合，那个人被拖下井，直接死亡。',
    ],
    win: '最后一块青石“咚”地砸下去，井口冒了两个泡，不动了。楼梯上的湿脚印从下往上一个个干掉。',
  },
  traitorSide: {
    goal: '你是来找替身的水鬼。满足任意一条你就获胜：拖下古井的人数达到 3 人局 1 人、4/5/6 人局 2 人；或者死亡的幸存者达到 3/4 人局 2 人、5/6 人局 3 人。',
    rules: [
      '特殊行动「拖拽」（算作你本回合的攻击；手上已拖着人时不能用）：用速度攻击同一房间的一名幸存者，双方掷速度，输的一方受到差值点物理伤害。你赢了，他还会被你拖住。',
      '你每进入一个房间，被拖住的人跟着进来，不会拖慢你。你不能攻击被你拖住的人。你的回合结束时，他不在你身边就算挣脱了。',
      '你带着被拖住的人在古井结束回合，他被拖下井，直接死亡。',
      '被拖住的人每回合可以挣脱（力量检定 5+），同一房间的幸存者也可以拉他（力量检定 4+）。你控制水猴子（3 人局没有，4/5 人局 1 只，6 人局 2 只），它们在你的回合之后行动，可以攻击被拖住的人。',
    ],
    win: '井水平了，水面上漂着一只绣花鞋。替身找够了，你爬上井沿，鞋底第一次是干的。',
  },
  monsters: {
    imp: { name: '水猴子', icon: 'imp', speed: 3, might: 3 },
  },
  *setup(g) {
    const t = g.traitor()!;
    let well = g.placeRoom('well');
    if (!well) well = 'B:0,-2';
    reachable(g, well);
    g.hv.well = well;
    g.hv.filled = 0;
    g.hv.need = g.scale(4, 5, 6, 6);
    g.hv.drowned = 0;
    g.hv.victim = null;
    const stones = g.hv.need + 1;
    let tiles = Object.keys(g.state.tiles).filter((k) => k !== well && !START.includes(k));
    if (tiles.length < stones) tiles = Object.keys(g.state.tiles).filter((k) => k !== well && k !== 'B:0,-2');
    g.rng.shuffle(tiles);
    for (let i = 0; i < stones; i++) {
      const k = tiles[i % tiles.length];
      reachable(g, k);
      g.token(k, 'stone', '石块', { icon: 'stone' });
    }
    const n = g.scale(0, 1, 1, 2);
    for (let i = 0; i < n; i++) g.spawn('imp', well);
    g.log(`${g.p(t).name} 的脚下汪开一滩井水`, 'haunt');
    track(g);
  },
  actions: [
    {
      id: 'struggle', side: 'hero', label: '挣脱', desc: '力量检定 5+：挣脱水鬼',
      can: (g, s) => victim(g) === s,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 5, '挣脱 5+');
        if (r >= 5) release(g, `${g.p(s).name} 一脚蹬开了脚踝上那只手`);
        else g.log('那只手攥得更紧了', 'bad');
      },
    },
    {
      id: 'rescue', side: 'hero', label: '拉人', desc: '和被拖住的同伴在同一房间：力量检定 4+，把他拉回来',
      can: (g, s) => {
        const v = victim(g);
        return v != null && v !== s && g.p(v).tile === g.p(s).tile;
      },
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '拉人 4+');
        if (r >= 4) release(g, `${g.p(s).name} 拽住同伴的胳膊，把他拉了回来`);
        else g.log('手一滑，没拉住', 'bad');
      },
    },
    {
      id: 'carry', side: 'hero', label: '搬石块', desc: '搬起本房间的 1 块石块（搬着时移动 -1）',
      can: (g, s) => !carrying(g, s) && victim(g) !== s && g.tokensAt(g.p(s).tile, 'stone').length > 0,
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'stone')[0];
        if (!t) return;
        g.removeToken(t.id);
        g.p(s).flags.stone = true;
        g.log(`${g.p(s).name} 抱起了一块青石`, 'info');
      },
    },
    {
      id: 'fill', side: 'hero', label: '填井', desc: '把搬来的石块投进井里',
      can: (g, s) => carrying(g, s) && g.p(s).tile === g.hv.well,
      *run(g, s) {
        g.p(s).flags.stone = false;
        g.hv.filled = (g.hv.filled ?? 0) + 1;
        track(g);
        g.log(`${g.p(s).name} 把石块砸进了井里，井底传来一声闷响`, 'good');
      },
    },
    {
      id: 'drag', side: 'traitor', label: '拖拽', desc: '用速度攻击同房间一名幸存者，赢了把他拖住',
      can: (g, s) => !g.attacked && victim(g) == null && g.heroes().some((h) => g.p(h).tile === g.p(s).tile),
      *run(g, s) {
        const list = g.heroes().filter((h) => g.p(h).tile === g.p(s).tile);
        list.sort((a, b) => g.value(a, 'speed') - g.value(b, 'speed'));
        const h = yield* g.choosePlayer(s, '拖住谁？', list);
        if (h == null) return;
        g.attacked = true;
        g.reveal('水鬼「拖拽」赢了会拖住对方；带着他在古井结束回合，他就会被淹死。');
        const r = yield* g.attack({ seat: s }, { seat: h }, { trait: 'speed' });
        if (!r.winner || !('seat' in r.winner) || r.winner.seat !== s || g.p(h).dead) return;
        g.hv.victim = h;
        dropStone(g, h);
        g.log(`一只泡得发白的手攥住了 ${g.p(h).name} 的脚踝`, 'bad');
      },
    },
  ],
  canAttack(g, seat, target) {
    if (seat < 0) return target.seat != null && !g.isTraitor(target.seat);
    if (target.monster != null) return !g.isTraitor(seat);
    const o = target.seat!;
    if (o === seat || g.sideOf(o) === g.sideOf(seat)) return false;
    if (g.isTraitor(seat) && o === victim(g)) return false;
    return true;
  },
  *onTurnStart(g, s) {
    if (victim(g) === s) {
      g.state.moveLeft = 0;
      g.log(`${g.p(s).name} 被拖住了，动弹不得`, 'bad', s);
    } else if (carrying(g, s)) {
      g.state.moveLeft = Math.max(1, g.state.moveLeft - 1);
    }
  },
  *onEnter(g, s) {
    const v = victim(g);
    if (v != null && g.isTraitor(s) && !g.p(v).dead) g.moveTo(v, g.p(s).tile, '被拖着走');
  },
  *onTurnEnd(g, s) {
    if (!g.isTraitor(s)) return;
    const v = victim(g);
    if (v == null) return;
    if (g.p(v).dead) {
      g.hv.victim = null;
      return;
    }
    if (g.p(v).tile !== g.p(s).tile) {
      release(g, `${g.p(v).name} 趁乱挣开了`);
      return;
    }
    if (g.p(s).tile === g.hv.well) {
      g.hv.victim = null;
      g.hv.drowned = (g.hv.drowned ?? 0) + 1;
      g.log(`${g.p(v).name} 被拖进了井里，水面只冒了几个泡`, 'bad');
      yield* g.kill(v, s);
    }
  },
  *onDeath(g, s) {
    dropStone(g, s);
    if (victim(g) === s) g.hv.victim = null;
  },
  *onRoundEnd(g) {
    for (const s of g.alive()) reachable(g, g.p(s).tile);
  },
  checkWin(g) {
    if ((g.hv.filled ?? 0) >= g.hv.need) return { side: 'hero' };
    if ((g.hv.drowned ?? 0) >= g.scale(1, 2, 2, 2)) return { side: 'traitor' };
    const dead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (dead >= g.scale(2, 2, 3, 3)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const well = g.hv.well as string;
      const here = g.p(s).tile;
      const v = victim(g);
      if (v === s) return { goals: [here], actions: ['struggle'] };
      if (v != null && !carrying(g, s) && g.distance(here, g.p(v).tile) <= 3) return { goals: [g.p(v).tile], actions: ['rescue', 'carry'] };
      if (carrying(g, s)) return { goals: [well], actions: ['fill', 'rescue'] };
      const toks = g.tokens('stone').map((t) => t.tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      if (toks.length) return { goals: toks, actions: ['carry', 'rescue'] };
      return { goals: [well], actions: ['rescue'] };
    },
    traitor: (g) => {
      const v = victim(g);
      if (v != null) return { goals: [g.hv.well], attack: false };
      const hs = g.heroes();
      hs.sort((a, b) => (carrying(g, b) ? 1 : 0) - (carrying(g, a) ? 1 : 0));
      return { goals: hs.map((h) => g.p(h).tile), actions: ['drag'] };
    },
    monster: (g) => {
      const hs = g.heroes().filter((h) => carrying(g, h));
      return { goals: hs.length ? hs.map((h) => g.p(h).tile) : [g.hv.well] };
    },
  },
};
