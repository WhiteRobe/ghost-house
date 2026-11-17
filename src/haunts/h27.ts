import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';
import type { Token } from '../shared/types';

/** 27 盖头下的人（失踪的朋友 × 红盖头） */

const ENTRANCE = 'G:0,0';

function landing(k: string) {
  return k[0] === 'B' ? 'B:0,-2' : k[0] === 'U' ? 'U:0,-2' : 'G:0,-1';
}

function reachable(g: Game, k: string) {
  if (g.distance(ENTRANCE, k) < Infinity) return;
  if (k[0] === 'B') g.placeRoom('cellar-hatch');
  if (g.distance(ENTRANCE, k) < Infinity) return;
  const l = landing(k);
  if (g.distance(ENTRANCE, l) === Infinity) g.link('G:0,-1', l);
  if (g.distance(ENTRANCE, k) === Infinity) g.link(l, k);
}

const bride = (g: Game): Token | undefined => g.tokens('bride')[0];
const brideTile = (g: Game) => bride(g)?.tile ?? ENTRANCE;
const escort = (g: Game) => (g.hv.escort as number | null) ?? null;

function moveBride(g: Game, k: string) {
  const b = bride(g);
  if (b) b.tile = k;
}

function track(g: Game) {
  g.setTrack(g.hv.freed ? '新娘已被掀开盖头' : `拜堂（盖头还剩 ${g.hv.layers ?? 0} 层）`, g.hv.bows ?? 0, 3);
}

