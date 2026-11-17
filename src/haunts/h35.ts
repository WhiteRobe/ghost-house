import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 35 鞋匠铺（拆迁前夜 × 绣花鞋） */

const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];

function connect(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊地板塌了个洞，底下是去地下室的石阶', 'haunt');
  }
}

function spot(g: Game, ids: string[]): string {
  for (const id of ids) {
    const k = g.placeRoom(id);
    if (k) return k;
  }
  const t = Object.keys(g.state.tiles).filter((k) => !START.includes(k));
  return t.length ? t[g.rng.int(t.length)] : 'G:0,-1';
}

const revealed = (g: Game) => g.state.haunt?.traitor != null;
const clear = (g: Game, s: number) => !!g.p(s).flags.clear;
const cursed = (g: Game): number[] => (g.hs.cursed ??= []);

function track(g: Game) {
  if (g.hv.carrier != null) g.setTrack('真符已被夺回', 1, 1);
  else g.setTrack('被查验清白的人', g.state.players.filter((p) => p.flags.clear).length, g.n - 1);
}

function dropTalisman(g: Game, tile: string) {
  g.hv.carrier = null;
  if (!g.tokens('talisman').length) g.token(tile, 'talisman', '真符', { icon: 'talisman' });
  g.log('真符掉在了地上', 'info');
}

function pickUp(g: Game, s: number) {
  if (g.isTraitor(s) || g.p(s).dead) return;
  const t = g.tokensAt(g.p(s).tile, 'talisman')[0];
  if (!t) return;
  g.removeToken(t.id);
  g.hv.carrier = s;
  g.log(`${g.p(s).name} 捡起了真符`, 'good');
  track(g);
}

