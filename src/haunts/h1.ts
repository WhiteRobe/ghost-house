import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 随机挑若干个格子（尽量分散，排除指定格子） */
function pickTiles(g: Game, n: number, exclude: string[]): string[] {
  const all = Object.keys(g.state.tiles).filter((k) => !exclude.includes(k));
  g.rng.shuffle(all);
  return all.slice(0, n);
}

const mirrorsLeft = (g: Game) => g.tokens('h1-mirror').length;

/** 1 镜中直播间（直播 × 铜镜） */
export const h1: HauntDef = {
  id: 1,
  title: '镜中直播间',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '直播画面突然卡住了。镜头里的揭示者还在对着弹幕微笑，可镜头外的那个人已经不会眨眼——真正的他被关进了镜子里，换出来的是镜中人。洋楼里每一面镜子都亮起了直播间的红点。',
  hero: {
    goal: '打碎散落在洋楼里的所有镜子，然后击败从镜中换出来的背叛者。',
    rules: [
      '异变开始时，房子里有若干面「镜子」标记（数量见计数轨）。',
      '特殊行动「砸镜子」：在有镜子的房间进行力量 4+ 检定，成功则打碎这面镜子。',
      '只要还有镜子没被打碎，背叛者死亡时会从一面镜子里重新走出来：他回到起始属性，出现在那面镜子所在的房间，而那面镜子随之碎裂。',
      '镜像会映出同房间里的人：每轮结束时，与幸存者同处一室的镜像，力量会变成该房间幸存者中最高的力量值（不会降低）。镜像受伤只会被击晕。',
      '所有镜子都碎了之后，击败背叛者即可获胜。',
    ],
    win: '最后一面镜子碎了，镜中人发出电流般的尖叫，直播间的画面一格一格地黑了下去。',
  },
  traitorSide: {
    goal: '让镜子外的人全部消失：杀死所有幸存者。',
    rules: [
      '你控制镜像，它们在你的回合之后行动。',
      '只要还有镜子没被打碎，你死亡时会从一面镜子里重生：回到起始属性，出现在那面镜子所在的房间，那面镜子随之碎裂。',
      '镜像会映出同房间里的人：每轮结束时，与幸存者同处一室的镜像，力量会变成该房间幸存者中最高的力量值（不会降低）。',
      '特殊行动「入镜」：在有镜子的房间，你可以瞬间移动到另一面镜子所在的房间（每回合一次）。',
    ],
    win: '最后一个观众也走进了镜子。直播间的在线人数停在了一个不可能的数字上。',
  },
  monsters: {
    reflection: { name: '镜像', icon: 'reflection', speed: 4, might: 3 },
  },
  *setup(g) {
    g.placeRoom('cellar-hatch'); // 保证地下室与一楼相通
    const t = g.traitor()!;
    const tiles: string[] = [];
    const mc = g.placeRoom('mirror-corridor');
    if (mc && mc !== g.p(t).tile) tiles.push(mc);
    const n = g.scale(3, 4, 4, 5);
    tiles.push(...pickTiles(g, n - tiles.length, [g.p(t).tile, ...tiles]));
    for (const k of tiles) g.token(k, 'h1-mirror', '镜子', { icon: 'mirror' });
    const m = g.scale(2, 2, 3, 3);
    for (let i = 0; i < m; i++) g.spawn('reflection', g.p(t).tile);
    g.setTrack('剩余镜子', mirrorsLeft(g));
  },
  actions: [
    {
      id: 'smash', side: 'hero', label: '砸镜子', desc: '力量 4+ 检定，成功则打碎本房间的镜子',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'h1-mirror').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '砸镜子 4+');
        if (r < 4) { g.log('镜面只裂开一道细纹，又慢慢合上了', 'bad'); return; }
        const tok = g.tokensAt(g.p(s).tile, 'h1-mirror')[0];
        g.removeToken(tok.id);
        g.setTrack('剩余镜子', mirrorsLeft(g));
        g.log(`${g.p(s).name} 一拳砸碎了镜子`, 'good');
      },
    },
    {
      id: 'enter', side: 'traitor', label: '入镜', desc: '移动到另一面镜子所在的房间',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'h1-mirror').length > 0 && g.tokens('h1-mirror').some((t) => t.tile !== g.p(s).tile),
      *run(g, s) {
        const here = g.p(s).tile;
        const opts = [...new Set(g.tokens('h1-mirror').map((t) => t.tile).filter((k) => k !== here))];
        // 把离幸存者最近的镜子放前面（AI 选最近，这里只是候选）
        const k = yield* g.chooseTile(s, '从哪面镜子里走出来？', opts);
        if (k) g.moveTo(s, k, '从镜子里走了出来');
      },
    },
  ],
  *onRoundEnd(g) {
    for (const m of g.state.monsters) {
      if (m.kind !== 'reflection') continue;
      const hs = g.heroes().filter((s) => g.p(s).tile === m.tile);
      if (!hs.length) continue;
      const top = Math.max(...hs.map((s) => g.value(s, 'might')));
      if (top > (m.traits.might ?? 0)) {
        m.traits.might = top;
        g.log(`镜像映出了对面的人，力量变成了 ${top}`, 'bad');
      }
    }
  },
  *onDeath(g, seat) {
    if (!g.isTraitor(seat)) return;
    const ms = g.tokens('h1-mirror');
    if (!ms.length) return;
    const tok = ms[g.rng.int(ms.length)];
    g.removeToken(tok.id);
    const p = g.p(seat);
    p.dead = false;
    for (const t of ['speed', 'might', 'sanity', 'knowledge'] as const) if (p.traits[t] < 1) p.traits[t] = 1;
    g.heal(seat);
    g.moveTo(seat, tok.tile, '从镜子里重新走了出来');
    g.setTrack('剩余镜子', mirrorsLeft(g));
    g.log(`${p.name} 从「${g.tileName(tok.tile)}」的镜子里重新走了出来，那面镜子碎了`, 'haunt');
  },
  checkWin(g) {
    const t = g.traitor();
    if (t != null && g.p(t).dead && mirrorsLeft(g) === 0) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const t = g.traitor()!;
      const ms = g.tokens('h1-mirror').map((x) => x.tile);
      if (ms.length) {
        const here = g.p(s).tile;
        ms.sort((a, b) => g.distance(here, a) - g.distance(here, b));
        return { goals: ms, actions: ['smash'], attack: g.value(s, 'might') >= 4 };
      }
      return { goals: [g.p(t).tile], targets: [t] };
    },
    traitor: (g) => ({ goals: g.heroes().map((s) => g.p(s).tile) }),
  },
};
