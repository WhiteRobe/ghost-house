import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const START = 'G:0,0';
const HALL = 'G:0,-1';
const starts = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

/** 地下室和楼上没连通时，开一道暗梯，免得有人被困死 */
function bridge(g: Game) {
  for (const p of g.state.players) {
    if (p.dead || g.distance(START, p.tile) < Infinity) continue;
    const to = g.distance('B:0,-2', p.tile) < Infinity ? 'B:0,-2' : p.tile;
    if (g.distance(START, to) === Infinity) {
      g.link(HALL, to);
      g.log('走廊的地板裂开，露出一道通往下面的暗梯', 'info');
    }
  }
}

function reachable(g: Game, k: string): string {
  if (g.distance(START, k) === Infinity) g.link(HALL, k);
  return k;
}

const captive = (g: Game): number => g.hv.captive as number;
const room = (g: Game): string => g.hv.room as string;
const bound = (g: Game) => !!g.hv.bound;

function deadline(g: Game) {
  return g.scale(7, 7, 6, 6);
}

function track(g: Game) {
  const left = Math.max(0, deadline(g) - ((g.state.haunt?.round ?? 1) - 1));
  g.setTrack('距吉时还有（轮）', left, deadline(g));
}

function lateHour(g: Game) {
  return (g.state.haunt?.round ?? 1) - 1 >= deadline(g);
}

