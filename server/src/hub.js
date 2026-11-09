/**
 * hub.js - WebSocket 连接管理与消息路由
 */
const auth = require('./auth');
const { RoomManager } = require('./room');

function createHub({ db }) {
  const conns = new Map();   // uid -> conn
  const rooms = new RoomManager({ db, getConn: (uid) => conns.get(uid) });

  function handleConnection(conn) {
    let uid = null;
    const send = (obj) => { try { conn.send(JSON.stringify(obj)); } catch (e) {} };

    conn.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch (e) { return; }
      const type = msg.type;

      if (type === 'auth') {
        const payload = auth.verifyToken(msg.token);
        if (!payload) { send({ type: 'error', msg: '登录态失效' }); return; }
        uid = payload.uid;
        conns.set(uid, conn);
        send({ type: 'authed' });
        return;
      }
      if (!uid) { send({ type: 'error', msg: '请先认证' }); return; }

      switch (type) {
        case 'ping': send({ type: 'pong' }); break;
        case 'join_room':
          try { rooms.join(uid, String(msg.roomId)); }
          catch (e) { send({ type: 'error', msg: (e && e.msg) || '加入房间失败' }); }
          break;
        case 'ready': rooms.ready(uid); break;
        case 'progress': rooms.progress(uid, msg); break;
        case 'finish': rooms.finish(uid, msg); break;
        case 'rematch': rooms.rematch(uid); break;
        case 'leave': rooms.leave(uid); break;
        default: send({ type: 'error', msg: '未知消息类型' });
      }
    });

    conn.on('close', () => {
      if (uid) {
        rooms.leave(uid);
        conns.delete(uid);
      }
    });
    conn.on('error', () => {});
  }

  return { handleConnection, rooms, conns };
}

module.exports = { createHub };
