import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 32 野猫群（拆迁前夜 × 黑猫） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const CAP = 12;

function spot(g: Game, ids: string[]): string {
  for (const id of ids) {
    const k = g.placeRoom(id, ['G']);
    if (k) return k;
  }
  const t = Object.keys(g.state.tiles).filter((k) => k.startsWith('G:') && !START.includes(k));
  return t.length ? t[g.rng.int(t.length)] : 'G:0,0';
}

/** 地下室与一楼不连通时，打通走廊与地下室楼梯口 */
function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，露出通往地下室的石阶', 'haunt');
  }
}

function track(g: Game) {
  if (g.hv.lured) g.setTrack('猫群正在厨房吃饵', g.state.monsters.length);
  else g.setTrack('诱饵准备进度', g.hv.bait, g.hv.need);
}

function cats(g: Game) {
  return g.state.monsters.filter((m) => m.kind === 'cat');
}

function spawnCat(g: Game, tile: string) {
  if (cats(g).length >= CAP) return;
  const n = (g.hv.spawned = (g.hv.spawned ?? 0) + 1);
  g.spawn('cat', tile, { guard: n % 2 === 0 });
}

/** 猫婆身边有没有清醒的猫护着 */
function guarded(g: Game): boolean {
  const t = g.traitor();
  if (t == null || g.hv.lured) return false;
  return g.monstersAt(g.p(t).tile, 'cat').some((m) => !m.stunned);
}

export const h32: HauntDef = {
  id: 32,
  title: '野猫群',
  type: 'traitor',
  traitor: { type: 'lowest', trait: 'knowledge' },
  intro: '拆迁队赶走了巷子里所有的野猫，它们全躲进了这栋楼。黑暗里亮起一双又一双绿眼睛，一个佝偻的身影从猫堆里站起来，嘴里“咪咪”地唤着。',
  hero: {
    goal: '在厨房备好诱饵把猫群引开，然后制服猫婆。',
    rules: [
      '猫婆（背叛者）指挥着一大群野猫。野猫很弱，被打败就会被击晕，但数量会越来越多。',
      '猫群护主：只要猫婆所在的房间里有清醒的野猫，就不能攻击猫婆。猫婆受到力量攻击防御时多掷 1 颗骰。',
      '特殊行动「备饵」：在厨房（若未发现则会出现在一楼）进行知识 3+ 检定，成功则诱饵进度 +1。进度满（3 人 3 次，4/5 人 4 次，6 人 5 次）时，所有野猫立刻被吸引到厨房埋头吃饵：它们不再攻击、不再护主，猫婆也不再招来新猫。',
      '猫婆如果在厨房完成「唤回猫群」，诱饵就会作废，进度清零，需要重新准备。',
    ],
    win: '猫婆被按倒在地，嘴里的唤猫声变成了呜咽。厨房里的野猫吃饱了，一只接一只从破窗跳了出去，再也没有回头。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '你控制野猫（速度 4、力量 2），它们在你的回合之后行动。一半野猫跟着你护主，另一半去追幸存者。',
      '猫群护主：只要你所在的房间里有清醒的野猫，幸存者就不能攻击你。',
      '你身手像猫一样灵活：受到力量攻击防御时多掷 1 颗骰。',
      '特殊行动「唤猫」：在你的房间招来一只野猫（场上最多 12 只）。每轮结束时也会自动来一只新猫。',
      '幸存者在厨房备好诱饵后，所有野猫会被引到厨房吃饵，不再攻击也不再护主。',
      '特殊行动「唤回猫群」：猫群在吃饵时，你在厨房进行理智 4+ 检定，成功则诱饵作废、进度清零，野猫重新听你指挥。',
    ],
    win: '最后一个人倒下的时候，猫群围了上来。月光下，猫婆坐在一地绿眼睛中间，慢慢地数着她的猫。',
  },
  monsters: {
    cat: { name: '野猫', icon: 'cat', speed: 4, might: 2 },
  },
  *setup(g) {
    connect(g);
    const kitchen = spot(g, ['kitchen', 'dining', 'servants']);
    g.hv.kitchen = kitchen;
    g.hv.bait = 0;
    g.hv.need = g.scale(3, 4, 4, 5);
    g.hv.lured = false;
    g.token(kitchen, 'bait', '诱饵', { icon: 'bait' });
    const t = g.traitor()!;
    for (let i = 0; i < g.scale(4, 5, 6, 7); i++) spawnCat(g, g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'bait', side: 'hero', label: '备饵', desc: '在厨房：知识 3+，诱饵进度 +1',
      can: (g, s) => !g.hv.lured && g.p(s).tile === g.hv.kitchen,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 3, '备饵 3+');
        if (r < 3) return;
        g.hv.bait++;
        g.log(`${g.p(s).name} 把鱼干剁碎拌进了米汤（${g.hv.bait}/${g.hv.need}）`, 'good');
        if (g.hv.bait >= g.hv.need) {
          g.hv.lured = true;
          for (const m of cats(g)) g.moveMonster(m.id, g.hv.kitchen);
          g.log('腥香飘满了整栋楼，所有野猫都冲进厨房埋头吃饵！', 'good');
        }
        track(g);
      },
    },
    {
      id: 'call', side: 'traitor', label: '唤猫', desc: '在你的房间招来一只野猫',
      can: (g) => !g.hv.lured && cats(g).length < CAP,
      *run(g, s) {
        spawnCat(g, g.p(s).tile);
      },
    },
    {
      id: 'recall', side: 'traitor', label: '唤回猫群', desc: '在厨房：理智 4+，诱饵作废',
      can: (g, s) => g.hv.lured && g.p(s).tile === g.hv.kitchen,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '唤回猫群 4+');
        if (r < 4) return;
        g.hv.lured = false;
        g.hv.bait = 0;
        g.log('猫婆尖声一唤，野猫们丢下食盆，齐刷刷转过头来！', 'bad');
        track(g);
      },
    },
  ],
  *onRoundEnd(g) {
    const t = g.traitor();
    if (!g.hv.lured && t != null && !g.p(t).dead) spawnCat(g, g.p(t).tile);
    track(g);
  },
  rollBonus(g, seat, trait, purpose) {
    return g.isTraitor(seat) && trait === 'might' && purpose === 'defend' ? 1 : 0;
  },
  canAttack(g, seat, target) {
    if (seat === -1) return !g.hv.lured;
    if (target.monster != null) return !g.isTraitor(seat);
    const ts = target.seat!;
    if (ts === seat) return false;
    if (g.sideOf(seat) === g.sideOf(ts)) return false;
    if (g.isTraitor(ts)) return !guarded(g);
    return true;
  },
  checkWin(g) {
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g) => {
      const t = g.traitor()!;
      const catIds = cats(g).map((m) => `m${m.id}` as const);
      if (!g.hv.lured) return { goals: [g.hv.kitchen], actions: ['bait'], targets: [t, ...catIds] };
      return { goals: [g.p(t).tile], targets: [t] };
    },
    traitor: (g) => {
      if (g.hv.lured) return { goals: [g.hv.kitchen], actions: ['recall'] };
      return { goals: g.heroes().map((s) => g.p(s).tile), actions: ['call'] };
    },
    monster: (g, id) => {
      if (g.hv.lured) return { goals: [g.hv.kitchen] };
      const m = g.monster(id);
      const t = g.traitor();
      if (m?.data?.guard && t != null && !g.p(t).dead) return { goals: [g.p(t).tile] };
      return { goals: g.heroes().map((s) => g.p(s).tile) };
    },
  },
};