/** 18 抢亲 */
export const h18: HauntDef = {
  id: 18,
  title: '抢亲',
  type: 'traitor',
  traitor: { type: 'revealer' },
  intro: '遗嘱最后一页有一行小字：“家产随新娘陪嫁。”刚念完，唢呐声就从楼上冲下来，一条红绸子缠住你们中的一个人，把他拖走了。揭示者站着没动，胸前多了一朵大红花。',
  hero: {
    goal: '解开红绸子，把被抢走的人带回门厅。',
    rules: [
      '被抢走的人（背叛者挑的）绑在「洞房」标记所在的房间。洞房优先设在主卧，主卧放不进地图时改用正厅，再不行就用离门厅最远的房间。',
      '被绑着的人轮到自己时什么也做不了，回合直接结束。',
      '洞房里守着喜娘（怪物）：3 人局 1 个，4 人局 2 个，5/6 人局 3 个。喜娘被打败只会被击晕。',
      '特殊行动「解绑」（每回合一次）：和被绑的人在同一房间时，用力量、知识中较高的一项检定。房间里没有清醒的喜娘时 4+，有时 5+。成功解开 1 个死结。',
      '红绸子上的死结：3/4 人局 1 个，5 人局 2 个，6 人局 3 个。全部解开，他就自由了。',
      '获胜：被救出的人和至少 1 名其他幸存者同时在门厅。其他幸存者都死了的话，他一个人走到门厅也算。',
      '计数轨显示离吉时还剩几轮（3/4 人局 7 轮，5/6 人局 6 轮）。归零时他还被绑着，你们失败；吉时过后他再被绑上，你们也立即失败。',
      '背叛者和喜娘不能攻击被抢走的人。但背叛者和他在同一房间时可以比力量，赢了就把他绑回洞房，死结重新打满。',
      '被抢走的人死亡，你们失败。',
    ],
    win: '你们拽着他冲进门厅，身后的唢呐“呜”地一声断了。他手腕上还拖着半截红绸子。',
  },
  traitorSide: {
    goal: '把新人留到吉时：计数归零时他还被绑着，你获胜。',
    rules: [
      '你控制喜娘。每轮在你的回合之后，喜娘行动一次。喜娘被打败只会被击晕。',
      '你和喜娘都不能攻击被抢走的人，你们要活的。',
      '特殊行动「再绑」（每回合一次）：和已被救出的人在同一房间时，双方各掷力量骰（不造成伤害）。你点数高就把他绑回洞房，死结重新打满；平局算他挣脱。',
      '获胜：计数归零时他还被绑着；吉时过后你又把他绑上；或者他死亡。',
      '失败：被救出的人和另一名幸存者同时在门厅（其他幸存者都死了时，他一个人到门厅也算）。',
    ],
    win: '吉时到了。洞房里的红烛一根接一根自己点着，新人坐在床沿上，盖头底下听不见喘气声。',
  },
  monsters: {
    matron: { name: '喜娘', icon: 'matron', speed: 3, might: 4 },
  },
  *setup(g) {
    bridge(g);
    const t = g.traitor()!;
    const heroes = g.heroes();
    // 抢走离门厅最远、最难救的人
    const sorted = [...heroes].sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
    const c = (yield* g.choosePlayer(t, '你要抢走谁？', sorted)) ?? sorted[0];
    g.hv.captive = c;
    let k = g.findTile('master-bedroom') ?? g.placeRoom('master-bedroom') ?? g.findTile('main-hall');
    if (!k) {
      const tiles = Object.keys(g.state.tiles).filter((x) => !starts.includes(x) && g.distance(START, x) < Infinity);
      tiles.sort((a, b) => g.distance(START, b) - g.distance(START, a));
      k = tiles[0] ?? 'U:0,-2';
    }
    g.hv.room = reachable(g, k);
    g.token(k, 'bridal', '洞房', { icon: 'bridal' });
    g.hv.bound = true;
    g.hv.knots = g.scale(1, 1, 2, 3);
    g.moveTo(c, k, '被红绸子卷走了');
    g.log(`${g.p(c).name} 被红绸子绑在了「${g.tileName(k)}」`, 'haunt');
    for (let i = 0; i < g.scale(1, 2, 3, 3); i++) g.spawn('matron', k);
    track(g);
  },
  actions: [
    {
      id: 'untie', side: 'hero', label: '解绑', desc: '和被绑的人同一房间：力量或知识检定（取高者），没有清醒喜娘 4+，有则 5+。成功解开 1 个死结',
      can: (g, s) => bound(g) && s !== captive(g) && g.p(s).tile === g.p(captive(g)).tile,
      *run(g, s) {
        const need = g.monstersAt(g.p(s).tile).some((m) => !m.stunned) ? 5 : 4;
        const trait = g.value(s, 'might') >= g.value(s, 'knowledge') ? 'might' : 'knowledge';
        const r = yield* g.check(s, trait, need, `解绑 ${need}+`);
        if (r < need) {
          g.log('红绸子越扯越紧', 'info');
          return;
        }
        g.hv.knots = (g.hv.knots as number) - 1;
        if ((g.hv.knots as number) > 0) {
          g.log(`${g.p(s).name} 解开了一个死结，还剩 ${g.hv.knots} 个`, 'good');
          return;
        }
        g.hv.bound = false;
        g.log(`${g.p(s).name} 扯断了红绸子，${g.p(captive(g)).name} 自由了！`, 'good');
      },
    },
    {
      id: 'rebind', side: 'traitor', label: '再绑', desc: '和被救出的人同一房间：双方掷力量骰，你点数高就把他绑回洞房',
      can: (g, s) => !bound(g) && !g.p(captive(g)).dead && g.p(captive(g)).tile === g.p(s).tile,
      *run(g, s) {
        const c = captive(g);
        const mine = yield* g.roll(g.value(s, 'might') + g.bonus(s, 'might', 'attack'), '再绑', s);
        const his = yield* g.roll(g.value(c, 'might') + g.bonus(c, 'might', 'defend'), '挣扎', c);
        g.log(`${g.p(s).name} 扑向 ${g.p(c).name}：${mine} 对 ${his}`, 'info');
        if (mine > his) {
          g.hv.bound = true;
          g.hv.knots = g.scale(1, 1, 2, 3);
          g.moveTo(c, room(g), '被唢呐声卷了回去');
          g.log(`红绸子又缠上了 ${g.p(c).name}，把他拖回了洞房`, 'bad');
        }
      },
    },
  ],
  *onTurnStart(g, s) {
    if (captive(g) != null && s === captive(g) && bound(g)) {
      g.log(`${g.p(s).name} 被绑着，动弹不得`, 'info');
      g.endTurn();
    }
  },
  *onRoundEnd(g) {
    bridge(g);
    track(g);
    if (lateHour(g)) g.log('吉时已到！', 'haunt');
  },
  canAttack(g, s, t) {
    // 他们要的是活的新人：背叛者和喜娘都不能攻击被抢的人
    if (t.seat != null && t.seat === captive(g) && (s === -1 || g.isTraitor(s))) return false;
    if (s === -1) return true;
    if (t.monster != null) return !g.isTraitor(s);
    if (t.seat == null || t.seat === s) return false;
    return g.isTraitor(s) !== g.isTraitor(t.seat);
  },
  checkWin(g) {
    const c = captive(g);
    if (c == null) return null;
    if (g.p(c).dead) return { side: 'traitor' };
    if (bound(g) && lateHour(g)) return { side: 'traitor' };
    if (!bound(g) && g.p(c).tile === START) {
      const others = g.heroes().filter((h) => h !== c);
      if (!others.length || others.some((h) => g.p(h).tile === START)) return { side: 'hero' };
    }
    return null;
  },
  ai: {
    hero: (g, s) => {
      const c = captive(g);
      if (bound(g)) return { goals: [g.p(c).tile], actions: ['untie'] };
      if (s === c) return { goals: [START], attack: false };
      // 护送：和他一起走向门厅
      const t = g.traitor();
      const near = g.distance(g.p(s).tile, g.p(c).tile);
      if (near > 1) return { goals: [g.p(c).tile], targets: t != null ? [t] : undefined };
      return { goals: [START] };
    },
    traitor: (g) => {
      const c = captive(g);
      if (bound(g)) {
        // 拦在洞房门口，打来救人的
        const heroes = g.heroes().filter((h) => h !== c).map((h) => g.p(h).tile);
        const near = heroes.filter((k) => g.distance(k, room(g)) <= 2);
        return { goals: near.length ? near : [room(g)] };
      }
      return { goals: [g.p(c).tile], actions: ['rebind'] };
    },
    monster: (g) => {
      const c = captive(g);
      if (!bound(g)) return { goals: [g.p(c).tile] };
      const heroes = g.heroes().filter((h) => h !== c).map((h) => g.p(h).tile);
      const near = heroes.filter((k) => g.distance(k, room(g)) <= 1);
      return { goals: near.length ? near : [room(g)] };
    },
  },
};
