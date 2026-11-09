/**
 * room.js - 房间状态机与对局逻辑
 * WAIT →（双方就绪）→ PLAYING → FINISHED →（60s 后销毁）
 * 再战：双方都发 rematch → 同房间重新开局（新 seed 新文章）
 */
const Words = require('./words');

const CPM_LIMIT = { cn: 150, en: 600 };  // 超人类阈值（字/分）
const ROOM_TTL = 60 * 1000;
const PROGRESS_GAP = 100;                // 进度上报最小间隔 ms

class RoomManager {
  constructor({ db, getConn }) {
    this.db = db;
    this.getConn = getConn;              // uid -> ws 连接
    this.rooms = new Map();              // roomId -> room
  }

  _send(uid, obj) {
    const conn = this.getConn(uid);
    if (conn) { try { conn.send(JSON.stringify(obj)); } catch (e) {} }
  }
  _broadcast(room, obj, exceptUid) {
    for (const uid of room.players.keys()) {
      if (uid === exceptUid) continue;
      this._send(uid, obj);
    }
  }
  _peer(room, uid) {
    for (const other of room.players.keys()) if (other !== uid) return other;
    return null;
  }
  _player(room, uid) { return room.players.get(uid); }

  create(uid, { mode, level }) {
    const id = 'R' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const room = {
      id, mode, level, owner: uid,
      status: 'WAIT',                 // WAIT | PLAYING | FINISHED
      players: new Map(),             // uid -> {ready, typedLen, score, combo, finished, lastReport}
      passage: '', seed: 0, startedAt: 0,
      rematch: new Set(),
      destroyTimer: null,
    };
    room.players.set(uid, this._newPlayer());
    this.rooms.set(id, room);
    return room;
  }

  _newPlayer() {
    return { ready: false, typedLen: 0, score: 0, combo: 0, finished: false, lastReport: 0 };
  }

  get(id) { return this.rooms.get(id); }

  join(uid, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw { code: 'ROOM_NOT_FOUND', msg: '房间不存在或已结束' };
    if (room.status !== 'WAIT') throw { code: 'ROOM_FULL', msg: '房间已开局或已满' };
    const isExisting = room.players.has(uid);   // 房主通过 WS 确认入房
    if (!isExisting) {
      if (room.players.size >= 2) throw { code: 'ROOM_FULL', msg: '房间已满' };
      room.players.set(uid, this._newPlayer());
    }
    const peerUid = this._peer(room, uid);
    const peerUser = peerUid ? this.db.getUser(peerUid) : null;
    this._send(uid, { type: 'joined', roomId: room.id, opponent: peerUser ? { nickname: peerUser.nickname, avatar: peerUser.avatar_url } : null });
    if (peerUid && !isExisting) {
      const me = this.db.getUser(uid);
      this._send(peerUid, { type: 'peer_joined', opponent: me ? { nickname: me.nickname, avatar: me.avatar_url } : null });
    }
    return room;
  }

  ready(uid) {
    const room = this._roomOf(uid);
    const p = this._player(room, uid);
    if (!p) return;
    p.ready = true;
    const peerUid = this._peer(room, uid);
    if (peerUid) this._send(peerUid, { type: 'peer_ready' });
    const all = [...room.players.values()].every((x) => x.ready);
    if (all && room.players.size === 2) this._start(room);
  }

  _start(room) {
    room.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    room.passage = Words.pickBySeed(room.mode, room.level, room.seed);
    room.status = 'PLAYING';
    room.startedAt = Date.now();
    for (const p of room.players.values()) {
      p.ready = false; p.typedLen = 0; p.score = 0; p.combo = 0; p.finished = false; p.lastReport = 0;
    }
    const payload = { type: 'game_start', passage: room.passage, seed: room.seed, mode: room.mode, level: room.level, startedAt: room.startedAt };
    this._broadcast(room, payload);
  }

