/**
 * game.js - 打字比赛 · 抖音/快手小游戏入口
 * 事件绑定：触摸 / 键盘 / 生命周期 / 网络消息分发
 */
const Platform = require('./js/platform');
const Game = require('./js/engine');
const Render = require('./js/render');
const Net = require('./js/net');

let touched = false;

// ---- 触摸（点击按钮；首次触摸初始化音频）----
Platform.onTouchStart((e) => {
  const t = e.touches && e.touches[0];
  if (t) Game.G.touchStart = { x: t.clientX, y: t.clientY };
  if (!touched) { touched = true; Game.firstTouch(); }
});

Platform.onTouchEnd((e) => {
  const t = e.changedTouches && e.changedTouches[0];
  if (!t || !Game.G.touchStart) return;
  const dx = t.clientX - Game.G.touchStart.x;
  const dy = t.clientY - Game.G.touchStart.y;
  Game.G.touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
    Game.tap(t.clientX, t.clientY);
  }
});

// ---- 系统键盘 ----
Platform.onKeyboardInput((res) => {
  if (!res || typeof res.value !== 'string') return;
  if (Game.G.codeMode) return;              // 挑战码输入：等确认再提交
  Game.input(res.value);
});
Platform.onKeyboardConfirm((res) => {
  if (res && typeof res.value === 'string') {
    if (Game.G.codeMode) { Game.submitChallengeCode(res.value); return; }
    Game.input(res.value);
  }
  Game.confirmClear();
});
Platform.onKeyboardComplete(() => {});

// ---- 网络消息 → 引擎 ----
['joined', 'peer_joined', 'peer_ready', 'game_start', 'peer_progress',
 'peer_finish', 'result', 'peer_left', 'peer_rematch', 'error'].forEach((type) => {
  Net.on(type, (data) => Game.onNet(type, data));
});

// ---- 生命周期 ----
Platform.onShow((res) => {
  const q = res && res.query;
  if (q && q.roomId && Game.G.state === 'HOME') {
    Game.handleLaunchOptions({ query: q });
    Game.pvpJoin(String(q.roomId));
  }
});
Platform.onHide(() => {});
Platform.onKeyboardComplete(() => {});

// ---- 启动：处理从分享卡片进入（携带 roomId）----
Game.bootstrap();
const launchRoomId = Game.G.pendingJoinRoom;
if (launchRoomId) Game.pvpJoin(launchRoomId);

// ---- 主循环 ----
let last = Date.now();
function loop() {
  const now = Date.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  Game.update(dt);
  Render.render();
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
  else setTimeout(loop, 16);
}
loop();
