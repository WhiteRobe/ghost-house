import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 24 日记最后一页（失踪的朋友 × 旧日记） */

function landing(k: string) {
  return k[0] === 'B' ? 'B:0,-2' : k[0] === 'U' ? 'U:0,-2' : 'G:0,-1';
}

function reachable(g: Game, k: string) {
  if (g.distance('G:0,0', k) < Infinity) return;
  if (k[0] === 'B') g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', k) < Infinity) return;
  const l = landing(k);
  if (g.distance('G:0,0', l) === Infinity) g.link('G:0,-1', l);
  if (g.distance('G:0,0', k) === Infinity) g.link(l, k);
}

function track(g: Game) {
  if (g.hv.named) g.setTrack('她的真名已被揭开', g.hv.need, g.hv.need);
  else g.setTrack('拼出的真名', g.hv.progress ?? 0, g.hv.need);
}

const diaryTile = (g: Game) => g.tokens('diary')[0]?.tile ?? (g.hv.diary as string);

export const h24: HauntDef = {
  id: 24,
  title: '日记最后一页',
  type: 'traitor',
  traitor: { type: 'lowest', trait: 'sanity' },
  intro: '日记的最后一页写着你们朋友的名字，墨迹还是湿的，下面是一行陌生的娟秀小楷：“我等了你们好久。”胆子最小的那位同伴开始用不属于他的声音哼一支旧曲子。日记的主人回来了，而只要没人叫出她的真名，什么都伤不了她。',
  hero: {
    goal: '轮流读日记，一笔一笔拼出日记主人的真名；之后合力击败被她附身的背叛者。',
    rules: [
      '日记（标记）放在书房里；书房若尚未被发现，异变开始时会出现（找不到就放在走廊）。',
      '特殊行动「读日记」：在日记所在的房间进行知识 4+ 检定，成功则真名进度 +1；失败受到 1 点精神伤害。每名幸存者每轮只能读一次。',
      '真名进度达到 3（3/4 人局）或 4（5/6 人局）时，真名被揭开。',
      '真名被揭开之前，你们无法攻击背叛者；之后可以正常攻击他。',
      '「无字仆」可以随时攻击，被击败时只会被击晕。',
    ],
    win: '有人对着那张惨白的脸，一字一顿地喊出了她的名字。日记“哗”地自己翻到封底，那位同伴跪倒在地，大口喘气，眼神终于是他自己的了。',
  },
  traitorSide: {
    goal: '你是日记的主人。在他们叫出你的真名之前，让足够多的人永远留在这里（3/4 人局 2 人，5/6 人局 3 人；或者杀光所有幸存者）。',
    rules: [
      '异变开始时你力量 +2、速度 +1。你控制「无字仆」（3 人局没有），它们在你的回合之后行动，被击败时只会被击晕。',
      '真名被揭开之前，幸存者无法攻击你。',
      '特殊行动「涂改」（每回合一次）：在日记所在的房间进行知识 4+ 检定，成功则真名进度 -1。',
      '真名被揭开后你会受到反噬：理智 -1，此后幸存者可以攻击你。你死亡则失败。',
    ],
    win: '日记合上了。最后一页上又多了几个名字，墨迹很快就干了。',
  },
  monsters: {
    blank: { name: '无字仆', icon: 'blank', speed: 3, might: 3 },
  },
  *setup(g) {
    const t = g.traitor()!;
    let lib = g.placeRoom('library');
    if (!lib) lib = 'G:0,-1';
    reachable(g, lib);
    g.hv.diary = lib;
    g.token(lib, 'diary', '日记', { icon: 'diary' });
    g.hv.progress = 0;
    g.hv.need = g.scale(3, 3, 4, 4);
    g.hv.named = false;
    yield* g.gain(t, 'might', 2);
    yield* g.gain(t, 'speed', 1);
    const n = g.scale(0, 1, 2, 2);
    for (let i = 0; i < n; i++) g.spawn('blank', g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'read', side: 'hero', label: '读日记', desc: '知识 4+ 检定：成功真名进度 +1，失败受 1 点精神伤害（每轮一次）',
      can: (g, s) => !g.hv.named && g.p(s).tile === diaryTile(g) && g.p(s).flags.readRound !== g.state.haunt?.round,
      *run(g, s) {
        g.p(s).flags.readRound = g.state.haunt?.round ?? 0;
        const r = yield* g.check(s, 'knowledge', 4, '读日记 4+');
        if (r < 4) {
          yield* g.damage(s, 'mental', 1, '字迹在纸上爬动');
          return;
        }
        g.hv.progress = (g.hv.progress ?? 0) + 1;
        g.log(`${g.p(s).name} 认出了名字里的又一个字`, 'good');
        if (g.hv.progress >= g.hv.need) {
          g.hv.named = true;
          g.reveal('真名被揭开了！背叛者现在可以被攻击。');
          const t = g.traitor();
          if (t != null) yield* g.lose(t, 'sanity', 1);
        }
        track(g);
      },
    },
    {
      id: 'erase', side: 'traitor', label: '涂改', desc: '在日记所在房间进行知识 4+ 检定，成功则真名进度 -1',
      can: (g, s) => !g.hv.named && (g.hv.progress ?? 0) > 0 && g.p(s).tile === diaryTile(g),
      *run(g, s) {
        g.reveal('背叛者可以在日记旁「涂改」，让拼出的真名少一个字。');
        const r = yield* g.check(s, 'knowledge', 4, '涂改 4+');
        if (r < 4) return;
        g.hv.progress = Math.max(0, (g.hv.progress ?? 0) - 1);
        g.log('一滴墨落在纸上，刚认出的字被洇成了一团黑', 'bad');
        track(g);
      },
    },
  ],
  canAttack(g, seat, target) {
    if (seat < 0) return target.seat != null && !g.isTraitor(target.seat);
    if (target.monster != null) return !g.isTraitor(seat);
    const o = target.seat!;
    if (o === seat || g.sideOf(o) === g.sideOf(seat)) return false;
    if (g.isTraitor(o) && !g.hv.named) return false;
    return true;
  },
  *onRoundEnd(g) {
    for (const s of g.alive()) reachable(g, g.p(s).tile);
  },
  checkWin(g) {
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero' };
    const dead = g.heroes(true).filter((s) => g.p(s).dead).length;
    if (dead >= g.scale(2, 2, 3, 3)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const t = g.traitor();
      if (g.hv.named && t != null) return { goals: [g.p(t).tile], targets: [t] };
      return { goals: [diaryTile(g)], actions: ['read'] };
    },
    traitor: (g) => {
      const hs = g.heroes();
      if (!g.hv.named) {
        const d = diaryTile(g);
        return { goals: [d, ...hs.map((h) => g.p(h).tile)], actions: ['erase'] };
      }
      hs.sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
      return { goals: hs.map((h) => g.p(h).tile) };
    },
  },
};
