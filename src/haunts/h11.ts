import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 地下室和楼上没连通时，开一道暗梯，免得有人被困死 */
function bridge(g: Game) {
  for (const p of g.state.players) {
    if (p.dead || g.distance('G:0,0', p.tile) < Infinity) continue;
    const to = g.distance('B:0,-2', p.tile) < Infinity ? 'B:0,-2' : p.tile;
    if (g.distance('G:0,0', to) === Infinity) {
      g.link('G:0,-1', to);
      g.log('走廊的地板裂开，露出一道通往下面的暗梯', 'info');
    }
  }
}

const START = 'G:0,0';
const starts = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function openTiles(g: Game, exclude: string[] = []): string[] {
  return Object.keys(g.state.tiles).filter((k) => !exclude.includes(k) && g.distance(START, k) < Infinity);
}

/** 替身归属：token id -> 座位（-1 表示空纸人） */
const owners = (g: Game): Record<number, number> => (g.hs.owner ??= {});

function effigyOf(g: Game, seat: number) {
  const own = owners(g);
  return g.tokens('effigy').find((t) => own[t.id] === seat) ?? null;
}

/** 被带在身上的替身跟着主人走 */
function sync(g: Game) {
  for (const t of g.tokens('effigy')) {
    const c = t.data?.carry as number | undefined;
    if (c == null || g.p(c).dead) continue;
    t.tile = g.p(c).tile;
    const m = g.state.tokens.find((x) => x.id === t.data?.mark);
    if (m) m.tile = t.tile;
  }
}

function fire(g: Game): string[] {
  return (g.hv.fire as string[] | undefined)?.filter((k) => g.state.tiles[k]) ?? [];
}

function reachable(g: Game, k: string): string {
  if (g.distance(START, k) === Infinity) g.link('G:0,-1', k);
  return k;
}

function burned(g: Game, seat: number) {
  return !!g.p(seat).flags.h11burned;
}

/** 背叛者够得着的替身主人 */
function cursable(g: Game, s: number): number[] {
  sync(g);
  const own = owners(g);
  const near = [g.p(s).tile, ...g.neighbors(g.p(s).tile)];
  const out: number[] = [];
  for (const t of g.tokens('effigy')) {
    const o = own[t.id];
    if (o == null || o < 0 || g.p(o).dead || !near.includes(t.tile) || out.includes(o)) continue;
    out.push(o);
  }
  return out;
}