export const h35: HauntDef = {
  id: 35,
  title: '鞋匠铺',
  type: 'hidden',
  traitor: { type: 'hidden' },
  intro: '绣花鞋的鞋垫底下压着一张黄符。你们脱鞋一看，每个人鞋里都有一张。墙缝里传出老鞋匠的声音：“一双鞋，一条命。真的那张，只有一个人知道。”',
  hero: {
    goal: '查鞋揪出背叛者，从他手里夺下真符，带到佛堂烧掉。',
    rules: [
      '你们中间藏着一个背叛者，真符在他鞋里。他会趁和你同处一室时，偷偷把你鞋里的符换成催命符。换符是秘密进行的，你不会知道。',
      '被换了符的人每轮结束时受到 1 点精神伤害。被换符的人数达到 2 人（3/4 人局）或 3 人（5/6 人局），背叛者获胜。幸存者全部死亡，背叛者也获胜。',
      '特殊行动「查鞋」（背叛者现身前）：选同房间一名还没被证明清白的探险者，知识检定 4+。成功：他是背叛者就当场现身，不是就公开证明他清白。',
      '背叛者现身前，谁都不能攻击别人。现身后你们可以攻击他，他也可以攻击你们。背叛者死亡也会现身。',
      '特殊行动「夺符」：和已现身的背叛者在同一房间时，你和他各掷力量，你点数更高就拿到真符，双方都不受伤害。背叛者或拿着真符的人死亡，真符掉在原地；幸存者进入这个房间或在这里开始回合时自动捡起。',
      '特殊行动「烧符」：拿着真符在佛堂（地图上有「佛前灯」标记的房间）执行，立即获胜。',
    ],
    win: '真符在佛前灯上卷成一团灰。大家鞋底一凉，催命符从鞋口滑出来，摸上去已经不烫了。',
  },
  traitorSide: {
    goal: '被揪出来之前，偷偷给足够多的人换上催命符。',
    rules: [
      '你是隐藏的背叛者，真符在你鞋里，只有你知道。在别人看来你还是幸存者。',
      '特殊行动「换符」：选同房间一名还没被换符的幸存者，理智检定 3+，成功就秘密给他换上催命符。被换符的人每轮结束时受到 1 点精神伤害。',
      '被换符的人数达到 2 人（3/4 人局）或 3 人（5/6 人局），你获胜。幸存者全部死亡你也获胜。',
      '幸存者可以对你「查鞋」（知识检定 4+），成功你就现身。你死亡也会现身。现身前谁都不能攻击别人，现身后双方可以互相攻击。',
      '现身后幸存者会来「夺符」：双方各掷力量，他们点数更高就拿走真符。真符在佛堂烧掉，你就输了。',
    ],
    win: '最后一张催命符贴着脚心烧起来。老鞋匠在墙里笑：“一双鞋，一条命，今晚的货齐了。”',
  },
  *setup(g) {
    connect(g);
    g.hv.chapel = spot(g, ['chapel', 'ancestral-hall']);
    g.token(g.hv.chapel, 'altar', '佛前灯', { icon: 'altar' });
    g.hv.carrier = null;
    g.hv.need = g.scale(2, 2, 3, 3);
    g.hs.cursed = [];
    track(g);
  },
  actions: [
    {
      id: 'inspect', side: 'hero', label: '查鞋', desc: '知识检定 4+：查同房间一名没被证明清白的人',
      can: (g, s) => !revealed(g) && g.playersAt(g.p(s).tile).some((o) => o !== s && !clear(g, o)),
      *run(g, s) {
        const list = g.playersAt(g.p(s).tile).filter((o) => o !== s && !clear(g, o));
        const t = yield* g.choosePlayer(s, '查谁的鞋？', list);
        if (t == null) return;
        const r = yield* g.check(s, 'knowledge', 4, '查鞋 4+');
        if (r < 4) {
          g.log(`${g.p(s).name} 没看出 ${g.p(t).name} 鞋里的符有什么名堂`, 'info');
          return;
        }
        if (g.isTraitor(t)) {
          g.log(`${g.p(s).name} 掀开 ${g.p(t).name} 的鞋垫，那张符是用血画的`, 'haunt');
          g.revealTraitor();
        } else {
          g.p(t).flags.clear = true;
          g.log(`${g.p(t).name} 鞋里是张普通黄纸，清白`, 'good');
        }
        track(g);
      },
    },
    {
      id: 'snatch', side: 'hero', label: '夺符', desc: '和现身的背叛者各掷力量，你点数更高就拿到真符',
      can: (g, s) => {
        const t = g.traitor();
        return revealed(g) && g.hv.carrier == null && !g.tokens('talisman').length && t != null && !g.p(t).dead && g.p(t).tile === g.p(s).tile;
      },
      *run(g, s) {
        const t = g.traitor()!;
        const a = yield* g.roll(g.value(s, 'might'), '夺符', s);
        const d = yield* g.roll(g.value(t, 'might'), '护符', t);
        if (a > d) {
          g.hv.carrier = s;
          g.log(`${g.p(s).name} 从背叛者鞋里抽出了真符（${a} 对 ${d}）`, 'good');
          track(g);
        } else g.log(`${g.p(s).name} 没能抢到真符（${a} 对 ${d}）`, 'bad');
      },
    },
    {
      id: 'burn', side: 'hero', label: '烧符', desc: '拿着真符在佛堂：立即获胜',
      can: (g, s) => g.hv.carrier === s && g.p(s).tile === g.hv.chapel,
      *run(g) {
        g.hv.burned = true;
      },
    },
    {
      id: 'swap', side: 'traitor', label: '换符', desc: '理智检定 3+：秘密给同房间一名幸存者换上催命符',
      can: (g, s) => g.heroes().some((o) => g.p(o).tile === g.p(s).tile && !cursed(g).includes(o)),
      *run(g, s) {
        const list = g.heroes().filter((o) => g.p(o).tile === g.p(s).tile && !cursed(g).includes(o));
        const t = yield* g.choosePlayer(s, '给谁换符？', list);
        if (t == null) return;
        const r = yield* g.check(s, 'sanity', 3, '换符 3+');
        if (r < 3) return;
        cursed(g).push(t);
        g.log(`你悄悄换掉了 ${g.p(t).name} 鞋里的符（${cursed(g).length}/${g.hv.need}）`, 'bad', s, 'traitor');
      },
    },
  ],
  *onTurnStart(g, s) {
    pickUp(g, s);
  },
  *onEnter(g, s) {
    pickUp(g, s);
  },
  *onDeath(g, s) {
    if (g.hv.carrier === s) dropTalisman(g, g.p(s).tile);
    if (g.isTraitor(s) && g.hv.carrier == null) dropTalisman(g, g.p(s).tile);
  },
  *onTurnEnd(g, s) {
    // 记录连续停在同一格的次数（AI 绕路用）
    const p = g.p(s);
    p.flags.same = p.flags.lastEnd === p.tile ? Number(p.flags.same ?? 0) + 1 : 0;
    p.flags.lastEnd = p.tile;
  },
  *onRoundEnd(g) {
    for (const s of cursed(g)) {
      if (g.p(s).dead) continue;
      yield* g.damage(s, 'mental', 1, '鞋里的符越来越烫');
    }
  },
  canAttack(g, seat, target) {
    if (seat === -1 || target.monster != null) return false;
    if (!revealed(g)) return false;
    const ts = target.seat!;
    if (ts === seat) return false;
    return g.isTraitor(seat) !== g.isTraitor(ts);
  },
  checkWin(g) {
    if (g.hv.burned) return { side: 'hero' };
    if (cursed(g).length >= g.hv.need) return { side: 'traitor' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      if (!revealed(g)) {
        // 只用公开信息：去找没被证明清白的人
        const sus = g.alive().filter((o) => o !== s && !clear(g, o)).map((o) => g.p(o).tile);
        return { goals: sus, actions: ['inspect'], attack: false };
      }
      const t = g.traitor()!;
      if (g.hv.carrier === s) {
        const same = Number(g.p(s).flags.same ?? 0);
        const detour = same >= 2 && same % 2 === 0 && g.p(s).tile !== g.hv.chapel;
        return { goals: detour ? [g.p(s).tile === 'G:0,0' ? 'G:0,-1' : 'G:0,0'] : [g.hv.chapel], actions: ['burn'], attack: false };
      }
      const tok = g.tokens('talisman')[0];
      if (tok) return { goals: [tok.tile] };
      if (g.hv.carrier != null) return { goals: [g.p(g.hv.carrier).tile], targets: [t] };
      return { goals: [g.p(t).tile], actions: ['snatch'], targets: [t] };
    },
    traitor: (g, s) => {
      const free = g.heroes().filter((o) => !cursed(g).includes(o));
      const goals = free.map((o) => g.p(o).tile);
      if (revealed(g) && g.hv.carrier != null) goals.unshift(g.p(g.hv.carrier).tile);
      return { goals: goals.length ? goals : [g.p(s).tile], actions: ['swap'], attack: revealed(g) };
    },
  },
};
