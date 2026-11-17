import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

const ENTRANCE = 'G:0,0';
const START = ['G:0,0', 'G:0,-1', 'G:0,-2', 'U:0,-2', 'B:0,-2'];
const BOWS = 3;

const captive = (g: Game): number | null => g.hv.captive ?? null;
const escaped = (g: Game): number[] => g.hv.escaped ?? [];
const escapeNeed = (g: Game) => Math.floor(g.heroes(true).length / 2) + 1;

function hallTile(g: Game): string {
  if (g.hv.hall && g.state.tiles[g.hv.hall]) return g.hv.hall;
  const k = g.placeRoom('main-hall') ?? g.placeRoom('ancestral-hall') ?? 'G:0,-2';
  g.hv.hall = k;
  return k;
}

function free(g: Game, text: string) {
  const c = captive(g);
  if (c == null) return;
  g.hv.captive = null;
  g.log(text, 'good');
}

/** 同格力量对抗，返回 true 表示发起者赢 */
function* contest(g: Game, a: number, d: number, label: string) {
  const x = yield* g.check(a, 'might', undefined, label);
  const y = yield* g.check(d, 'might', undefined, label + '（对抗）');
  return x > y;
}

/** 9 直播冥婚（直播 × 红盖头） */
export const h9: HauntDef = {
  id: 9,
  title: '直播冥婚',
  type: 'traitor',
  traitor: { type: 'oldest' },
  intro: '红盖头飘起来，落在年纪最大的那个人头上。掀开时，他已经换了一身新长衫，胸前别着纸扎的大红花。直播间里有人刷了一行字：“吉时已到。”门厅的大门砰地锁上了。',
  hero: {
    goal: '找到前门钥匙，打开门厅的大门，让一半以上的幸存者逃出去。',
    rules: [
      '获胜：逃出的人数超过幸存者总数（含死者）的一半。3、4 人局逃出 2 人，5、6 人局逃出 3 人。',
      '失败：背叛者拜满 3 次堂；或者死的人太多，剩下的人全逃出去也凑不够。',
      '房子里有几只「旧木匣」，其中一只装着前门钥匙。特殊行动「翻木匣」：在有木匣的房间做知识检定 4+，成功就打开它。被押住时不能用。',
      '特殊行动「开门」：持钥匙的人在门厅做力量检定 4+，成功大门打开。',
      '特殊行动「逃出」：大门开着时，在门厅执行。你离开洋楼，不再行动，不算死亡。持钥匙的人逃出，钥匙也跟着带走了。',
      '背叛者可以在门厅把门重新锁上，之后要用钥匙再开一次。',
      '持钥匙的人死亡时，钥匙掉在原地。走进那个房间会自动捡起，已经在房间里可以用「捡钥匙」。',
      '背叛者会押人去正厅拜堂。被押的人回合开始时没有移动点，背叛者走到哪就被拖到哪。',
      '特殊行动「挣脱」：被押住时做力量检定 4+，成功就挣脱，这回合还能正常移动。',
      '特殊行动「解救」：你、被押的人和背叛者在同一房间时，和背叛者掷力量对抗，你点数更高就救下他。',
      '拜堂次数不会清零，换一个人押去也接着算。被押的人死了，背叛者得另押一个。',
    ],
    win: '大门推开一道缝，夜风灌进来，满屋红烛灭了一半。身后的喜乐停在半句上。',
  },
  traitorSide: {
    goal: '押着幸存者在正厅拜满 3 次堂（看计数轨），或者杀掉足够多的幸存者，让他们逃不出一半以上。',
    rules: [
      '异变开始时你的力量 +1。正厅的位置公开。',
      '特殊行动「押人」：选同房间一名幸存者掷力量对抗，你点数更高就押住他（平局算他赢）。同一时间只能押一个人。被押的人回合开始没有移动点，你走到哪他被拖到哪。',
      '特殊行动「拜堂」：你和被押的人都在正厅时，做理智检定 3+，成功拜堂次数 +1。拜满 3 次你获胜。次数不会清零，换一个人押来接着拜。',
      '特殊行动「锁门」：大门开着时，你在门厅做理智检定 4+，成功大门重新锁上。幸存者要用钥匙再开一次。',
      '幸存者死得太多，剩下的人全逃出去也不到一半以上时，你获胜。',
      '你也可以正常攻击幸存者。',
    ],
    win: '三拜礼成。红盖头底下的人不动了，直播间的画面停在一张发黄的结婚照上。',
  },
  *setup(g) {
    g.placeRoom('cellar-hatch');
    const hall = hallTile(g);
    const t = g.traitor()!;
    yield* g.gain(t, 'might', 1);
    const n = g.scale(4, 5, 5, 6);
    const all = Object.keys(g.state.tiles).filter((k) => !START.includes(k) && k !== hall && k !== g.p(t).tile);
    g.rng.shuffle(all);
    all.sort((a, b) => Math.min(g.distance(ENTRANCE, b), 20) - Math.min(g.distance(ENTRANCE, a), 20));
    const spots = all.slice(0, n);
    while (spots.length < n) spots.push(START[1 + (spots.length % 4)]);
    g.hs.keyBox = g.rng.int(Math.ceil(spots.length / 2)); // 钥匙总在比较远的那几只木匣里
    spots.forEach((k, i) => g.token(k, 'h9-box', '旧木匣', { icon: 'box', data: { i } }));
    g.hv.bows = 0;
    g.hv.escaped = [];
    g.reveal(`正厅位于「${g.tileName(hall)}」`);
    g.setTrack('拜堂', 0, BOWS);
  },
  actions: [
    {
      id: 'open-box', side: 'hero', label: '翻木匣', desc: '知识检定 4+，撬开本房间的旧木匣',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'h9-box').length > 0 && captive(g) !== s,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 4, '撬开木匣 4+');
        if (r < 4) { g.log('铜扣锈死了，没撬开', 'bad'); return; }
        const tok = g.tokensAt(g.p(s).tile, 'h9-box')[0];
        g.removeToken(tok.id);
        if (tok.data?.i === g.hs.keyBox) {
          g.hv.key = s;
          g.log(`${g.p(s).name} 在木匣里摸到一把黄铜钥匙！`, 'good');
        } else g.log('木匣里只有几张发黄的喜帖', 'info');
      },
    },
    {
      id: 'pick-key', side: 'hero', label: '捡钥匙', desc: '捡起掉在这里的前门钥匙',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'h9-key').length > 0,
      *run(g, s) {
        for (const t of g.tokens('h9-key')) g.removeToken(t.id);
        g.hv.key = s;
        g.log(`${g.p(s).name} 捡起了前门钥匙`, 'good');
      },
    },
    {
      id: 'unlock', side: 'hero', label: '开门', desc: '在门厅用钥匙开门，力量检定 4+',
      can: (g, s) => g.hv.key === s && !g.hv.open && g.p(s).tile === ENTRANCE,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '扭开门锁 4+');
        if (r < 4) { g.log('钥匙插进去了，锁芯咯吱响，就是拧不动', 'bad'); return; }
        g.hv.open = true;
        g.reveal('门厅的大门被打开了！');
      },
    },
    {
      id: 'escape', side: 'hero', label: '逃出', desc: '从开着的大门逃出洋楼',
      can: (g, s) => !!g.hv.open && g.p(s).tile === ENTRANCE && captive(g) !== s,
      *run(g, s) {
        const p = g.p(s);
        g.hv.escaped = [...escaped(g), s];
        if (g.hv.key === s) g.hv.key = null;
        p.dead = true; // 离开洋楼，不再参与（不算死亡）
        p.cards = [];
        g.endTurn();
        g.log(`${p.name} 冲出大门，跑进了夜里`, 'good');
      },
    },
    {
      id: 'break', side: 'hero', label: '挣脱', desc: '被押住时力量检定 4+，成功就挣脱',
      can: (g, s) => captive(g) === s,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '挣脱 4+');
        if (r < 4) { g.log(`${g.p(s).name} 没挣开`, 'bad'); return; }
        free(g, `${g.p(s).name} 一把扯掉红盖头，挣脱了`);
        g.state.moveLeft = g.value(s, 'speed');
      },
    },
    {
      id: 'rescue', side: 'hero', label: '解救', desc: '与背叛者力量对抗，赢了就救下被押的人',
      can: (g, s) => { const c = captive(g); const t = g.traitor(); return c != null && c !== s && t != null && g.p(c).tile === g.p(s).tile && g.p(t).tile === g.p(s).tile; },
      *run(g, s) {
        if (yield* contest(g, s, g.traitor()!, '解救')) free(g, `${g.p(s).name} 把 ${g.p(captive(g)!).name} 抢了回来`);
        else g.log('背叛者攥着不撒手', 'bad');
      },
    },
    {
      id: 'seize', side: 'traitor', label: '押人', desc: '与同房间一名幸存者力量对抗，赢了就押住他',
      can: (g, s) => captive(g) == null && g.heroes().some((o) => g.p(o).tile === g.p(s).tile),
      *run(g, s) {
        const hs = g.heroes().filter((o) => g.p(o).tile === g.p(s).tile).sort((a, b) => g.value(a, 'might') - g.value(b, 'might'));
        const o = yield* g.choosePlayer(s, '押住谁？', hs);
        if (o == null) return;
        if (yield* contest(g, s, o, '押人')) {
          g.hv.captive = o;
          g.log(`${g.p(s).name} 把红盖头蒙在 ${g.p(o).name} 头上，押着他往正厅走`, 'bad');
        } else g.log(`${g.p(o).name} 挣开了`, 'info');
      },
    },
    {
      id: 'lock', side: 'traitor', label: '锁门', desc: '在门厅理智检定 4+，把开着的大门重新锁上',
      can: (g, s) => !!g.hv.open && g.p(s).tile === ENTRANCE,
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '锁门 4+');
        if (r < 4) return;
        g.hv.open = false;
        g.reveal('大门“砰”地自己关上了，得用钥匙重新开');
      },
    },
    {
      id: 'bow', side: 'traitor', label: '拜堂', desc: '在正厅与被押的人一起，理智检定 3+，成功拜堂 +1',
      can: (g, s) => { const c = captive(g); return c != null && g.p(s).tile === hallTile(g) && g.p(c).tile === g.p(s).tile; },
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 3, '拜堂 3+');
        if (r < 3) { g.log('喜烛灭了一根，这一拜不作数', 'good'); return; }
        g.hv.bows = (g.hv.bows ?? 0) + 1;
        g.setTrack('拜堂', g.hv.bows, BOWS);
        g.log(['一拜天地', '二拜高堂', '夫妻对拜'][Math.min(2, g.hv.bows - 1)] + '……', 'bad');
      },
    },
  ],
  *onTurnStart(g, s) {
    if (captive(g) === s) g.state.moveLeft = 0;
  },
  *onEnter(g, s) {
    const c = captive(g);
    if (c != null && g.isTraitor(s) && !g.p(c).dead) g.moveTo(c, g.p(s).tile, '被拖着走');
    if (!g.isTraitor(s) && g.tokensAt(g.p(s).tile, 'h9-key').length) {
      for (const t of g.tokens('h9-key')) g.removeToken(t.id);
      g.hv.key = s;
      g.log(`${g.p(s).name} 捡起了前门钥匙`, 'good');
    }
  },
  *onDeath(g, s) {
    if (escaped(g).includes(s)) return;
    if (captive(g) === s) free(g, '被押的人倒下了，背叛者得另找一个新人');
    if (g.hv.key === s) {
      g.hv.key = null;
      g.token(g.p(s).tile, 'h9-key', '前门钥匙', { icon: 'key' });
    }
  },
  checkWin(g) {
    if ((g.hv.bows ?? 0) >= BOWS) return { side: 'traitor' };
    const all = g.heroes(true);
    const esc = escaped(g).length;
    if (esc >= escapeNeed(g)) return { side: 'hero', seats: all };
    const dead = all.filter((s) => g.p(s).dead && !escaped(g).includes(s)).length;
    if (all.length - dead < escapeNeed(g)) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      const c = captive(g);
      const t = g.traitor()!;
      if (c === s) return { goals: [g.p(s).tile], actions: ['break'] };
      if (g.hv.open) return { goals: [ENTRANCE], actions: ['escape'] };
      if (c != null && g.distance(g.p(s).tile, g.p(c).tile) <= 3) return { goals: [g.p(c).tile], actions: ['rescue'], targets: [t] };
      if (g.hv.key === s) return { goals: [ENTRANCE], actions: ['unlock'] };
      const here = g.p(s).tile;
      const keys = g.tokens('h9-key').map((k) => k.tile);
      const boxes = g.tokens('h9-box').map((k) => k.tile).sort((a, b) => g.distance(here, a) - g.distance(here, b));
      if (keys.length) return { goals: keys, actions: ['pick-key'] };
      if (g.hv.key != null) return { goals: [g.p(g.hv.key).tile, ENTRANCE] };
      return { goals: boxes, actions: ['open-box'] };
    },
    traitor: (g, s) => {
      const c = captive(g);
      if (c != null) return { goals: [hallTile(g)], actions: ['bow'], attack: false };
      // 优先盯住拿钥匙的人
      const k = g.hv.key;
      if (g.hv.open) return { goals: [ENTRANCE], actions: ['lock', 'seize'], attack: false };
      const goals = k != null && !g.p(k).dead ? [g.p(k).tile] : g.heroes().map((o) => g.p(o).tile);
      return { goals, actions: ['seize', 'lock'], attack: false };
    },
  },
};
