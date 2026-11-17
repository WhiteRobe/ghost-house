// 公开内容注册表：客户端和服务端都可以引用（不含异变剧本）。
import type { CardDef, ExplorerDef, RoomDef, ScenarioDef } from '../engine/defs';
import { EXPLORERS as EX } from './explorers';
import { START_ROOM_DEFS, START_ROOMS } from './start';
import { ROOMS_LIST } from './rooms';
import { OMENS } from './omens';
import { ITEMS } from './items';
import { EVENTS } from './events';
import { SCENARIOS as SC, OMEN_ORDER } from './scenarios';

const byId = <T extends { id: string }>(xs: T[]): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const x of xs) {
    if (out[x.id]) throw new Error('重复的 id：' + x.id);
    out[x.id] = x;
  }
  return out;
};

export const EXPLORERS: Record<string, ExplorerDef> = byId(EX);
export const ROOMS: Record<string, RoomDef> = byId([...START_ROOM_DEFS, ...ROOMS_LIST]);
export const CARDS: Record<string, CardDef> = byId([...OMENS, ...ITEMS, ...EVENTS]);
export const SCENARIOS: Record<string, ScenarioDef> = byId(SC);
export const OMEN_IDS: string[] = OMEN_ORDER;
export { START_ROOMS };
