# Cloudflare 免费计划与 wrangler 调研（增量）

> 调研日期：2026-11-17。基线是 `../magical_athlete/docs/research-cloudflare.md`（2026-10-18），这里只写变化和本项目相关的结论。只运行了 `--help` 类只读命令。标「推断」的是文档没写明、由我推出的结论。

## 0. 结论

1. **免费额度没变**：Workers 10 万请求/天、10 ms CPU；静态资源免费不限量；DO（仅 SQLite 后端）请求 10 万/天、行写 10 万/天、行读 500 万/天；D1 行写 10 万/天；KV 写 1,000/天。
2. **最大变化：DO 默认推迟代码更新**（2026-10-30）。部署后对象进入休眠才换新代码，Hibernation 的 WebSocket **不再断开**，默认最多等 300 秒。旧文档「每次部署都断开所有 WS」已不成立。一局 60–90 分钟的游戏可以放心在局中发版（仍需保留重连）。
3. **日志计费**：12-01 起免费计划每天 0.5 GB 摄入、保留 7 天。不要每条消息打印整份状态。
4. **工具链**：本机全局 wrangler 是 4.135.0，最新 4.163.0。`@cloudflare/vite-plugin@1.69.1` 要求 `wrangler ^4.160`。**项目内装 wrangler，命令一律 `npx wrangler`**。
5. **架构**：沿用前项目「手写 DO + Hibernation + D1」，加上 Vite 插件。不用 Agents SDK（`setState` 会把整份状态广播给所有人，和隐藏信息冲突）；partyserver 可选但收益小。
6. **图片放静态资源，不用 R2**（R2 要开通订阅，生产要自有域名）。剧本规则文本**不能**放静态资源，必须服务端按阵营下发。

## 1. 逐项变化

| 项 | 旧（10-18） | 现在（11-17） | 来源 |
|---|---|---|---|
| DO 部署 | 断开所有 WS | 默认 deferred，`max_delay` 300 s；休眠后换代码；超时才强制重置 | [DO code updates](https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/) |
| DO SQL 单行 | 2 MB | 8 MB | [DO Limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |
| DO 单对象存储 | 1 GB | Limits 写 10 GB、FAQ 写 Free 1 GB，按 1 GB 设计 | 同上 |
| DO 免费 CPU | 10 ms 还是 30 s 有歧义 | 仍有歧义，按 10 ms 设计 | 同上 |
| DO 调用重试 | – | 未到达对象的 fetch/RPC 自动重试最多 4 次；幂等方法用 `retryable()` 标记（wrangler 4.158+） | [Workers changelog](https://developers.cloudflare.com/changelog/product/workers/) |
| Auto-response 心跳 | 未说明 | 不计时长费；是否计入 20:1 请求折算仍没写 | [DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| 同步 KV API | 没用 | `ctx.storage.kv.get/put/delete/list` 同步，和 `sql` 同库，可放进 `transactionSync` | [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) |
| 静态资源 | – | 新增 `assets.base_path`（4.148+）；Range 请求返回 200 全量（音频在 Safari 可能受影响） | [Static assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) |
| 兼容日期 | – | `2026-11-17` 起默认开启新模块注册表和 `Request.signal` | [Workers changelog](https://developers.cloudflare.com/changelog/product/workers/) |
| 日志 | 20 万条/天，3 天 | 12-01 起 0.5 GB/天，7 天 | [Observability Pricing](https://developers.cloudflare.com/observability/pricing/) |
| 消费上限 | – | Dashboard 可设 Spend limits（Paid 计划用） | [DO changelog](https://developers.cloudflare.com/changelog/product/durable-objects/) |

R2：每月 10 GB 存储、Class A 100 万、Class B 1,000 万、出站免费；需要先完成订阅 checkout（推断要填付款方式）；`r2.dev` 限流只适合开发。[R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

## 2. wrangler 能力（核实自 `--help`）

| 能力 | 结论 |
|---|---|
| `wrangler dev` | DO / D1 / KV / 静态资源本地模拟，数据在 `.wrangler/state`；`--tunnel` 可暴露给手机联调 |
| `wrangler d1` | `create / execute / migrations / export / time-travel`，`--local/--remote` |
| `wrangler types` | 生成 `worker-configuration.d.ts`，含运行时类型，可代替 `@cloudflare/workers-types`；`--check` 用于 CI |
| `wrangler deploy` | 新增 `--domains`、`--secrets-file`、`--strict`；新版有 `--durable-objects-code-update-mode` |
| versions | `versions upload/deploy`、`rollback`；**有待执行的 DO migration 时必须用 `wrangler deploy`** |
| `wrangler tail` | 实时日志，可按状态 / 关键词过滤 |
| secret | `secret put/list/bulk`；本地 `.dev.vars` |
| 自定义域名 | `routes: [{ pattern, custom_domain: true }]`，域名需是本账户活跃 zone |
| `cf` CLI | 2026-09 beta，读 `cloudflare.config.ts` 不读 wrangler.jsonc，缺 tail；暂不用 |

## 3. 方案取舍

| 方案 | 隐藏信息 | 成本 | 结论 |
|---|---|---|---|
| 手写 DO + Hibernation | 按连接逐个计算视图下发，完全可控 | 前项目代码可复用 | **采用** |
| partyserver 0.5 | 可控 | 低，0.x | 不用 |
| Agents SDK 0.33 | 内置 state 广播会泄密 | 中，偏 AI | 不用 |
| Workers RPC | Worker → DO、DO → DO 调用 | 已在用 | 继续用 |
| `@cloudflare/vite-plugin` | 前端和 Worker 共用一个 dev server，HMR | 低 | **采用** |

## 4. 隐藏信息的落地方式

- 状态分三层：公开（地图、位置、属性、骰子）、秘密（牌堆顺序、剧本号、叛徒身份、双方规则）、个人私有。
- **唯一出口** `viewFor(state, seat)`：广播时对每个连接取 attachment 里的 `{userId, seat}`，逐个计算视图再 `send`，永远不发原始 state。出站消息免费，6 人逐个发没有成本。
- 剧本正文放在 **Worker 代码里**（不进前端 bundle、不进静态资源），揭晓时按阵营下发；执行过的规则段落广播到公共日志。
- 写属性测试：任意英雄视角的序列化结果都不含叛徒专属字段。

## 5. 容量估算（推断）

5 人局约 75 分钟、约 500 个入站动作。行写入仍是第一瓶颈：每个动作写一行约 160 局/天；按回合合批写约 600 局/天。自娱足够。

## 6. 图片预算

- WebP/AVIF，文件名带 hash，`_headers` 设 `immutable` 长缓存。
- 房间板块约 45 块、卡牌约 80 张、角色 12 名。若用位图：板块 512px × 40–80 KB、卡牌插画 30–60 KB，合计 < 10 MB；卡面文字用 HTML 渲染不烤进图。
- 首屏（大厅）≤ 1.5 MB，对局资源进房后预加载。
