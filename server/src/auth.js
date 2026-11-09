/**
 * auth.js - 轻量 JWT（HS256，HMAC 自实现，零依赖）
 * 生产可替换为 jsonwebtoken + 平台 code2Session
 */
const crypto = require('crypto');
const config = require('./config');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  let b = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  return Buffer.from(b, 'base64');
}
function hmac(data) {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(data).digest();
}

function signToken(uid) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ uid, exp: Date.now() + 2 * 3600 * 1000 }));
  const sig = b64url(hmac(header + '.' + payload));
  return header + '.' + payload + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expect = b64url(hmac(parts[0] + '.' + parts[1]));
    if (expect !== parts[2]) return null;
    const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
    if (!payload.uid || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

/**
 * 平台 code 换 openid。
 * 生产环境：
 *  - 抖音: GET https://developer.toutiao.com/api/apps/v2/jscode2session?appid=..&secret=..&code=..
 *  - 快手: 以快手小游戏开放平台最新文档为准
 * 本地/演示：直接以 platform:code 作为 openid。
 */
function exchangeOpenId(platform, code) {
  return Promise.resolve(platform + ':' + String(code));
}

module.exports = { signToken, verifyToken, exchangeOpenId };
