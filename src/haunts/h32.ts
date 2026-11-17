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
    g.log('走廊的地板塌出一个洞，底下是通往地下室的石阶', 'haunt');
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
  intro: '拆迁队把巷子里的野猫全撵了，它们都钻进了这栋楼。手电一扫，楼梯上蹲满了绿眼睛。你们中间有个人蹲了下去，嘴里“咪咪”地唤着，猫一只接一只蹭到他脚边。',
  hero: {
    goal: '在厨房备好诱饵把猫群引开，然后杀死猫婆（背叛者）。',
    rules: [
      '猫婆死亡，你们立即获胜。所有幸存者死亡，你们失败。',
      '猫婆带着一群野猫（怪物，速度 4，力量 2），被击败时只会被击晕。每轮结束时她身边会多一只猫，场上最多 12 只。',
      '猫群护主：猫婆所在的房间里有清醒的野猫时，你们不能攻击猫婆。猫婆用力量防御时多掷 1 颗骰。',
      '「诱饵」标记在厨房（还没发现就直接放进一楼；放不下时依次改用餐厅、佣人房，再不行是一楼的一个随机房间）。',
      '特殊行动「备饵」（每回合一次）：在诱饵所在的房间，知识检定 3+，成功则诱饵进度 +1。进度到 3（3 人局）、4（4/5 人局）或 5（6 人局）时，所有野猫立刻被拉进厨房吃饵。',
      '猫在吃饵时不攻击、不护主，猫婆也招不来新猫。这时去找猫婆动手。',
      '猫婆在厨房用「唤回猫群」成功后，诱饵作废，进度清零，要从头再备。',
    ],
    win: '猫婆被按在地上，唤猫声变成了干咳。厨房里的野猫吃饱了，一只接一只从破窗跳出去，没有一只回头。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '你控制野猫（速度 4，力量 2），它们在你的回合之后行动，被击败时只会被击晕。开局有 4/5/6/7 只（3/4/5/6 人局），都在你身边。',
      '猫群护主：你所在的房间里有清醒的野猫时，幸存者不能攻击你。你用力量防御时多掷 1 颗骰。',
      '特殊行动「唤猫」（每回合一次）：在你的房间招来一只野猫。每轮结束时也会自动来一只。场上最多 12 只。',
      '幸存者备好诱饵后，所有野猫被拉进厨房吃饵：不攻击、不护主，你也招不来新猫。',
      '特殊行动「唤回猫群」（每回合一次）：猫在吃饵时，你在厨房理智检定 4+，成功则诱饵作废、进度清零，野猫重新听你指挥。',
      '你死亡就失败。',
    ],
    win: '最后一个人倒下，猫群围了上去。猫婆坐在一地绿眼睛中间，一只一只数她的猫。',
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
      id: 'bait', side: 'hero', label: '备饵', desc: '在厨房：知识检定 3+，诱饵进度 +1',
      can: (g, s) => !g.hv.lured && g.p(s).tile === g.hv.kitchen,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 3, '备饵 3+');
        if (r < 3) return;
        g.hv.bait++;
        g.log(`${g.p(s).name} 把鱼干剁碎拌进了米汤（${g.hv.bait}/${g.hv.need}）`, 'good');
        if (g.hv.bait >= g.hv.need) {
          g.hv.lured = true;
          for (const m of cats(g)) g.moveMonster(m.id, g.hv.kitchen);
          g.log('鱼腥味飘上了楼，所有野猫都冲进厨房，脑袋扎进了食盆', 'good');
        }
        track(g);
      },
    },
    {
      id: 'call', side: 'traitor', label: '唤猫', desc: '在你的房间招来一只野猫（最多 12 只）',
      can: (g) => !g.hv.lured && cats(g).length < CAP,
      *run(g, s) {
        spawnCat(g, g.p(s).tile);
      },
    },
    {
      id: 'recall', side: 'traitor', label: '唤回猫群', desc: '猫在吃饵时，在厨房理智检定 4+：诱饵作废，进度清零',
      can: (g, s) => g.hv.lured && g.p(s).tile === g.hv.kitchen,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '唤回猫群 4+');
        if (r < 4) return;
        g.hv.lured = false;
        g.hv.bait = 0;
        g.log('猫婆尖着嗓子一唤，野猫丢下食盆，全转过头来', 'bad');
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
