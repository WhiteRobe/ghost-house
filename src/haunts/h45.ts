import type { HauntDef } from '../engine/defs';
import type { Game } from '../engine/game';

/** 45 百年婚约（百年诅咒 × 红盖头） */

const BOWS = 3;
const TEARS = 3;
const START = ['entrance', 'hallway', 'stairs', 'upper-landing', 'basement-landing'];

function ensureBasement(g: Game) {
  if (g.distance('G:0,0', 'B:0,-2') < Infinity) return;
  g.placeRoom('cellar-hatch');
  if (g.distance('G:0,0', 'B:0,-2') === Infinity) {
    g.link('G:0,-1', 'B:0,-2');
    g.log('走廊尽头的地板塌了个洞，底下是去地下室的石阶', 'info');
  }
}

const hall = (g: Game): string => g.hv.hall ?? 'G:0,0';
const bride = (g: Game): number | null => (g.hv.bride ?? null) as number | null;
const contract = (g: Game): number | null => (g.hv.contract ?? null) as number | null;

function pickBride(g: Game) {
  const hs = g.heroes();
  if (!hs.length) {
    g.hv.bride = null;
    return;
  }
  const b = hs[g.rng.int(hs.length)];
  g.hv.bride = b;
  g.log(`一块红盖头飘下来，正好盖在 ${g.p(b).name} 头上。鬼新郎选好新娘了`, 'haunt');
}

function updateTrack(g: Game) {
  g.setTrack('三拜', g.hv.bows ?? 0, BOWS);
}

