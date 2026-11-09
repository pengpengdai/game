/**
 * config.js - 服务端配置（环境变量覆盖）
 */
module.exports = {
  HOST: process.env.HOST || '0.0.0.0',
  PORT: Number(process.env.PORT || 8080),

  // 生产必改：JWT 密钥
  JWT_SECRET: process.env.JWT_SECRET || 'typing-race-dev-secret-change-me',

  // 每日复活次数上限
  REVIVE_DAY_LIMIT: Number(process.env.REVIVE_DAY_LIMIT || 5),

  // 生产环境接入真实平台（服务端持有，客户端零接触）：
  // TT_APPID: process.env.TT_APPID || '',
  // TT_SECRET: process.env.TT_SECRET || '',
  // KS_APPID: process.env.KS_APPID || '',
  // KS_SECRET: process.env.KS_SECRET || '',
};
