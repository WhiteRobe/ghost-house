import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 50 夜戏（事件「戏台开锣」触发） */

const START = ['entrance', 'hallway', 'stairs', 'upper-landing', 'basement-landing'];

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌了个洞，底下是去地下室的石阶', 'info');
  }
}

const stage = (g: Game): string => g.hv.stage ?? 'G:0,0';
const holder = (g: Game): number | null => (g.hv.script ?? null) as number | null;
const length = (g: Game) => g.scale(9, 9, 8, 8);

function fires(g: Game): string[] {
  return ['kitchen', 'furnace'].map((r) => g.findTile(r)).filter((k): k is string => !!k);
}

function updateTrack(g: Game) {
  const r = g.state.haunt?.round ?? 1;
  g.setTrack('距离散场还有（轮）', Math.max(0, length(g) - r + 1), length(g));
}

export const h50: HauntDef = {
  id: 50,
  title: '夜戏',
  type: 'traitor',
  traitor: { type: 'highest', trait: 'sanity' },
  intro: '戏台那边响起了锣鼓点子。台下一排排空椅子，每张椅子前都摆着一杯冒热气的茶。你们当中理智最高的那个人披上了一件褪了色的蟒袍，捻着并不存在的胡子说：“今夜唱全本，一个也不许走。”',
  hero: {
    goal: '戏散场之前，找到戏本，在灶火里烧掉。',
    rules: [
      '戏台和厨房还没发现的话，会直接放到地图上。能烧戏本的地方：厨房、锅炉房；两间都放不下时，门厅会出现一只炭盆。',
      '房子里有戏箱标记（3 人局 3 只，4/5 人局 4 只，6 人局 5 只），只有一只装着戏本，它在离火最远的两只箱子之一。背叛者知道是哪只。',
      '特殊行动「翻戏箱」：在有戏箱的房间执行，知识检定 3+，成功打开它：空箱就移除，有戏本就归你拿着。拿着戏本的人死亡，戏本掉在原地，要再「翻戏箱」才能拿起。',
      '特殊行动「烧戏本」：拿着戏本在厨房、锅炉房或有炭盆的房间执行，理智检定 4+，成功你们获胜。',
      '点戏：每轮结束时背叛者点一名幸存者上台。被点到的人下个回合开始时被移到戏台，唱一折：理智检定 4+，失败受到 1 点精神伤害。不管成没成，这个回合移动 -2。背叛者死亡后不再点戏，但杀死他不会让你们获胜。',
      '龙套（怪物，速度 3、力量 3，3/4/5/6 人局分别 1/2/2/3 个）会追着你们打，专盯拿着戏本的人。龙套受伤只会被击晕。',
      '3/4 人局第 9 轮、5/6 人局第 8 轮结束时戏散场，背叛者获胜。',
    ],
    win: '戏本在灶膛里卷起来，烧黑了。台上的锣鼓一下乱了点子。蟒袍从班主肩上滑下去，台下那一排排茶都不冒气了。',
  },
  traitorSide: {
    goal: '撑到戏散场，或者杀死所有幸存者。',
    rules: [
      '你是戏班班主，控制龙套（速度 3、力量 3，3/4/5/6 人局分别 1/2/2/3 个），它们在你的回合之后行动。',
      '点戏：每轮结束时你点一名幸存者上台。他下个回合开始时被移到戏台唱一折：理智检定 4+，失败受到 1 点精神伤害。不管成没成，他这个回合移动 -2。你死亡后就不能再点戏。',
      '你知道戏本在哪只戏箱里。',
      '你不能翻戏箱，也不能烧戏本。戏本被烧掉，你失败；你死亡不算失败。',
      '3/4 人局第 9 轮、5/6 人局第 8 轮结束时戏散场，你获胜。',
    ],
    win: '“咚”，最后一声锣。台下的椅子坐满了，个个穿着戏服、画着油彩，一齐拍起手来，茶还冒着热气。',
  },
  monsters: {
    extra: { name: '龙套', icon: 'extra', speed: 3, might: 3, sanity: 3 },
  },
  *setup(g) {
    ensureBasement(g);
    const st = g.placeRoom('opera-stage') ?? g.placeRoom('main-hall') ?? 'G:0,0';
    g.hv.stage = st;
    g.placeRoom('kitchen');
    if (!fires(g).length) g.placeRoom('furnace');
    if (!fires(g).length) {
      // 实在放不下：在门厅支一只炭盆
      g.token('G:0,0', 'brazier', '炭盆', { icon: 'fire' });
    }
    g.hv.script = null;
    g.hv.called = null;
    const t = g.traitor()!;
    const n = g.scale(3, 4, 4, 5);
    const pool = Object.keys(g.state.tiles).filter((k) => k !== st && !START.includes(g.state.tiles[k].room) && !fires(g).includes(k) && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(pool);
    const picks: string[] = [];
    for (const f of ['U', 'B', 'G']) {
      const k = pool.find((x) => x.startsWith(f + ':'));
      if (k) picks.push(k);
    }
    for (const k of pool) if (picks.length < n && !picks.includes(k)) picks.push(k);
    for (const k of ['U:0,-2', 'B:0,-2', 'G:0,-1', 'G:0,-2']) if (picks.length < n && !picks.includes(k)) picks.push(k);
    for (const k of picks) g.token(k, 'trunk', '戏箱', { icon: 'trunk' });
    // 真戏本在离火较远的两只箱子之一
    const fireTiles = fires(g).length ? fires(g) : ['G:0,0'];
    const far = [...picks].sort((a, b) => Math.min(...fireTiles.map((f) => g.distance(f, b))) - Math.min(...fireTiles.map((f) => g.distance(f, a)))).slice(0, 2);
    g.hs.real = far[g.rng.int(far.length)];
    g.log(`戏本藏在${g.tileName(g.hs.real)}的戏箱里`, 'info', t, 'traitor');
    for (let i = 0; i < g.scale(1, 2, 2, 3); i++) g.spawn('extra', st);
    updateTrack(g);
  },
  actions: [
    {
      id: 'open', side: 'hero', label: '翻戏箱', desc: '知识检定 3+：打开这个房间的戏箱',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'trunk').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 3, '翻戏箱 3+');
        if (r < 3) {
          g.log('箱锁锈死了，撬不开', 'info');
          return;
        }
        const here = g.p(s).tile;
        const list = g.tokensAt(here, 'trunk');
        const tk = list.find((x) => x.data?.real) ?? list[0];
        g.removeToken(tk.id);
        if (tk.data?.real || (here === g.hs.real && !g.hs.found)) {
          g.hs.found = true;
          g.hv.script = s;
          g.reveal(`${g.p(s).name} 从戏箱里翻出了戏本`);
        } else g.log('箱子里只有几件长了霉的戏服', 'info');
      },
    },
    {
      id: 'burn', side: 'hero', label: '烧戏本', desc: '理智检定 4+：把戏本扔进火里',
      can: (g, s) => holder(g) === s && (fires(g).includes(g.p(s).tile) || g.tokensAt(g.p(s).tile, 'brazier').length > 0),
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '烧戏本 4+');
        if (r >= 4) g.hv.burned = true;
        else g.log('戏本里冒出一声尖嗓子的唱腔，手一抖缩了回来', 'bad');
      },
    },
  ],
  *onTurnStart(g, s) {
    if (g.hv.called !== s || g.isTraitor(s)) return;
    g.hv.called = null;
    g.moveTo(s, stage(g), '跟着锣鼓点子');
    g.log(`${g.p(s).name} 被拉上了戏台，只好硬着头皮唱一折`, 'haunt');
    const r = yield* g.check(s, 'sanity', 4, '唱戏 4+');
    if (r < 4) yield* g.damage(s, 'mental', 1, '台下喝倒彩');
    else g.log('一折唱完，台下稀稀拉拉响了几下巴掌', 'info');
    g.state.moveLeft = Math.max(0, g.state.moveLeft - 2);
  },
  *onRoundEnd(g) {
    updateTrack(g);
    const r = g.state.haunt?.round ?? 1;
    if (r > length(g)) {
      g.hv.over = true;
      return;
    }
    const t = g.traitor();
    const heroes = g.heroes();
    if (t == null || g.p(t).dead || !heroes.length) return;
    // 先点拿着戏本的人，其次离火最近的
    const h = holder(g);
    const fire = fires(g);
    const dist = (x: number) => (fire.length ? Math.min(...fire.map((f) => g.distance(g.p(x).tile, f))) : 0);
    const order = [...heroes].sort((a, b) => (a === h ? -1 : b === h ? 1 : dist(a) - dist(b)));
    const v = yield* g.choosePlayer(t, '点谁上台？', order);
    if (v != null) {
      g.hv.called = v;
      g.log(`班主一甩水袖：“下一折，请 ${g.p(v).name} 登台！”`, 'haunt');
    }
  },
  *onDeath(g, s) {
    if (holder(g) === s) {
      g.hv.script = null;
      g.token(g.p(s).tile, 'trunk', '戏本', { icon: 'script', data: { real: true } });
      g.log(`戏本掉在了${g.tileName(g.p(s).tile)}`, 'info');
    }
  },
  checkWin(g) {
    if (g.hv.burned) return { side: 'hero' };
    if (g.hv.over || g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const h = holder(g);
      const fire = [...fires(g), ...g.tokens('brazier').map((t) => t.tile)];
      if (h === s) return { goals: fire, actions: ['burn'], attack: false };
      const trunks = g.tokens('trunk').map((t) => t.tile);
      if (h != null) {
        // 护送持本人
        return { goals: [g.p(h).tile], actions: ['open'] };
      }
      return { goals: trunks, actions: ['open'] };
    },
    traitor: (g) => {
      const h = holder(g);
      if (h != null) return { goals: [g.p(h).tile], targets: [h] };
      // 守着真戏箱附近
      const real = g.hs.real as string;
      if (g.tokensAt(real, 'trunk').length) {
        const near = g.heroes().filter((x) => g.distance(g.p(x).tile, real) <= 2);
        if (near.length) return { goals: near.map((x) => g.p(x).tile) };
        return { goals: [real] };
      }
      return { goals: g.heroes().map((x) => g.p(x).tile) };
    },
    monster: (g) => {
      const h = holder(g);
      if (h != null) return { goals: [g.p(h).tile] };
      return { goals: g.heroes().map((x) => g.p(x).tile) };
    },
  },
};
