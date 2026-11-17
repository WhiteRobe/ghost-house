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
  intro: '日记最后一页写着你们朋友的名字，墨还没干，底下多了一行小楷：“我等了你们好久。”胆子最小的那位同伴开始哼一支老曲子，嗓子尖细，是个女人的声音。前面那些页上的署名全被墨涂黑了。',
  hero: {
    goal: '读日记拼出日记主人的真名，然后杀死被她附身的背叛者。',
    rules: [
      '背叛者是理智最低的人。「日记」标记放在书房；书房还没被发现的话，异变开始时会直接放出来（放不下时放在一楼走廊）。',
      '特殊行动「读日记」：在日记所在房间知识检定 4+。成功：真名进度 +1。失败：受到 1 点精神伤害。每轮一次。',
      '真名进度到 3（5/6 人局 4）时，真名揭开，背叛者失去 1 点理智。背叛者会「涂改」日记，让进度 -1。',
      '真名揭开之前，你们不能攻击背叛者，他却可以攻击你们。揭开之后可以正常攻击他。',
      '无字仆（4 人局 1 个，5/6 人局 2 个，3 人局没有）随时可以攻击，被击败时只会被击晕。',
      '背叛者死亡时，你们获胜。死去的幸存者达到 2 人（5/6 人局 3 人）时，你们失败。',
    ],
    win: '有人冲着那张白脸，一个字一个字喊出了她的名字。日记“哗啦”自己翻到了封底。那位同伴跪在地上大口喘气，抬头喊了一声你的名字，是他自己的嗓音。',
  },
  traitorSide: {
    goal: '你是日记的主人。杀死 2 名幸存者（5/6 人局 3 名）。',
    rules: [
      '异变开始时你力量 +2、速度 +1。你控制无字仆（4 人局 1 个，5/6 人局 2 个，3 人局没有），开始时在你的房间，在你的回合之后行动，被击败时只会被击晕。',
      '幸存者每人每轮可以读一次日记，知识检定 4+ 成功，真名进度 +1。进度到 3（5/6 人局 4）时真名揭开。',
      '真名揭开之前，幸存者不能攻击你，你可以攻击他们。',
      '特殊行动「涂改」：真名进度大于 0、你在日记所在房间时，知识检定 4+。成功：真名进度 -1。',
      '真名揭开时你失去 1 点理智，之后幸存者可以攻击你。你死亡时，你失败。',
    ],
    win: '日记合上了。最后一页又添了几个名字，墨一会儿就干了。',
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
      id: 'read', side: 'hero', label: '读日记', desc: '每轮一次：知识检定 4+，成功真名进度 +1。失败：受到 1 点精神伤害',
      can: (g, s) => !g.hv.named && g.p(s).tile === diaryTile(g) && g.p(s).flags.readRound !== g.state.haunt?.round,
      *run(g, s) {
        g.p(s).flags.readRound = g.state.haunt?.round ?? 0;
        const r = yield* g.check(s, 'knowledge', 4, '读日记 4+');
        if (r < 4) {
          yield* g.damage(s, 'mental', 1, '字迹在纸上爬动');
          return;
        }
        g.hv.progress = (g.hv.progress ?? 0) + 1;
        g.log(`${g.p(s).name} 又认出了名字里的一个字`, 'good');
        if (g.hv.progress >= g.hv.need) {
          g.hv.named = true;
          g.reveal('真名揭开了。背叛者失去 1 点理智，现在可以攻击他了。');
          const t = g.traitor();
          if (t != null) yield* g.lose(t, 'sanity', 1);
        }
        track(g);
      },
    },
    {
      id: 'erase', side: 'traitor', label: '涂改', desc: '在日记所在房间知识检定 4+，成功则真名进度 -1',
      can: (g, s) => !g.hv.named && (g.hv.progress ?? 0) > 0 && g.p(s).tile === diaryTile(g),
      *run(g, s) {
        g.reveal('背叛者可以在日记所在房间「涂改」：知识检定 4+，成功则真名进度 -1。');
        const r = yield* g.check(s, 'knowledge', 4, '涂改 4+');
        if (r < 4) return;
        g.hv.progress = Math.max(0, (g.hv.progress ?? 0) - 1);
        g.log('一滴墨掉在纸上，刚认出的那个字洇成了一团黑', 'bad');
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
