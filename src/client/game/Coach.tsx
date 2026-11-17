// 新手引导：按对局进度依次弹出提示，并把相关界面圈出来。
// 教学局里每条都会出现；普通对局只在打开「新手提示」时出现没看过的条目。
import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { GameState, Request, Side } from '../../shared/types';
import { overlay } from './store';

interface Ctx {
  s: GameState;
  req: Request | null;
  you: number | null;
  side: Side | null;
}

interface Tip {
  id: string;
  title: string;
  text: string | ((c: Ctx) => string);
  /** data-tour 名称 */
  target?: string;
  when: (c: Ctx) => boolean;
}

const me = (c: Ctx) => (c.you != null ? c.s.players[c.you] : null);
const turn = (c: Ctx) => (c.req?.kind === 'turn' ? c.req : null);

const TIPS: Tip[] = [
  {
    id: 'welcome', title: '先说两句',
    text: '你们几个半夜溜进了一栋民国老洋楼。前半局大家是一伙的，轮流开门找房间、捡东西、撞上怪事。凶兆攒多了会触发「异变」，到那时，你们当中多半有人要反水。',
    when: (c) => c.s.phase === 'explore',
  },
  {
    id: 'traits', title: '你的四项属性', target: 'me',
    text: '速度、力量（身体），理智、知识（精神）。高亮格是现在的数值，绿框是起始值。检定就是掷「属性值」颗骰子，每颗骰子只有 0、1、2 三种点数。受伤就沿着轨道往左移。好消息是：异变开始之前，谁都不会死。',
    when: (c) => !!me(c) && c.s.phase === 'explore',
  },
  {
    id: 'players', title: '其他玩家', target: 'players',
    text: '这里能看到每个人的属性和手里有几张卡。金框的是正在行动的人。手机上点右上角 ☰ 打开这一栏。',
    when: (c) => c.s.phase === 'explore',
  },
  {
    id: 'move', title: '移动', target: 'map',
    text: (c) => `轮到你了！你这回合最多能走 ${turn(c)?.moveLeft ?? 0} 格（等于你的速度）。点击金色高亮的房间就会走过去，右下角的小数字是要花的步数。楼层按钮可以切换一楼、二楼和地下室。`,
    when: (c) => !!turn(c) && Object.keys(turn(c)!.moves).length > 0,
  },
  {
    id: 'explore', title: '探索新房间', target: 'explore',
    text: '虚线框里的「？」是一扇还没打开的门。点它，就会发现一个新房间：随机抽一块房间接上去，然后按房间上的符号抽一张事件、物品或凶兆。注意：发现新房间后，你的回合就结束了。',
    when: (c) => !!turn(c) && turn(c)!.explore.length > 0,
  },
  {
    id: 'rotate', title: '摆放房间', target: 'actions',
    text: '用「转」按钮旋转新房间。至少要有一扇门对着你走来的方向；其他门越多朝向空地，以后能探索的地方就越多。满意了就点「就这样放」。',
    when: (c) => c.req?.kind === 'rotate',
  },
  {
    id: 'cards', title: '物品与凶兆', target: 'cards',
    text: '你捡到的物品和凶兆都放在这里，点一下能看说明。带能力的卡会在你的回合变成行动按钮；武器在攻击时使用。同一房间的队友之间每回合可以交易一次。',
    when: (c) => (me(c)?.cards.length ?? 0) > 0,
  },
  {
    id: 'omen', title: '凶兆出现了', target: 'title',
    text: '每抽到一张凶兆，就要做一次异变检定：掷「已出现凶兆数」颗骰子，掷出 5 点以上就触发异变。凶兆越多越容易触发，第 9 张必定触发。顶栏显示目前出了几张。',
    when: (c) => c.s.omensDrawn > 0 && c.s.phase === 'explore',
  },
  {
    id: 'end', title: '结束回合', target: 'end',
    text: '不想再走、也不想探索时，点「结束回合」。有些房间会在你结束回合时生效，比如加属性的书房、会让人受伤的锅炉房，点房间可以看它的说明。',
    when: (c) => !!turn(c) && c.s.round >= 2,
  },
  {
    id: 'log', title: '日志', target: 'players',
    text: '侧栏的「日志」记下了每一次掷骰、每一张卡和每一次受伤。看不懂刚才发生了什么，就去翻翻日志。',
    when: (c) => c.s.round >= 2,
  },
  {
    id: 'haunt', title: '异变开始了', target: 'brief',
    text: (c) =>
      (c.side === 'traitor'
        ? '你成了背叛者！你和幸存者的目标完全不同。'
        : '异变开始了。你是幸存者，和同伴一起对付背叛者。') +
      '点「📜 手册」看你这一方的目标和特殊规则。对方看不到你的手册，不过你用过的规则会公开。还有，从现在起属性掉到骷髅就会死。',
    when: (c) => c.s.phase === 'haunt',
  },
  {
    id: 'haunt-action', title: '特殊行动', target: 'actions',
    text: '行动栏里多了剧本给你的特殊行动（比如撕掉「喜」字）。它们往往要做一次检定，每种每回合只能用一次。这通常就是赢的关键。',
    when: (c) => !!turn(c) && turn(c)!.actions.some((a) => a.id.startsWith('haunt:')),
  },
  {
    id: 'attack', title: '攻击', target: 'attack',
    text: '和敌人在同一个房间时可以攻击（每回合一次）。双方都掷力量，点数高的一方给对方造成差值伤害。防守方赢了，受伤的就是你。武器能让你多掷骰子。怪物被打中只会眩晕，跳过它的下一回合。',
    when: (c) => !!turn(c) && turn(c)!.attacks.length > 0,
  },
  {
    id: 'damage', title: '分配伤害', target: 'modal',
    text: '受到伤害时，由你决定扣哪项属性。物理伤害扣力量或速度，精神伤害扣理智或知识。异变之后任何一项降到骷髅就会死，所以别把一项扣光。',
    when: (c) => c.req?.kind === 'damage',
  },
  {
    id: 'monster', title: '怪物', target: 'map',
    text: '红框方块是怪物。它们在背叛者的回合之后行动，移动步数靠掷骰。离开有敌人的房间要多花一步，所以别轻易被堵住。',
    when: (c) => c.s.monsters.length > 0,
  },
];

