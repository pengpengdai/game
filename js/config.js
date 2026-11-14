/**
 * config.js - 全局配置（部署时按环境替换）
 */
module.exports = {
  // 服务端地址：上线前替换为已备案 HTTPS/WSS 域名
  // 本地调试：抖音/快手开发者工具需在「域名信息」里配置合法域名，或用工具自带的忽略校验选项
  SERVER_BASE: 'https://your-domain.com',

  // 广告位 ID（抖音=穿山甲 / 快手=快手联盟，各自申请后填入）
  AD_REVIVE: 'adunit-revive-placeholder',     // 失败复活
  AD_SLOW: 'adunit-slow-placeholder',         // 对手减速
  AD_REMATCH: 'adunit-rematch-placeholder',   // 对战失败再战

  // 开局倒计时（秒）。三种写法都支持：
  //   数字 → 所有难度统一，例：COUNTDOWN_SEC: 3
  //   对象 → 按难度分别设置，例：COUNTDOWN_SEC: { default: 3, easy: 2, normal: 3, hard: 3 }
  //   0    → 跳过倒计时，点「开始打字」立即开打
  COUNTDOWN_SEC: { default: 3, easy: 2, normal: 3, hard: 3 },
};
