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
  const a = yield* g.check(s, 'might', undefined, '夺玉：比力量');
  const d = yield* g.check(o, 'might', undefined, '护玉：比力量');
  return a > d;
}

/** 4 玉中魂（直播 × 血沁玉佩） */
export const h4: HauntDef = {
  id: 4,
  title: '玉中魂',
  type: 'traitor',
  traitor: { type: 'highest', trait: 'sanity' },
  intro: '玉佩里那缕红丝游了起来，钻进背叛者的掌心。他再抬头看人，眼神像在认一百年前的熟人。墙缝里有个女人在哭。',
  hero: {
    goal: '从背叛者身上抢回血沁玉佩，带到佛堂封印。',
    rules: [
      '背叛者开局带着玉佩（玉佩不是卡牌，看计数轨）。佛堂一定会出现，放不下时换成祠堂，位置会公开。',
      '特殊行动「夺玉」：和带着玉佩的背叛者在同一房间时，双方各掷力量比点数。你更高就抢到玉佩；打平或更低，你受到 1 点物理伤害。',
      '带着玉佩的人死亡，玉佩掉在他所在的房间。谁先进入这个房间就自动捡起；已经在房间里的人用特殊行动「捡起玉佩」。',
      '特殊行动「封印玉佩」：你带着玉佩并且在佛堂时，理智检定 4+，成功你们就赢了。失败可以下回合再试。',
      '杀死背叛者不算获胜，只会让玉佩掉在地上。背叛者也能把玉佩抢回去，带玉的人身边最好有同伴。',
      '怨灵受伤只会被击晕。',
    ],
    win: '玉佩按进佛前的香灰里，红丝扭了两下，褪成白色。哭声停了，背叛者一屁股坐在地上。',
  },
  traitorSide: {
    goal: '杀死所有幸存者，别让玉佩进佛堂。',
    rules: [
      '你控制怨灵（速度 3，力量 4），它们在你的回合之后行动。开局你身边有 1 个怨灵。',
      '特殊行动「召魂」：你带着玉佩时，在你所在的房间召唤 1 个怨灵。场上怨灵最多 3 个，5、6 人局最多 4 个。',
      '特殊行动「夺玉」：和带着玉佩的幸存者在同一房间时，双方各掷力量比点数，你更高就抢回玉佩；打平或更低什么也不发生。',
      '带着玉佩的人死亡，玉佩掉在他所在的房间。谁先进入这个房间就自动捡起；已经在房间里的人用特殊行动「捡起玉佩」。',
      '幸存者带着玉佩在佛堂通过理智检定 4+，你就输了。',
    ],
    win: '玉佩又贴回了你的心口，里面多了几缕新的红丝。',
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
      id: 'grab', side: 'hero', label: '夺玉', desc: '和持玉的背叛者比力量，你更高就抢到玉佩，否则受到 1 点物理伤害',
      can: (g, s) => { const h = holder(g); return h != null && h !== s && g.isTraitor(h) && g.p(h).tile === g.p(s).tile; },
      *run(g, s) {
        const h = holder(g)!;
        if (yield* wrest(g, s, h)) {
          setHolder(g, s);
          g.setTrack('玉佩在背叛者身上', 0, 1);
          g.log(`${g.p(s).name} 从 ${g.p(h).name} 胸前扯下了玉佩`, 'good');
        } else {
          yield* g.damage(s, 'physical', 1, '玉佩烫手', h);
        }
      },
    },
    {
      id: 'seal', side: 'hero', label: '封印玉佩', desc: '在佛堂理智检定 4+，成功即获胜',
      can: (g, s) => holder(g) === s && g.p(s).tile === chapelTile(g),
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '封印玉佩 4+');
        if (r >= 4) g.hv.sealed = true;
        else g.log('玉佩在供桌上跳了一下，红丝还在游', 'bad');
      },
    },
    {
      id: 'summon', side: 'traitor', label: '召魂', desc: '在你所在的房间召唤 1 个怨灵',
      can: (g, s) => holder(g) === s && g.state.monsters.length < g.scale(3, 3, 4, 4),
      *run(g, s) {
        g.spawn('wraith', g.p(s).tile);
        g.log('玉佩一亮，墙里又走出一个怨灵', 'bad');
      },
    },
    {
      id: 'regrab', side: 'traitor', label: '夺玉', desc: '和持玉的幸存者比力量，你更高就抢回玉佩',
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
    g.log('玉佩滚到了地上', 'info');
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