/** 11 替身诅咒 */
export const h11: HauntDef = {
  id: 11,
  title: '替身诅咒',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '遗嘱宣读到一半，律师念出了一句奇怪的话：“凡在场者，各留一身，代受其过。”屋里各处的角落，悄悄多出了一个个纸扎小人，眉眼和你们一模一样。揭示者手里多了一根长长的银针。',
  hero: {
    goal: '找到属于你自己的纸人替身，把它烧掉。所有活着的幸存者都烧掉自己的替身时，你们获胜；但如果死去的幸存者达到一半（向上取整；3 人局为 2 人），你们就输了。',
    rules: [
      '房子里散落着若干个「纸人」标记，数量比幸存者多三个：每名幸存者各有一个替身，其余是空纸人。只有背叛者知道哪个是谁的。',
      '特殊行动「翻看纸人」：在有未翻开纸人的房间执行，翻开这里所有纸人，公开它们属于谁；空纸人直接被移除。',
      '特殊行动「收起替身」：在你自己（已翻开的）替身所在的房间，把它揣进怀里，它会跟着你移动。',
      '特殊行动「烧替身」：带着自己的替身到有火的房间（标有「火」的房间：锅炉房，没有锅炉房则是厨房），进行理智 3+ 检定，成功则烧掉它。烧掉后背叛者再也不能通过它伤害你。',
      '背叛者站在某个替身所在的房间或相邻房间时，可以对它施咒，替身的主人会直接受到伤害——不管他身在何处。',
      '幸存者死亡后，他的替身随之化为纸灰。',
      '背叛者躲在纸人后面：他防御时多掷 2 颗骰。就算杀了他，扎进纸人里的针也不会自己掉出来。',
    ],
    win: '最后一个纸人在火苗里蜷成一团黑灰。那根银针“叮”地一声掉在地上，再也没人去捡。',
  },
  traitorSide: {
    goal: '用替身扎死至少一半的幸存者（向上取整：3 人局 2 人，4/5 人局 2 人，6 人局 3 人）。',
    rules: [
      '你能看到每个纸人属于谁（带「替身」字样的标记只有你看得见）。',
      '特殊行动「扎纸人」（每回合一次）：对你所在房间或相邻房间里一个未烧掉的替身（包括被幸存者揣在身上的）进行知识检定，替身的主人受到伤害（由他自己分配到任意属性）：0–1 点为 1 点，2–3 点为 2 点，4–5 点为 3 点，6 点以上为 4 点。',
      '特殊行动「藏纸人」（每回合一次）：把你所在房间里一个尚未被翻开的替身带到相邻房间。',
      '你被攻击时防御多掷 2 颗骰。',
    ],
    win: '最后一根银针扎下去，纸人的眼睛里渗出了一滴墨。屋里又安静了。',
  },
  *setup(g) {
    bridge(g);
    const t = g.traitor()!;
    const heroes = g.heroes();
    let tiles = openTiles(g, [...starts, g.p(t).tile]);
    if (tiles.length < heroes.length + 2) tiles = openTiles(g, [START]);
    g.rng.shuffle(tiles);
    const own = owners(g);
    const list = [...heroes, -1, -1, -1];
    list.forEach((seat, i) => {
      const tile = tiles[i % tiles.length];
      const tok = g.token(tile, 'effigy', '纸人', { icon: 'effigy' });
      own[tok.id] = seat;
      if (seat >= 0) {
        const mark = g.token(tile, 'effigy-mark', `${g.p(seat).name}的替身`, { icon: 'effigy', side: 'traitor', data: { of: tok.id } });
        tok.data = { mark: mark.id };
        g.log(`${g.p(seat).name} 的替身藏在「${g.tileName(tile)}」`, 'info', t, 'traitor');
      }
    });
    g.setTrack('未烧掉的替身', heroes.length);
    const fires: string[] = [];
    for (const id of ['furnace', 'kitchen']) {
      const k = g.findTile(id) ?? g.placeRoom(id);
      if (k) { fires.push(reachable(g, k)); break; }
    }
    if (!fires.length) {
      const far = openTiles(g, starts);
      fires.push(far.length ? far[g.rng.int(far.length)] : 'G:0,-1');
    }
    for (const k of fires) g.token(k, 'fire', '火', { icon: 'fire' });
    g.hv.fire = fires;
  },
  *onRoundEnd(g) { bridge(g); },
  *onEnter(g) { sync(g); },
  *onTurnStart(g) { sync(g); },
  *onTurnEnd(g) { sync(g); },
  actions: [
    {
      id: 'inspect', side: 'hero', label: '翻看纸人', desc: '翻开这里所有纸人，公开它们属于谁',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'effigy').some((t) => !t.data?.shown),
      *run(g, s) {
        const own = owners(g);
        for (const t of g.tokensAt(g.p(s).tile, 'effigy')) {
          if (t.data?.shown) continue;
          const o = own[t.id];
          if (o == null || o < 0) {
            g.removeToken(t.id);
            g.log(`${g.p(s).name} 翻开一个纸人——脸是空白的，一碰就散了`, 'info');
          } else {
            t.data = { ...t.data, shown: true };
            t.label = `${g.p(o).name}的替身`;
            g.log(`${g.p(s).name} 翻开纸人：那是 ${g.p(o).name} 的脸！`, 'haunt');
          }
        }
      },
    },
    {
      id: 'pick', side: 'hero', label: '收起替身', desc: '把这里属于你的替身揣进怀里',
      can: (g, s) => {
        const e = effigyOf(g, s);
        return !!e && !!e.data?.shown && e.data?.carry == null && e.tile === g.p(s).tile;
      },
      *run(g, s) {
        const e = effigyOf(g, s);
        if (!e) return;
        e.data = { ...e.data, carry: s };
        e.label = `${g.p(s).name}的替身（被带走）`;
        g.log(`${g.p(s).name} 把自己的替身揣进了怀里，它冰凉冰凉的`, 'info');
      },
    },
    {
      id: 'burn', side: 'hero', label: '烧替身', desc: '在有火的房间理智 3+ 检定，烧掉身上的替身',
      can: (g, s) => {
        const e = effigyOf(g, s);
        return !!e && e.data?.carry === s && fire(g).includes(g.p(s).tile);
      },
      *run(g, s) {
        const e = effigyOf(g, s);
        if (!e) return;
        const r = yield* g.check(s, 'sanity', 3, '烧替身 3+');
        if (r < 3) {
          g.log(`火苗舔到纸人就灭了，${g.p(s).name} 的手在发抖`, 'bad');
          return;
        }
        if (e.data?.mark != null) g.removeToken(e.data.mark as number);
        g.removeToken(e.id);
        g.p(s).flags.h11burned = true;
        g.setTrack('未烧掉的替身', g.tokens('effigy').filter((t) => (owners(g)[t.id] ?? -1) >= 0).length);
        g.log(`${g.p(s).name} 烧掉了自己的替身，胸口一松`, 'good');
      },
    },
    {
      id: 'curse', side: 'traitor', label: '扎纸人', desc: '知识检定，伤害这里某个替身的主人',
      can: (g, s) => cursable(g, s).length > 0,
      *run(g, s) {
        const here = cursable(g, s);
        const target = yield* g.choosePlayer(s, '扎谁的替身？', here);
        if (target == null) return;
        const r = yield* g.check(s, 'knowledge', undefined, '扎纸人');
        const n = r >= 6 ? 4 : r >= 4 ? 3 : r >= 2 ? 2 : 1;
        g.log(`${g.p(target).name} 浑身一阵刺痛，像被无数根针扎进了骨头`, 'bad');
        yield* g.damage(target, 'general', n, '替身诅咒', s);
      },
    },
    {
      id: 'hide', side: 'traitor', label: '藏纸人', desc: '把这里一个未被翻开的替身带到相邻房间',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'effigy').some((t) => !t.data?.shown && (owners(g)[t.id] ?? -1) >= 0) && g.neighbors(g.p(s).tile).length > 0,
      ai: () => false,
      *run(g, s) {
        const t = g.tokensAt(g.p(s).tile, 'effigy').find((x) => !x.data?.shown && (owners(g)[x.id] ?? -1) >= 0);
        if (!t) return;
        const to = yield* g.chooseTile(s, '把替身藏到哪里？', g.neighbors(g.p(s).tile));
        if (!to) return;
        t.tile = to;
        const m = g.state.tokens.find((x) => x.id === t.data?.mark);
        if (m) m.tile = to;
        g.log('一阵风吹过，纸人似乎换了个地方', 'info');
      },
    },
  ],
  *onDeath(g, seat) {
    const e = effigyOf(g, seat);
    if (e) {
      if (e.data?.mark != null) g.removeToken(e.data.mark as number);
      g.removeToken(e.id);
    }
  },
  rollBonus: (g, s, _t, purpose) => (purpose === 'defend' && g.isTraitor(s) ? 2 : 0),
  checkWin(g) {
    const t = g.traitor();
    const all = g.heroes(true);
    const dead = all.filter((s) => g.p(s).dead).length;
    if (dead >= (all.length <= 2 ? 2 : Math.ceil(all.length / 2))) return { side: 'traitor' };
    const alive = g.heroes();
    if (alive.length && alive.every((s) => burned(g, s))) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const mine = effigyOf(g, s);
      const unknown = g.tokens('effigy').filter((t) => !t.data?.shown).map((t) => t.tile);
      if (mine?.data?.carry === s) return { goals: fire(g), actions: ['burn', 'inspect'] };
      if (mine?.data?.shown) return { goals: [mine.tile], actions: ['pick', 'inspect'] };
      if (mine && unknown.length) return { goals: unknown, actions: ['inspect'] };
      // 自己的已经烧掉：帮别人翻，或者去围攻背叛者
      const t = g.traitor();
      const goals = unknown.length ? unknown : t != null ? [g.p(t).tile] : [];
      return { goals, actions: ['inspect'] };
    },
    traitor: (g, s) => {
      const own = owners(g);
      const live = g.tokens('effigy').filter((t) => (own[t.id] ?? -1) >= 0);
      // 优先去被翻开的（马上要被烧的）
      const shown = live.filter((t) => t.data?.shown).map((t) => t.tile);
      const goals = shown.length ? shown : live.map((t) => t.tile);
      return { goals, actions: ['curse'], attack: true };
    },
  },
};
