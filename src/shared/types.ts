// 引擎公开类型：服务端、客户端共用。任何秘密信息都不在这些类型里，见 engine/game.ts 的 Secret。

export type Trait = 'speed' | 'might' | 'sanity' | 'knowledge';
export const TRAITS: Trait[] = ['speed', 'might', 'sanity', 'knowledge'];
export const TRAIT_NAME: Record<Trait, string> = { speed: '速度', might: '力量', sanity: '理智', knowledge: '知识' };
export const PHYSICAL: Trait[] = ['might', 'speed'];
export const MENTAL: Trait[] = ['sanity', 'knowledge'];

/** 地下室 / 一楼 / 二楼 */
export type Floor = 'B' | 'G' | 'U';
export const FLOORS: Floor[] = ['B', 'G', 'U'];
export const FLOOR_NAME: Record<Floor, string> = { B: '地下室', G: '一楼', U: '二楼' };

/** 0 北 1 东 2 南 3 西 */
export type Dir = 0 | 1 | 2 | 3;
export const DIR_NAME = ['北', '东', '南', '西'];

export type CardKind = 'item' | 'omen' | 'event';
export const CARD_KIND_NAME: Record<CardKind, string> = { item: '物品', omen: '凶兆', event: '事件' };

export type Side = 'hero' | 'traitor';
export type DamageKind = 'physical' | 'mental' | 'general' | Trait;
export type AiLevel = 'normal';
export type RuleMode = 'standard' | 'classic';
export type HauntType = 'traitor' | 'hidden' | 'coop' | 'ffa';

export interface GameConfig {
  seed: number;
  seats: { name: string; ai?: AiLevel; explorer: string }[];
  scenario: string; // 缘起卡 id
  mode: RuleMode; // standard = 第 3 版异变检定；classic = 第 2 版
  /** 调试：抽到第 2 个凶兆时必定触发这个异变 */
  debugHaunt?: number;
}

export interface PlacedTile {
  room: string;
  floor: Floor;
  x: number;
  y: number;
  rot: number; // 顺时针 90° 的次数
}

export interface Token {
  id: number;
  kind: string;
  tile: string;
  label: string;
  icon?: string;
  /** 离开这一格要多花 1 点移动（障碍） */
  obstacle?: boolean;
  /** 只有某一方可以看到（例如背叛者的陷阱）；服务端在视图里过滤 */
  side?: Side;
  data?: Record<string, unknown>;
}

export interface Monster {
  id: number;
  kind: string;
  name: string;
  icon: string;
  tile: string;
  traits: Partial<Record<Trait, number>>;
  stunned: boolean;
  hp?: number;
  data?: Record<string, unknown>;
}

export interface PlayerState {
  seat: number;
  name: string;
  ai?: AiLevel;
  explorer: string;
  /** 每项属性在轨道上的位置：0 = 骷髅（死亡），1..8 */
  traits: Record<Trait, number>;
  tile: string;
  cards: string[];
  dead: boolean;
  /** 公开阵营。隐藏背叛者在公开之前显示为 hero。 */
  side: Side | null;
  /** 内容层可用的公开标记（每局一次的房间加成等） */
  flags: Record<string, number | string | boolean>;
}

export interface HauntPublic {
  id: number;
  title: string;
  type: HauntType;
  intro: string;
  revealer: number;
  traitor: number | null; // 隐藏背叛者未公开前为 null
  round: number; // 异变后的轮数
  vars: Record<string, unknown>;
  /** 公开计数轨 */
  track?: { label: string; value: number; max?: number };
  /** 已经执行过、因而向所有人公开的规则 */
  revealed: string[];
}

export interface Winner {
  side: Side | 'none' | 'solo';
  seats: number[];
  title: string;
  text: string;
}

export interface GameState {
  phase: 'explore' | 'haunt' | 'end';
  round: number;
  turn: number; // 当前行动座位；-1 表示怪物阶段
  players: PlayerState[];
  tiles: Record<string, PlacedTile>;
  tokens: Token[];
  monsters: Monster[];
  /** 剧本临时加的远距连接 */
  links: [string, string][];
  /** 牌堆剩余张数；房间堆按楼层统计（背面可见） */
  decks: { item: number; omen: number; event: number; rooms: Record<Floor, number> };
  omensDrawn: number;
  scenario: string;
  mode: RuleMode;
  haunt: HauntPublic | null;
  winner: Winner | null;
  /** 当前回合剩余移动点（仅当前玩家有意义） */
  moveLeft: number;
}

// ---------- 决策请求 ----------

export type Target = { seat: number } | { monster: number };

export interface ActionOpt {
  id: string;
  label: string;
  desc?: string;
}

export interface AttackOpt {
  target: Target;
  label: string;
  weapons: string[]; // 可用的武器卡 id；空数组仍可徒手
  ranged?: boolean;
}

