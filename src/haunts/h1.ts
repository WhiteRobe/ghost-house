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
  intro: '直播画面卡了一下。镜头里的揭示者还在冲弹幕笑，镜头外那个人却一直没眨眼。真正的他被关进了镜子，走出来的是镜子里那个。洋楼里每一面镜子的角上都亮起了直播的小红点。',
  hero: {
    goal: '打碎所有镜子，再杀死背叛者。',
    rules: [
      '获胜条件：所有镜子都碎了，并且背叛者死亡。',
      '房子里放着若干面「镜子」标记，剩余数量见计数轨。',
      '特殊行动「砸镜子」：在有镜子的房间，力量检定 4+，成功就打碎这面镜子。每回合一次。',
      '还有镜子时，背叛者死了会复活：随机碎掉一面镜子，他从那面镜子的房间走出来，低于起始值的属性恢复到起始值。所以杀死他也能消耗镜子。',
      '每轮结束时，和幸存者同在一个房间的镜像，力量变成该房间幸存者中最高的力量值（只升不降）。',
      '镜像受到伤害只会被击晕，杀不死。',
    ],
    win: '最后一面镜子碎了。镜子里那个人尖叫起来，像麦克风啸叫，直播画面一格一格黑了下去。',
  },
  traitorSide: {
    goal: '杀死所有幸存者。',
    rules: [
      '你控制镜像，它们在你的回合之后行动。镜像受到伤害只会被击晕。',
      '还有镜子时，你死了会复活：随机碎掉一面镜子，你从那面镜子的房间走出来，低于起始值的属性恢复到起始值。镜子全碎后再死就输了。',
      '每轮结束时，和幸存者同在一个房间的镜像，力量变成该房间幸存者中最高的力量值（只升不降）。',
      '特殊行动「入镜」：在有镜子的房间，移动到另一面镜子所在的房间。每回合一次。',
    ],
    win: '最后一个人也走进了镜子。直播间的在线人数跳到 0，过了一秒又变成 1。',
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
      id: 'smash', side: 'hero', label: '砸镜子', desc: '力量检定 4+：打碎这个房间的镜子',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'h1-mirror').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '砸镜子 4+');
        if (r < 4) { g.log('镜面裂了一道缝，又自己合上了', 'bad'); return; }
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
        g.log(`镜像照着对面的人学了一遍，力量变成 ${top}`, 'bad');
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
