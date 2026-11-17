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
  intro: '一串湿漉漉的小脚印从地下室一路印上楼梯，每一步都带着井底的青苔味。你们的朋友就是踩着这串鞋印走下去的。跑得最快的那位同伴低头看了看自己的脚——他不知什么时候穿上了那只绣花鞋，鞋里汩汩地往外冒水。',
  hero: {
    goal: '把房子里的石块搬到古井，把井填上（3 人局 4 块，4 人局 5 块，5/6 人局 6 块）。',
    rules: [
      '古井若尚未被发现，异变开始时会出现在地下室。石块（标记）散落在各个房间。',
      '特殊行动「搬石块」：在有石块的房间搬起一块（每人一次只能搬一块）。搬着石块时你每回合的移动 -1。',
      '特殊行动「填井」：搬着石块在古井时，把石块投进井里。',
      '被水鬼（背叛者）拖住的人不能移动，会被他一路拖着走。被拖住的人可以用特殊行动「挣脱」（力量 5+ 检定）；同格的其他幸存者也可以用特殊行动「拉人」（力量 4+ 检定）把他拉回来。',
      '被拖住的人手里的石块会掉在地上。如果背叛者带着被拖住的人在古井结束回合，那个人会被拖下井淹死。',
    ],
    win: '最后一块青石“咚”地砸进井里，井水翻涌了几下，再没了声息。地上的湿鞋印一点点干了。',
  },
  traitorSide: {
    goal: '你是来找替身的水鬼：把足够多的人拖下古井（3 人局 1 人，4–6 人局 2 人），或者杀死足够多的幸存者（3/4 人局 2 人，5/6 人局 3 人）。',
    rules: [
      '特殊行动「拖拽」（代替本回合的攻击，同时只能拖一个人）：用速度攻击同格一名幸存者（双方掷速度，输家受速度差值的物理伤害）；若你获胜，他还会被你拖住。',
      '你移动时，被拖住的人跟着你移动，不会拖慢你。你不能攻击被你拖住的人。',
      '你带着被拖住的人在古井结束回合时，他被拖下井淹死。',
      '被拖住的人每回合都可以尝试挣脱（力量 5+），同格的幸存者也可以拉他回来（力量 4+）。',
    ],
    win: '井水终于平静下来，水面上漂着一只绣花鞋。替身找到了，你可以上岸了——至少今晚可以。',
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
      id: 'struggle', side: 'hero', label: '挣脱', desc: '力量 5+ 检定，挣脱水鬼的拖拽',
      can: (g, s) => victim(g) === s,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 5, '挣脱 5+');
        if (r >= 5) release(g, `${g.p(s).name} 一脚蹬开了那只冰凉的手`);
        else g.log('湿冷的手攥得更紧了', 'bad');
      },
    },
    {
      id: 'rescue', side: 'hero', label: '拉人', desc: '与被拖住的同伴同格：力量 4+ 检定，把他拉回来',
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
      id: 'carry', side: 'hero', label: '搬石块', desc: '搬起本房间的一块石头（搬着时移动 -1）',
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
      id: 'drag', side: 'traitor', label: '拖拽', desc: '攻击同格一名幸存者，获胜则把他拖住',
      can: (g, s) => !g.attacked && victim(g) == null && g.heroes().some((h) => g.p(h).tile === g.p(s).tile),
      *run(g, s) {
        const list = g.heroes().filter((h) => g.p(h).tile === g.p(s).tile);
        list.sort((a, b) => g.value(a, 'speed') - g.value(b, 'speed'));
        const h = yield* g.choosePlayer(s, '拖住谁？', list);
        if (h == null) return;
        g.attacked = true;
        g.reveal('水鬼「拖拽」得手时会拖住对方，带着他在古井结束回合就会把他淹死。');
        const r = yield* g.attack({ seat: s }, { seat: h }, { trait: 'speed' });
        if (!r.winner || !('seat' in r.winner) || r.winner.seat !== s || g.p(h).dead) return;
        g.hv.victim = h;
        dropStone(g, h);
        g.log(`一只泡得发白的手攥住了 ${g.p(h).name} 的脚踝！`, 'bad');
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
