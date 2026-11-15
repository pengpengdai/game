// 掉落消词玩法测试：生成/下落/消除/漏词扣星/升关/复活
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
  setInnerAudioOption: () => {},
  showToast: () => {},
};

const Drop = require('../js/drop');
const Words = require('../js/words');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}

function step(sec) {
  const n = Math.ceil(sec / 0.05);
  for (let i = 0; i < n; i++) Drop.update(0.05);
}

Drop.start('cn');
assert(Drop.S.on && Drop.S.words.length >= 2, '开局生成掉落词（' + Drop.S.words.length + ' 个）');
assert(Drop.S.stars === 10 && Drop.S.level === 1, '初始 10 颗星 / 第 1 关');

// 手动放一个词在可控位置
Drop.S.words = [{ id: 1, text: '你好', typed: '', lane: 0, x: 40, y: 200, w: 60, speed: 1 }];
Drop.S.buf = '';
Drop.input('你好');
assert(Drop.S.words.length === 0 && Drop.S.score > 0, '打完整词即消除并加分（score=' + Drop.S.score + '）');
assert(Drop.S.cleared === 1, '消除计数 +1');

// 只打前缀不消除
Drop.S.words = [{ id: 2, text: '速度', typed: '', lane: 0, x: 40, y: 200, w: 60, speed: 1 }];
Drop.S.buf = '';
Drop.input('速');
assert(Drop.S.words.length === 1 && Drop.S.words[0].typed === '速', '只打前缀不消除（typed=' + Drop.S.words[0].typed + '）');

// 拼音字母被剥离
Drop.input('sudu');            // 拼音阶段
assert(Drop.S.words[0].typed === '速', '纯拼音不推进');
Drop.input('速度');            // 上屏
assert(Drop.S.words.length === 0, '拼音上屏后可消除');

// 漏词扣星
Drop.start('cn');
Drop.S.words = [{ id: 3, text: '你好', typed: '', lane: 0, x: 40, y: Drop.S.lineY - 20, w: 60, speed: 1 }];
const before = Drop.S.stars;
step(0.6);
assert(Drop.S.stars === before - 1, '漏到底部扣 1 星（' + Drop.S.stars + '）');
assert(Drop.S.words.length === 0, '漏掉的词被移除');

// 星星归零 → 结束
Drop.S.stars = 1;
Drop.S.words = [{ id: 4, text: '加油', typed: '', lane: 0, x: 40, y: Drop.S.lineY - 20, w: 60, speed: 1 }];
step(0.6);
assert(Drop.S.stars === 0 && Drop.S.over === true, '星星耗尽 → 本局结束');

// 复活
Drop.revive();
assert(Drop.S.over === false && Drop.S.stars === 3 && Drop.S.revived === true, '复活后 3 颗星、继续本局');

// 升关 + 加星
Drop.start('cn');
Drop.S.stars = 5;
Drop.S.levelCleared = 11;
Drop.S.combo = 0;
Drop.S.words = [{ id: 5, text: '读书', typed: '', lane: 0, x: 40, y: 200, w: 60, speed: 1 }];
Drop.S.buf = '';
Drop.input('读书');
assert(Drop.S.level === 2, '消除满 12 个词升到第 2 关（level=' + Drop.S.level + '）');
assert(Drop.S.stars === 6, '升关 +1 星（stars=' + Drop.S.stars + '）');
assert(Drop.S.score > 0 && Drop.S.maxCombo >= 1, '分数与连击正常');

// 同字多词时优先最靠下的
Drop.start('cn');
Drop.S.words = [
  { id: 6, text: '花开', typed: '', lane: 0, x: 30, y: 150, w: 60, speed: 1 },
  { id: 7, text: '海边', typed: '', lane: 1, x: 150, y: 300, w: 60, speed: 1 },
];
Drop.S.buf = '';
Drop.input('海');
assert(Drop.S.words.length === 2 && Drop.S.words[1].typed === '海', '同首字时打最靠下的词（y=' + Drop.S.words[1].y + '）');

// 词库覆盖
assert(Words.DROP_CN.length >= 40 && Words.DROP_EN.length >= 15, '掉落词库充足（cn=' + Words.DROP_CN.length + '）');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