  progress(uid, msg) {
    const room = this._roomOf(uid);
    if (!room || room.status !== 'PLAYING') return;
    const p = this._player(room, uid);
    if (!p || p.finished) return;
    const now = Date.now();
    const typedLen = Math.floor(msg.typedLen || 0);
    if (typedLen < p.typedLen) return;                       // 进度只增不减
    if (now - p.lastReport < PROGRESS_GAP) return;           // 限频
    const cpm = typedLen / Math.max((now - room.startedAt) / 60000, 1 / 60);
    if (cpm > CPM_LIMIT[room.mode]) return;                  // 超速忽略
    p.lastReport = now;
    p.typedLen = typedLen;
    p.score = Math.floor(msg.score || 0);
    p.combo = Math.floor(msg.combo || 0);
    const peerUid = this._peer(room, uid);
    if (peerUid) this._send(peerUid, { type: 'peer_progress', typedLen, score: p.score, combo: p.combo });
    if (typedLen >= room.passage.length) this._finish(room, uid, msg);
  }

  finish(uid, msg) {
    const room = this._roomOf(uid);
    if (!room || room.status !== 'PLAYING') return;
    this._finish(room, uid, msg);
  }

  _finish(room, uid, msg) {
    const p = this._player(room, uid);
    if (!p || p.finished) return;
    p.finished = true;
    p.typedLen = room.passage.length;
    room.status = 'FINISHED';
    const me = this.db.getUser(uid);
    const stats = {
      typedLen: room.passage.length,
      score: Math.floor((msg && msg.stats && msg.stats.score) || p.score || 0),
      cpm: Math.floor((msg && msg.stats && msg.stats.cpm) || p.typedLen / Math.max((Date.now() - room.startedAt) / 60000, 1 / 60)),
      accuracy: (msg && msg.stats && msg.stats.accuracy) || 100,
      maxCombo: (msg && msg.stats && msg.stats.maxCombo) || p.combo || 0,
      passageHash: Words.hashPassage(room.passage),
    };
    for (const otherUid of room.players.keys()) {
      const win = otherUid === uid;
      this._send(otherUid, { type: 'result', win, roomId: room.id, stats: win ? stats : null, opponentStats: win ? null : stats, winner: me ? me.nickname : '' });
    }
    // 对局记录 + 排行榜
    this.db.addRecord({
      user_id: uid, room_id: room.id, mode: room.mode, level: room.level,
      result: 'win', score: stats.score, cpm: stats.cpm, accuracy: stats.accuracy,
      max_combo: stats.maxCombo, passage_hash: stats.passageHash,
    });
    this._scheduleDestroy(room);
  }

  rematch(uid) {
    const room = this._roomOf(uid);
    if (!room || room.status !== 'FINISHED') return;
    room.rematch.add(uid);
    this._broadcast(room, { type: 'peer_rematch' });
    if (room.rematch.size >= room.players.size) {
      room.rematch.clear();
      this._cancelDestroy(room);
      this._start(room);
    }
  }

  leave(uid) {
    const room = this._roomOf(uid);
    if (!room) return;
    const wasPlaying = room.status === 'PLAYING';
    room.players.delete(uid);
    room.rematch.delete(uid);
    if (room.players.size === 0) {
      this._cancelDestroy(room);
      this.rooms.delete(room.id);
      return;
    }
    this._broadcast(room, { type: 'peer_left' });
    if (wasPlaying) {
      // 对手中途退出：剩余玩家判胜
      const winnerUid = [...room.players.keys()][0];
      room.status = 'FINISHED';
      this._send(winnerUid, { type: 'result', win: true, roomId: room.id, stats: null, opponentStats: null, winner: '' });
    }
    this._scheduleDestroy(room);
  }

  _roomOf(uid) {
    for (const room of this.rooms.values()) {
      if (room.players.has(uid)) return room;
    }
    return null;
  }

  _scheduleDestroy(room) {
    this._cancelDestroy(room);
    room.destroyTimer = setTimeout(() => {
      this.rooms.delete(room.id);
    }, ROOM_TTL);
  }
  _cancelDestroy(room) {
    if (room.destroyTimer) { clearTimeout(room.destroyTimer); room.destroyTimer = null; }
  }

  sanitize(room) {
    if (!room) return null;
    return {
      id: room.id, mode: room.mode, level: room.level,
      status: room.status, owner: room.owner,
      players: [...room.players.keys()].map((uid) => { const u = this.db.getUser(uid); return { userId: uid, nickname: u ? u.nickname : '' }; }),
    };
  }
}

module.exports = { RoomManager };
