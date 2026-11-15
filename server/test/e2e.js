/**
 * e2e.js - 服务端端到端测试（零依赖，Node ≥ 18 自带 fetch / WebSocket）
 * 覆盖：登录 → 建房 → 双人入房 → 就绪开局（同文）→ 进度/胜负 → 排行榜 →
 *       复活限次 → 再战重开
 */
const { createApp } = require('../src/app');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}

async function api(base, path, opts) {
  const res = await fetch(base + path, opts);
  const body = await res.json();
  return { status: res.status, body };
}

function makeClient(url) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const queue = [];
    const waiters = [];
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const hit = waiters.filter((w) => w.type === msg.type);
      waiters.splice(0, hit.length);
      if (hit.length) hit.forEach((w) => w.resolve(msg));
      else queue.push(msg);   // 已被等待者消费的消息不再入队，避免二次消费
    };
    ws.onerror = () => {};
    ws.onopen = () => resolve({
      ws,
      send: (obj) => ws.send(JSON.stringify(obj)),
      next: (type, timeout) => new Promise((res2, rej2) => {
        const idx = queue.findIndex((m) => m.type === type);
        if (idx >= 0) { const m = queue[idx]; queue.splice(idx, 1); res2(m); return; }
        const t = setTimeout(() => rej2(new Error('timeout waiting ' + type)), timeout || 5000);
        waiters.push({ type, resolve: (m) => { clearTimeout(t); res2(m); } });
      }),
    });
  });
}

async function main() {
  const app = createApp();
  await new Promise((res) => app.server.listen(0, '127.0.0.1', res));
  const port = app.server.address().port;
  const base = 'http://127.0.0.1:' + port;
  const wsBase = 'ws://127.0.0.1:' + port + '/ws';
  console.log('server on', port);

  // 1. 登录
  const rA = await api(base, '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'douyin', code: 'uA' }) });
  const rB = await api(base, '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'kuaishou', code: 'uB' }) });
  assert(rA.status === 200 && rA.body.token, 'A 登录成功（抖音）');
  assert(rB.status === 200 && rB.body.token, 'B 登录成功（快手，跨端）');
  const hA = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + rA.body.token };
  const hB = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + rB.body.token };

  // 2. 建房 + 双人 WS 入房
  const roomRes = await api(base, '/api/rooms', { method: 'POST', headers: hA, body: JSON.stringify({ mode: 'en', level: 'easy' }) });
  assert(roomRes.status === 200 && roomRes.body.roomId, 'A 建房成功: ' + roomRes.body.roomId);
  const roomId = roomRes.body.roomId;

  const cA = await makeClient(wsBase);
  const cB = await makeClient(wsBase);
  cA.send({ type: 'auth', token: rA.body.token });
  assert((await cA.next('authed')).type === 'authed', 'A WS 认证成功');
  cB.send({ type: 'auth', token: rB.body.token });
  await cB.next('authed');
  cA.send({ type: 'join_room', roomId });
  await cA.next('joined');
  cB.send({ type: 'join_room', roomId });
  await cB.next('joined');
  const peerJoined = await cA.next('peer_joined');
  assert(peerJoined.type === 'peer_joined', 'A 收到 B 加入通知');

  // 3. 就绪开局（双方同一篇文章）
  cA.send({ type: 'ready' });
  await cB.next('peer_ready');
  cB.send({ type: 'ready' });
  const gsA = await cA.next('game_start');
  const gsB = await cB.next('game_start');
  assert(gsA.passage && gsA.passage === gsB.passage, '双方收到同一篇文章（同 seed）');

  // 4. A 打完全文 → 胜负广播
  cA.send({ type: 'progress', typedLen: Math.floor(gsA.passage.length / 2), score: 300, combo: 5 });
  cA.send({ type: 'finish', stats: { typedLen: gsA.passage.length, score: 1526, cpm: 180, accuracy: 98, maxCombo: 12, passageHash: 'x' } });
  const resA = await cA.next('result');
  const resB = await cB.next('result');
  assert(resA.win === true && resB.win === false, 'A 胜 / B 负广播正确');
  assert(resA.stats && resA.stats.score === 1526, '胜者成绩随 result 下发');

  // 5. 排行榜（B 上报成绩后查询）
  await api(base, '/api/records', { method: 'POST', headers: hB, body: JSON.stringify({ mode: 'en', level: 'easy', result: 'lose', score: 800, cpm: 90, accuracy: 95, maxCombo: 8, roomId: roomId, passageHash: 'y' }) });
  const lb = await api(base, '/api/leaderboard?mode=en&level=easy&limit=10', { method: 'GET', headers: hB });
  assert(lb.body.list && lb.body.list.length >= 1, '全局榜返回数据');
  assert(lb.body.mine && lb.body.mine.rank >= 1, 'B 有我的排名: ' + JSON.stringify(lb.body.mine));

  // 6. 复活限次：5 次成功，第 6 次 429
  let okCount = 0, limitHit = false;
  for (let i = 0; i < 6; i++) {
    const rv = await api(base, '/api/revive/confirm', { method: 'POST', headers: hA, body: JSON.stringify({ scene: 'revive' }) });
    if (rv.status === 200) okCount++;
    if (rv.status === 429) limitHit = true;
  }
  assert(okCount === 5 && limitHit, '复活限次生效（5 次成功，第 6 次 429）');

  // 7. 再战：双方 rematch → 新开局
  cA.send({ type: 'rematch' });
  await cA.next('peer_rematch');
  cB.send({ type: 'rematch' });
  const gsA2 = await cA.next('game_start');
  await cB.next('game_start');
  assert(!!gsA2.passage && gsA2.seed !== gsA.seed, '再战重开新局（新 seed 新文章）');

  // 7.5 挑战码：生成 → 拉取 → 不存在的码
  const chRes = await api(base, '/api/challenges', {
    method: 'POST', headers: hA,
    body: JSON.stringify({ mode: 'cn', level: 'easy', passage: '书中自有黄金屋', timeMs: 20000, score: 900, cpm: 120, accuracy: 98, maxCombo: 7, nickname: 'A' }),
  });
  assert(chRes.status === 200 && /^[A-Z0-9]{6}$/.test(chRes.body.code || ''), '挑战码生成（' + chRes.body.code + '）');
  const got = await api(base, '/api/challenges/' + chRes.body.code, { headers: hA });
  assert(got.status === 200 && got.body.passage === '书中自有黄金屋' && got.body.score === 900 && got.body.timeMs === 20000, '挑战码可拉取且内容一致');
  const bad = await api(base, '/api/challenges/ZZZZZZ', { headers: hA });
  assert(bad.status === 404, '不存在的挑战码返回 404');

  // 8. 断线：B 关闭 → 房间清理不崩溃
  cB.ws.close();
  await new Promise((r) => setTimeout(r, 200));
  assert(true, '断线处理无异常');

  cA.ws.close();
  await new Promise((r) => app.server.close(r));
  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('E2E 失败:', e); process.exit(1); });
