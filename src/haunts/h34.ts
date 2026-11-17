import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';
import type { Trait } from '../shared/types';

/** 34 捉鬼人（拆迁前夜 × 桃木剑） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const TRAIT_CN: Record<Trait, string> = { speed: '速度', might: '力量', sanity: '理智', knowledge: '知识' };

/** 可以“证明阳气”的房间与对应属性 */
const PROOF: [string, Trait][] = [
  ['chapel', 'sanity'], ['kitchen', 'might'], ['library', 'knowledge'], ['ancestral-hall', 'sanity'],
  ['drill-room', 'speed'], ['mirror-corridor', 'sanity'], ['bathroom', 'might'], ['garden', 'speed'],
  ['dining', 'might'], ['tea-room', 'knowledge'],
];
const CYCLE: Trait[] = ['sanity', 'might', 'knowledge', 'speed'];

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊的地板塌出一个洞，露出通往地下室的石阶', 'haunt');
  }
}

const proved = (g: Game, s: number) => !!g.p(s).flags.proved;

function track(g: Game) {
  const hs = g.heroes();
  g.setTrack('已证明自己是活人', hs.filter((s) => proved(g, s)).length, hs.length);
}

export const h34: HauntDef = {
  id: 34,
  title: '捉鬼人',
  type: 'traitor',
  traitor: { type: 'holder', card: 'sword' },
  intro: '握着桃木剑的那个人忽然停下脚步，眯眼打量着你们：“这栋楼三十年前就塌过一次，死的人一个没少。你们……是怎么进来的？”他咬破指尖，在剑身上抹了一道血。',
  hero: {
    goal: '各自证明自己是活人，然后合力制服捉鬼人。',
    rules: [
      '每名幸存者在某个房间留有一枚「阳气印记」（标记，写着你的名字，见日志），对应一项属性。',
      '特殊行动「证明阳气」：在属于你的印记所在房间进行对应属性 5+ 检定，成功即证明你是活人。',
      '捉鬼人认定没证明的人都是鬼：没证明的幸存者不能攻击他。',
      '特殊行动「合力制服」：至少两名已证明的幸存者与捉鬼人同处一室时，其中一人可以执行。把在场所有已证明幸存者的力量值相加掷骰，对抗捉鬼人力量 +3 颗骰；你们点数更高即胜利。',
      '杀死捉鬼人同样胜利。',
    ],
    win: '捉鬼人被按在地上，桃木剑从他手里滑落。他看着你们手腕上跳动的脉搏，喃喃道：“……原来是活的。那，那些鬼呢？”',
  },
  traitorSide: {
    goal: '用桃木剑“超度”所有幸存者（杀死他们）。',
    rules: [
      '异变开始时你的力量 +1。',
      '你坚信其他人都已经是鬼。没有证明自己是活人的幸存者不能攻击你。',
      '特殊行动「超度」：对同一房间里一名还没证明自己是活人的幸存者发起力量攻击，你多掷 2 颗骰。',
      '你可以正常攻击任何幸存者（包括已证明的）。',
      '小心：至少两名已证明的幸存者和你同处一室时，他们可以「合力制服」你。',
    ],
    win: '最后一道符贴上了最后一具尸体的额头。捉鬼人收起剑，朝空荡荡的楼道拱了拱手：“各位，一路走好。”',
  },
  *setup(g) {
    connect(g);
    const heroes = g.heroes();
    // 候选房间：先尝试放出还没出现的房间，再用已有的
    const cands: [string, Trait][] = [];
    const seen = new Set<string>();
    for (const [id, trait] of PROOF) {
      const k = g.findTile(id) ?? (cands.length < heroes.length + 1 ? g.placeRoom(id) : null);
      if (k && !seen.has(k)) { seen.add(k); cands.push([k, trait]); }
    }
    const rest = Object.keys(g.state.tiles).filter((k) => !START.includes(k) && !seen.has(k));
    rest.forEach((k, i) => cands.push([k, CYCLE[i % 4]]));
    if (!cands.length) START.slice(1).forEach((k, i) => cands.push([k, CYCLE[i % 4]]));
    // 每人分到离自己最远的一间（尽量不重复）
    const picks: [string, Trait][] = [];
    for (const s of heroes) {
      const here = g.p(s).tile;
      const free = cands.filter(([k]) => !picks.some(([pk]) => pk === k));
      const pool = (free.length ? free : cands).filter(([k]) => g.distance(here, k) < Infinity);
      const list = pool.length ? pool : free.length ? free : cands;
      list.sort((a, b) => g.distance(here, b[0]) - g.distance(here, a[0]));
      picks.push(list[0]);
    }
    yield* g.gain(g.traitor()!, 'might', 1);
    heroes.forEach((s, i) => {
      const [k, trait] = picks[i];
      g.p(s).flags.proofTile = k;
      g.p(s).flags.proofTrait = trait;
      g.token(k, 'mark', `${g.p(s).name}的阳气印记（${TRAIT_CN[trait]}）`, { icon: 'mark', data: { seat: s } });
      g.log(`${g.p(s).name} 的阳气印记在「${g.tileName(k)}」，需要${TRAIT_CN[trait]}检定`, 'haunt');
    });
    track(g);
  },
  actions: [
    {
      id: 'prove', side: 'hero', label: '证明阳气', desc: '在你的印记所在房间：对应属性 5+',
      can: (g, s) => !proved(g, s) && g.p(s).tile === g.p(s).flags.proofTile,
      *run(g, s) {
        const trait = g.p(s).flags.proofTrait as Trait;
        const r = yield* g.check(s, trait, 5, `证明阳气：${TRAIT_CN[trait]} 5+`);
        if (r < 5) {
          g.log(`${g.p(s).name} 的印记黯淡了一下`, 'bad');
          return;
        }
        g.p(s).flags.proved = true;
        for (const t of g.tokens('mark')) if (t.data?.seat === s) g.removeToken(t.id);
        g.log(`${g.p(s).name} 的印记亮起一团暖光——是活人！`, 'good');
        track(g);
      },
    },
    {
      id: 'subdue', side: 'hero', label: '合力制服', desc: '至少两名已证明者与捉鬼人同室：合力掷骰对抗',
      can: (g, s) => {
        const t = g.traitor();
        if (t == null || g.p(t).dead || !proved(g, s) || g.p(t).tile !== g.p(s).tile) return false;
        return g.playersAt(g.p(s).tile).filter((o) => o !== t && proved(g, o)).length >= 2;
      },
      *run(g, s) {
        const t = g.traitor()!;
        const team = g.playersAt(g.p(s).tile).filter((o) => o !== t && proved(g, o));
        const dice = team.reduce((a, o) => a + g.value(o, 'might'), 0);
        const a = yield* g.roll(dice, '合力制服', s);
        const d = yield* g.roll(g.value(t, 'might') + 3, '捉鬼人挣扎', t);
        if (a > d) {
          g.hv.subdued = true;
          g.log(`众人一拥而上，把捉鬼人死死按住（${a} 对 ${d}）`, 'good');
        } else {
          g.log(`捉鬼人挣脱开来，桃木剑一挥（${a} 对 ${d}）`, 'bad');
          yield* g.damage(s, 'physical', 1, '桃木剑横扫', t);
        }
      },
    },
    {
      id: 'exorcise', side: 'traitor', label: '超度', desc: '力量攻击同房间未证明的幸存者，多掷 2 颗骰',
      can: (g, s) => g.heroes().some((o) => g.p(o).tile === g.p(s).tile && !proved(g, o)),
      *run(g, s) {
        const list = g.heroes().filter((o) => g.p(o).tile === g.p(s).tile && !proved(g, o));
        const t = yield* g.choosePlayer(s, '超度谁？', list);
        if (t == null) return;
        yield* g.attack({ seat: s }, { seat: t }, { bonus: 2 });
      },
    },
  ],
  canAttack(g, seat, target) {
    if (target.monster != null) return !g.isTraitor(seat);
    if (seat === -1) return true;
    const ts = target.seat!;
    if (ts === seat || g.sideOf(seat) === g.sideOf(ts)) return false;
    if (g.isTraitor(ts)) return proved(g, seat);
    return true;
  },
  checkWin(g) {
    if (g.hv.subdued) return { side: 'hero' };
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const t = g.traitor()!;
      if (!proved(g, s)) return { goals: [g.p(s).flags.proofTile as string], actions: ['prove'], attack: false };
      const team = g.heroes().filter((o) => proved(g, o));
      if (team.length >= 2) return { goals: [g.p(t).tile], actions: ['subdue'], targets: [t] };
      // 只有自己证明了：去找还没证明的同伴，护着他
      const others = g.heroes().filter((o) => o !== s).map((o) => g.p(o).tile);
      return { goals: others, targets: [t] };
    },
    traitor: (g) => {
      const raw = g.heroes().filter((o) => !proved(g, o)).map((o) => g.p(o).tile);
      return { goals: raw.length ? raw : g.heroes().map((o) => g.p(o).tile), actions: ['exorcise'] };
    },
  },
};
