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
  { id: 'entrance', name: '门厅', floors: ['G'], doors: 1 | 2 | 8, start: true, text: '雕花铁门在你们身后锁死了，怎么推都纹丝不动。' },
  { id: 'hallway', name: '走廊', floors: ['G'], doors: 15, start: true, text: '一条铺着褪色地毯的长廊，墙上的挂钟停在三点十七分。' },
  { id: 'stairs', name: '大楼梯', floors: ['G'], doors: 2 | 4 | 8, start: true, link: 'upper-landing', text: '旋转的柚木楼梯通往二楼，扶手上积着厚厚的灰。' },
  { id: 'upper-landing', name: '二楼楼梯口', floors: ['U'], doors: 15, start: true, text: '楼梯尽头的平台，四面都是紧闭的房门。' },
  { id: 'basement-landing', name: '地下室楼梯口', floors: ['B'], doors: 15, start: true, text: '潮湿的石阶在这里到底，空气里有股铁锈味。' },
];
