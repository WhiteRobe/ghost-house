import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 玉佩当前在谁身上：座位号；掉在地上为 null（看 h4-jade 标记） */
const holder = (g: Game): number | null => (g.hv.holder ?? null);

function setHolder(g: Game, seat: number | null, tile?: string) {
  for (const t of g.tokens('h4-jade')) g.removeToken(t.id);
  g.hv.holder = seat;
  if (seat == null && tile) g.token(tile, 'h4-jade', '血沁玉佩', { icon: 'jade' });
}

function chapelTile(g: Game): string {
  if (g.hv.chapel && g.state.tiles[g.hv.chapel]) return g.hv.chapel;
  const k = g.placeRoom('chapel') ?? g.placeRoom('ancestral-hall') ?? 'G:0,-2';
  g.hv.chapel = k;
  return k;
}

/** 同格对抗力量；返回 true 表示发起者胜出 */
function* wrest(g: Game, s: number, o: number) {
  const a = yield* g.check(s, 'might', undefined, '夺玉（力量对抗）');
  const d = yield* g.check(o, 'might', undefined, '护玉（力量对抗）');
  return a > d;
}

/** 4 玉中魂（直播 × 血沁玉佩） */
export const h4: HauntDef = {
  id: 4,
  title: '玉中魂',
  type: 'traitor',
  traitor: { type: 'highest', trait: 'sanity' },
  intro: '玉佩里那缕红丝忽然游了起来，钻进了背叛者的掌心。他的眼神变得很旧，像是在看一百年前的人。墙缝里开始渗出低低的哭声——玉里的魂醒了，它要把这栋楼的冤魂都叫回来。',
  hero: {
    goal: '把血沁玉佩从背叛者身上抢回来，带到佛堂封印。',
    rules: [
      '异变开始时，背叛者身上带着玉佩（以剧本状态记录，不是卡牌）。佛堂一定会出现（放不下时改为祠堂）。',
      '特殊行动「夺玉」：与持玉者同处一室时，和他进行力量对抗检定（双方各掷力量），你点数更高就抢到玉佩；否则你受到 1 点物理伤害。',
      '持玉者死亡时，玉佩掉在他所在的房间；任何人进入该房间会自动捡起它，已在房间里的人可以用行动「捡起玉佩」。',
      '特殊行动「封印玉佩」：持玉者在佛堂进行理智 4+ 检定，成功即获胜。',
      '怨灵受伤只会被击晕。',
    ],
    win: '玉佩被按进佛前的香灰里，那缕红丝挣扎着褪成了白色。哭声停了，背叛者像大梦初醒般瘫坐在地上。',
  },
  traitorSide: {
    goal: '杀死所有幸存者，让玉中魂重新拥有一个家族。',
    rules: [
      '你控制怨灵，它们在你的回合之后行动。',
      '特殊行动「召魂」：你身上有玉佩时，在你所在房间召唤一个怨灵（场上最多若干个，3/4 人局 3 个，5/6 人局 4 个）。',
      '特殊行动「夺玉」：与持玉的幸存者同处一室时，和他进行力量对抗，你点数更高就抢回玉佩。',
      '持玉的幸存者死亡时，玉佩掉在他所在的房间，任何人进入该房间会自动捡起，已在房间里的人可以用行动「捡起玉佩」。',
    ],
    win: '玉佩又回到了你的心口。房子里多了几缕新的红丝，它们终于不再孤单。',
  },
  monsters: {
    wraith: { name: '怨灵', icon: 'wraith', speed: 3, might: 4 },
  },
  *setup(g) {
    g.placeRoom('cellar-hatch'); // 保证地下室与一楼相通
    const t = g.traitor()!;
    setHolder(g, t);
    const c = chapelTile(g);
    g.spawn('wraith', g.p(t).tile);
    g.reveal(`佛堂位于「${g.tileName(c)}」`);
    g.setTrack('玉佩在背叛者身上', 1, 1);
  },
  actions: [
    {
      id: 'pickup', side: 'any', label: '捡起玉佩', desc: '捡起掉在本房间的玉佩',
      can: (g, s) => holder(g) == null && g.tokensAt(g.p(s).tile, 'h4-jade').length > 0,
      *run(g, s) {
        setHolder(g, s);
        g.setTrack('玉佩在背叛者身上', g.isTraitor(s) ? 1 : 0, 1);
        g.log(`${g.p(s).name} 捡起了玉佩`, g.isTraitor(s) ? 'bad' : 'good');
      },
    },
    {
      id: 'grab', side: 'hero', label: '夺玉', desc: '与持玉者进行力量对抗，胜则抢到玉佩，败则受 1 点物理伤害',
      can: (g, s) => { const h = holder(g); return h != null && h !== s && g.isTraitor(h) && g.p(h).tile === g.p(s).tile; },
      *run(g, s) {
        const h = holder(g)!;
        if (yield* wrest(g, s, h)) {
          setHolder(g, s);
          g.setTrack('玉佩在背叛者身上', 0, 1);
          g.log(`${g.p(s).name} 从 ${g.p(h).name} 胸前扯下了玉佩！`, 'good');
        } else {
          yield* g.damage(s, 'physical', 1, '玉佩烫手', h);
        }
      },
    },
    {
      id: 'seal', side: 'hero', label: '封印玉佩', desc: '在佛堂进行理智 4+ 检定，成功即获胜',
      can: (g, s) => holder(g) === s && g.p(s).tile === chapelTile(g),
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '封印玉佩 4+');
        if (r >= 4) g.hv.sealed = true;
        else g.log('玉佩在供桌上跳了一下，红丝还在游动', 'bad');
      },
    },
    {
      id: 'summon', side: 'traitor', label: '召魂', desc: '在你所在房间召唤一个怨灵',
      can: (g, s) => holder(g) === s && g.state.monsters.length < g.scale(3, 3, 4, 4),
      *run(g, s) {
        g.spawn('wraith', g.p(s).tile);
        g.log('玉佩一亮，墙里又走出一个怨灵', 'bad');
      },
    },
    {
      id: 'regrab', side: 'traitor', label: '夺玉', desc: '与持玉的幸存者进行力量对抗，胜则抢回玉佩',
      can: (g, s) => { const h = holder(g); return h != null && h !== s && g.p(h).tile === g.p(s).tile; },
      *run(g, s) {
        const h = holder(g)!;
        if (yield* wrest(g, s, h)) {
          setHolder(g, s);
          g.setTrack('玉佩在背叛者身上', 1, 1);
          g.log(`${g.p(s).name} 把玉佩抢了回去`, 'bad');
        }
      },
    },
  ],
  *onEnter(g, s) {
    if (holder(g) != null) return;
    const tok = g.tokensAt(g.p(s).tile, 'h4-jade')[0];
    if (!tok) return;
    setHolder(g, s);
    g.setTrack('玉佩在背叛者身上', g.isTraitor(s) ? 1 : 0, 1);
    g.log(`${g.p(s).name} 捡起了玉佩`, g.isTraitor(s) ? 'bad' : 'good');
  },
  *onDeath(g, s) {
    if (holder(g) !== s) return;
    setHolder(g, null, g.p(s).tile);
    g.setTrack('玉佩在背叛者身上', 0, 1);
    g.log('玉佩滚落在地上', 'info');
  },
  checkWin(g) {
    if (g.hv.sealed) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const h = holder(g);
      if (h === s) return { goals: [chapelTile(g)], actions: ['seal'], attack: false };
      if (h == null) return { goals: g.tokens('h4-jade').map((t) => t.tile), actions: ['pickup'] };
      if (!g.isTraitor(h)) {
        // 护送持玉的队友
        return { goals: [g.p(h).tile] };
      }
      return { goals: [g.p(h).tile], actions: ['grab'], targets: [h] };
    },
    traitor: (g, s) => {
      const h = holder(g);
      if (h === s) return { goals: g.heroes().map((x) => g.p(x).tile), actions: ['summon'] };
      if (h == null) return { goals: g.tokens('h4-jade').map((t) => t.tile), actions: ['pickup'] };
      return { goals: [g.p(h).tile], actions: ['regrab'], targets: [h] };
    },
    monster: (g) => {
      const h = holder(g);
      if (h != null && !g.isTraitor(h)) return { goals: [g.p(h).tile] };
      return {};
    },
  },
};
