// 客户端引擎模拟测试：mock tt API + 假 WebSocket
// 覆盖：输入方式弹框、倒计时、自绘键盘(26键/9键)、AI 胜负、复活、PVP 全链路
const storage = {};
let lastShare = null, cloudKv = null;
let adCloseCb = null;
let kbSets = 0;   // 中文模式下 setKeyboardValue 调用次数（应为 0）
let lastClip = null;   // 剪贴板内容
const vib = { light: 0, heavy: 0 };   // 分级震动计数
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
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2, statusBarHeight: 20, safeArea: { top: 20, bottom: 647 } }),
  onTouchStart: () => {}, onTouchEnd: () => {}, onTouchMove: () => {},
  showKeyboard: () => {}, hideKeyboard: () => {}, setKeyboardValue: () => { kbSets++; },
  onKeyboardInput: () => {}, onKeyboardConfirm: () => {}, onKeyboardComplete: () => {},
  getStorageSync: (k) => (storage[k] !== undefined ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  vibrateShort: (o) => { if (o && o.type === 'light') vib.light++; else vib.heavy++; },
  setClipboardData: (o) => { lastClip = o && o.data; },
  shareAppMessage: (o) => { lastShare = o; },
  login: ({ success }) => success({ code: 'mock-code' }),
  getLaunchOptionsSync: () => ({}),
  onShow: () => {}, onHide: () => {},
  request: (opt) => {
    const u = opt.url.replace(/^https?:\/\/[^/]+/, '');
    const respond = (body) => opt.success({ statusCode: 200, data: JSON.stringify(body) });
    const failReq = () => opt.fail({ errMsg: 'mock network down' });
    if (u.indexOf('/api/login') === 0) respond({ token: 'tok-1', user: { id: 1, nickname: 'T' } });
    else if (u.indexOf('/api/rooms') === 0 && opt.method === 'POST') respond({ roomId: 'R1' });
    else if (u.indexOf('/api/records') === 0) respond({ ok: true });
    else if (u.indexOf('/api/challenges') === 0 && opt.method === 'POST') respond({ code: 'ABC123' });
    else if (u.indexOf('/api/challenges/') === 0) respond({
      code: 'ABC123', mode: 'cn', level: 'easy', passage: '书中自有黄金屋',
      timeMs: 20000, score: 900, cpm: 120, accuracy: 98, maxCombo: 7, nickname: '小明',
    });
    else if (u.indexOf('/api/revive/confirm') === 0) failReq();
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
const Config = require('../js/config');
const G = Game.G;

['joined', 'peer_joined', 'peer_ready', 'game_start', 'peer_progress',
 'peer_finish', 'result', 'peer_left', 'peer_rematch', 'error'].forEach((type) => {
  Net.on(type, (data) => Game.onNet(type, data));
});

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 10));
const tapAction = (action) => {
  const b = G.buttons.find((x) => x.action === action);
  if (!b) return false;
  Game.tap(b.x + 5, b.y + 5);
  return true;
};
const advance = (sec) => { for (let i = 0; i < Math.ceil(sec / 0.05); i++) Game.update(0.05); };

// 走完 READY → 倒计时 → PLAY
function startRace(layout) {
  if (layout && G.mode === 'en') tapAction('kb:' + layout);
  return tapAction('start_race');
}