export interface TradeOpt {
  seat: number;
  theirs: string[];
}

export type Request =
  | {
      kind: 'turn';
      seat: number;
      moveLeft: number;
      /** 可到达的格子 -> 花费 */
      moves: Record<string, number>;
      explore: Dir[];
      actions: ActionOpt[];
      attacks: AttackOpt[];
      trades: TradeOpt[];
      loot: { seat: number; cards: string[] }[];
      /** 自己可以交易出去的卡 */
      tradeable: string[];
    }
  | { kind: 'rotate'; seat: number; tile: string; room: string; rots: number[] }
  | { kind: 'damage'; seat: number; amount: number; caps: Partial<Record<Trait, number>>; reason: string }
  | { kind: 'choose'; seat: number; prompt: string; options: { label: string; desc?: string }[]; card?: string }
  | { kind: 'tile'; seat: number; prompt: string; tiles: string[]; optional: boolean }
  | { kind: 'player'; seat: number; prompt: string; seats: number[]; optional: boolean }
  | { kind: 'card'; seat: number; prompt: string; cards: string[]; optional: boolean }
  | { kind: 'trade'; seat: number; from: number; give: string[]; take: string[] }
  | {
      kind: 'monster';
      seat: number;
      monsters: { id: number; moveLeft: number; moves: Record<string, number>; attacks: AttackOpt[] }[];
    };

export type RequestKind = Request['kind'];

export type Answer =
  | { kind: 'turn'; a: 'move'; to: string }
  | { kind: 'turn'; a: 'explore'; dir: Dir }
  | { kind: 'turn'; a: 'act'; id: string }
  | { kind: 'turn'; a: 'attack'; target: Target; weapon?: string }
  | { kind: 'turn'; a: 'trade'; with: number; give: string[]; take: string[] }
  | { kind: 'turn'; a: 'loot'; from: number; card: string }
  | { kind: 'turn'; a: 'end' }
  | { kind: 'rotate'; rot: number }
  | { kind: 'damage'; alloc: Partial<Record<Trait, number>> }
  | { kind: 'choose'; i: number }
  | { kind: 'tile'; tile: string | null }
  | { kind: 'player'; seat: number | null }
  | { kind: 'card'; card: string | null }
  | { kind: 'trade'; ok: boolean }
  | { kind: 'monster'; a: 'move'; id: number; to: string }
  | { kind: 'monster'; a: 'attack'; id: number; target: Target }
  | { kind: 'monster'; a: 'end' };

// ---------- 事件（动画 + 日志） ----------

export type GameEvent =
  | { t: 'turn'; seat: number; round: number }
  | { t: 'monsterPhase' }
  | { t: 'move'; seat?: number; monster?: number; path: string[] }
  | { t: 'place'; seat?: number; monster?: number; to: string; text?: string }
  | { t: 'tile'; key: string; tile: PlacedTile; seat: number }
  | { t: 'card'; seat: number; card: string; how: 'draw' | 'gain' | 'event' }
  | { t: 'lose'; seat: number; card: string; to?: number }
  | { t: 'roll'; seat?: number; monster?: number; label: string; dice: number[]; total: number; need?: number; ok?: boolean }
  | { t: 'trait'; seat: number; trait: Trait; from: number; to: number }
  | { t: 'log'; text: string; seat?: number; tone?: 'good' | 'bad' | 'info' | 'haunt'; side?: Side; /** 只发给这个座位 */ to?: number }
  | { t: 'hauntRoll'; seat: number; dice: number[]; total: number; need: string; ok: boolean }
  | { t: 'haunt'; id: number; title: string; revealer: number; traitor: number | null }
  | { t: 'attack'; from: Target; to: Target; trait: Trait; a: number[]; d: number[]; damage: number; loser: Target | null }
  | { t: 'death'; seat: number }
  | { t: 'stun'; monster: number }
  | { t: 'end'; winner: Winner };

/** 属性轨实际数值 */
export function traitValue(track: number[], idx: number): number {
  return idx <= 0 ? 0 : track[Math.min(idx, 8) - 1];
}

export function tileKey(floor: Floor, x: number, y: number): string {
  return `${floor}:${x},${y}`;
}

export function parseKey(key: string): { floor: Floor; x: number; y: number } {
  const [f, rest] = key.split(':');
  const [x, y] = rest.split(',').map(Number);
  return { floor: f as Floor, x, y };
}

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

/** 房间旋转后某方向是否有门。doors 为未旋转时的位掩码：1 北 2 东 4 南 8 西 */
export function hasDoor(doors: number, rot: number, dir: number): boolean {
  const base = (dir - rot + 8) % 4;
  return (doors & (1 << base)) !== 0;
}
