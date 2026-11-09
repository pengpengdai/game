/**
 * ad.js - 激励视频单例
 * 只有完整看完（onClose res.isEnded === true）才回调成功，防止作弊。
 */
const Platform = require('./platform');

let ad = null;
let completeCb = null;

function show(adUnitId, onComplete) {
  completeCb = onComplete || null;

  if (!Platform.api || !Platform.createRewardedVideoAd) {
    // 平台不支持广告：直接视为完成（开发调试用），生产环境请配置广告位
    if (completeCb) completeCb(true);
    return;
  }

  if (!ad) {
    ad = Platform.createRewardedVideoAd({ adUnitId });
    ad.onClose((res) => {
      const ended = !res || res.isEnded === true;
      if (ended) { if (completeCb) completeCb(true); }
      else {
        Platform.showToast('完整看完广告才能获得奖励');
        if (completeCb) completeCb(false);
      }
    });
    ad.onError(() => {
      Platform.showToast('广告加载失败，请稍后再试');
      if (completeCb) completeCb(false);
    });
  }

  const showOnce = () => {
    if (ad.show) ad.show().catch(() => {
      if (ad.load) ad.load().then(showOnce).catch(() => {});
    });
  };
  showOnce();
}

module.exports = { show };
