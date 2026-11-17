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
  intro: '怀表的指针转得飞快，墙皮像呼吸一样一鼓一瘪。揭示者用指甲在门框上签下自己的名字——他和这栋房子签了约：房子不拆，他就永远不老。现在房子醒了，饿了，楼板的缝隙里传来咀嚼声。',
  hero: {
    goal: '在锅炉房、煤房和电闸三处布置好炸药，然后回到门厅点燃引线，炸掉这栋活过来的房子。',
    rules: [
      '锅炉房、煤房若尚未被发现，异变开始时会出现在地下室；电闸（标记）在二楼离门厅最远的房间（没有就放在二楼楼梯口）。',
      '特殊行动「布置炸药」：在尚未布置的爆破点进行知识 5+ 检定，成功则布置好。',
      '特殊行动「点燃引线」：三处都布置好后，在门厅点燃引线即获胜。',
      '房子会「咬人」：背叛者每回合可以选择一个有幸存者的房间，里面的每名幸存者进行速度 4+ 检定，失败受到 2 点物理伤害。',
      '背叛者可以拆除已经布置好的炸药，你们得重新布置。背叛者死亡也算你们获胜。',
      '「活房梁」（4 人局以上）会追打你们，被击败时只会被击晕。',
    ],
    win: '引线“嗤嗤”地烧进地下室。一声闷响之后，整栋楼像泄了气一样塌了下去——那种咀嚼声，终于停了。',
  },
  traitorSide: {
    goal: '保护你的房子：杀死足够多的幸存者（3/4 人局 2 人，5/6 人局 3 人；或者杀光所有幸存者）。',
    rules: [
      '特殊行动「咬人」（每回合一次）：选择任意一个有幸存者的房间，里面的每名幸存者进行速度 4+ 检定，失败受到 2 点物理伤害。',
      '特殊行动「拆除」（每回合一次）：在布置好炸药的爆破点进行理智 4+ 检定，成功则拆除它。',
      '你控制「活房梁」（4 人局以上），它们在你的回合之后行动，被击败时只会被击晕。',
      '你可以无视房间的有害效果（例如锅炉房的热浪）。你死亡就失败。',
    ],
    win: '墙皮慢慢合拢，把最后一声尖叫也咽了下去。明天拆迁队来的时候，只会看见一栋安安静静的老房子，和一个年轻得过分的看门人。',
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
      id: 'arm', side: 'hero', label: '布置炸药', desc: '在未布置的爆破点进行知识 5+ 检定，成功则布置好',
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
      id: 'bite', side: 'traitor', label: '咬人', desc: '选择一个有幸存者的房间：里面每人速度 4+ 检定，失败受 2 点物理伤害',
      can: (g) => g.heroes().length > 0,
      *run(g, s) {
        const tiles = [...new Set(g.heroes().map((h) => g.p(h).tile))];
        const near = (k: string) => Math.min(...sites(g).filter((t) => !t.data?.armed).map((t) => g.distance(k, t.tile)), 99);
        tiles.sort((a, b) => g.playersAt(b).filter((h) => !g.isTraitor(h)).length - g.playersAt(a).filter((h) => !g.isTraitor(h)).length || near(a) - near(b));
        const k = yield* g.chooseTile(s, '让房子咬哪个房间？', tiles);
        if (!k) return;
        g.reveal('背叛者每回合可以让房子「咬」一个房间：里面的人速度 4+ 检定，失败受到 2 点物理伤害。');
        g.log(`${g.tileName(k)}的地板突然裂开，像一张嘴！`, 'bad');
        for (const h of g.heroes().filter((x) => g.p(x).tile === k)) {
          const r = yield* g.check(h, 'speed', 4, '躲开 4+');
          if (r >= 4) g.log(`${g.p(h).name} 跳开了`, 'good');
          else yield* g.damage(h, 'physical', 2, '房子咬了一口', s);
        }
      },
    },
    {
      id: 'disarm', side: 'traitor', label: '拆除', desc: '在布置好炸药的爆破点进行理智 4+ 检定，成功则拆除',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'site').some((t) => t.data?.armed),
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'site').find((x) => x.data?.armed);
        if (!t) return;
        g.reveal('背叛者可以「拆除」已经布置好的炸药。');
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
