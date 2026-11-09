/**
 * app.js - 组装 HTTP + WebSocket
 * WS 优先使用 'ws' 包；未安装时自动回退内置 minws（零依赖可运行）。
 */
const http = require('http');
const db = require('./db');
const { createHub } = require('./hub');
const { createRoutes } = require('./routes');

function createApp() {
  const hub = createHub({ db });
  const handle = createRoutes({ db, hub });
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      try { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: 'INTERNAL', msg: String(e && e.message || e) })); } catch (err) {}
    });
  });

  let WebSocketServer = null;
  try { WebSocketServer = require('ws'); } catch (e) { WebSocketServer = null; }

  if (WebSocketServer && WebSocketServer.WebSocketServer) {
    const wss = new WebSocketServer.WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => hub.handleConnection(ws));
  } else {
    require('./minws').attachMiniWs(server, (ws) => hub.handleConnection(ws));
  }

  return { server, hub, db };
}

module.exports = { createApp };
