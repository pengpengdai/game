/**
 * routes.js - REST 路由（Node http 内置，零依赖）
 */
const url = require('url');
const auth = require('./auth');
const config = require('./config');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function createRoutes({ db, hub }) {
  return async function handle(req, res) {
    const u = url.parse(req.url, true);
    const path = u.pathname;
    const method = req.method;

    if (path === '/api/health') return json(res, 200, { ok: true, ts: Date.now() });

    if (path === '/api/login' && method === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      const platform = body.platform === 'kuaishou' ? 'kuaishou' : 'douyin';
      const openid = await auth.exchangeOpenId(platform, body.code || 'dev');
      const user = await db.upsertUser(platform, openid);
      return json(res, 200, { token: auth.signToken(user.id), user: { id: user.id, nickname: user.nickname, avatar: user.avatar_url } });
    }

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const payload = auth.verifyToken(token);
    if (!payload) return json(res, 401, { code: 'UNAUTHORIZED' });
    const uid = payload.uid;

    if (path === '/api/records' && method === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      await db.addRecord({
        user_id: uid,
        mode: body.mode === 'en' ? 'en' : 'cn',
        level: body.level || 'easy',
        result: body.result || 'win',
        score: Math.floor(body.score || 0),
        cpm: Math.floor(body.cpm || 0),
        accuracy: Math.floor(body.accuracy || 0),
        max_combo: Math.floor(body.maxCombo || 0),
        room_id: body.roomId || null,
        passage_hash: body.passageHash || '',
      });
      return json(res, 200, { ok: true });
    }

    if (path === '/api/leaderboard' && method === 'GET') {
      const mode = u.query.mode === 'en' ? 'en' : 'cn';
      const level = u.query.level || 'easy';
      const limit = Math.min(50, Number(u.query.limit || 10));
      const data = await db.getLb(mode, level, limit, uid);
      return json(res, 200, data);
    }

    if (path === '/api/rooms' && method === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      const room = hub.rooms.create(uid, { mode: body.mode === 'en' ? 'en' : 'cn', level: body.level || 'easy' });
      return json(res, 200, { roomId: room.id });
    }

    if (/^\/api\/rooms\/[^/]+$/.test(path) && method === 'GET') {
      const roomId = path.split('/')[3];
      return json(res, 200, hub.rooms.sanitize(hub.rooms.get(roomId)) || { code: 'ROOM_NOT_FOUND' });
    }

    if (path === '/api/revive/confirm' && method === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      const scene = ['revive', 'slow_down', 'rematch'].includes(body.scene) ? body.scene : 'revive';
      const dayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const key = `revive:${dayKey}:${uid}`;
      const n = await db.incrDay(key);
      if (n > config.REVIVE_DAY_LIMIT) return json(res, 429, { code: 'REVIVE_LIMIT', remain: 0 });
      return json(res, 200, { ok: true, remain: config.REVIVE_DAY_LIMIT - n });
    }

    return json(res, 404, { code: 'NOT_FOUND' });
  };
}

module.exports = { createRoutes };
