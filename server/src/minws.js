/**
 * minws.js - 最小 WebSocket 服务端实现（RFC6455，零依赖）
 * 仅在环境中没有 'ws' 包时启用；生产环境推荐安装 ws。
 */
const crypto = require('crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

class MiniWebSocket {
  constructor(socket) {
    this.socket = socket;
    this._buf = [];
    this._onMessage = null;
    this._onClose = null;
    this._onError = null;
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => { if (this._onClose) this._onClose(); });
    socket.on('error', (e) => { if (this._onError) this._onError(e); });
  }
  on(type, fn) {
    if (type === 'message') this._onMessage = fn;
    else if (type === 'close') this._onClose = fn;
    else if (type === 'error') this._onError = fn;
  }
  _onData(chunk) {
    this._buf.push(chunk);
    let buf = Buffer.concat(this._buf);
    this._buf = [];
    for (;;) {
      if (buf.length < 2) { this._buf.push(buf); return; }
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) break; len = buf.readUInt32BE(2) * 2 ** 32 + buf.readUInt32BE(6); off = 10; }
      let mask = null;
      if (masked) { if (buf.length < off + 4) break; mask = buf.slice(off, off + 4); off += 4; }
      if (buf.length < off + len) break;
      const payload = Buffer.from(buf.slice(off, off + len));
      buf = buf.slice(off + len);
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      if (opcode === 0x9) { this._sendFrame(0xA, payload); continue; }   // ping -> pong
      if (opcode === 0x8) { try { this._sendFrame(0x8, payload); } catch (e) {} this.socket.end(); return; } // close
      if (opcode === 0x1 || opcode === 0x0) { if (this._onMessage) this._onMessage(payload.toString('utf8')); }
    }
    if (buf.length) this._buf.push(buf);
  }
  _sendFrame(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) { header = Buffer.alloc(2); header[0] = 0x80 | opcode; header[1] = len; }
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeUInt32BE(Math.floor(len / 2 ** 32), 2); header.writeUInt32BE(len >>> 0, 6); }
    this.socket.write(Buffer.concat([header, payload]));
  }
  send(data) { this._sendFrame(0x1, Buffer.from(data)); }
  close() { try { this._sendFrame(0x8, Buffer.alloc(0)); } catch (e) {} try { this.socket.end(); } catch (e) {} }
}

function attachMiniWs(server, onConnection) {
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key || req.url !== '/ws') { socket.destroy(); return; }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
    );
    onConnection(new MiniWebSocket(socket), req);
  });
}

module.exports = { attachMiniWs, MiniWebSocket };
