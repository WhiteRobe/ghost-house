// 5 张缘起卡：你们为什么来到这座房子。表格：凶兆 -> 异变编号（1..45）；46..50 由事件触发。
import type { ScenarioDef } from '../engine/defs';

const OMEN_ORDER = ['mirror', 'effigy', 'watch', 'jade', 'cat', 'diary', 'sword', 'shoe', 'veil'];

function table(base: number): Record<string, number> {
  return Object.fromEntries(OMEN_ORDER.map((o, i) => [o, base + i]));
}

export const SCENARIOS: ScenarioDef[] = [
  { id: 'live', name: '探灵直播', text: '你们是一支小有名气的探灵直播团队。今晚，直播间的人数一路飙升，弹幕催你们去那栋民国洋楼。', table: table(1) },
  { id: 'will', name: '遗嘱宣读', text: '一位素未谋面的远房亲戚去世了，律师函上写着：遗嘱将在老宅里、午夜时分宣读。', table: table(10) },
  { id: 'missing', name: '失踪的朋友', text: '三天前，你们的朋友在这附近失踪。他发来的最后一张照片，拍的就是这栋楼的门厅。', table: table(19) },
  { id: 'demolish', name: '拆迁前夜', text: '这栋楼明天一早就要拆了。你们趁夜溜进来，想在推土机之前看看它藏着什么。', table: table(28) },
  { id: 'curse', name: '百年诅咒', text: '你们的祖辈都曾在这栋楼里做过事。家族里流传一个说法：每过一百年，房子就要收回点什么。', table: table(37) },
];

export { OMEN_ORDER };
