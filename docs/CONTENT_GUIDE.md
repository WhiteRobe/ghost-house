# 内容编写指南（房间 / 卡牌 / 异变剧本）

游戏叫「鬼屋」：一栋民国时期的西式洋楼，现代人深夜闯入。规则框架取《山中小屋》第 3 版，**所有文字、名称、剧本都是原创**，不要照搬或改写原作的任何卡牌、房间、剧本文本，也不要用原作的专有名词。界面全中文。

## 术语
- 异变（作祟）、凶兆（预兆）、背叛者、幸存者（英雄）、揭示者、缘起卡（剧本卡）、计数轨、标记、怪物、眩晕。
- 四项属性：速度、力量（物理）；理智、知识（精神）。伤害分物理 / 精神 / 通用（任选）。
- 骰子每面 0/0/1/1/2/2，检定掷「属性值」颗骰（上限 8）。典型门槛：3+ 容易、4+ 中等、5+ 难、6+ 很难。

## 代码结构
- 类型：`src/engine/defs.ts`（RoomDef / CardDef / HauntDef …）
- 引擎 API：`src/engine/game.ts` 里 `Game` 的公开方法。效果写成 `function*(g, seat)`，需要等玩家决策的方法（名字前带 `*` 的）一律 `yield*` 调用。
- 内容文件**只能 `import type` 引擎**（`import type { Game } from '../engine/game'`），不能运行时引用引擎，否则会把引擎打进前端包。工具函数在 `src/content/helpers.ts`。
- 剧本在 `src/haunts/hNN.ts`，导出 `hNN: HauntDef`，并登记到 `src/haunts/index.ts`。剧本只在服务端运行，可以写任何文本（不会泄露给前端）。

## 常用 API（g: Game）
| 方法 | 说明 |
|---|---|
| `g.p(seat)` | 玩家状态（`tile`、`cards`、`dead`、`flags` 每局标记） |
| `g.value(seat, trait)` | 当前属性值 |
| `yield* g.check(seat, trait, need?, label?, extraDice?)` | 属性检定，返回点数 |
| `yield* g.roll(n, label, seat?)` | 掷 n 颗骰，返回点数 |
| `yield* g.damage(seat, 'physical'\|'mental'\|'general'\|trait, n, reason)` | 伤害，玩家自己分配；异变后可能致死 |
| `yield* g.gain(seat, trait, n)` / `yield* g.lose(seat, trait, n)` | 直接加减属性（lose 不能被减免） |
| `g.heal(seat, trait?)` | 恢复到起始值 |
| `yield* g.choose(seat, prompt, ['选项A', '选项B'])` | 返回下标；AI 默认选 0，所以**把对 AI 最合理的选项放第一个** |
| `yield* g.chooseTile / choosePlayer / chooseCard(seat, prompt, list, optional?)` | 返回所选（可能 null） |
| `yield* g.draw(seat, 'item'\|'omen'\|'event')` | 抽牌并结算 |
| `yield* g.searchDeck(seat, kind, pred)` | 从牌堆找第一张符合条件的卡给玩家 |
| `yield* g.gainCard / loseCard(seat, card, to?)` | 给 / 失去卡（会触发 onGain/onLose） |
| `g.moveTo(seat, key, text?)` / `yield* g.moveInto(...)` | 传送（后者触发进入效果） |
| `g.placeRoom(roomId, floors?)` | 从房间堆找出该房间并放到地图上，返回格子 key |
| `g.findTile(roomId)` | 已放置房间的格子 key 或 null |
| `g.token(tile, kind, label, {icon, obstacle, side, data})` / `g.removeToken(id)` / `g.tokensAt(tile, kind?)` / `g.tokens(kind)` | 标记。`side` 设置后只有那一方看得见 |
| `g.spawn(kind, tile)` / `g.monster(id)` / `g.monstersAt(tile)` / `g.removeMonster(id)` / `g.moveMonster(id, tile)` / `g.stun(id)` | 怪物（kind 对应 `HauntDef.monsters`） |
| `yield* g.attack(from, to, {trait, bonus})` | 发起对抗攻击，Target 为 `{seat}` 或 `{monster}` |
| `yield* g.hurt(target, n, trait, by)` | 直接造成伤害 |
| `yield* g.kill(seat, killer)` | 异变后直接杀死 |
| `g.endTurn()` | 结束当前回合 |
| `g.escape(seat, text?)` / `g.escaped(seat)` | 玩家逃出房子（不再行动，不算死亡；界面显示「已逃出」） |
| `g.tell(seat, text)` | 只有这一名玩家能看到的消息（隐藏身份类剧本用） |
| `g.win('hero'\|'traitor'\|'none'\|'solo', text?, seats?)` | 立即判定胜负（一般用 `checkWin` 更好） |
| `g.hv` / `g.hs` | 剧本公开变量 / 秘密变量（对象，可直接读写） |
| `g.setTrack(label, value, max?)` | 公开计数轨 |
| `g.reveal(text)` | 把一条规则公开到日志 |
| `g.revealTraitor()` | 隐藏背叛者现身 |
| `g.log(text, tone?, seat?, side?)` | 日志；`side` 设置后只有那一方看得见 |
| `g.traitor()` / `g.heroes(includeDead?)` / `g.alive()` / `g.isTraitor(s)` / `g.sideOf(s)` | 阵营 |
| `g.scale(a3, a4, a5, a6)` | 按人数取值 |
| `g.distance(a, b)` / `g.neighbors(key)` / `g.lineOfSight(a, b)` / `g.link(a, b)` | 地图 |
| `g.rng.int(n)` / `g.rng.shuffle(arr)` | 随机（确定性，**禁止用 Math.random / Date**） |
| `g.state` | 整个公开状态，必要时可以直接读写（tiles、tokens、monsters、players…） |
| `g.n` / `g.state.round` / `g.state.haunt.round` | 人数 / 轮数 |

