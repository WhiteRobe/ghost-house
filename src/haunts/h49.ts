import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 49 井（事件「井里的声音」触发） */

const START = ['entrance', 'hallway', 'stairs', 'upper-landing', 'basement-landing'];

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌开一个洞，露出通往地下室的石阶', 'info');
  }
}

type Part = 'rope' | 'slab';
const PART_NAME: Record<Part, string> = { rope: '麻绳', slab: '石板' };

const well = (g: Game): string => g.hv.well ?? 'B:0,-2';
const carry = (g: Game) => g.hv.carry as Record<string, Part[]>;
const mine = (g: Game, s: number): Part[] => carry(g)[s] ?? [];
const slabNeed = (g: Game): number => g.hv.slabNeed ?? 2;
const pushNeed = (g: Game) => g.scale(2, 2, 3, 3);

function heroesAt(g: Game, k: string) {
  return g.heroes().filter((h) => g.p(h).tile === k);
}

function updateTrack(g: Game) {
  g.setTrack('封井进度', (g.hv.rope ? 1 : 0) + (g.hv.slabs ?? 0), 1 + slabNeed(g));
}

export const h49: HauntDef = {
  id: 49,
  title: '井',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '地下室那口古井里传来有人在唱歌的声音，调子很老，像哄孩子睡觉。揭示者听着听着就笑了，转身朝你们走来，手上湿淋淋的，指缝里全是青苔。井里的东西饿了一百年，它要一个一个地收回去。',
  hero: {
    goal: '把麻绳和足够的石板搬到古井，把井封死。',
    rules: [
      '古井在地下室（若尚未出现会立即出现；放不下就以地下室楼梯口为井口）。',
      '房子里散落着一捆麻绳和若干块石板（标记；3 人局 2 块，4/5 人局 3 块，6 人局 4 块）。',
      '特殊行动「搬取」：在有麻绳或石板的房间拿起一件。拿麻绳无需检定；搬石板需要力量 3+ 检定。每人最多同时搬一块石板。携带者死亡时东西掉在原地。',
      '特殊行动「封井」：在古井把你携带的一件东西用上：压石板需要力量 4+ 检定，捆麻绳需要知识 3+ 检定，失败则东西还在你手里。麻绳和全部石板都用上后井就封死了，你们获胜。',
      '井边很危险：背叛者可以把同一房间的人拖到井边，并在井边把人推下去（推下去的人直接死亡）。',
      '在古井结束回合时，进行理智 4+ 检定，失败受到 1 点精神伤害（井里的歌声）。',
    ],
    win: '最后一块石板压上井口，麻绳一圈圈缠紧。井底的歌声闷了几声，终于停了，只剩下水滴的回音。',
  },
  traitorSide: {
    goal: '把幸存者推下井（3/4 人局 2 人，5/6 人局 3 人），或者杀死所有幸存者。',
    rules: [
      '特殊行动「拖向井边」：与一名幸存者在同一房间（不在古井）时，你和他各掷力量检定；你点数更高就把他和你一起拖到古井。',
      '特殊行动「推下井」：在古井时，与同一房间的一名幸存者各掷力量检定；你点数更高就把他推下井，他立即死亡。',
      '你无视古井的歌声。你不能搬取麻绳和石板。',
    ],
    win: '井水漫了上来，一张张泡得发白的脸浮在水面，齐声唱着那支老调子。今夜，井不会再饿了。',
  },
  *setup(g) {
    ensureBasement(g);
    const w = g.placeRoom('well') ?? 'B:0,-2';
    g.hv.well = w;
    g.hv.carry = {};
    g.hv.rope = false;
    g.hv.slabs = 0;
    g.hv.pushed = 0;
    g.hv.slabNeed = g.scale(2, 3, 3, 4);
    const t = g.traitor()!;
    const pool = Object.keys(g.state.tiles).filter((k) => k !== w && k !== g.p(t).tile && !START.includes(g.state.tiles[k].room) && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(pool);
    // 离井远一点的地方
    pool.sort((a, b) => g.distance(w, b) - g.distance(w, a));
    const half = pool.slice(0, Math.max(slabNeed(g) + 1, Math.ceil(pool.length * 0.6)));
    g.rng.shuffle(half);
    const spots = [...half, 'U:0,-2', 'G:0,-2', 'G:0,-1', 'G:0,0'];
    g.token(spots[0], 'part', PART_NAME.rope, { icon: 'rope', data: { part: 'rope' } });
    for (let i = 1; i <= slabNeed(g); i++) g.token(spots[i], 'part', PART_NAME.slab, { icon: 'slab', data: { part: 'slab' } });
    g.token(w, 'wellmouth', '井口', { icon: 'well' });
    updateTrack(g);
  },
  actions: [
    {
      id: 'take', side: 'hero', label: '搬取', desc: '拿起本房间的麻绳，或力量 3+ 检定搬起一块石板',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'part').some((t) => t.data?.part === 'rope' || !mine(g, s).includes('slab')),
      *run(g, s) {
        const here = g.tokensAt(g.p(s).tile, 'part');
        const rope = here.find((t) => t.data?.part === 'rope');
        const slab = here.find((t) => t.data?.part === 'slab');
        const list = (carry(g)[s] ??= []);
        if (rope) {
          g.removeToken(rope.id);
          list.push('rope');
          g.log(`${g.p(s).name} 扛起了麻绳`, 'good');
          return;
        }
        if (!slab || list.includes('slab')) return;
        const r = yield* g.check(s, 'might', 3, '搬石板 3+');
        if (r < 3) {
          g.log('石板太沉了，挪都挪不动', 'bad');
          return;
        }
        g.removeToken(slab.id);
        list.push('slab');
        g.log(`${g.p(s).name} 咬牙搬起了一块石板`, 'good');
      },
    },
    {
      id: 'seal', side: 'hero', label: '封井', desc: '把一件携带的东西用在井口：麻绳需知识 3+，石板需力量 4+',
      can: (g, s) => g.p(s).tile === well(g) && mine(g, s).length > 0,
      *run(g, s) {
        const list = mine(g, s);
        // 先压石板，再捆麻绳
        const part: Part = list.includes('slab') ? 'slab' : 'rope';
        const r = part === 'slab' ? yield* g.check(s, 'might', 4, '压石板 4+') : yield* g.check(s, 'knowledge', 3, '捆麻绳 3+');
        if (r < (part === 'slab' ? 4 : 3)) {
          g.log(part === 'slab' ? '石板滑了一下，没压稳' : '绳结松开了', 'bad');
          return;
        }
        list.splice(list.indexOf(part), 1);
        if (part === 'rope') g.hv.rope = true;
        else g.hv.slabs = (g.hv.slabs ?? 0) + 1;
        g.log(`${g.p(s).name} 把${PART_NAME[part]}压在了井口`, 'good');
        updateTrack(g);
      },
    },
    {
      id: 'drag', side: 'traitor', label: '拖向井边', desc: '与同一房间的幸存者比力量，赢了就把他拖到古井',
      can: (g, s) => g.p(s).tile !== well(g) && heroesAt(g, g.p(s).tile).length > 0,
      *run(g, s) {
        const opts = heroesAt(g, g.p(s).tile).sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
        const v = yield* g.choosePlayer(s, '把谁拖向井边？', opts);
        if (v == null) return;
        const a = yield* g.check(s, 'might', undefined, '拖拽（力量）');
        const d = yield* g.check(v, 'might', undefined, '挣扎（力量）');
        if (a > d) {
          g.moveTo(s, well(g), '湿淋淋的手');
          g.moveTo(v, well(g), '被一路拖行');
          g.log(`${g.p(v).name} 被拖到了井边！`, 'bad');
        } else g.log(`${g.p(v).name} 挣脱了那双湿手`, 'good');
      },
    },
    {
      id: 'push', side: 'traitor', label: '推下井', desc: '在古井与一名幸存者比力量，赢了就把他推下去',
      publicText: '井里的歌声突然拔高——有人被推向了井口！',
      can: (g, s) => g.p(s).tile === well(g) && heroesAt(g, well(g)).length > 0,
      *run(g, s) {
        const opts = heroesAt(g, well(g)).sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
        const v = yield* g.choosePlayer(s, '把谁推下井？', opts);
        if (v == null) return;
        const a = yield* g.check(s, 'might', undefined, '推（力量）');
        const d = yield* g.check(v, 'might', undefined, '抓住井沿（力量）');
        if (a > d) {
          g.log(`${g.p(v).name} 掉进了井里，水面合上了`, 'bad');
          g.hv.pushed = (g.hv.pushed ?? 0) + 1;
          yield* g.kill(v, s);
        } else g.log(`${g.p(v).name} 死死抓住了井沿`, 'good');
      },
    },
  ],
  *onTurnEnd(g, s) {
    if (g.isTraitor(s) || g.p(s).tile !== well(g)) return;
    const r = yield* g.check(s, 'sanity', 4, '井里的歌声 4+');
    if (r < 4) yield* g.damage(s, 'mental', 1, '井里的歌声');
  },
  *onDeath(g, s) {
    const list = mine(g, s);
    if (!list.length) return;
    // 推下井的人带着东西一起沉了？不，东西留在井边
    for (const part of list) g.token(g.p(s).tile, 'part', PART_NAME[part], { icon: part, data: { part } });
    carry(g)[s] = [];
    g.log(`${list.map((p) => PART_NAME[p]).join('、')}掉在了${g.tileName(g.p(s).tile)}`, 'info');
  },
  checkWin(g) {
    if (g.hv.rope && (g.hv.slabs ?? 0) >= slabNeed(g)) return { side: 'hero' };
    if ((g.hv.pushed ?? 0) >= pushNeed(g) || g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const w = well(g);
      const parts = g.tokens('part').filter((t) => t.data?.part === 'rope' || !mine(g, s).includes('slab')).map((t) => t.tile);
      if (mine(g, s).includes('slab') || (mine(g, s).length && !parts.length)) return { goals: [w], actions: ['seal', 'take'] };
      if (parts.length) return { goals: parts, actions: ['take', 'seal'] };
      if (mine(g, s).length) return { goals: [w], actions: ['seal'] };
      // 没东西可搬：去井边帮忙看住背叛者
      const t = g.traitor();
      return { goals: t != null ? [g.p(t).tile] : [w], actions: ['seal'] };
    },
    traitor: (g) => {
      const w = well(g);
      const atWell = heroesAt(g, w);
      if (atWell.length) return { goals: [w], actions: ['push'] };
      const carriers = g.heroes().filter((h) => mine(g, h).length);
      const targets = carriers.length ? carriers : g.heroes();
      return { goals: targets.map((h) => g.p(h).tile), actions: ['push', 'drag'] };
    },
  },
};