export const h27: HauntDef = {
  id: 27,
  title: '盖头下的人',
  type: 'traitor',
  traitor: { type: 'oldest' },
  intro: '一个蒙着红盖头的人影从楼梯上慢慢走下来，绣鞋踩在台阶上没有声音。盖头底下露出一截手腕，戴着你们朋友的那块电子表。年纪最大的那位同伴走上前，搀住了“新娘”的胳膊，嘴里念着谁也听不懂的吉祥话。',
  hero: {
    goal: '掀开朋友头上的红盖头，然后护送她回到门厅。',
    rules: [
      '「新娘」（标记）和背叛者一起出现在正厅（正厅若尚未被发现会先出现），背叛者押着她，她跟着背叛者移动。',
      '新娘头上蒙着好几层盖头（3 人局 1 层，4 人局 2 层，5/6 人局 3 层）。特殊行动「掀盖头」：与新娘同格时，用知识或理智（取较高者）进行 5+ 检定（押着她的背叛者也在场时为 6+），成功揭下一层，失败受到 1 点精神伤害。揭下最后一层时，新娘改由你护送。',
      '护送新娘的人移动时，新娘跟着他走；她裹着小脚走不快，护送者每回合最多移动 2 格。护送者死亡时新娘留在原地，同格的幸存者可以用特殊行动「护送」接过她。',
      '新娘被护送到门厅时，你们获胜。',
      '背叛者被鬼新郎护着：他倒下后会在离正厅最远的房间重新站起来（属性恢复到起始值），但押着的新娘会留在原地，仍蒙着盖头。',
      '「喜娘」被击败时只会被击晕。',
    ],
    win: '盖头落地，底下是一张哭花了妆的熟悉的脸。你们拉着她冲出门厅，身后那支唢呐吹到一半，哑了。',
  },
  traitorSide: {
    goal: '把新娘押到正厅拜完三拜（三次成功的「拜堂」）。',
    rules: [
      '异变开始时你押着新娘站在正厅（若尚未被发现会先出现）。你押着新娘时，她跟着你移动。',
      '特殊行动「拜堂」（每回合一次）：押着新娘在正厅时进行理智 4+ 检定，成功则完成一拜。拜满三拜你就获胜。',
      '特殊行动「抢亲」（代替本回合的攻击）：攻击同格护送新娘的幸存者；若你获胜，除了正常造成伤害，还会重新给新娘盖上一层盖头，改由你押着。',
      '特殊行动「盖盖头」：盖头已被掀开、新娘无人护送且与你同格时，进行理智 3+ 检定，成功则给她盖上一层盖头并改由你押着。',
      '你控制「喜娘」，它们在你的回合之后行动，被击败时只会被击晕。',
      '你不会真正死去：倒下后会在离正厅最远的房间重新站起来，属性恢复到起始值，但押着的新娘会留在原地。',
      '特殊行动「押走」：新娘仍蒙着盖头、无人押送且与你同格时，直接重新押走她。',
    ],
    win: '三拜礼成。盖头下的人轻轻笑了一声，挽着新郎的手走进了墙上那幅褪色的结婚照里。',
  },
  monsters: {
    matron: { name: '喜娘', icon: 'matron', speed: 3, might: 4 },
  },
  *setup(g) {
    const t = g.traitor()!;
    let hall = g.placeRoom('main-hall');
    if (!hall) hall = 'G:0,-2';
    reachable(g, hall);
    g.hv.hall = hall;
    g.hv.bows = 0;
    g.hv.freed = false;
    g.hv.layers = g.scale(1, 2, 3, 3);
    g.hv.escort = t;
    g.moveTo(t, hall, '被唢呐声引进了正厅');
    const far = hall;
    g.token(far, 'bride', '新娘', { icon: 'bride' });
    const n = g.scale(1, 1, 2, 2);
    for (let i = 0; i < n; i++) g.spawn('matron', g.p(t).tile);
    track(g);
  },
  actions: [
    {
      id: 'unveil', side: 'hero', label: '掀盖头', desc: '知识或理智（取较高者）5+ 检定（背叛者在场 6+），成功则掀开盖头并护送新娘',
      can: (g, s) => !g.hv.freed && brideTile(g) === g.p(s).tile,
      *run(g, s) {
        const trait = g.value(s, 'knowledge') >= g.value(s, 'sanity') ? 'knowledge' : 'sanity';
        const need = g.p(escort(g) ?? s).tile === g.p(s).tile && escort(g) !== s ? 6 : 5;
        const r = yield* g.check(s, trait, need, `掀盖头 ${need}+`);
        if (r < need) {
          g.log('盖头像长在了她头上，怎么也掀不动', 'info');
          yield* g.damage(s, 'mental', 1, '盖头底下有人在笑');
          return;
        }
        g.hv.layers = (g.hv.layers ?? 1) - 1;
        if (g.hv.layers > 0) {
          g.log(`${g.p(s).name} 揭下一层盖头——底下还有一层！（还剩 ${g.hv.layers} 层）`, 'good');
          track(g);
          return;
        }
        g.hv.freed = true;
        g.hv.escort = s;
        track(g);
        g.log(`${g.p(s).name} 一把掀开了红盖头！`, 'good');
      },
    },
    {
      id: 'take', side: 'hero', label: '护送', desc: '新娘无人护送时，接过她',
      can: (g, s) => {
        const e = escort(g);
        return !!g.hv.freed && brideTile(g) === g.p(s).tile && (e == null || g.p(e).dead) && e !== s;
      },
      *run(g, s) {
        g.hv.escort = s;
        g.log(`${g.p(s).name} 扶起了新娘`, 'good');
      },
    },
    {
      id: 'bow', side: 'traitor', label: '拜堂', desc: '押着新娘在正厅：理智 4+ 检定，成功完成一拜',
      can: (g, s) => escort(g) === s && !g.hv.freed && g.p(s).tile === g.hv.hall && brideTile(g) === g.hv.hall,
      *run(g, s) {
        g.reveal('背叛者押着新娘在正厅「拜堂」，拜满三拜他就获胜。');
        const r = yield* g.check(s, 'sanity', 4, '拜堂 4+');
        if (r < 4) {
          g.log('香头“啪”地断了，这一拜不算', 'info');
          return;
        }
        g.hv.bows = (g.hv.bows ?? 0) + 1;
        track(g);
        g.log(['一拜天地……', '二拜高堂……', '夫妻对拜……'][Math.min(2, g.hv.bows - 1)], 'bad');
      },
    },
    {
      id: 'snatch', side: 'traitor', label: '抢亲', desc: '攻击护送新娘的幸存者，获胜则夺回新娘',
      can: (g, s) => {
        const e = escort(g);
        return !g.attacked && !!g.hv.freed && e != null && !g.p(e).dead && g.p(e).tile === g.p(s).tile;
      },
      *run(g, s) {
        const e = escort(g)!;
        g.attacked = true;
        g.reveal('背叛者「抢亲」得手时，会重新给新娘盖上盖头。');
        const r = yield* g.attack({ seat: s }, { seat: e });
        if (!r.winner || !('seat' in r.winner) || r.winner.seat !== s) return;
        g.hv.freed = false;
        g.hv.layers = 1;
        g.hv.escort = s;
        moveBride(g, g.p(s).tile);
        track(g);
        g.log('红盖头又落回了新娘头上', 'bad');
      },
    },
    {
      id: 'retake', side: 'traitor', label: '押走', desc: '新娘仍蒙着盖头且无人押送：重新押走她',
      can: (g, s) => {
        const e = escort(g);
        return !g.hv.freed && (e == null || g.p(e).dead) && brideTile(g) === g.p(s).tile;
      },
      *run(g, s) {
        g.hv.escort = s;
        g.log('背叛者又搀住了新娘的胳膊', 'bad');
      },
    },
    {
      id: 'reveil', side: 'traitor', label: '盖盖头', desc: '新娘无人护送且与你同格：理智 3+ 检定，成功则重新押走她',
      can: (g, s) => {
        const e = escort(g);
        return !!g.hv.freed && (e == null || g.p(e).dead) && brideTile(g) === g.p(s).tile;
      },
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 3, '盖盖头 3+');
        if (r < 3) return;
        g.hv.freed = false;
        g.hv.layers = 1;
        g.hv.escort = s;
        track(g);
        g.log('红盖头又落回了新娘头上', 'bad');
      },
    },
  ],
  *onTurnStart(g, s) {
    if (escort(g) === s && g.hv.freed) g.state.moveLeft = Math.min(g.state.moveLeft, 2);
  },
  *onEnter(g, s) {
    if (escort(g) === s) moveBride(g, g.p(s).tile);
  },
  *onTurnEnd(g, s) {
    if (escort(g) === s) moveBride(g, g.p(s).tile);
  },
  *onDeath(g, s) {
    if (escort(g) === s) {
      g.hv.escort = null;
      g.log('新娘呆呆地站在原地', 'info');
    }
    if (g.isTraitor(s)) {
      // 鬼新郎不让他死：在离正厅最远的房间重新站起来
      const p = g.p(s);
      p.dead = false;
      g.heal(s);
      let far = g.hv.hall as string;
      let best = -1;
      for (const k of Object.keys(g.state.tiles)) {
        const d = g.distance(g.hv.hall, k);
        if (d < Infinity && d > best) { best = d; far = k; }
      }
      g.moveTo(s, far, `在${g.tileName(far)}重新站了起来`);
      g.reveal('背叛者被鬼新郎护着，倒下后会在离正厅最远的房间重新站起来（属性恢复到起始值），新娘则留在原地。');
    }
  },
  *onRoundEnd(g) {
    for (const s of g.alive()) reachable(g, g.p(s).tile);
  },
  checkWin(g) {
    if ((g.hv.bows ?? 0) >= 3) return { side: 'traitor' };
    if (g.hv.freed && brideTile(g) === ENTRANCE && escort(g) != null) return { side: 'hero' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const t = g.traitor();
      const e = escort(g);
      if (!g.hv.freed) return { goals: [brideTile(g)], actions: ['unveil'], targets: t != null ? [t] : undefined };
      if (e === s) return { goals: [ENTRANCE], attack: false };
      return { goals: [brideTile(g)], actions: ['take'], targets: t != null ? [t] : undefined };
    },
    traitor: (g, s) => {
      if (escort(g) === s && !g.hv.freed) return { goals: [g.hv.hall], actions: ['bow'] };
      return { goals: [brideTile(g)], actions: ['retake', 'snatch', 'reveil'] };
    },
    monster: (g) => {
      const e = escort(g);
      if (g.hv.freed && e != null && !g.p(e).dead) return { goals: [g.p(e).tile] };
      const hs = g.heroes();
      return { goals: hs.length ? hs.map((h) => g.p(h).tile) : [brideTile(g)] };
    },
  },
};
