import type { RoomDef } from '../engine/defs';

/** 起始房间：[格子, 房间 id, 旋转] —— 第一个是所有人的出发点 */
export const START_ROOMS: [string, string, number][] = [
  ['G:0,0', 'entrance', 0],
  ['G:0,-1', 'hallway', 0],
  ['G:0,-2', 'stairs', 0],
  ['U:0,-2', 'upper-landing', 0],
  ['B:0,-2', 'basement-landing', 0],
];

export const START_ROOM_DEFS: RoomDef[] = [
  { id: 'entrance', name: '门厅', floors: ['G'], doors: 1 | 2 | 8, start: true, text: '雕花铁门在你们身后咔嗒一声锁上了，怎么推都推不开。' },
  { id: 'hallway', name: '走廊', floors: ['G'], doors: 15, start: true, text: '长廊铺着褪色的地毯，墙上的挂钟停在三点十七分。' },
  { id: 'stairs', name: '大楼梯', floors: ['G'], doors: 2 | 4 | 8, start: true, link: 'upper-landing', text: '柚木楼梯拐着弯上二楼，扶手上的灰厚得能写字。' },
  { id: 'upper-landing', name: '二楼楼梯口', floors: ['U'], doors: 15, start: true, text: '楼梯上来是个小平台，四面的门都关着。' },
  { id: 'basement-landing', name: '地下室楼梯口', floors: ['B'], doors: 15, start: true, text: '石阶到这里就没了，脚下湿滑，一股铁锈味。' },
];
