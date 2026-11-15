// 打字冒险测试：怪物血量=诗长、打完整首击败、蓄力扣心、心归零失败、复活
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

const Adv = require('../js/adventure');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
function step(sec) { for (let i = 0; i < Math.ceil(sec / 0.05); i++) Adv.update(0.05); }

Adv.start();
const A = Adv.A;
assert(A.hearts === 3 && A.over === false, '开局 3 颗心');
assert(A.passage === '床前明月光疑是地上霜', '第一只怪物的诗（' + A.passage + '）');
assert(A.passage.length === A.monster.poem.length, '怪物血量 = 诗的字数（' + A.passage.length + '）');

// 逐字攻击
A.bufBase = 0;
Adv.input('床');
assert(A.typed === 1 && A.combo === 1, '打对 1 字 → 进度 +1');
Adv.input('床前');
assert(A.typed === 2, '输入法累积文本按增量推进（typed=' + A.typed + '）');
Adv.input('床前明月');
assert(A.typed === 4, '多字上屏一次推进（typed=' + A.typed + '）');

// 打错：不扣心，断连击
Adv.input('床前明月光山');   // 打错一个汉字（字母会被当拼音剥离）
assert(A.typed === 5 && A.combo === 0, '打错不推进且断连击（typed=' + A.typed + ', combo=' + A.combo + '）');

// 打完整首 → 击败，进入下一只
A.bufBase = 0;
Adv.input(A.passage.slice(0, 5));
A.typed = A.passage.length - 1;
Adv.input(A.passage);
assert(A.kills === 1 && A.monster.name === '灯笼妖', '打完整首击败怪物并进入下一只（kills=' + A.kills + '）');

// 蓄力攻击扣心
Adv.start();
step(Adv.A.atkTotal + 0.2);
assert(Adv.A.hearts === 2, '蓄力归零扣 1 心（hearts=' + Adv.A.hearts + '）');

// 心归零 → 失败
Adv.A.hearts = 1;
Adv.A.atkIn = 0.1;
step(0.2);
assert(Adv.A.hearts === 0 && Adv.A.over === true, '心归零 → 本局结束');

// 复活
Adv.revive();
assert(Adv.A.over === false && Adv.A.hearts === 2 && Adv.A.revived === true, '复活回到 2 心继续');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