const SEEN_KEY = 'ghost-tips-seen';
const ON_KEY = 'ghost-tips';

/** 当前提示圈中的目标（手机上据此展开折叠的面板） */
export const coachTarget = signal<string | null>(null);

export const tipsOn = signal<boolean>(localStorage.getItem(ON_KEY) !== 'off');
export function setTipsOn(v: boolean) {
  tipsOn.value = v;
  localStorage.setItem(ON_KEY, v ? 'on' : 'off');
}

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function resetTips() {
  localStorage.removeItem(SEEN_KEY);
}

export function Coach({ ctx, tutorial }: { ctx: Ctx; tutorial: boolean }) {
  const [seen, setSeen] = useState<Set<string>>(() => (tutorial ? new Set() : loadSeen()));
  const [rect, setRect] = useState<DOMRect | null>(null);
  /** 本局看过的提示（按顺序），用于「上一步」 */
  const [history, setHistory] = useState<string[]>([]);
  /** 正在回看 history 里的第几条；null 表示正常推进 */
  const [back, setBack] = useState<number | null>(null);
  const active = tutorial || tipsOn.value;
  const busy = overlay.value != null;
  const live = active && !busy ? TIPS.find((t) => !seen.has(t.id) && t.when(ctx)) : undefined;
  const tip = back != null ? TIPS.find((t) => t.id === history[back]) : live;

  useEffect(() => {
    coachTarget.value = tip?.target ?? null;
    return () => { coachTarget.value = null; };
  }, [tip?.id]);

  useEffect(() => {
    if (!tip?.target) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-tour="${tip.target}"]`) ?? (tip.target === 'modal' ? document.querySelector('.modal') : null);
      const r = el?.getBoundingClientRect();
      // 目标不在屏幕里（比如手机上收起的侧栏）就不圈，气泡居中
      const visible = r && r.width > 0 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
      setRect(visible ? r : null);
    };
    measure();
    const t = setInterval(measure, 400);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', measure);
    };
  }, [tip?.id]);

  if (!tip) return null;
  const done = (all = false) => {
    if (back != null && !all) {
      // 回看模式：往后翻，翻到头回到正常推进
      setBack(back + 1 < history.length ? back + 1 : null);
      return;
    }
    setBack(null);
    if (!history.includes(tip.id)) setHistory([...history, tip.id]);
    const next = new Set(seen);
    if (all) for (const t of TIPS) next.add(t.id);
    else next.add(tip.id);
    setSeen(next);
    if (!tutorial) localStorage.setItem(SEEN_KEY, JSON.stringify([...next, ...loadSeen()]));
    if (all && !tutorial) setTipsOn(false);
  };
  const idx = TIPS.indexOf(tip) + 1;
  const prevIdx = back != null ? back - 1 : history.length - 1;
  const prev = () => prevIdx >= 0 && setBack(prevIdx);

  // 气泡位置：目标下方放不下就放上方；没有目标就居中
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W = Math.min(340, vw - 24);
  let style: Record<string, string>;
  if (rect) {
    const below = rect.bottom + 12;
    const left = Math.max(12, Math.min(vw - W - 12, rect.left + rect.width / 2 - W / 2));
    if (below + 200 < vh) style = { left: `${left}px`, top: `${below}px` };
    else if (rect.top - 12 > 200) style = { left: `${left}px`, bottom: `${vh - rect.top + 12}px` };
    else style = { left: `${Math.max(12, Math.min(vw - W - 12, rect.left + 16))}px`, top: `${Math.max(12, rect.top + 56)}px` }; // 目标太大：放在它里面
  } else style = { left: `${(vw - W) / 2}px`, top: `${vh * 0.3}px` };

  return (
    <div class="coach">
      {rect ? (
        <div class="coach-hole" style={{ left: `${rect.left - 6}px`, top: `${rect.top - 6}px`, width: `${rect.width + 12}px`, height: `${rect.height + 12}px` }} />
      ) : <div class="coach-dim" />}
      <div class="coach-bubble" style={{ ...style, width: `${W}px` }}>
        <div class="coach-step">{tutorial ? `新手教程 · ${idx}/${TIPS.length}` : '新手提示'}</div>
        <h4>{tip.title}</h4>
        <p>{typeof tip.text === 'function' ? tip.text(ctx) : tip.text}</p>
        <div class="row end">
          <button class="btn small ghost" disabled={prevIdx < 0} onClick={prev}>上一步</button>
          <span class="spacer" />
          <button class="btn small ghost" onClick={() => done(true)}>{tutorial ? '跳过教程' : '不再提示'}</button>
          <button class="btn small primary" onClick={() => done()}>知道了</button>
        </div>
      </div>
    </div>
  );
}
