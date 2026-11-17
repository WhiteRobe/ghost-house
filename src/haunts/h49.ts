import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 49 井（事件「井里的声音」触发） */

const START = ['entrance', 'hallway', 'stairs', 'upper-landing', 'basement-landing'];

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌了个洞，底下是去地下室的石阶', 'info');
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
  intro: '地下室那口古井里有人在唱歌，老调子，哄孩子睡觉的那种。揭示者听了一会儿，笑了，转身朝你们走过来。他两只手湿淋淋的，指缝里塞满了青苔。',
  hero: {
    goal: '把麻绳和所有石板搬到古井，把井封死。',
    rules: [
      '古井在地下室，有「井口」标记（古井放不进地图时，地下室楼梯口就是井口）。',
      '房子里有 1 捆麻绳和几块石板，都是标记，大多离井较远。石板 3 人局 2 块，4/5 人局 3 块，6 人局 4 块。',
      '特殊行动「搬取」：在有麻绳或石板的房间执行，拿起一件。房间里有麻绳就拿麻绳，不用检定；没有麻绳才搬石板，力量检定 3+。每人身上最多 1 块石板。带着东西的人死亡，东西掉在原地。',
      '特殊行动「封井」：在古井执行，用掉你带着的一件东西，身上有石板就先用石板。压石板：力量检定 4+；捆麻绳：知识检定 3+。失败东西还在你手里。麻绳和全部石板都用上，你们获胜。',
      '背叛者能和同房间的你各掷力量，点数更高就把你拖到古井；在古井再赢一次，就把你推下井，你直接死亡。被推下井的人数达到 2 人（3/4 人局）或 3 人（5/6 人局），背叛者获胜。',
      '回合结束时在古井：理智检定 4+，失败受到 1 点精神伤害。杀死背叛者不会让你们获胜。',
    ],
    win: '最后一块石板压上井口，麻绳一圈圈勒紧。井底的歌又哼了两句，闷住了，后来只听得见滴水。',
  },
  traitorSide: {
    goal: '把幸存者推下井（3/4 人局 2 人，5/6 人局 3 人），或者杀死所有幸存者。',
    rules: [
      '特殊行动「拖向井边」：你不在古井、房间里有幸存者时执行，选一名幸存者，你和他各掷力量，你点数更高就把你们俩一起移到古井。',
      '特殊行动「推下井」：在古井、房间里有幸存者时执行，选一名幸存者，你和他各掷力量，你点数更高他立即死亡，算推下井 1 人。',
      '回合结束时在古井的理智检定，你不用做。你不能搬取麻绳和石板。井封死你就失败；你死亡不算失败。',
    ],
    win: '井水漫上了井沿，水面浮着几张泡白的脸，一起哼着那支老调子。',
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
      id: 'take', side: 'hero', label: '搬取', desc: '拿起这个房间的麻绳；没有麻绳时力量检定 3+，搬起一块石板',
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
          g.log('石板太沉，挪都挪不动', 'bad');
          return;
        }
        g.removeToken(slab.id);
        list.push('slab');
        g.log(`${g.p(s).name} 咬牙搬起了一块石板`, 'good');
      },
    },
    {
      id: 'seal', side: 'hero', label: '封井', desc: '在古井：用掉一件带着的东西。石板力量检定 4+，麻绳知识检定 3+',
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
        g.log(`${g.p(s).name} 把${PART_NAME[part]}用在了井口`, 'good');
        updateTrack(g);
      },
    },
    {
      id: 'drag', side: 'traitor', label: '拖向井边', desc: '和同房间一名幸存者各掷力量，你点数更高就把他拖到古井',
      can: (g, s) => g.p(s).tile !== well(g) && heroesAt(g, g.p(s).tile).length > 0,
      *run(g, s) {
        const opts = heroesAt(g, g.p(s).tile).sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
        const v = yield* g.choosePlayer(s, '把谁拖向井边？', opts);
        if (v == null) return;
        const a = yield* g.check(s, 'might', undefined, '拖拽（力量）');
        const d = yield* g.check(v, 'might', undefined, '挣扎（力量）');
        if (a > d) {
          g.moveTo(s, well(g), '被一双湿手拽着');
          g.moveTo(v, well(g), '被一路拖行');
          g.log(`${g.p(v).name} 被拖到了井边`, 'bad');
        } else g.log(`${g.p(v).name} 挣脱了那双湿手`, 'good');
      },
    },
    {
      id: 'push', side: 'traitor', label: '推下井', desc: '在古井和一名幸存者各掷力量，你点数更高就把他推下井',
      publicText: '井里的歌一下子唱高了，有人被推到了井沿上',
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
