// 异变剧本注册表：只在服务端使用，前端不得引用（构建时会检查）。
import type { HauntDef } from '../engine/defs';
import { h46 } from './h46';

const LIST: HauntDef[] = [h46];

export const HAUNTS: Record<number, HauntDef> = Object.fromEntries(LIST.map((h) => [h.id, h]));
