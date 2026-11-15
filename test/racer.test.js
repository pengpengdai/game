// 打字赛车测试：进度推进、AI 车手速度、到终点判名次、快慢影响排名
const storage = {};
global.tt = {
  createCanvas: () => null,
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2, statusBarHeight: 20, safeArea: { top: 20, bottom: 647 } }),
  getStorageSync: (k) => (storage[k] === undefined ? '' : storage[k]),
  setStorageSync: (k, v) => { storage[k] = v; },
  vibrateShort: () => {},
  showKeyboard: () => {}, hideKeyboard: () => {}, setKeyboardValue: () => {},
  onKeyboardInput: () => {}, onKeyboardConfirm: () => {}, onKeyboardComplete: () => {},
  createInnerAudioContext: () => ({ src: '', loop: false, volume: 1, play: () => {}, stop: () => {} }),
  setInnerAudioOption: () => {}, showToast: () => {},
};

const Racer = require('../js/racer');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
function step(sec) { for (let i = 0; i < Math.ceil(sec / 0.05); i++) Racer.update(0.05); }

// 快车手：50 字/分以上 → 一路领先拿第一
Racer.start();
const R = Racer.R;
assert(R.on && R.passage.length >= 10 && R.rivals.length === 2, '开局有文章与 2 名 AI 车手');
step(2);
assert(R.rivals[0].p > 0 && R.rivals[0].p < 0.2, 'AI 车手按目标用时推进（' + Math.round(R.rivals[0].p * 100) + '%）');

R.typed = 0;
Racer.input(R.passage);
assert(R.finished && R.over && R.rank === 1, '飞速打完全文 → 第 1 名（rank=' + R.rank + '）');
assert(R.score > 0 && R.cpm > 0, '结算得分与 CPM 正常（score=' + R.score + ', cpm=' + R.cpm + '）');

// 慢车手：先挂机 40 秒让对手跑完，再打完 → 第 3 名
Racer.start();
step(46);
const allFinished = Racer.R.rivals.every((r) => r.p >= 1);
assert(allFinished, 'AI 车手会先冲线');
Racer.input(Racer.R.passage);
assert(Racer.R.finished && Racer.R.rank === 3, '两名对手先到 → 第 3 名（rank=' + Racer.R.rank + '）');

// 速度决定名次：快速 1 名、慢速 3 名
assert(Racer.AI_RIVALS.length === 2 && Racer.AI_RIVALS[0].targetSec < Racer.AI_RIVALS[1].targetSec, '两名对手速度不同（26s / 34s）');

// 打错不推进
Racer.start();
Racer.R.typed = 0;
const wrong = '错字';
Racer.input(wrong);
assert(Racer.R.typed === 0, '打错不推进进度');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
