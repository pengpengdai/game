/**
 * audio.js - 音效管理
 * 背景音乐循环播放，音效一次性播放；支持全局静音开关。
 * 资源：audio/*.wav（占位音，上线前替换为正式音效）
 */
const Platform = require('./platform');

const MUTE_KEY = 'tp_audio_muted';
// key1~3 为机械键盘按键音（三个力度变体，打字时随机播放，避免机械重复）
const NAMES = ['tick', 'error', 'win', 'lose', 'click', 'combo', 'key1', 'key2', 'key3', 'milestone'];

let inited = false;
let muted = false;
const pool = {};     // name -> InnerAudioContext
const bgm = { ctx: null };

/** 首次用户触摸后调用（规避平台 autoplay 限制） */
function init() {
  if (inited) return;
  inited = true;
  muted = Platform.getStorageSync(MUTE_KEY) === '1';
  if (!Platform.api || !Platform.createInnerAudioContext) return;
  NAMES.forEach((name) => {
    const c = Platform.createInnerAudioContext();
    c.src = 'audio/' + name + '.wav';
    pool[name] = c;
  });
  bgm.ctx = Platform.createInnerAudioContext();
  bgm.ctx.src = 'audio/bgm.wav';
  bgm.ctx.loop = true;
  bgm.ctx.volume = 0.35;
}

function play(name) {
  if (!inited || muted || !pool[name]) return;
  try { const c = pool[name]; c.stop(); c.play(); } catch (e) {}
}
function startBgm() {
  if (!inited || muted || !bgm.ctx) return;
  try { bgm.ctx.play(); } catch (e) {}
}
function stopBgm() { try { if (bgm.ctx) bgm.ctx.stop(); } catch (e) {} }

/** 按键音：三档力度随机，随连击升高音色更脆 */
function playKey(combo) {
  const c = Number(combo) || 0;
  let name;
  if (c >= 30) name = 'key3';
  else if (c >= 10) name = 'key2';
  else name = Math.random() < 0.5 ? 'key1' : 'key2';
  play(name);
}
function isMuted() { return muted; }
function toggleMute() {
  muted = !muted;
  Platform.setStorageSync(MUTE_KEY, muted ? '1' : '0');
  if (muted) stopBgm(); else startBgm();
}

module.exports = { init, play, playKey, startBgm, stopBgm, toggleMute, isMuted };
