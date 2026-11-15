/**
 * platform.js - 平台兼容层（扩展版）
 *
 * 同一套代码同时发布抖音 / 快手 /（兜底微信调试）：
 *  - 抖音 API 前缀：tt
 *  - 快手 API 前缀：ks
 * 缺失的 API 自动降级（no-op / reject），保证任意环境不崩溃。
 */
const isTT = typeof tt !== 'undefined';
const isKS = typeof ks !== 'undefined';
const isWX = typeof wx !== 'undefined';

const api = isTT ? tt : (isKS ? ks : (isWX ? wx : null));
const NAME = isTT ? 'douyin' : (isKS ? 'kuaishou' : (isWX ? 'wechat' : 'none'));

function safe(fn) {
  try { return fn(); } catch (e) { return undefined; }
}

const Platform = {
  name: NAME,
  api: api,
  hasKeyboard: !!(api && api.showKeyboard),

  // ---- 画布 / 系统信息 ----
  createCanvas() { return api ? api.createCanvas() : null; },

  getSystemInfoSync() {
    if (!api) return { windowWidth: 375, windowHeight: 667, pixelRatio: 1 };
    try { return api.getSystemInfoSync(); }
    catch (e) { return { windowWidth: 375, windowHeight: 667, pixelRatio: 1 }; }
  },

  // ---- 触摸 ----
  onTouchStart(fn) { if (api) api.onTouchStart(fn); },
  onTouchEnd(fn) { if (api) api.onTouchEnd(fn); },
  onTouchMove(fn) { if (api) api.onTouchMove(fn); },

  // ---- 键盘 ----
  showKeyboard(opt) { if (api && api.showKeyboard) { try { api.showKeyboard(opt); } catch (e) {} } },
  hideKeyboard() { if (api && api.hideKeyboard) { try { api.hideKeyboard(); } catch (e) {} } },
  setKeyboardValue(v) { if (api && api.setKeyboardValue) { try { api.setKeyboardValue(v); } catch (e) {} } },
  onKeyboardInput(fn) { if (api && api.onKeyboardInput) api.onKeyboardInput(fn); },
  onKeyboardConfirm(fn) { if (api && api.onKeyboardConfirm) api.onKeyboardConfirm(fn); },
  onKeyboardComplete(fn) { if (api && api.onKeyboardComplete) api.onKeyboardComplete(fn); },

  // ---- 存储 / 反馈 / 分享 ----
  getStorageSync(k) { try { return api ? api.getStorageSync(k) : ''; } catch (e) { return ''; } },
  setStorageSync(k, v) { try { if (api) api.setStorageSync(k, v); } catch (e) {} },
  vibrateShort() { try { if (api && api.vibrateShort) api.vibrateShort({}); } catch (e) {} },
  shareAppMessage(obj) { try { if (api && api.shareAppMessage) api.shareAppMessage(obj); } catch (e) {} },

  // ---- 登录 / 生命周期 ----
  login() {
    return new Promise((resolve, reject) => {
      if (!api || !api.login) { reject(new Error('platform no login')); return; }
      api.login({ success: (r) => resolve(r.code || ''), fail: reject });
    });
  },
  getLaunchOptionsSync() {
    return safe(() => (api && api.getLaunchOptionsSync ? api.getLaunchOptionsSync() : {})) || {};
  },
  onShow(fn) { if (api && api.onShow) api.onShow(fn); },
  onHide(fn) { if (api && api.onHide) api.onHide(fn); },

  // ---- 网络 ----
  request(opt) {
    return new Promise((resolve, reject) => {
      if (!api || !api.request) { reject(new Error('platform no request')); return; }
      api.request(Object.assign({}, opt, { success: resolve, fail: reject }));
    });
  },
  connectSocket(opt) {
    if (!api || !api.connectSocket) return null;
    return api.connectSocket(opt);
  },

  // ---- 广告 ----
  createRewardedVideoAd(opt) {
    return safe(() => (api && api.createRewardedVideoAd ? api.createRewardedVideoAd(opt) : null));
  },

  // ---- 开放数据域（好友榜）----
  setUserCloudStorage(kv) {
    safe(() => { if (api && api.setUserCloudStorage) api.setUserCloudStorage({ keyValueData: kv }); });
  },
  getOpenDataContext() {
    return safe(() => (api && api.getOpenDataContext ? api.getOpenDataContext() : null));
  },

  // ---- 音频 ----
  createInnerAudioContext() {
    return safe(() => (api && api.createInnerAudioContext ? api.createInnerAudioContext() : null));
  },
  setInnerAudioOption(opt) {
    safe(() => { if (api && api.setInnerAudioOption) api.setInnerAudioOption(opt); });
  },

  // ---- 提示 ----
  setClipboardData(text) {
    safe(() => { if (api && api.setClipboardData) api.setClipboardData({ data: String(text || '') }); });
  },
  showToast(title) {
    safe(() => { if (api && api.showToast) api.showToast({ title: title || '', icon: 'none' }); });
  },
};

module.exports = Platform;
