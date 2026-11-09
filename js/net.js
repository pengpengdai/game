/**
 * net.js - 网络层（HTTP + WebSocket）
 * 职责：token 管理、REST 调用、WS 连接/心跳/自动重连/消息分发
 */
const Platform = require('./platform');
const Config = require('./config');

const TOKEN_KEY = 'tp_token';
let token = Platform.getStorageSync(TOKEN_KEY) || '';

let socket = null;          // SocketTask
let connected = false;
let heartbeatTimer = null;
let reconnectTimer = null;
let reconnectTimes = 0;
let queue = [];             // 未连接时的待发消息

const listeners = {};       // type -> [fn]

function on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
function emit(type, data) { (listeners[type] || []).forEach((fn) => fn(data)); }

function setToken(t) { token = t; Platform.setStorageSync(TOKEN_KEY, t); }
function getToken() { return token; }

/** HTTP 请求（自动带 token） */
function http(path, data, method) {
  return Platform.request({
    url: Config.SERVER_BASE + path,
    method: method || 'POST',
    data: data || {},
    header: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  }).then((r) => {
    let body = r.data;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) {} }
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    throw (body || { code: 'HTTP_' + r.statusCode });
  });
}

/** 登录：tt.login/ks.login 取 code → 服务端换 token */
async function ensureLogin() {
  if (token) return token;
  const code = await Platform.login();
  const res = await http('/api/login', { platform: Platform.name, code: code || 'dev' });
  setToken(res.token);
  return res.token;
}

function wsUrl() { return Config.SERVER_BASE.replace(/^http/, 'ws') + '/ws'; }

/** 建立 WS 连接（幂等） */
function connect() {
  if (!Platform.api || !Platform.connectSocket || socket) return;
  socket = Platform.connectSocket({ url: wsUrl(), header: { Authorization: 'Bearer ' + token } });

  socket.onOpen(() => {
    connected = true;
    reconnectTimes = 0;
    try { socket.send({ data: JSON.stringify({ type: 'auth', token: token }) }); } catch (e) {}
    flushQueue();
    startHeartbeat();
  });
  socket.onMessage((r) => {
    let msg;
    try { msg = JSON.parse(r.data); } catch (e) { return; }
    if (msg.type === 'pong') return;
    emit(msg.type, msg);
  });
  socket.onClose(() => {
    connected = false;
    stopHeartbeat();
    socket = null;
    scheduleReconnect();
  });
  socket.onError(() => {});
}

function scheduleReconnect() {
  if (reconnectTimer || reconnectTimes >= 3) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectTimes++;
    connect();
  }, 3000);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    try { socket && socket.send({ data: JSON.stringify({ type: 'ping' }) }); } catch (e) {}
  }, 10000);
}
function stopHeartbeat() { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } }

function flushQueue() {
  while (queue.length && socket && connected) {
    const m = queue.shift();
    try { socket.send({ data: JSON.stringify(m) }); } catch (e) {}
  }
}

/** 发送 WS 消息（未连接则排队并尝试连接） */
function send(obj) {
  if (!socket || !connected) {
    queue.push(obj);
    connect();
    return;
  }
  try { socket.send({ data: JSON.stringify(obj) }); } catch (e) { queue.push(obj); }
}

// ---- 业务接口 ----
async function postRecord(record) {
  try { await http('/api/records', record); } catch (e) { /* 静默失败，不影响对局 */ }
}
async function reviveConfirm(scene) {
  return http('/api/revive/confirm', { scene });
}
async function createRoom(payload) {
  return http('/api/rooms', payload);
}
async function fetchLeaderboard(mode, level) {
  try { return await http('/api/leaderboard?mode=' + mode + '&level=' + level, {}, 'GET'); }
  catch (e) { return null; }
}

module.exports = {
  on, emit, http, ensureLogin, connect, send,
  postRecord, reviveConfirm, createRoom, fetchLeaderboard,
  getToken, setToken, setBase: (u) => { Config.SERVER_BASE = u; },
};
