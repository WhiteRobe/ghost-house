import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';
import type { Floor } from '../shared/types';

/** 29 纸扎施工队（拆迁前夜 × 纸人，合作） */

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

function spot(g: Game, floor: Floor, avoid: string[], extra: string[]): string {
  const have = Object.keys(g.state.tiles).filter((k) => k[0] === floor && !START.includes(k) && !avoid.includes(k));
  // 越远越好
  have.sort((a, b) => g.distance(ENTRANCE, b) - g.distance(ENTRANCE, a));
  if (have.length && g.distance(ENTRANCE, have[0]) >= 3) {
    const k = have[0];
    reachable(g, k);
    return k;
  }
  for (const id of extra) {
    const k = g.placeRoom(id, [floor]);
    if (k && !avoid.includes(k)) {
      reachable(g, k);
      return k;
    }
  }
  if (have.length) {
    reachable(g, have[0]);
    return have[0];
  }
  reachable(g, LANDING[floor]);
  return LANDING[floor];
}

const pieces = (g: Game, s: number) => (g.p(s).flags.pieces as number) ?? 0;
const carriers = (g: Game) => g.heroes().filter((s) => pieces(g, s) > 0);

function deposit(g: Game, s: number) {
  const n = pieces(g, s);
  if (n <= 0 || g.p(s).tile !== ENTRANCE) return;
  g.p(s).flags.pieces = 0;
  g.hv.done = (g.hv.done ?? 0) + n;
  g.log(`${g.p(s).name} 把 ${n} 片地契压在了门厅的地砖下（已拼好 ${g.hv.done}/3）`, 'good');
  track(g);
}
const left = (g: Game) => Math.max(0, (g.hv.limit as number) - (g.state.haunt?.round ?? 1) + 1);

function track(g: Game) {
  g.setTrack(`拼回门厅的地契 · 房子被拆光前还剩 ${left(g)} 轮`, g.hv.done ?? 0, 3);
}

/** 必须一直走得到的格子：所有人、木匣、地契 */
function vital(g: Game): string[] {
  return [...g.alive().map((s) => g.p(s).tile), ...g.tokens('box').map((t) => t.tile), ...g.tokens('deed').map((t) => t.tile)];
}

/** 尝试拆掉一个房间（不能把人或木匣隔断） */
function demolish(g: Game, k: string): boolean {
  const tile = g.state.tiles[k];
  if (!tile || START.includes(k)) return false;
  if (g.alive().some((s) => g.p(s).tile === k)) return false;
  if (g.tokensAt(k, 'box').length || g.tokensAt(k, 'deed').length) return false;
  const links = g.state.links;
  delete g.state.tiles[k];
  g.state.links = links.filter(([a, b]) => a !== k && b !== k);
  if (vital(g).some((v) => g.distance(ENTRANCE, v) === Infinity)) {
    g.state.tiles[k] = tile;
    g.state.links = links;
    return false;
  }
  for (const t of g.tokensAt(k)) g.removeToken(t.id);
  for (const m of g.monstersAt(k)) {
    const near = Object.keys(g.state.tiles).filter((x) => x[0] === k[0]);
    g.moveMonster(m.id, near.length ? near[g.rng.int(near.length)] : ENTRANCE);
  }
  // 死者遗体所在的房间塌了：挪到门厅
  for (const p of g.state.players) if (p.tile === k) p.tile = ENTRANCE;
  return true;
}