export const h45: HauntDef = {
  id: 45,
  title: '百年婚约',
  type: 'traitor',
  traitor: { type: 'left' },
  intro: '红盖头底下压着张发黄的婚约，落款是一百年前的今天。正厅的红烛自己着了，太师椅上坐着个穿长袍马褂的新郎官，脸上什么都没有。揭示者左手边那人站起来，冲大家笑得像个媒婆。',
  hero: {
    goal: '找到真婚书，撕满 3 道口子。别让新娘在正厅拜满 3 拜。',
    rules: [
      '异变开始时随机一名幸存者当新娘，所有人都知道是谁。新娘死亡，鬼新郎随机另选一名幸存者，已拜的次数保留。',
      '房子里有「婚书」标记（3/4 人局 4 份，5/6 人局 5 份，尽量分在三层），只有一份是真的。',
      '正厅挂满了红绸：谁离开正厅都要多花 1 点移动。',
      '特殊行动「搜查婚书」：在有婚书的房间执行，知识检定 3+，成功拿起来看：假的当场化成灰，真的归你拿着。',
      `特殊行动「撕毁婚书」：拿着真婚书时在哪都能执行，力量检定 4+，成功撕开 1 道口子。口子不会复原，换人拿着也接着算，累计 ${TEARS} 道你们获胜。拿着婚书的人死亡，婚书掉在原地，要再「搜查婚书」才能拿起。`,
      '鬼新郎（速度 3、力量 4）从正厅出发，打不伤，专追拿着真婚书的人。',
      `背叛者和新娘在同一房间时，可以跟她各掷理智，点数更高就把她押到正厅。两人都在正厅时背叛者可以拜堂，拜满 ${BOWS} 拜背叛者获胜。杀死背叛者不会让你们获胜。`,
    ],
    win: '婚书在手里撕成了两半，墨顺着纸边往下滴。正厅的红烛一下全灭了，太师椅上只剩一件马褂搭着。',
  },
  traitorSide: {
    goal: `替鬼新郎把新娘押进正厅，拜满 ${BOWS} 拜；或者杀死所有幸存者。`,
    rules: [
      '正厅还没发现的话，会直接放到地图上。新娘是谁所有人都知道。正厅挂满了红绸：谁离开正厅都要多花 1 点移动。',
      `幸存者在真婚书上撕满 ${TEARS} 道口子，你失败。你死亡不算失败。`,
      '特殊行动「押新娘」：和新娘在同一房间、且不在正厅时执行，你和她各掷理智，你点数更高就把你们俩一起移到正厅。',
      `特殊行动「拜堂」：你和新娘都在正厅时执行，理智检定 4+，成功拜 1 拜。拜满 ${BOWS} 拜你获胜。幸存者全部死亡你也获胜。`,
      '新娘死亡，鬼新郎随机另选一名幸存者当新娘，已拜的次数保留。',
      '你控制鬼新郎（速度 3、力量 4，打不伤），它在你的回合之后行动。',
      '你不能搜查或撕毁婚书。',
    ],
    win: '三拜拜完，鬼新郎牵起新娘，两个人走进了墙上那张旧合影。照片里坐着的宾客，长着你们的脸。',
  },
  monsters: {
    groom: { name: '鬼新郎', icon: 'groom', speed: 3, might: 4, sanity: 4, stun: false },
  },
  *setup(g) {
    ensureBasement(g);
    const h = g.placeRoom('main-hall') ?? 'G:0,0';
    g.spawn('groom', h);
    g.hv.hall = h;
    g.hv.bows = 0;
    g.hv.tears = 0;
    g.hv.contract = null;
    pickBride(g);
    const pool = Object.keys(g.state.tiles).filter((k) => k !== h && !START.includes(g.state.tiles[k].room) && g.distance('G:0,0', k) < Infinity);
    g.rng.shuffle(pool);
    const picks: string[] = [];
    for (const f of ['U', 'B', 'G']) {
      const k = pool.find((x) => x.startsWith(f + ':'));
      if (k) picks.push(k);
    }
    const n = g.scale(4, 4, 5, 5);
    for (const k of pool) if (picks.length < n && !picks.includes(k)) picks.push(k);
    for (const k of ['U:0,-2', 'B:0,-2', 'G:0,-1']) if (picks.length < n && !picks.includes(k)) picks.push(k);
    for (const k of picks) g.token(k, 'contract', '婚书', { icon: 'scroll' });
    g.hs.real = picks[g.rng.int(picks.length)];
    g.token(h, 'silk', '红绸', { icon: 'silk', obstacle: true });
    updateTrack(g);
  },
  actions: [
    {
      id: 'search', side: 'hero', label: '搜查婚书', desc: '知识检定 3+：拿起这个房间的一份婚书看真假',
      can: (g, s) => g.tokensAt(g.p(s).tile, 'contract').length > 0,
      *run(g, s) {
        const r = yield* g.check(s, 'knowledge', 3, '搜查婚书 3+');
        if (r < 3) {
          g.log('纸页粘在一起，揭不开', 'info');
          return;
        }
        const here = g.p(s).tile;
        const list = g.tokensAt(here, 'contract');
        const tk = list.find((x) => x.data?.real) ?? list[0];
        g.removeToken(tk.id);
        if (tk.data?.real || (g.hs.real === here && !g.hs.found)) {
          g.hs.found = true;
          g.hv.contract = s;
          g.log(`${g.p(s).name} 找到了真婚书`, 'good');
        } else g.log('是张假婚书，一碰就成了纸灰', 'info');
      },
    },
    {
      id: 'tear', side: 'hero', label: '撕毁婚书', desc: `力量检定 4+：在真婚书上撕开 1 道口子（共需 ${TEARS} 道）`,
      can: (g, s) => contract(g) === s,
      *run(g, s) {
        const r = yield* g.check(s, 'might', 4, '撕毁婚书 4+');
        if (r >= 4) {
          g.hv.tears = (g.hv.tears ?? 0) + 1;
          g.log(`婚书被撕开了一道口子（${g.hv.tears}/${TEARS}）`, 'good');
          if (g.hv.tears >= TEARS) g.hv.torn = true;
        } else g.log('婚书韧得像牛皮，撕不动', 'bad');
      },
    },
    {
      id: 'drag', side: 'traitor', label: '押新娘', desc: '和新娘各掷理智，你点数更高就把她押到正厅',
      can: (g, s) => {
        const b = bride(g);
        return b != null && !g.p(b).dead && g.p(b).tile === g.p(s).tile && g.p(s).tile !== hall(g);
      },
      *run(g, s) {
        const b = bride(g)!;
        const a = yield* g.check(s, 'sanity', undefined, '押新娘（理智）');
        const d = yield* g.check(b, 'sanity', undefined, '挣扎（理智）');
        if (a > d) {
          g.moveTo(s, hall(g), '跟着唢呐声');
          g.moveTo(b, hall(g), '被红绸牵着');
          g.log(`${g.p(b).name} 被押进了正厅`, 'bad');
        } else g.log(`${g.p(b).name} 挣开了红绸`, 'good');
      },
    },
    {
      id: 'bow', side: 'traitor', label: '拜堂', desc: '在正厅：理智检定 4+，新娘拜 1 拜',
      publicText: '正厅里有人拖着嗓子喊：“一拜天地——”',
      can: (g, s) => {
        const b = bride(g);
        return b != null && !g.p(b).dead && g.p(b).tile === hall(g) && g.p(s).tile === hall(g);
      },
      *run(g, s) {
        const r = yield* g.check(s, 'sanity', 4, '拜堂 4+');
        if (r < 4) {
          g.log('红烛的火苗晃了一下，这一拜没拜下去', 'good');
          return;
        }
        g.hv.bows = (g.hv.bows ?? 0) + 1;
        const words = ['一拜天地', '二拜高堂', '夫妻对拜'];
        g.log(`“${words[Math.min(2, g.hv.bows - 1)]}！”新娘的腰自己弯了下去（${g.hv.bows}/${BOWS}）`, 'bad');
        updateTrack(g);
      },
    },
  ],
  *onDeath(g, s) {
    if (contract(g) === s) {
      g.hv.contract = null;
      g.token(g.p(s).tile, 'contract', '婚书', { icon: 'scroll', data: { real: true } });
      g.log(`真婚书掉在了${g.tileName(g.p(s).tile)}`, 'info');
    }
    if (bride(g) === s) pickBride(g);
  },
  checkWin(g) {
    if (g.hv.torn) return { side: 'hero' };
    if ((g.hv.bows ?? 0) >= BOWS) return { side: 'traitor' };
    if (g.heroes().length === 0) return { side: 'traitor' };
    return null;
  },
  ai: {
    hero: (g, s) => {
      if (contract(g) === s) return { goals: [g.p(s).tile], actions: ['tear'] };
      const goals = g.tokens('contract').map((t) => t.tile);
      const b = bride(g);
      // 新娘被押进正厅了：离得最近的人去护驾（打背叛者）
      if (b != null && b !== s && g.p(b).tile === hall(g)) {
        const t = g.traitor();
        return { goals: [hall(g), ...goals], actions: ['search', 'tear'], targets: t != null ? [t] : undefined };
      }
      return { goals: goals.length ? goals : [hall(g)], actions: ['search', 'tear'] };
    },
    traitor: (g) => {
      const b = bride(g);
      if (b == null) return { goals: g.heroes().map((s) => g.p(s).tile) };
      if (g.p(b).tile === hall(g)) return { goals: [hall(g)], actions: ['bow'], attack: false };
      // 先拜堂，拜不了就押人；别把新娘打死
      return { goals: [g.p(b).tile], actions: ['bow', 'drag'], attack: false };
    },
    monster: (g) => {
      const c = contract(g);
      if (c != null) return { goals: [g.p(c).tile] };
      const loose = g.tokens('contract').filter((t) => t.data?.real).map((t) => t.tile);
      return { goals: loose.length ? loose : g.heroes().filter((s) => s !== bride(g)).map((s) => g.p(s).tile) };
    },
  },
};
