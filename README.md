# 打字比赛 · 小游戏（抖音 / 快手 双端）

逐字打字竞速：与 AI 或真实好友比谁先打完一篇文章。一套代码双端发布。

## 功能

| 模块 | 说明 |
| --- | --- |
| 单机竞速 | 中/英双语 × 简单/普通/困难，逐字判定、连击加成、CPM/正确率、段位（S~D） |
| 好友对战 | 建房→房间号/分享卡片→就绪→服务端同种子同文开局→实时进度互推→服务端判胜→断线重连 |
| 激励视频 | ①失败复活（AI 回退 60%）②对手减速 5 秒 ③对战再战；服务端每日 5 次限次 |
| 音效 | 6 类音效 + BGM + 静音开关（首次触摸后初始化，规避 autoplay 限制） |
| 排行榜 | 好友榜（开放数据域）+ 全局榜（服务端分榜）+ 战绩分享 |
| 双端 | 平台差异全部收敛在 `js/platform.js`，业务代码不出现 `tt`/`ks` |

## 目录

```
typing-race/
├── game.js                     入口：事件绑定 + 主循环
├── game.json                   竖屏
├── project.config.json         抖音（填 appid）
├── kuaishou.project.config.json 快手模板（填 appid）
├── js/
│   ├── platform.js             双端兼容层
│   ├── config.js               SERVER_BASE + 广告位 ID
│   ├── words.js                题库
│   ├── engine.js               状态机/计分/AI/PVP/复活
│   ├── render.js               Canvas 渲染
│   ├── net.js                  HTTP + WS（token/心跳/重连）
│   ├── audio.js                音效
│   └── ad.js                   激励视频
├── audio/                      音效资源（wav 占位，可替换）
├── openDataContext/            好友排行榜
├── server/                     服务端（Node 零依赖，可直接跑）
│   ├── src/                    auth/db/words/minws/room/hub/routes/app/index
│   └── test/e2e.js             E2E（13 项）
├── test/client.test.js         客户端逻辑测试（20 项）
└── docs/
    ├── 技术方案.md
    └── 产品文档.md
```

## 本地运行

```bash
# 服务端（默认 8080）
cd server && node src/index.js

# 客户端测试（mock 平台 API + 假 WS）
node test/client.test.js      # 20 项

# 服务端 E2E
node server/test/e2e.js       # 13 项
```

## 可调参数（js/config.js）

```js
// 开局倒计时，三种写法
COUNTDOWN_SEC: 3;                                  // 所有难度统一 3 秒
COUNTDOWN_SEC: { default: 3, easy: 2, hard: 5 };   // 按难度，未配的用 default
COUNTDOWN_SEC: 0;                                  // 跳过倒计时，点开始直接开打
```

其他可调项：`SERVER_BASE`（服务端地址）、`AD_REVIVE` / `AD_SLOW` / `AD_REMATCH`（广告位）。

## 上线前必改

1. `js/config.js` → `SERVER_BASE` 换成已备案 HTTPS/WSS 域名；三个广告位 ID 换成真实值。
2. `project.config.json` / `kuaishou.project.config.json` → 填各自 appid。
3. `audio/*.wav` → 换成正式音效资源。
4. 服务端 `src/config.js` → 数据库/密钥配置；生产建议 MySQL + Redis。

详见 `docs/技术方案.md`（架构、接口、部署、安全）与 `docs/产品文档.md`（玩法、数值、变现、增长、合规）。
