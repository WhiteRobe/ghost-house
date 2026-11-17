// 内容定义的类型：探险者、房间、卡牌、缘起卡、异变剧本。
// 所有效果都写成生成器函数 function*(g, seat)，需要玩家决策时 `yield*` 引擎提供的方法即可。
import type { CardKind, DamageKind, Floor, HauntType, Side, Trait } from '../shared/types';
import type { Game, Gen } from './game';

export type Fx = (g: Game, seat: number) => Gen<unknown>;

export interface ExplorerDef {
  id: string;
  name: string;
  /** 0..5：同一块角色板的两面不能同时上场 */
  board: number;
  color: string;
  age: number;
  birthday: string; // MM-DD
  hobbies: string;
  bio: string;
  /** 每条轨 8 个数值，由低到高（骷髅格不写） */
  tracks: Record<Trait, number[]>;
  /** 起始位置 1..8 */
  start: Record<Trait, number>;
}

export interface ActionDef {
  label: string;
  desc?: string;
  /** 默认每回合一次。返回 false 时不显示 */
  can?: (g: Game, seat: number) => boolean;
  run: Fx;
  /** AI 是否愿意现在执行 */
  ai?: (g: Game, seat: number) => boolean;
}

export interface RoomDef {
  id: string;
  name: string;
  floors: Floor[];
  /** 门：1 北 2 东 4 南 8 西 */
  doors: number;
  /** 发现时要抽的牌 */
  symbols?: CardKind[];
  text: string;
  start?: boolean;
  /** 与另一间已放置的房间直接相连（双向） */
  link?: string;
  onDiscover?: Fx;
  onEnter?: Fx;
  /** 回合结束时在此房间 */
  onEndTurn?: Fx;
  /** onEndTurn / onEnter 是有害效果：背叛者与怪物可以忽略 */
  harmful?: boolean;
  action?: ActionDef;
  /** 离开时额外花费的移动点 */
  leaveCost?: number;
}

export interface CardDef {
  id: string;
  kind: CardKind;
  name: string;
  text: string;
  flavor?: string;
  /** 武器：攻击时额外掷骰；ranged 可攻击视线内目标 */
  weapon?: { trait: Trait; dice: number; ranged?: boolean };
  /** 获得 / 失去时（物品、凶兆） */
  onGain?: Fx;
  onLose?: Fx;
  /** 主动能力（每回合一次） */
  action?: ActionDef & { discard?: boolean };
  /** 事件立即结算 */
  run?: Fx;
  /** 受到伤害前修正伤害值 */
  reduceDamage?: (g: Game, seat: number, kind: DamageKind, n: number) => number;
  /** 掷骰时额外骰子数 */
  rollBonus?: (g: Game, seat: number, trait: Trait, purpose: RollPurpose) => number;
  /** 不能交易 / 丢弃 */
  bound?: boolean;
  /** 抽到此事件即触发指定异变（异变前） */
  haunt?: number;
}

export type RollPurpose = 'check' | 'attack' | 'defend' | 'other';

export interface ScenarioDef {
  id: string;
  name: string;
  text: string;
  /** 凶兆 id -> 异变编号 */
  table: Record<string, number>;
}

export type TraitorRule =
  | { type: 'revealer' }
  | { type: 'left' } // 揭示者左手边（下一个座位）
  | { type: 'highest' | 'lowest'; trait: Trait; exclude?: boolean }
  | { type: 'holder'; card: string } // 持有某张卡的人，没人持有则揭示者
  | { type: 'none' }
  | { type: 'hidden' } // 隐藏背叛者：随机，只有本人知道
  | { type: 'oldest' | 'youngest' };

export interface MonsterDef {
  name: string;
  icon: string;
  speed: number;
  might: number;
  sanity?: number;
  knowledge?: number;
  /** 默认受伤即眩晕；false 表示伤害无效 */
  stun?: boolean;
  /** 设置后改为扣血，血量归零即被消灭 */
  hp?: number;
  /** 可以无视门穿墙移动到同楼层相邻格 */
  phase?: boolean;
  /** 不会造成阻碍 */
  noBlock?: boolean;
}

export interface AiHint {
  /** 想去的格子（按优先级） */
  goals?: string[];
  /** 想执行的行动 id（按优先级），如 haunt:ritual、room:xxx */
  actions?: string[];
  /** 是否主动攻击同格敌人，默认 true */
  attack?: boolean;
  /** 只攻击这些目标 */
  targets?: (number | `m${number}`)[];
}

export interface HauntSideText {
  goal: string;
  rules: string[];
  win: string;
}

export interface HauntAction extends ActionDef {
  id: string;
  side: Side | 'any';
  /** 执行时公开给所有人的说明 */
  publicText?: string;
}

export interface HauntDef {
  id: number;
  title: string;
  type: HauntType;
  traitor: TraitorRule;
  /** 公开引言：揭晓时所有人可见 */
  intro: string;
  hero: HauntSideText;
  /** 背叛者（ffa 时为所有人共用的说明，coop 时可省略） */
  traitorSide?: HauntSideText;
  monsters?: Record<string, MonsterDef>;
  setup?: (g: Game) => Gen<unknown>;
  actions?: HauntAction[];
  onTurnStart?: Fx;
  onTurnEnd?: Fx;
  /** 每轮结束（所有玩家和怪物行动完） */
  onRoundEnd?: (g: Game) => Gen<unknown>;
  onDeath?: (g: Game, seat: number, killer: number | null) => Gen<unknown>;
  /** 怪物受到伤害。返回 true 表示已处理，引擎不再做默认的眩晕/扣血 */
  onMonsterHurt?: (g: Game, monster: number, damage: number, by: number | null) => Gen<boolean>;
  /** 进入某格之后 */
  onEnter?: Fx;
  /** 掷骰加成 */
  rollBonus?: (g: Game, seat: number, trait: Trait, purpose: RollPurpose) => number;
  /** 是否可以攻击目标（默认按阵营） */
  canAttack?: (g: Game, seat: number, target: { seat?: number; monster?: number }) => boolean;
  /** 每步之后检查胜负 */
  checkWin?: (g: Game) => { side: Side | 'none' | 'solo'; seats?: number[]; text?: string } | null;
  ai?: {
    hero?: (g: Game, seat: number) => AiHint;
    traitor?: (g: Game, seat: number) => AiHint;
    monster?: (g: Game, monster: number) => { goals?: string[] };
  };
}
