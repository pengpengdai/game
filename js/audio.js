/**
 * audio.js - 音效管理
 * 背景音乐循环播放，音效一次性播放；支持全局静音开关。
 * 资源：audio/*.wav（占位音，上线前替换为正式音效）
 */
const Platform = require('./platform');

const MUTE_KEY = 'tp_audio_muted';
const NAMES = ['tick', 'error', 'win', 'lose', 'click', 'combo'];

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

function isMuted() { return muted; }
function toggleMute() {
  muted = !muted;
  Platform.setStorageSync(MUTE_KEY, muted ? '1' : '0');
  if (muted) stopBgm(); else startBgm();
}

module.exports = { init, play, startBgm, stopBgm, toggleMute, isMuted };
