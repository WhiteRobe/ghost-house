// 5 张缘起卡：你们为什么来到这座房子。表格：凶兆 -> 异变编号（1..45）；46..50 由事件触发。
import type { ScenarioDef } from '../engine/defs';

const OMEN_ORDER = ['mirror', 'effigy', 'watch', 'jade', 'cat', 'diary', 'sword', 'shoe', 'veil'];

function table(base: number): Record<string, number> {
  return Object.fromEntries(OMEN_ORDER.map((o, i) => [o, base + i]));
}

export const SCENARIOS: ScenarioDef[] = [
  { id: 'live', name: '探灵直播', text: '你们是个小有名气的探灵直播团队。今晚直播间人数一路往上涨，弹幕全在刷：去那栋民国洋楼。', table: table(1) },
  { id: 'will', name: '遗嘱宣读', text: '一个从没见过的远房亲戚死了。律师函上写着：遗嘱午夜在老宅宣读，本人须到场。', table: table(10) },
  { id: 'missing', name: '失踪的朋友', text: '三天前，你们的朋友在这附近不见了。他发来的最后一张照片，拍的就是这栋楼的门厅。', table: table(19) },
  { id: 'demolish', name: '拆迁前夜', text: '这栋楼明天一早就拆。你们趁夜溜进来，想赶在推土机前面看看里头有什么。', table: table(28) },
  { id: 'curse', name: '百年诅咒', text: '你们的祖辈都在这栋楼里做过事。家里老人说，这房子每过一百年，要收一回人。', table: table(37) },
];

export { OMEN_ORDER };
