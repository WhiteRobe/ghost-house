import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const dawn = (g: Game) => g.scale(6, 6, 7, 7);

/** 是否持有能克制僵尸的东西：桃木剑、名字带「符」的物品，或捡到的符纸 */
function armed(g: Game, s: number): boolean {
  const p = g.p(s);
  if (Number(p.flags.h7fu ?? 0) > 0) return true;
  return p.cards.some((c) => c === 'sword' || g.card(c)?.name.includes('符') || g.card(c)?.name.includes('桃木'));
}

function guarded(g: Game): boolean {
  const t = g.traitor();
  return t != null && g.monstersAt(g.p(t).tile, 'zombie').some((m) => !m.stunned);
}

/** 离所有僵尸最远的一组格子（AI 躲避用） */
function safest(g: Game, from: string): string[] {
  const zs = g.state.monsters.filter((m) => m.kind === 'zombie' && !m.stunned).map((m) => m.tile);
  if (!zs.length) return [from];
  const tiles = Object.keys(g.state.tiles).filter((k) => g.distance(from, k) <= 4);
  let best = -1;
  let out: string[] = [];
  for (const k of tiles) {
    const d = Math.min(...zs.map((z) => Math.min(g.distance(z, k), 9)));
    if (d > best) { best = d; out = [k]; } else if (d === best) out.push(k);
  }
  return out;
}