格子 key 形如 `G:0,-1`（楼层:x,y）。起始房间：门厅 `entrance` 在 `G:0,0`，走廊 `hallway` `G:0,-1`，大楼梯 `stairs` `G:0,-2`（连二楼楼梯口），二楼楼梯口 `upper-landing` `U:0,-2`，地下室楼梯口 `basement-landing` `B:0,-2`。

## 房间 id 清单（共 42 块，不含起始房间）
符号：O 凶兆、E 事件、I 物品、N 无。

| id | 名称 | 楼层 | 符号 | 机制提示 |
|---|---|---|---|---|
| furnace | 锅炉房 | B | O | 回合结束在此受 1 点物理伤害（有害） |
| wine-cellar | 酒窖 | B | E | |
| well | 古井 | B | O | 剧本常用：水鬼、井 |
| morgue | 停尸间 | B | E | |
| crypt | 地宫 | B | O | 剧本常用：封印、守卫 |
| underground-river | 暗河 | B | E | 离开多花 1 点移动 |
| coal-room | 煤房 | B | I | |
| water-prison | 水牢 | B | N | 剧本常用：关押 |
| cellar-hatch | 地窖口 | G | E | 与地下室楼梯口相连 |
| kitchen | 厨房 | G | O | 每人每局一次：结束回合在此力量 +1 |
| dining | 餐厅 | G | O | |
| ballroom | 舞厅 | G | E | |
| ancestral-hall | 祠堂 | G | O | 剧本常用：祭拜、祖先 |
| garden | 后花园 | G | E | 室外 |
| opera-stage | 戏台 | G | O | 剧本常用：夜戏 |
| servants | 佣人房 | G | I | |
| main-hall | 正厅 | G | E | 剧本常用：婚礼、仪式 |
| master-bedroom | 主卧 | U | O | |
| nursery | 儿童房 | U | E | |
| attic | 阁楼 | U | E | |
| balcony | 露台 | U | O | 室外，剧本常用：逃生 |
| dressing | 梳妆间 | U | O | |
| clock-tower | 钟楼 | U | E | 剧本常用：时钟 |
| library | 书房 | G,U | E | 每人每局一次：知识 +1 |
| chapel | 佛堂 | G,U | O | 每人每局一次：理智 +1 |
| storeroom | 储藏间 | B,G,U | I | |
| collapsed | 坍塌的卧室 | G,U | N | 速度 5+ 否则跌到地下室 |
| laundry-chute | 洗衣槽 | G,U | N | 结束回合在此滑到地下室楼梯口 |
| dumbwaiter | 送菜梯 | B,G,U | N | 掷骰决定被送到哪一层 |
| secret-passage | 密道 | B,G,U | N | 与走廊相连 |
| drill-room | 练功房 | B,G | N | 每人每局一次：速度 +1 |
| bathroom | 浴室 | G,U | E | |
| darkroom | 暗房 | B,U | E | |
| music-room | 琴房 | G,U | O | |
| guest-room | 客房 | G,U | E | |
| conservatory | 花房 | G,U | I | |
| vault | 保险库 | B,U | I,I | |
| junk-room | 杂物间 | B,G,U | N | 发现时放障碍 |
| gallery | 画廊 | G,U | O | |
| armory | 兵器室 | B,G | N | 发现时从物品堆找一件武器 |
| tea-room | 茶室 | G,U | E | |
| mirror-corridor | 镜廊 | G,U | O | |

## 凶兆 id
`mirror` 铜镜、`effigy` 纸人、`watch` 停走的怀表、`jade` 血沁玉佩、`cat` 黑猫、`diary` 旧日记、`sword` 桃木剑、`shoe` 绣花鞋、`veil` 红盖头。

## 剧本编写要点
- 参考 `src/haunts/h46.ts`。
- `hero` 写给幸存者、`traitorSide` 写给背叛者（coop 可省略；ffa 时所有人看 `traitorSide`）。每份都要写清楚：目标、特殊规则、特殊行动、胜利文本。
- 胜负尽量写在 `checkWin`，每步之后都会检查。默认规则：所有幸存者死亡则背叛者胜（coop 除外）。超过 40 轮强制平局，所以要保证 AI 互打一般 15 轮内能分胜负。
- 必须写 `ai` 提示，让 AI 知道该去哪、做什么：`{ goals: 格子[], actions: [行动 id], attack?: boolean, targets?: [...] }`。
- 异变开始时（setup 前后）引擎会保证地下室可达：走不到时自动把走廊和地下室楼梯口连起来。
- 剧本需要的房间如果还没出现，用 `g.placeRoom('well')` 放出来（返回 null 时要有退路，比如改用 `g.p(traitor).tile`）。
- 怪物可以设 `hp`（扣血）或 `stun: false`（无法伤害），默认受伤眩晕。
- 测试：`npx vitest run test/haunts.test.ts -t "h12 "`（会跑 6 局不同人数的 AI 互打，检查无报错、能结束、可重放）。
