// 12 名探险者，6 块双面角色板（board 相同的两人不能同时上场）。
// tracks：每条轨 8 个数值由低到高；start：起始位置 1..8。
import type { ExplorerDef } from '../engine/defs';

export const EXPLORERS: ExplorerDef[] = [
  {
    id: 'lin', name: '林晓峰', board: 0, color: '#c0392b', age: 28, birthday: '07-15', hobbies: '直播、看恐怖片',
    bio: '百万粉丝的探灵主播，镜头前喊“家人们别怕”，一关麦第一个往后缩。',
    tracks: { speed: [3, 4, 4, 5, 6, 6, 7, 8], might: [2, 3, 3, 4, 5, 6, 6, 7], sanity: [2, 3, 3, 4, 5, 5, 6, 7], knowledge: [2, 3, 4, 4, 5, 6, 6, 7] },
    start: { speed: 3, might: 3, sanity: 4, knowledge: 3 },
  },
  {
    id: 'zhao', name: '赵铁柱', board: 0, color: '#c0392b', age: 58, birthday: '02-03', hobbies: '下象棋、修收音机',
    bio: '退休消防员，扛过煤气罐，背过伤员，这辈子不信鬼。',
    tracks: { speed: [2, 3, 3, 4, 4, 5, 6, 6], might: [3, 4, 5, 5, 6, 7, 7, 8], sanity: [3, 3, 4, 5, 5, 6, 7, 7], knowledge: [1, 2, 3, 3, 4, 5, 5, 6] },
    start: { speed: 4, might: 3, sanity: 3, knowledge: 4 },
  },
  {
    id: 'su', name: '苏婉清', board: 1, color: '#2e6fb7', age: 24, birthday: '11-02', hobbies: '读县志、拓碑',
    bio: '历史系研究生，毕业论文写的就是这栋洋楼的旧主人。',
    tracks: { speed: [2, 3, 3, 4, 5, 5, 6, 7], might: [1, 2, 3, 3, 4, 5, 5, 6], sanity: [2, 3, 4, 4, 5, 6, 6, 7], knowledge: [3, 4, 5, 5, 6, 7, 7, 8] },
    start: { speed: 4, might: 4, sanity: 3, knowledge: 3 },
  },
  {
    id: 'chen', name: '陈默', board: 1, color: '#2e6fb7', age: 31, birthday: '04-21', hobbies: '写代码、拼乐高',
    bio: '网络安全工程师，背了一包传感器进来，觉得什么都能测出个数。',
    tracks: { speed: [3, 3, 4, 5, 5, 6, 7, 7], might: [2, 3, 3, 4, 5, 5, 6, 7], sanity: [1, 2, 3, 4, 4, 5, 6, 6], knowledge: [2, 3, 4, 5, 5, 6, 7, 8] },
    start: { speed: 3, might: 3, sanity: 4, knowledge: 3 },
  },
  {
    id: 'xiaoman', name: '小满', board: 2, color: '#2e9a5b', age: 13, birthday: '05-21', hobbies: '爬树、养蚕、偷看哥哥的漫画',
    bio: '跟在大人后头溜进来的初中生，个子小，跑起来谁也追不上。',
    tracks: { speed: [3, 4, 5, 5, 6, 7, 7, 8], might: [1, 2, 2, 3, 4, 4, 5, 6], sanity: [2, 3, 3, 4, 5, 6, 6, 7], knowledge: [2, 3, 3, 4, 5, 5, 6, 7] },
    start: { speed: 3, might: 4, sanity: 3, knowledge: 4 },
  },
  {
    id: 'ajiu', name: '阿九', board: 2, color: '#2e9a5b', age: 22, birthday: '09-09', hobbies: '电瓶车改装、打游戏',
    bio: '外卖骑手，接了一单“送到洋楼二楼”的夜宵，备注写着“请走后门”。',
    tracks: { speed: [3, 4, 4, 5, 6, 6, 7, 8], might: [2, 3, 4, 4, 5, 6, 6, 7], sanity: [2, 2, 3, 4, 4, 5, 6, 6], knowledge: [1, 2, 3, 3, 4, 5, 6, 6] },
    start: { speed: 4, might: 3, sanity: 4, knowledge: 4 },
  },
  {
    id: 'zhou', name: '周大妈', board: 3, color: '#d4a017', age: 62, birthday: '01-28', hobbies: '广场舞、砍价、给人介绍对象',
    bio: '小区广场舞领队，嗓门大，胆子更大。孙子半夜跑丢了，她一路找到这儿。',
    tracks: { speed: [2, 2, 3, 4, 4, 5, 5, 6], might: [2, 3, 3, 4, 5, 5, 6, 7], sanity: [3, 4, 5, 5, 6, 7, 7, 8], knowledge: [2, 3, 3, 4, 4, 5, 6, 6] },
    start: { speed: 4, might: 4, sanity: 3, knowledge: 4 },
  },
  {
    id: 'fang', name: '方圆', board: 3, color: '#d4a017', age: 45, birthday: '08-08', hobbies: '看风水、收老罗盘',
    bio: '自称风水大师，进门前绕着楼走了三圈，脸色越来越难看。',
    tracks: { speed: [2, 3, 3, 4, 5, 5, 6, 6], might: [1, 2, 3, 3, 4, 5, 5, 6], sanity: [2, 3, 4, 4, 5, 6, 7, 7], knowledge: [3, 3, 4, 5, 6, 6, 7, 8] },
    start: { speed: 4, might: 4, sanity: 3, knowledge: 3 },
  },
  {
    id: 'xuanqing', name: '玄清道长', board: 4, color: '#9aa3ad', age: 50, birthday: '03-03', hobbies: '画符、泡茶',
    bio: '山上道观的住持，受人所托来“看一看”，背着一把旧木剑。',
    tracks: { speed: [2, 3, 3, 4, 4, 5, 6, 6], might: [2, 3, 4, 4, 5, 5, 6, 7], sanity: [3, 4, 4, 5, 6, 6, 7, 8], knowledge: [2, 3, 4, 4, 5, 6, 6, 7] },
    start: { speed: 4, might: 3, sanity: 3, knowledge: 3 },
  },
  {
    id: 'anna', name: '安娜', board: 4, color: '#9aa3ad', age: 35, birthday: '12-24', hobbies: '弹钢琴、种花',
    bio: '心理咨询师，一直认为“闹鬼”多半是心理创伤。今晚之前是这么认为的。',
    tracks: { speed: [2, 3, 4, 4, 5, 6, 6, 7], might: [1, 2, 3, 3, 4, 4, 5, 6], sanity: [3, 4, 4, 5, 6, 7, 7, 8], knowledge: [2, 3, 4, 5, 5, 6, 7, 7] },
    start: { speed: 3, might: 4, sanity: 3, knowledge: 3 },
  },
  {
    id: 'shen', name: '沈曼', board: 5, color: '#8e44ad', age: 30, birthday: '06-06', hobbies: '击剑、收旧戏服',
    bio: '话剧演员，为新戏来洋楼体验生活。她在戏里演的就是这家的女主人。',
    tracks: { speed: [3, 3, 4, 5, 5, 6, 7, 7], might: [2, 3, 3, 4, 5, 6, 6, 7], sanity: [1, 2, 3, 4, 4, 5, 6, 7], knowledge: [2, 3, 3, 4, 5, 6, 6, 7] },
    start: { speed: 3, might: 3, sanity: 4, knowledge: 4 },
  },
  {
    id: 'oldk', name: '老K', board: 5, color: '#8e44ad', age: 66, birthday: '10-31', hobbies: '鉴宝、讲鬼故事',
    bio: '古董贩子，听说楼里有一面前清的铜镜，连夜赶来“收货”。',
    tracks: { speed: [1, 2, 3, 3, 4, 5, 5, 6], might: [2, 3, 3, 4, 5, 5, 6, 6], sanity: [2, 3, 4, 5, 5, 6, 7, 7], knowledge: [3, 4, 4, 5, 6, 7, 7, 8] },
    start: { speed: 4, might: 4, sanity: 3, knowledge: 3 },
  },
];
