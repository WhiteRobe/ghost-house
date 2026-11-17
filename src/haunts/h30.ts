import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';
import type { Floor } from '../shared/types';

/** 30 最后一夜（拆迁前夜 × 停走的怀表） */

const ENTRANCE = 'G:0,0';
const LANDING: Record<Floor, string> = { B: 'B:0,-2', G: 'G:0,-1', U: 'U:0,-2' };
const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function reachable(g: Game, key: string) {
  if (g.distance(ENTRANCE, key) < Infinity) return;
  const f = key[0] as Floor;
  if (f === 'B') g.placeRoom('cellar-hatch');
  if (g.distance(ENTRANCE, key) < Infinity) return;
  if (f === 'B' && g.distance(ENTRANCE, 'B:0,-2') === Infinity) g.link('G:0,-1', 'B:0,-2');
  if (g.distance(ENTRANCE, key) === Infinity) g.link(LANDING[f], key);
}

function spot(g: Game, floor: Floor, avoid: string[]): string {
  const have = Object.keys(g.state.tiles).filter((k) => k[0] === floor && !START.includes(k) && !avoid.includes(k));
  have.sort((a, b) => g.distance(ENTRANCE, b) - g.distance(ENTRANCE, a));
  const k = have[0] ?? LANDING[floor];
  reachable(g, k);
  return k;
}

const SITE_NAME: Record<string, string> = { furnace: '锅炉房', coal: '煤房', switch: '电闸' };
const sites = (g: Game) => g.tokens('site');
const armed = (g: Game) => sites(g).filter((t) => t.data?.armed).length;

function track(g: Game) {
  g.setTrack('布置好的炸药', armed(g), 3);
}

function relabel(g: Game) {
  for (const t of sites(g)) t.label = `${SITE_NAME[t.data!.site as string]}${t.data!.armed ? '（炸药已布置）' : '（待布置）'}`;
}

