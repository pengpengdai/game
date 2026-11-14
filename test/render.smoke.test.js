// 渲染冒烟测试：用桩 canvas 跑遍所有状态，确保 render() 不崩、关键绘制被调用
let calls = { fillText: 0, fillRect: 0, arc: 0, arcTo: 0 };

function makeCtx() {
  const noop = () => {};
  return {
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: 'center', textBaseline: 'middle',
    shadowColor: '', shadowBlur: 0, shadowOffsetY: 0, globalAlpha: 1,
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, rect: noop, clip: noop,
    arcTo: () => { calls.arcTo++; }, arc: () => { calls.arc++; },
    fill: noop, stroke: noop,
    fillRect: () => { calls.fillRect++; },
    fillText: () => { calls.fillText++; },
    measureText: (s) => ({ width: String(s).length * 9 }),
    drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    setLineDash: noop,
  };
}

global.tt = {
  createCanvas: () => ({ width: 0, height: 0, getContext: () => makeCtx() }),
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2, statusBarHeight: 20, safeArea: { top: 20, bottom: 647 } }),
  onTouchStart: () => {}, onTouchEnd: () => {}, onTouchMove: () => {},
  showKeyboard: () => {}, hideKeyboard: () => {}, setKeyboardValue: () => {},
  onKeyboardInput: () => {}, onKeyboardConfirm: () => {}, onKeyboardComplete: () => {},
  getStorageSync: () => '', setStorageSync: () => {},
  vibrateShort: () => {}, shareAppMessage: () => {},
  login: ({ success }) => success({ code: 'c' }),
  getLaunchOptionsSync: () => ({}), onShow: () => {}, onHide: () => {},
  request: (o) => o.fail && o.fail({ errMsg: 'no net' }),
  connectSocket: () => ({ onOpen: () => {}, onMessage: () => {}, onClose: () => {}, onError: () => {}, send: () => {}, close: () => {} }),
  createRewardedVideoAd: () => ({ load: () => Promise.resolve(), show: () => Promise.resolve(), onClose: () => {}, onError: () => {} }),
  setUserCloudStorage: () => {}, getOpenDataContext: () => null,
  createInnerAudioContext: () => ({ src: '', loop: false, volume: 1, play: () => {}, stop: () => {} }),
  setInnerAudioOption: () => {}, showToast: () => {},
};

const Game = require('../js/engine');
const Render = require('../js/render');
const G = Game.G;

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}

Game.bootstrap();

// HOME
calls = { fillText: 0, fillRect: 0, arc: 0, arcTo: 0 };
Render.render();
assert(calls.fillText > 3 && calls.fillRect >= 2, 'HOME 渲染正常（文字+背景）');

// READY（英文，弹框）
Game.startAiGame('en', 'easy');
calls = { fillText: 0, fillRect: 0, arc: 0, arcTo: 0 };
Render.render();
assert(G.state === 'READY' && calls.fillText > 5, 'READY 选择输入方式弹框渲染正常');

// 9 键弹框
G.kb.layout = 'q9'; Game.buildKeyboard();
calls.fillText = 0;
Render.render();
assert(calls.fillText > 5, 'READY 切 9 键后仍正常');

// COUNTDOWN
G.kb.layout = 'q26'; Game.buildKeyboard();
G.state = 'COUNTDOWN'; G.countdown = 2.4;
calls = { fillText: 0, fillRect: 0, arc: 0, arcTo: 0 };
Render.render();
assert(calls.arc > 0 && calls.fillText > 5, 'COUNTDOWN 倒计时环渲染正常');

// PLAY（26键键盘）
Game.startPlay();
G.mode = 'en';
G.typedLen = 3; G.totalKeys = 3; G.score = 60; G.combo = 3;
calls = { fillText: 0, fillRect: 0, arc: 0, arcTo: 0 };
Render.render();
assert(G.kb.visible && calls.arcTo > 20, 'PLAY 26 键键盘渲染正常（27 键帽）');

// PLAY（9键键盘）
G.kb.layout = 'q9'; Game.buildKeyboard();
calls.arcTo = 0;
Render.render();
assert(calls.arcTo > 10, 'PLAY 9 键键盘渲染正常');

// PLAY（中文，系统键盘提示）
G.mode = 'cn'; G.kb.visible = false;
calls.fillText = 0;
Render.render();
assert(calls.fillText > 5, 'PLAY 中文模式系统键盘提示渲染正常');

// 长文自动滚动（当前字符在末尾）
G.mode = 'en'; G.kb.visible = true; G.passage = 'the quick brown fox jumps over the lazy dog again and again and again';
G.typedLen = G.passage.length - 3;
calls.fillText = 0;
Render.render();
assert(calls.fillText > 5, '长文自动滚动到当前行渲染正常');

// 错误闪烁
G.flash = 0.4;
Render.render();
assert(true, '错误闪红渲染不崩');
G.flash = 0;

// RESULT（胜）
G.state = 'RESULT'; G.result = 'win'; G.rank = 'B'; G.score = 1234;
G.elapsed = 30; G.cpm = 180; G.accuracy = 97; G.maxCombo = 24;
G.buttons = [{ x: 10, y: 500, w: 100, h: 44, label: '再来一局', action: 'again', primary: true }];
calls.fillText = 0;
Render.render();
assert(calls.fillText > 6, 'RESULT 胜利页渲染正常');

// LOBBY
G.state = 'LOBBY'; G.pvp.roomId = 'R1X43Q8';
G.pvp.peer = { nickname: '好友', avatar: '' };
G.buttons = [{ x: 20, y: 300, w: 100, h: 46, label: '就绪', action: 'ready', primary: true }];
calls.fillText = 0;
Render.render();
assert(calls.fillText > 4, 'LOBBY 大厅渲染正常');

// PAUSED
Game.startAiGame('en', 'easy');
Game.startPlay();
Game.pauseGame();
calls = { fillText: 0, fillRect: 0, arc: 0, arcTo: 0 };
Render.render();
assert(G.state === 'PAUSED' && calls.fillText > 5, 'PAUSED 暂停页渲染正常');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
