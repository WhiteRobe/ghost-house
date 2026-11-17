# 鬼屋

一款受《山中小屋》（Betrayal at House on the Hill）第 3 版规则框架启发的在线合作 / 背叛桌游。民国西式洋楼 + 中式民俗恐怖，3–6 人，可以用 AI 补位。所有角色、房间、卡牌、50 个异变剧本、插画均为原创（插画由 Cloudflare Workers AI 生成）。非官方、非商业。

## 技术
- 前端：Vite + Preact + signals，SVG 地图，WebAudio 合成音效。
- 后端：Cloudflare Workers + Durable Objects（SQLite，WebSocket Hibernation）+ D1。
- 规则引擎：`src/engine`，纯 TS、确定性的生成器协程；重放回答日志即可恢复对局。
- 隐藏信息：服务端按座位过滤视图（`Game.viewFor`）；剧本只在 Worker 端，构建时检查前端不含剧本文本。

## 目录
```
src/engine/    规则引擎、AI
src/content/   探险者、房间、凶兆、物品、事件、缘起卡（前后端共用）
src/haunts/    50 个异变剧本（仅服务端）
src/worker/    Worker 入口、账号、LobbyDO、HouseDO
src/client/    前端
scripts/       模拟、构建检查、AI 插画生成
docs/          调研、计划、内容指南、剧本总表
```

## 开发
```bash
npm i
cp .dev.vars.example .dev.vars          # 填 SESSION_SECRET
cp wrangler.jsonc wrangler.local.jsonc  # 填 D1 database_id（此文件不提交）
npm run db:migrate:local
npm run dev                             # 前端 + Worker 同一个 dev server
npm test                                # 引擎冒烟 + 50 个剧本各 6 局 AI 互打
npm run sim -- 20 4                     # 跑 20 局 4 人 AI 对局
```

## 部署
```bash
npm run db:migrate
npx wrangler secret put SESSION_SECRET
npm run deploy
```