export const h30: HauntDef = {
  id: 30,
  title: '最后一夜',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '揭示者的怀表停了，他却笑了。他用指甲在门框上刻下自己的名字：几十年前他就和这栋房子签了约，房子不拆，他就不老。明天拆迁队进场，今晚墙皮一鼓一瘪，楼板缝里传出嚼东西的声音。',
  hero: {
    goal: '在锅炉房、煤房、电闸三个爆破点都布置好炸药，再到门厅点燃引线。',
    rules: [
      '锅炉房和煤房在地下室，还没发现的话，异变开始时直接放进地下室（放不下就改用地下室离门厅最远的房间）。电闸在楼上离门厅最远的房间（楼上没有房间时在楼上楼梯口）。三处都有爆破点标记。',
      '特殊行动「布置炸药」（每回合一次）：在还没布置的爆破点，知识检定 5+，成功就布置好。',
      '特殊行动「点燃引线」：三处炸药都布置好后，在门厅执行，你们立即获胜。',
      '背叛者死亡，你们也获胜。',
      '死亡的幸存者达到 2 人（3/4 人局）或 3 人（5/6 人局）时，你们失败。',
      '背叛者每回合可以让房子「咬」一个有幸存者的房间：里面每人速度检定 4+，失败受到 2 点物理伤害。',
      '背叛者可以拆掉布置好的炸药，被拆的爆破点要重新布置。',
      '4 人局起有活房梁（怪物，4/5/6 人局分别 1/2/3 根）追着你们打，被击败时只会被击晕。',
    ],
    win: '引线嗤嗤地烧进地下室。一声闷响，整栋楼往下一坐，楼板缝里那嚼东西的声音停了。',
  },
  traitorSide: {
    goal: '保住房子：让死亡的幸存者达到 2 人（3/4 人局）或 3 人（5/6 人局）。',
    rules: [
      '特殊行动「咬人」（每回合一次）：选一个有幸存者的房间，里面每名幸存者速度检定 4+，失败受到 2 点物理伤害。',
      '特殊行动「拆除」（每回合一次）：在布置好炸药的爆破点，理智检定 4+，成功就拆掉。',
      '你控制活房梁（4 人局起，4/5/6 人局分别 1/2/3 根，出现在你所在的房间），它们在你的回合之后行动，被击败时只会被击晕。',
      '你不受房间有害效果影响，例如锅炉房的热浪。',
      '幸存者三处炸药都布置好并在门厅点火，或者你死亡，你就失败。',
    ],
    win: '墙皮合拢，把最后一声喊也咽了下去。第二天拆迁队来，只看见一栋安安静静的老房子，门口站着个年轻得过分的看门人。',
  },
  *setup(g) {
    const used: string[] = [];
    const place = (id: string, site: string) => {
      let k = g.placeRoom(id, ['B']);
      if (!k || used.includes(k)) k = spot(g, 'B', used);
      reachable(g, k);
      used.push(k);
      g.token(k, 'site', '', { icon: 'dynamite', data: { site, armed: false } });
    };
    place('furnace', 'furnace');
    place('coal-room', 'coal');
    const u = spot(g, 'U', used);
    g.token(u, 'site', '', { icon: 'dynamite', data: { site: 'switch', armed: false } });
    relabel(g);
    const t = g.traitor()!;
    const n = g.scale(0, 1, 2, 3);
    for (let i = 0; i < n; i++) g.spawn('beam', g.p(t).tile);
    track(g);
  },
  monsters: {
    beam: { name: '活房梁', icon: 'beam', speed: 3, might: 4 },
  },
  actions: [
    {
      id: 'arm', side: 'hero', label: '布置炸药', desc: '在未布置的爆破点知识检定 5+，成功就布置好',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'site').some((t) => !t.data?.armed),
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'site').find((x) => !x.data?.armed);
        if (!t) return;
        const r = yield* g.check(s, 'knowledge', 5, '布置炸药 5+');
        if (r < 5) {
          g.log('引线接错了，只好拆下来重接', 'info');
          return;
        }
        t.data!.armed = true;
        relabel(g);
        track(g);
        g.log(`${g.p(s).name} 在${SITE_NAME[t.data!.site as string]}布置好了炸药`, 'good');
      },
    },
    {
      id: 'ignite', side: 'hero', label: '点燃引线', desc: '三处炸药都布置好后，在门厅点燃引线',
      can: (g, s) => armed(g) >= 3 && g.p(s).tile === ENTRANCE,
      *run(g, s) {
        g.hv.boom = true;
        g.log(`${g.p(s).name} 划着了火柴……`, 'good');
      },
    },
    {
      id: 'bite', side: 'traitor', label: '咬人', desc: '选一个有幸存者的房间：里面每人速度检定 4+，失败受到 2 点物理伤害',
      can: (g) => g.heroes().length > 0,
      *run(g, s) {
        const tiles = [...new Set(g.heroes().map((h) => g.p(h).tile))];
        const near = (k: string) => Math.min(...sites(g).filter((t) => !t.data?.armed).map((t) => g.distance(k, t.tile)), 99);
        tiles.sort((a, b) => g.playersAt(b).filter((h) => !g.isTraitor(h)).length - g.playersAt(a).filter((h) => !g.isTraitor(h)).length || near(a) - near(b));
        const k = yield* g.chooseTile(s, '让房子咬哪个房间？', tiles);
        if (!k) return;
        g.reveal('背叛者每回合可以让房子「咬」一个房间：里面每人速度检定 4+，失败受到 2 点物理伤害。');
        g.log(`${g.tileName(k)}的地板裂开一道口子，两边全是木刺！`, 'bad');
        for (const h of g.heroes().filter((x) => g.p(x).tile === k)) {
          const r = yield* g.check(h, 'speed', 4, '躲开 4+');
          if (r >= 4) g.log(`${g.p(h).name} 跳开了`, 'good');
          else yield* g.damage(h, 'physical', 2, '房子咬了一口', s);
        }
      },
    },
    {
      id: 'disarm', side: 'traitor', label: '拆除', desc: '在布置好炸药的爆破点理智检定 4+，成功就拆掉',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'site').some((t) => t.data?.armed),
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'site').find((x) => x.data?.armed);
        if (!t) return;
        g.reveal('背叛者可以拆掉已经布置好的炸药。');
        const r = yield* g.check(s, 'sanity', 4, '拆除 4+');
        if (r < 4) return;
        t.data!.armed = false;
        relabel(g);
        track(g);
        g.log(`${SITE_NAME[t.data!.site as string]}的炸药被拆掉了`, 'bad');
      },
    },
  ],
  *onRoundEnd(g) {
    for (const s of g.alive()) reachable(g, g.p(s).tile);
  },
  checkWin(g) {
    if (g.hv.boom) return { side: 'hero' };
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    const dead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (dead >= g.scale(2, 2, 3, 3)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const here = g.p(s).tile;
      if (armed(g) >= 3) return { goals: [ENTRANCE], actions: ['ignite'], attack: false };
      const todo = sites(g).filter((t) => !t.data?.armed).map((t) => t.tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      return { goals: todo, actions: ['arm', 'ignite'] };
    },
    traitor: (g, s) => {
      const here = g.p(s).tile;
      const done = sites(g).filter((t) => t.data?.armed).map((t) => t.tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      const hs = g.heroes().map((h) => g.p(h).tile);
      return { goals: done.length ? done : hs, actions: ['disarm', 'bite'] };
    },
  },
};