/** 7 尸王夜宴（直播 × 桃木剑） */
export const h7: HauntDef = {
  id: 7,
  title: '尸王夜宴',
  type: 'traitor',
  traitor: { type: 'lowest', trait: 'might' },
  intro: '桃木剑从鞘里滑出来，剑尖戳着地板。餐厅里摆开了酒席，一桌青面獠牙的客人齐刷刷站起来，朝主位上的背叛者作揖：“恭迎尸王。”',
  hero: {
    goal: '撑到天亮：第 6 轮结束时（5、6 人局第 7 轮）还有幸存者活着；或者杀死尸王。',
    rules: [
      '计数轨显示离天亮还剩几轮。到点时只要还有 1 名幸存者活着，你们就赢了。',
      '僵尸打不死：你身上有桃木剑、名字带「符」或「桃木」的物品，或者有符纸时，在战斗中赢过僵尸就能把它击晕；否则打赢了它也毫发无伤。',
      '房子里散落着「符纸」标记（3、4 人局 4 张，5、6 人局 5 张）。幸存者进入有符纸的房间会自动捡起。每击晕 1 个僵尸用掉 1 张符纸；桃木剑和符类物品不会用掉。',
      '僵尸护驾：尸王所在的房间有没被击晕的僵尸时，你们不能攻击尸王。没有护驾时可以正常攻击他，杀死尸王你们立即获胜。',
      '每 2 轮结束时，餐厅（没有餐厅就在尸王身边）会多出 1 个僵尸，场上最多 5 个（4 人局 6 个，5 人局 7 个，6 人局 8 个）。',
    ],
    win: '鸡叫了。满桌客人僵在原地，一个个塌成了纸灰和泥。',
  },
  traitorSide: {
    goal: '天亮前杀死所有幸存者。',
    rules: [
      '你控制僵尸（速度 3，力量 4），它们在你的回合之后行动。幸存者只有带着桃木剑、名字带「符」或「桃木」的物品或符纸，才能在战斗中把僵尸击晕。',
      '异变开始时，你的力量、速度各提升 1 格。',
      '僵尸护驾：你所在的房间有没被击晕的僵尸时，幸存者不能攻击你。没有护驾时你可以被正常攻击；你一死，幸存者立即获胜。',
      '每 2 轮结束时，餐厅（没有餐厅就在你身边）会多出 1 个僵尸，场上最多 5 个（4 人局 6 个，5 人局 7 个，6 人局 8 个）。',
      `特殊行动「号令」：你所在房间有没被击晕的僵尸时，让它直接跳到 2 格以内一名幸存者所在的房间。`,
      '第 6 轮结束时（5、6 人局第 7 轮）还有幸存者活着，你就输了。',
    ],
    win: '天还没亮，席上又添了几位新客，脸色还没变青。',
  },
  monsters: {
    zombie: { name: '僵尸', icon: 'zombie', speed: 3, might: 4, stun: false },
  },
  *setup(g) {
    g.placeRoom('cellar-hatch');
    const t = g.traitor()!;
    yield* g.gain(t, 'might', 1);
    yield* g.gain(t, 'speed', 1);
    const hall = g.placeRoom('dining') ?? g.p(t).tile;
    g.hv.hall = hall;
    const n = g.scale(2, 2, 3, 3);
    for (let i = 0; i < n; i++) g.spawn('zombie', i % 2 ? g.p(t).tile : hall);
    const tiles = Object.keys(g.state.tiles).filter((k) => k !== hall && k !== g.p(t).tile);
    g.rng.shuffle(tiles);
    for (const k of tiles.slice(0, g.scale(4, 4, 5, 5))) g.token(k, 'h7-fu', '符纸', { icon: 'talisman' });
    g.setTrack('距离天亮', dawn(g), dawn(g));
  },
  actions: [
    {
      id: 'command', side: 'traitor', label: '号令', desc: '本房间的 1 个僵尸跳到 2 格以内一名幸存者所在的房间',
      can: (g, s) => g.monstersAt(g.p(s).tile, 'zombie').some((m) => !m.stunned) && g.heroes().some((o) => g.distance(g.p(s).tile, g.p(o).tile) <= 2 && g.p(o).tile !== g.p(s).tile),
      *run(g, s) {
        const here = g.p(s).tile;
        const hs = g.heroes().filter((o) => g.distance(here, g.p(o).tile) <= 2 && g.p(o).tile !== here);
        const o = yield* g.choosePlayer(s, '让僵尸扑向谁？', hs);
        const z = g.monstersAt(here, 'zombie').find((m) => !m.stunned);
        if (o == null || !z) return;
        g.moveMonster(z.id, g.p(o).tile);
        g.log(`尸王一抬手，僵尸蹦到了 ${g.p(o).name} 面前`, 'bad');
      },
    },
  ],
  *onEnter(g, s) {
    if (g.isTraitor(s)) return;
    const toks = g.tokensAt(g.p(s).tile, 'h7-fu');
    if (!toks.length) return;
    for (const t of toks) g.removeToken(t.id);
    const p = g.p(s);
    p.flags.h7fu = Number(p.flags.h7fu ?? 0) + toks.length;
    g.log(`${p.name} 捡到了 ${toks.length} 张符纸`, 'good');
  },
  *onMonsterHurt(g, id, _dmg, by) {
    const m = g.monster(id);
    if (!m || m.kind !== 'zombie') return false;
    if (by != null && armed(g, by)) {
      const p = g.p(by);
      const real = p.cards.some((c) => c === 'sword' || g.card(c)?.name.includes('符') || g.card(c)?.name.includes('桃木'));
      if (!real) {
        p.flags.h7fu = Number(p.flags.h7fu ?? 1) - 1;
        g.log(`${p.name} 拍出一张符纸，符纸烧成了灰，僵尸定住了`, 'info');
      }
      g.stun(id);
    } else {
      g.log('僵尸挨了一下，晃都没晃', 'bad');
    }
    return true;
  },
  *onRoundEnd(g) {
    const done = g.state.haunt!.round - 1;
    g.setTrack('距离天亮', Math.max(0, dawn(g) - done), dawn(g));
    if (done % 2 === 0 && g.state.monsters.length < g.scale(5, 6, 7, 8)) {
      const t = g.traitor();
      const k = g.hv.hall && g.state.tiles[g.hv.hall] ? g.hv.hall : t != null ? g.p(t).tile : 'G:0,0';
      g.spawn('zombie', k);
      g.log('酒席上又站起来一位客人', 'bad');
    }
    if (done >= dawn(g)) g.hv.dawn = true;
  },
  checkWin(g) {
    const t = g.traitor();
    if (t != null && g.p(t).dead) return { side: 'hero', text: '尸王一倒，满屋僵尸跟着扑在地上，再没起来。' };
    if (g.hv.dawn && g.heroes().length > 0) return { side: 'hero' };
    return null;
  },
  canAttack(g, s, target) {
    if (s < 0) return true;
    if (target.monster != null) return !g.isTraitor(s);
    if (target.seat == null || target.seat === s) return false;
    if (g.sideOf(s) === g.sideOf(target.seat)) return false;
    // 僵尸护驾：尸王身边有清醒的僵尸时不能被攻击
    if (g.isTraitor(target.seat) && guarded(g)) return false;
    return true;
  },
  ai: {
    hero: (g, s) => {
      const t = g.traitor()!;
      const here = g.p(s).tile;
      const zHere = g.monstersAt(here, 'zombie').filter((m) => !m.stunned);
      const fu = g.tokens('h7-fu').map((k) => k.tile).filter((k) => g.distance(here, k) <= 3);
      const strong = g.value(s, 'might') > g.value(t, 'might') + 1 && !guarded(g);
      if (strong && g.distance(here, g.p(t).tile) <= 4) return { goals: [g.p(t).tile], targets: [t, ...(armed(g, s) ? zHere.map((m) => `m${m.id}` as const) : [])] };
      if (armed(g, s)) return { goals: fu.length ? fu : safest(g, here), targets: [t, ...zHere.map((m) => `m${m.id}` as const)] };
      if (fu.length && !zHere.length) return { goals: fu, targets: [t] };
      return { goals: safest(g, here), targets: [t] };
    },
    traitor: (g, s) => {
      const here = g.p(s).tile;
      const zs = g.state.monsters.filter((m) => m.kind === 'zombie').map((m) => m.tile);
      // 尸王很弱：待在僵尸身边，只在占优时出手
      const weak = g.heroes().filter((o) => g.value(o, 'might') <= g.value(s, 'might')).map((o) => g.p(o).tile);
      const exposed = !guarded(g) && g.heroes().some((o) => g.distance(here, g.p(o).tile) <= 2 && g.value(o, 'might') > g.value(s, 'might'));
      return { goals: exposed && zs.length ? zs : weak.length ? weak : zs.length ? zs : [here], actions: ['command'], attack: true, targets: g.heroes().filter((o) => g.value(o, 'might') <= g.value(s, 'might') + 1) };
    },
  },
};
