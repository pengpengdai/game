// 客户端引擎模拟测试：mock tt API + 假 WebSocket
// 覆盖：AI 胜负/最高分/分享、胜利不被 AI 反超（回归）、看广告复活（服务端不可用→本地限次兜底）、
//      PVP 大厅→就绪→开局→打完→服务端判胜→再战
const storage = {};
let lastShare = null, cloudKv = null;
let adCloseCb = null;
let socketHandlers = {};

const fakeSocket = {
  sent: [],
  onOpen: (fn) => { socketHandlers.open = fn; },
  onMessage: (fn) => { socketHandlers.message = fn; },
  onClose: (fn) => { socketHandlers.close = fn; },
  onError: (fn) => { socketHandlers.error = fn; },
  send: (o) => { fakeSocket.sent.push(JSON.parse(o.data)); },
  close: () => {},
};
function inject(msg) { if (socketHandlers.message) socketHandlers.message({ data: JSON.stringify(msg) }); }
function fireOpen() { if (socketHandlers.open) socketHandlers.open(); }
function adComplete() { if (adCloseCb) adCloseCb({ isEnded: true }); }

global.tt = {
  createCanvas: () => null,
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2 }),
  onTouchStart: () => {}, onTouchEnd: () => {}, onTouchMove: () => {},
  showKeyboard: () => {}, hideKeyboard: () => {}, setKeyboardValue: () => {},
  onKeyboardInput: () => {}, onKeyboardConfirm: () => {}, onKeyboardComplete: () => {},
  getStorageSync: (k) => (storage[k] !== undefined ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  vibrateShort: () => {},
  shareAppMessage: (o) => { lastShare = o; },
  login: ({ success }) => success({ code: 'mock-code' }),
  getLaunchOptionsSync: () => ({}),
  onShow: () => {}, onHide: () => {},
  request: (opt) => {
    const u = opt.url.replace('https://your-domain.com', '');
    const respond = (body) => opt.success({ statusCode: 200, data: JSON.stringify(body) });
    const failReq = () => opt.fail({ errMsg: 'mock network down' });
    if (u.indexOf('/api/login') === 0) respond({ token: 'tok-1', user: { id: 1, nickname: 'T' } });
    else if (u.indexOf('/api/rooms') === 0 && opt.method === 'POST') respond({ roomId: 'R1' });
    else if (u.indexOf('/api/records') === 0) respond({ ok: true });
    else if (u.indexOf('/api/revive/confirm') === 0) failReq();   // 模拟服务端不可用 → 走本地限次
    else if (u.indexOf('/api/leaderboard') === 0) respond({ list: [], mine: null });
    else failReq();
  },
  connectSocket: () => fakeSocket,
  createRewardedVideoAd: () => ({
    load: () => Promise.resolve(),
    show: () => Promise.resolve(),
    onClose: (fn) => { adCloseCb = fn; },
    onError: () => {},
  }),
  setUserCloudStorage: (o) => { cloudKv = o.keyValueData; },
  getOpenDataContext: () => null,
  createInnerAudioContext: () => ({ src: '', loop: false, volume: 1, play: () => {}, stop: () => {} }),
  setInnerAudioOption: () => {},
  showToast: () => {},
};

const Game = require('../js/engine');
const Net = require('../js/net');
const G = Game.G;

// 与 game.js 一致：网络消息 → 引擎
['joined', 'peer_joined', 'peer_ready', 'game_start', 'peer_progress',
 'peer_finish', 'result', 'peer_left', 'peer_rematch', 'error'].forEach((type) => {
  Net.on(type, (data) => Game.onNet(type, data));
});

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
const tapAction = (action) => {
  const b = G.buttons.find((x) => x.action === action);
  if (!b) return false;
  Game.tap(b.x + 5, b.y + 5);
  return true;
};
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 10));
// 用真实帧步长推进
const advance = (sec) => { for (let i = 0; i < Math.ceil(sec / 0.05); i++) Game.update(0.05); };