async function main() {
  Game.bootstrap();

  // 1. 进入打字页：先弹输入方式选择，键盘不出现
  Game.startAiGame('en', 'easy');
  assert(G.state === 'READY', '进入打字页为 READY（弹输入方式选择）');
  assert(G.kb.visible === false, '未点开始前不显示键盘');
  assert(G.buttons.some((b) => b.action === 'kb:q9') && G.buttons.some((b) => b.action === 'kb:q26'), '弹框可选 9 键 / 26 键');

  // 2. 选 26 键 → 开始 → 倒计时 → 键盘出现
  gaming: {
    startRace('q26');
    assert(G.state === 'COUNTDOWN' && G.countdown === 2, '点开始 → 简单难度倒计时 2 秒（按配置）');
    advance(3.2);
    assert(G.state === 'PLAY', '倒计时结束进入 PLAY');
    assert(G.kb.visible === true, '开始后键盘出现');
    assert(G.kb.layout === 'q26' && G.kb.keys.length === 27, '26 键布局：26 字母 + 空格');
  }

  // 3. 自绘键盘点击可推进
  {
    const before = G.typedLen;
    const target = G.passage[before];
    const k = G.kb.keys.find((x) => x.type === 'char' && x.chars[0] === target);
    assert(!!k, '键盘上能找到下一个字符键：' + JSON.stringify(target));
    Game.tap(k.x + k.w / 2, k.y + k.h / 2);
    assert(G.typedLen === before + 1 && G.score > 0, '点键盘字符 → 推进并加分');
  }

  // 4. 切成 9 键：布局重建 + T9 连点循环
  {
    Game.startAiGame('en', 'easy');
    startRace('q9');
    advance(3.2);
    assert(G.kb.layout === 'q9' && G.kb.keys.length === 9, '9 键布局：8 组字母 + 空格');
    const before = G.typedLen;
    const target = G.passage[before];
    const k = G.kb.keys.find((x) => x.type === 't9' && x.chars.indexOf(target) >= 0);
    assert(!!k, '9 键能找到含目标字符的分组');
    let taps = 0;
    while (G.typedLen === before && taps < 5) { Game.tap(k.x + k.w / 2, k.y + k.h / 2); taps++; }
    assert(G.typedLen === before + 1 && taps <= 4, '9 键连点循环打到目标字符（' + taps + ' 次）');
  }

  // 5. AI 单机胜利 + 最高分 + 好友榜上报 + 分享
  Game.startAiGame('en', 'easy');
  startRace('q26');
  advance(3.2);
  const p1 = G.passage;
  for (let i = 0; i < p1.length; i++) Game.input(p1[i]);
  advance(2);
  assert(G.state === 'RESULT' && G.result === 'win', 'AI 局打完 → 胜利结算');
  assert(Number(storage['tp_best']) === G.best && G.best > 0, '最高分已持久化: ' + G.best);
  assert(cloudKv && cloudKv[0] && cloudKv[0].key === 'best', '好友榜托管数据已上报');
  assert(tapAction('share') && lastShare && lastShare.title, '分享战绩可用');
  assert(G.kb.visible === false, '结算后键盘收起');

  // 6. 回归：胜利延迟窗口内 AI 被冻结
  Game.startAiGame('en', 'easy');
  startRace('q26');
  advance(3.2);
  G.aiSpeed = 1;
  const p2 = G.passage;
  for (let i = 0; i < p2.length; i++) Game.input(p2[i]);
  advance(2);
  assert(G.result === 'win' && G.state === 'RESULT', '胜利延迟窗口内 AI 被冻结，结果不被反超');

  // 7. AI 失败 → 看广告复活
  Game.startAiGame('cn', 'normal');
  assert(G.state === 'READY' && G.buttons.length === 1 && G.buttons[0].action === 'start_race', '中文模式直接开始（系统输入法）');
  startRace();
  advance(3.2);
  assert(G.state === 'PLAY' && G.kb.visible === false, '中文模式用系统键盘，不显示自绘键盘');
  G.aiSpeed = 99999;
  advance(7);
  assert(G.state === 'RESULT' && G.result === 'lose', 'AI 先到 → 失败结算');
  assert(tapAction('revive'), '结算页出现「看广告复活」按钮');
  adComplete();
  await tick();
  assert(G.state === 'PLAY' && G.gameOver === false, '复活成功回到对局');
  assert(Math.abs(G.aiProgress - 0.6) < 0.01, '复活后 AI 进度回退 60%');
  const localKey = Object.keys(storage).find((k) => k.indexOf('tp_revive_') === 0);
  assert(!!localKey && Number(storage[localKey]) === 1, '本地限次计数生效（服务端不可用兜底）');

  // 8. PVP：建房 → 入房 → 就绪 → 开局(READY) → 开始 → 打完 → 服务端判胜 → 再战
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
  assert(G.state === 'READY' && G.passage === 'practice makes perfect', '收到开局文章 → READY（可与好友同步选键盘）');
  startRace('q26');
  advance(3.2);
  assert(G.state === 'PLAY', 'PVP 倒计时后开打');
  const p4 = G.passage;
  for (let i = 0; i < p4.length; i++) Game.input(p4[i]);
  assert(G.playerFinished === true, '打完全文 → 等待服务端结果');
  assert(fakeSocket.sent.some((m) => m.type === 'finish'), '完成消息已上报服务端');
  inject({ type: 'result', win: true, stats: { score: 888 } });
  Game.update(0.05);
  assert(G.state === 'RESULT' && G.result === 'win', '服务端判胜 → 结算页');
  assert(tapAction('rematch'), '胜局可发起再战');
  assert(G.pvp.waitingRematch && fakeSocket.sent.some((m) => m.type === 'rematch'), '再战请求已发送');

  // 9. 倒计时可配置（统一数值 / 按难度 / 0 跳过）
  Config.COUNTDOWN_SEC = 1;
  Game.startAiGame('en', 'easy');
  startRace('q26');
  assert(G.state === 'COUNTDOWN' && G.countdown === 1, '倒计时统一配置为 1 秒');
  advance(1.1);
  assert(G.state === 'PLAY', '1 秒后自动开打');

  Config.COUNTDOWN_SEC = { default: 3, easy: 2, hard: 5 };
  Game.startAiGame('en', 'easy');
  startRace('q26');
  assert(G.countdown === 2, '按难度配置：简单 2 秒');
  Game.startAiGame('en', 'hard');
  startRace('q26');
  assert(G.countdown === 5, '按难度配置：困难 5 秒');
  Game.startAiGame('cn', 'normal');
  startRace();
  assert(G.countdown === 3, '按难度配置：未配置的难度用 default 3 秒');

  Config.COUNTDOWN_SEC = 0;
  Game.startAiGame('en', 'easy');
  startRace('q26');
  assert(G.state === 'PLAY' && G.kb.visible === true, '配置为 0 → 跳过倒计时，键区直接可用');
  Config.COUNTDOWN_SEC = 3;

  // 10. 暂停：冻结 AI 与计时；恢复后计时不含暂停时长；暂停中可退出
  {
    Game.startAiGame('en', 'easy');
    startRace('q26');
    advance(3.2);
    assert(G.state === 'PLAY' && G.buttons.some((b) => b.action === 'pause'), 'AI 对局中有暂停按钮');
    G.aiSpeed = 0.04;
    advance(1);
    const aiBefore = G.aiProgress;
    const elBefore = G.elapsed;
    const pauseBtn = G.buttons.find((b) => b.action === 'pause');
    Game.tap(pauseBtn.x + 5, pauseBtn.y + 5);
    assert(G.state === 'PAUSED' && G.kb.visible === false, '点暂停 → PAUSED 且键盘隐藏');
    advance(3);
    assert(Math.abs(G.aiProgress - aiBefore) < 1e-9, '暂停期间 AI 冻结');
    assert(Math.abs(G.elapsed - elBefore) < 1e-9, '暂停期间计时冻结');
    const t0 = G.pause.total;
    await tick(150);
    const resumeBtn = G.buttons.find((b) => b.action === 'resume');
    Game.tap(resumeBtn.x + 5, resumeBtn.y + 5);
    assert(G.state === 'PLAY' && G.kb.visible === true, '点继续 → PLAY 且键盘恢复');
    assert(G.pause.total - t0 >= 100, '暂停时长被累计（' + Math.round(G.pause.total - t0) + 'ms）');
    advance(0.1);
    assert(G.elapsed < 0.1, '恢复后计时不含暂停时长: ' + G.elapsed.toFixed(2) + 's');
    Game.tap(G.buttons.find((b) => b.action === 'pause').x + 5, G.buttons.find((b) => b.action === 'pause').y + 5);
    Game.tap(G.buttons.find((b) => b.action === 'pause_home').x + 5, G.buttons.find((b) => b.action === 'pause_home').y + 5);
    assert(G.state === 'HOME', '暂停中退出 → 回首页');
  }

  // 11. 中文模式 PLAY 提供「唤起键盘」按钮
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);   // 全局配置 3 秒倒计时 + 余量
    assert(G.state === 'PLAY' && G.buttons.some((b) => b.action === 'kb_show'), '中文模式对局中有「唤起键盘」按钮（state=' + G.state + ', btns=' + JSON.stringify(G.buttons.map((b) => b.action)) + '）');
  }

  // 12. 中文带标点文章：标点自动跳过，不卡在标点位置（用户报告的 bug）
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '千里之行,始于足下';
    Game.input('千里之行');
    assert(G.typedLen === 5, '输入「千里之行」后逗号自动通过，停在「始」前（typedLen=' + G.typedLen + '）');
    Game.input('千里之行始于足下');   // 联想整句（无标点）一次上屏
    assert(G.playerFinished && G.typedLen === 9, '联想整句一次上屏可完成全文（typedLen=' + G.typedLen + ', finished=' + G.playerFinished + '）');
  }

  // 13. 中文联想带标点/句号：全部忽略仍能完成
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '千里之行,始于足下';
    Game.input('千里之行，始于足下。');   // 联想自带中文逗号 + 句号
    assert(G.playerFinished && G.typedLen === 9, '联想带标点整句可完成（typedLen=' + G.typedLen + '）');
    assert(G.totalKeys === 8 && G.score > 0, '只统计实际打的 8 个字（totalKeys=' + G.totalKeys + ', score=' + G.score + '）');
  }

  // 14. 中文打完正文后，文章末尾标点自动通过 → 完成
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '你好世界。';
    Game.input('你好世界');
    assert(G.playerFinished && G.typedLen === 5, '末尾句号自动通过并判完成（typedLen=' + G.typedLen + '）');
  }

  // 15. 英文模式标点不跳过（保持严格逐字比对；英文输入框每次清空，回调为新增片段）
  {
    Game.startAiGame('en', 'easy');
    startRace('q26');
    advance(3.2);
    G.passage = 'a b, c';
    Game.input('a'); Game.input(' '); Game.input('b'); Game.input(','); Game.input(' '); Game.input('c');
    assert(G.playerFinished && G.typedLen === 6, '英文标点正常匹配可完成（typedLen=' + G.typedLen + '）');

    Game.startAiGame('en', 'easy');
    startRace('q26');
    advance(3.2);
    G.passage = 'a b, c';
    Game.input('a'); Game.input(' '); Game.input('b');
    Game.input('x');   // 应匹配逗号却输入 x → 判错
    assert(G.typedLen === 3 && G.wrongKeys === 1, '英文多打判错，标点严格（typedLen=' + G.typedLen + ', wrongKeys=' + G.wrongKeys + '）');
  }

  // 16. 输入法拼音残留 → 上屏改写：不误判、可继续推进（用户报告场景的真实现场）
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '千里之行,始于足下';
    Game.input('qianlizhixing');           // 第一个词的拼音
    assert(G.typedLen === 0, '纯拼音阶段不推进（typedLen=' + G.typedLen + '）');
    Game.input('千里之行');                 // 上屏
    assert(G.typedLen === 5, '上屏后推进到逗号之后（typedLen=' + G.typedLen + '）');
    Game.input('千里之行shiyuzuxia');        // 第二个词的拼音（输入框累积拼音）
    assert(G.typedLen === 5, '后续拼音不误推进、不误判错（typedLen=' + G.typedLen + '）');
    Game.input('千里之行始于足下');            // 拼音被改写为汉字上屏
    assert(G.playerFinished && G.typedLen === 9, '上屏改写后仍能正确完成（typedLen=' + G.typedLen + ', finished=' + G.playerFinished + '）');
  }

  // 17. 用户报告场景：拼音与汉字混排上屏，光标不能卡在「自」
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '书中自有黄金屋';
    kbSets = 0;
    Game.input('shu');
    assert(G.typedLen === 0 && kbSets === 0, '拼音阶段不推进、不清空输入框（typedLen=' + G.typedLen + ', kbSets=' + kbSets + '）');
    Game.input('书中');
    assert(G.typedLen === 2, '上屏「书中」→ 光标到「自」（typedLen=' + G.typedLen + '）');
    Game.input('书中ziyouhuangjinwu');
    assert(G.typedLen === 2 && kbSets === 0, '混排拼音当噪声，不推进也不清空（typedLen=' + G.typedLen + ', kbSets=' + kbSets + '）');
    Game.input('书中自有you黄金屋');
    assert(G.playerFinished && G.typedLen === 7, '混排上屏仍能打到「黄金屋」并完成（typedLen=' + G.typedLen + ', finished=' + G.playerFinished + '）');
    assert(kbSets === 0, '中文模式全程未调用 setKeyboardValue（不打断输入法）');
  }

  // 18. 输入框被系统清空后，继续从当前位置打（尾对齐）
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '书中自有黄金屋';
    Game.input('书中自有');
    assert(G.typedLen === 4, '打到「有」后进度正确（typedLen=' + G.typedLen + '）');
    Game.input('黄金屋');
    assert(G.playerFinished && G.typedLen === 7, '输入框被清空后继续打也能完成（typedLen=' + G.typedLen + '）');
  }

  // 19. AI 人格 + 里程碑 + 最后一击 + 速度曲线
  {
    Game.startAiGame('cn', 'hard');
    assert(G.aiRole && G.aiRole.name === '竞赛选手阿May', '困难档 AI 人格正确（' + (G.aiRole && G.aiRole.name) + '）');
    Game.startAiGame('cn', 'easy');
    assert(G.aiRole.name === '键盘侠小王', '简单档 AI 人格正确（' + G.aiRole.name + '）');

    startRace();
    advance(3.2);
    G.passage = '书中自有黄金屋';
    Game.input('书中');
    assert(G.fx.milestone && G.fx.milestone.text.indexOf('25%') === 0, '25% 里程碑触发（' + (G.fx.milestone && G.fx.milestone.text) + '）');
    Game.input('书中自');
    Game.input('书中自有');
    assert(G.milestoneDone[50] === true, '50% 里程碑只播一次');
    advance(0.85);
    assert(G.curve.length >= 1 && G.curve[G.curve.length - 1].me === 4, '速度曲线已采样（点=' + G.curve.length + '）');
    Game.input('书中自有黄金屋');
    assert(G.fx.finisherAt > 0, '最后一击触发（finisherAt=' + G.fx.finisherAt + '）');
  }

  // 20. 挑战码：结束页生成 → 复制 → 输入码开局 → 按分数判胜负
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '书中自有黄金屋';
    Game.input('书中自有黄金屋');
    advance(2);
    assert(G.state === 'RESULT', '打完进入结算（state=' + G.state + '）');
    tapAction('make_challenge');
    await new Promise((r) => setTimeout(r, 0));
    console.log('   … 挑战码：', G.modal && G.modal.code);
    assert(!!(G.modal && G.modal.code === 'ABC123'), '生成挑战码（' + (G.modal && G.modal.code) + '）');
    assert(G.buttons.some((b) => b.action === 'code_copy'), '弹窗有复制按钮');
    tapAction('code_copy');
    assert(lastClip === 'ABC123', '挑战码已复制到剪贴板');
    tapAction('code_close');
    assert(G.modal === null && G.state === 'RESULT', '关闭弹窗回到结算');

    Game.gotoHome();
    Game.openChallengeInput();
    assert(G.codeMode === true, '进入挑战码输入态');
    Game.submitChallengeCode('abc123');
    await new Promise((r) => setTimeout(r, 0));
    assert(G.state === 'READY' && G.challenge && G.challenge.score === 900, '拉取挑战并进入就绪（state=' + G.state + ', 目标=' + (G.challenge && G.challenge.score) + '）');
    assert(Math.abs(G.aiSpeed - 1 / 20) < 0.01, '幽灵对手按好友用时推进（speed=' + G.aiSpeed.toFixed(3) + '）');
    assert(G.passage === '书中自有黄金屋', '使用挑战码里的文章');

    startRace();
    advance(3.2);
    Game.input('书中自有黄金屋');
    assert(G.playerFinished && G.result === 'lose', '分数低于好友记录 → 判负（result=' + G.result + '）');
  }

  // 21. 体感：GO 动画 / 分数飘字 / 分级震动 / 被反超反馈 / 今日最佳
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    assert(G.fx.goAt > 0, '开局 GO 动画触发');
    G.passage = '书中自有黄金屋书中自有颜如玉';
    vib.light = 0; vib.heavy = 0;
    Game.input('书');
    assert(G.fx.floats.length >= 1 && G.fx.floats[0].text.charAt(0) === '+', '打对出现分数飘字（' + G.fx.floats[0].text + '）');

    // 打满 10 字 → 一次轻震
    let acc = '书';
    const rest = G.passage.slice(1);
    for (let i = 0; i < rest.length; i++) { acc += rest[i]; Game.input(acc); }
    assert(vib.light >= 1, '每 10 字轻震一次（' + vib.light + ' 次）');
    assert(vib.heavy === 0, '全对不触发重震');
  }

  // 22. 被反超：重震 + 红色脉冲
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '书中自有黄金屋';
    vib.heavy = 0;
    G.aiProgress = 0.35;
    G.typedLen = 0;
    advance(0.1);
    assert(G.fx.chaseAt > 0 && vib.heavy >= 1, '被反超触发重震（heavy=' + vib.heavy + '）');
    assert(G.fx.pulseAt > 0 && G.fx.pulseColor === '225,72,63', '被反超触发红色脉冲');
  }

  // 23. 今日最佳 CPM 落盘
  {
    G.todayBest = 0;
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    G.passage = '书中自有黄金屋';
    G.startedAt = Date.now() - 20000;   // 模拟打了 20 秒
    Game.input('书中自有黄金屋');
    advance(2);
    assert(G.state === 'RESULT' && G.cpm > 0, '结算 CPM 正常（' + G.cpm + '）');
    assert(G.todayBest === G.cpm, '今日最佳已更新为本次 CPM（' + G.todayBest + '）');
  }

  // 24. 重复片段文章：不能因为尾对齐误判而跳字
  {
    Game.startAiGame('cn', 'easy');
    startRace();
    advance(3.2);
    const p2 = '书中自有黄金屋书中自有颜如玉';
    G.passage = p2;
    let acc = '';
    for (let i = 0; i < 8; i++) { acc += p2[i]; Game.input(acc); }
    assert(G.typedLen === 8, '重复片段不跳字（typedLen=' + G.typedLen + '，应为 8）');
    assert(G.wrongKeys === 0, '重复片段不误判错（wrongKeys=' + G.wrongKeys + '）');
    for (let i = 8; i < p2.length; i++) { acc += p2[i]; Game.input(acc); }
    assert(G.playerFinished && G.typedLen === p2.length, '重复片段文章可正常打完（typedLen=' + G.typedLen + '）');
  }

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error('客户端测试异常:', e); process.exit(1); });