export const h29: HauntDef = {
  id: 29,
  title: '纸扎施工队',
  type: 'coop',
  traitor: { type: 'none' },
  intro: '纸人怀里那顶小安全帽，一转眼戴到了它自己头上。楼上楼下响起叮叮当当的敲打声，一队纸扎的工人举着纸糊的大锤，一间一间拆这栋房子。拆迁办的人说过，房子底下压着一张地契，没了它，没人能证明这里住过人。',
  hero: {
    goal: '在房子被拆光前，把 3 片地契全部带回门厅。',
    rules: [
      '地下室、一楼、二楼各有一只木匣（标记），尽量放在离门厅远的房间，每只里面有 1 片地契。',
      '特殊行动「撬木匣」：在有木匣的房间知识检定 4+，成功拿到里面的地契。你可以带好几片。',
      '带着地契进入门厅，或在门厅结束回合，地契自动交上。交满 3 片，你们获胜。',
      '你死亡时，身上的地契掉在原地。其他人用特殊行动「捡地契」拿起。',
      '每轮结束时，随机房间被标成危房（3/4 人局 1 间，5/6 人局 2 间，起始房间不会）。你在危房结束回合，受到 1 点物理伤害。危房在下一轮结束时被拆掉，从地图上消失。里面有活人、木匣或地契，或者拆了会让人、木匣、地契走不回门厅时，这间先不拆，等之后的轮。',
      '纸扎工人（怪物）一开始有 3 人局 2 只、4 人局 3 只、5 人局 4 只、6 人局 5 只，专追带着地契的人，被击败时只会被击晕。每轮结束时从一间危房里再钻出 1 只，最多 3 人局 4 只、4 人局 6 只、5 人局 7 只、6 人局 8 只。',
      '计数轨显示房子被拆光前还剩几轮（3/4 人局 7 轮，5/6 人局 6 轮）。归零时地契还没交齐，所有人失败。',
    ],
    win: '最后一片地契压进门厅的地砖底下，锤声一下子停了。纸扎工人站在原地，被穿堂风一吹，散成一地纸屑。',
  },
  monsters: {
    worker: { name: '纸扎工人', icon: 'worker', speed: 4, might: 4 },
  },
  *setup(g) {
    g.hv.limit = g.scale(7, 7, 6, 6);
    const used: string[] = [];
    const extra: Record<Floor, string[]> = {
      B: ['storeroom', 'coal-room', 'wine-cellar', 'vault'],
      G: ['servants', 'storeroom', 'dining', 'tea-room'],
      U: ['attic', 'vault', 'master-bedroom', 'guest-room'],
    };
    for (const f of ['B', 'G', 'U'] as Floor[]) {
      const k = spot(g, f, used, extra[f]);
      used.push(k);
      g.token(k, 'box', '木匣', { icon: 'box' });
    }
    g.hv.done = 0;
    const n = g.scale(2, 3, 4, 5);
    const tiles = Object.keys(g.state.tiles).filter((k) => k !== ENTRANCE && g.distance(ENTRANCE, k) < Infinity);
    for (let i = 0; i < n; i++) g.spawn('worker', tiles[g.rng.int(tiles.length)]);
    track(g);
  },
  actions: [
    {
      id: 'open', side: 'hero', label: '撬木匣', desc: '知识检定 4+：打开本房间的木匣，拿到 1 片地契',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'box').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '撬木匣 4+');
        if (r < 4) {
          g.log('铜锁锈死了，撬不开', 'info');
          return;
        }
        const box = g.tokensAt(g.p(s).tile, 'box')[0];
        if (!box) return;
        g.removeToken(box.id);
        g.p(s).flags.pieces = pieces(g, s) + 1;
        g.log(`${g.p(s).name} 打开木匣，取出了一片地契`, 'good');
      },
    },
    {
      id: 'grab', side: 'hero', label: '捡地契', desc: '捡起本房间地上的所有地契',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'deed').length > 0,
      *run(g, s) {
        const ts = g.tokensAt(g.p(s).tile, 'deed');
        for (const t of ts) g.removeToken(t.id);
        g.p(s).flags.pieces = pieces(g, s) + ts.length;
        g.log(`${g.p(s).name} 捡起了地契碎片`, 'good');
      },
    },
  ],
  *onEnter(g, s) {
    deposit(g, s);
  },
  *onTurnEnd(g, s) {
    deposit(g, s);
    if (g.tokensAt(g.p(s).tile, 'unsafe').length) yield* g.damage(s, 'physical', 1, '危房掉下来的砖瓦');
  },
  *onDeath(g, s) {
    const p = g.p(s);
    const n = pieces(g, s);
    if (n > 0) {
      p.flags.pieces = 0;
      for (let i = 0; i < n; i++) g.token(p.tile, 'deed', '地契碎片', { icon: 'deed' });
      g.log('地契碎片飘落在地上', 'info');
    }
  },
  *onRoundEnd(g) {
    // 已是危房的先拆
    for (const t of g.tokens('unsafe')) {
      const name = g.tileName(t.tile);
      if (demolish(g, t.tile)) g.log(`「${name}」被纸扎工人拆了，只剩一片空地`, 'bad');
    }
    const k = g.scale(1, 1, 2, 2);
    const cand = Object.keys(g.state.tiles).filter((x) => !START.includes(x) && !g.tokensAt(x, 'unsafe').length);
    g.rng.shuffle(cand);
    for (const x of cand.slice(0, k)) {
      g.token(x, 'unsafe', '危房', { icon: 'unsafe' });
      g.log(`纸扎工人在「${g.tileName(x)}」的墙上刷了一个「拆」字`, 'bad');
    }
    // 每轮再来一名工人
    if (g.state.monsters.length < g.scale(4, 6, 7, 8)) {
      const from = g.tokens('unsafe').map((t) => t.tile).filter((x) => g.state.tiles[x]);
      if (from.length) g.spawn('worker', from[g.rng.int(from.length)]);
    }
    for (const s of g.alive()) reachable(g, g.p(s).tile);
    track(g);
  },
  checkWin(g) {
    if ((g.hv.done ?? 0) >= 3) return { side: 'hero' };
    if (left(g) <= 0) return { side: 'none', text: '最后一面墙倒了。纸扎工人扛起纸锤，排着队走进废墟。' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const here = g.p(s).tile;
      const todo = [...g.tokens('deed'), ...g.tokens('box')].map((t) => t.tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      if (pieces(g, s) > 0 && (!todo.length || g.distance(here, ENTRANCE) <= g.distance(here, todo[0]))) return { goals: [ENTRANCE], actions: ['grab', 'open'], attack: false };
      if (todo.length) return { goals: todo, actions: ['grab', 'open'] };
      const c = carriers(g);
      return { goals: c.length ? c.map((h) => g.p(h).tile) : [ENTRANCE] };
    },
    monster: (g) => {
      const c = carriers(g);
      return c.length ? { goals: c.map((h) => g.p(h).tile) } : {};
    },
  },
};