async function main() {
  Game.bootstrap();

  // 1. AI 单机胜利 + 最高分 + 好友榜上报 + 分享
  Game.startAiGame('en', 'easy');
  const p1 = G.passage;
  for (let i = 0; i < p1.length; i++) Game.input(p1[i]);
  advance(2);   // 越过 1.2s 胜利延迟
  assert(G.state === 'RESULT' && G.result === 'win', 'AI 局打完 → 胜利结算');
  assert(Number(storage['tp_best']) === G.best && G.best > 0, '最高分已持久化: ' + G.best);
  assert(cloudKv && cloudKv[0] && cloudKv[0].key === 'best', '好友榜托管数据已上报');
  assert(tapAction('share') && lastShare && lastShare.title, '分享战绩可用');

  // 2. 回归：玩家胜利后 AI 不再反超（修复验证）
  Game.startAiGame('en', 'easy');
  G.aiSpeed = 1;   // 若 AI 在 1.2s 延迟内继续推进 → 会超过终点
  const p2 = G.passage;
  for (let i = 0; i < p2.length; i++) Game.input(p2[i]);
  advance(2);
  assert(G.result === 'win' && G.state === 'RESULT', '胜利延迟窗口内 AI 被冻结，结果不被反超');

  // 3. AI 失败 → 看广告复活（服务端不可用 → 本地限次兜底）
  Game.startAiGame('cn', 'normal');
  G.aiSpeed = 99999;
  advance(7);
  assert(G.state === 'RESULT' && G.result === 'lose', 'AI 先到 → 失败结算');
  assert(tapAction('revive'), '结算页出现「看广告复活」按钮');
  adComplete();
  await tick();   // 复活链路是 promise 链，等微任务落地
  assert(G.state === 'PLAY' && G.gameOver === false, '复活成功回到对局');
  assert(Math.abs(G.aiProgress - 0.6) < 0.01, '复活后 AI 进度回退 60%');
  const localKey = Object.keys(storage).find((k) => k.indexOf('tp_revive_') === 0);
  assert(!!localKey && Number(storage[localKey]) === 1, '本地限次计数生效（服务端不可用兜底）');

  // 4. PVP：建房 → 入房 → 就绪 → 开局 → 打完 → 服务端判胜 → 再战
  await Game.startPvpLobby();
  await tick();
  assert(G.state === 'LOBBY', '进入对战大厅（当前: ' + G.state + '）');
  fireOpen();
  await tick();
  assert(fakeSocket.sent.some((m) => m.type === 'join_room'), '已发送加入房间消息');
  inject({ type: 'joined', roomId: 'R1', opponent: { nickname: '好友' } });
  assert(G.pvp.peer.nickname === '好友', '大厅显示对手信息');
  assert(tapAction('ready'), '大厅有「就绪」按钮');
  inject({ type: 'peer_ready' });
  inject({ type: 'game_start', passage: 'practice makes perfect', mode: 'en', level: 'easy', seed: 1 });
  assert(G.state === 'PLAY' && G.passage === 'practice makes perfect', '收到开局文章（服务端下发）');
  const p4 = G.passage;
  for (let i = 0; i < p4.length; i++) Game.input(p4[i]);
  assert(G.playerFinished === true, '打完全文 → 等待服务端结果');
  assert(fakeSocket.sent.some((m) => m.type === 'finish'), '完成消息已上报服务端');
  inject({ type: 'result', win: true, stats: { score: 888 } });
  Game.update(0.05);
  assert(G.state === 'RESULT' && G.result === 'win', '服务端判胜 → 结算页');
  assert(tapAction('rematch'), '胜局可发起再战');
  assert(G.pvp.waitingRematch && fakeSocket.sent.some((m) => m.type === 'rematch'), '再战请求已发送');

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error('客户端测试异常:', e); process.exit(1); });
