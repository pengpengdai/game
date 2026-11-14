// 布局几何测试：元素不越界、关键元素不重叠
const storage = {};
global.tt = {
  createCanvas: () => null,
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2 }),
  onTouchStart: () => {}, onTouchEnd: () => {}, onTouchMove: () => {},
  showKeyboard: () => {}, hideKeyboard: () => {}, setKeyboardValue: () => {},
  onKeyboardInput: () => {}, onKeyboardConfirm: () => {}, onKeyboardComplete: () => {},
  getStorageSync: (k) => (storage[k] === undefined ? '' : storage[k]),
  setStorageSync: (k, v) => { storage[k] = v; },
  vibrateShort: () => {}, shareAppMessage: () => {},
  login: ({ success }) => success({ code: 'c' }),
  getLaunchOptionsSync: () => ({}), onShow: () => {}, onHide: () => {},
  request: (o) => o.fail && o.fail({ errMsg: 'x' }),
  connectSocket: () => ({ onOpen: () => {}, onMessage: () => {}, onClose: () => {}, onError: () => {}, send: () => {}, close: () => {} }),
  createRewardedVideoAd: () => ({ load: () => Promise.resolve(), show: () => Promise.resolve(), onClose: () => {}, onError: () => {} }),
  setUserCloudStorage: () => {}, getOpenDataContext: () => null,
  createInnerAudioContext: () => ({ src: '', loop: false, volume: 1, play: () => {}, stop: () => {} }),
  setInnerAudioOption: () => {}, showToast: () => {},
};

const Game = require('../js/engine');
const G = Game.G;
const W = 375, H = 667;
const L = G.layout;

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
const R = (x, y, w, h) => ({ x, y, w, h });
const inside = (r) => r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= W + 0.5 && r.y + r.h <= H + 0.5;
const overlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
const pair = (a, b, name) => assert(!overlap(a, b), '不重叠：' + name);

Game.bootstrap();

// ---- 首页 ----
{
  const lh = L.home;
      // 各区间不重叠
  const rects = {
    brand: R(22, 40, W - 44, 44),
    bestCard: R(22, lh.bestY, W - 44, lh.bestH),
    modeBtns: R((W - (lh.modeBtnW * 2 + lh.modeGap)) / 2, lh.modeBtnY, lh.modeBtnW * 2 + lh.modeGap, lh.modeBtnH),
    levelBtns: R((W - (lh.levelBtnW * 3 + lh.levelGap * 2)) / 2, lh.levelBtnY, lh.levelBtnW * 3 + lh.levelGap * 2, lh.levelBtnH),
    startBtn: R(W / 2 - lh.startW / 2, lh.startY, lh.startW, lh.startH),
    pvpBtn: R(W / 2 - lh.pvpW / 2, lh.pvpY, lh.pvpW, lh.pvpH),
    lbBtns: R(W / 2 - lh.lbBtnW - 6, lh.lbBtnY, lh.lbBtnW * 2 + 12, lh.lbBtnH),
    sound: R(lh.soundX, lh.soundY, lh.soundW, lh.soundH),
  };
  Object.keys(rects).forEach((k) => assert(inside(rects[k]), '首页 ' + k + ' 在屏幕内'));
  pair(rects.brand, rects.bestCard, '品牌区 vs 成就卡');
  pair(rects.bestCard, rects.modeBtns, '成就卡 vs 语言');
  pair(rects.modeBtns, rects.levelBtns, '语言 vs 难度');
  pair(rects.levelBtns, rects.startBtn, '难度 vs 开始');
  pair(rects.startBtn, rects.pvpBtn, '开始 vs 好友对战');
  pair(rects.pvpBtn, rects.lbBtns, '好友对战 vs 榜单');
  // 榜单弹层
  const M = lh.lbModal;
  const modal = R(M.x, M.y, M.w, M.h);
  assert(inside(modal), '榜单弹层在屏幕内');
  assert(M.closeY + 44 <= 667, '榜单关闭按钮在屏幕内');
  // 所有首页按钮在屏幕内
  Game.startAiGame('en', 'easy'); Game.gotoHome();
  assert(G.buttons.every((b) => inside(R(b.x, b.y, b.w, b.h))), '首页按钮全部在屏幕内');
}

// ---- 对局页 ----
{
  Game.startAiGame('en', 'easy');
  const lp = L.play;
  const chipW = (lp.panelW - lp.statGap * 3) / 4;
  const head = R(lp.headX, lp.headY, lp.headW, lp.headH);
  const chips = R(lp.panelX, lp.statY, lp.panelW, lp.statH);
  const panel = R(lp.panelX, lp.panelY, lp.panelW, lp.panelH);
  assert(inside(head) && inside(chips) && inside(panel), '对局页 头卡/指标/文章卡 都在屏幕内');
  pair(head, chips, '头卡 vs 指标');
  pair(chips, panel, '指标 vs 文章卡');
  assert(panel.y + panel.h <= lp.kbTop + 0.5, '文章卡不压键盘区');
  assert(lp.panelH > 180, '文章卡高度充足: ' + Math.round(lp.panelH) + 'px');

  // 26 键
  G.kb.layout = 'q26'; Game.buildKeyboard();
  const k26 = G.kb.keys;
  assert(k26.length === 27, '26 键共 27 个键帽');
  assert(k26.every((k) => inside(R(k.x, k.y, k.w, k.h))), '26 键盘帽都在屏幕内');
  let ov = 0;
  for (let i = 0; i < k26.length; i++) for (let j = i + 1; j < k26.length; j++) {
    if (overlap(k26[i], k26[j])) ov++;
  }
  assert(ov === 0, '26 键盘帽互不重叠（重叠数 ' + ov + '）');

  // 9 键
  G.kb.layout = 'q9'; Game.buildKeyboard();
  const k9 = G.kb.keys;
  assert(k9.length === 9, '9 键共 9 个键帽');
  assert(k9.every((k) => inside(R(k.x, k.y, k.w, k.h))), '9 键盘帽都在屏幕内');
  ov = 0;
  for (let i = 0; i < k9.length; i++) for (let j = i + 1; j < k9.length; j++) if (overlap(k9[i], k9[j])) ov++;
  assert(ov === 0, '9 键盘帽互不重叠（重叠数 ' + ov + '）');
}

// ---- 开局弹框 ----
{
  Game.startAiGame('en', 'easy');
  const r = L.ready;
  const cardR = R(r.cardX, r.cardY, r.cardW, r.cardH);
  assert(inside(cardR), '弹框卡片在屏幕内');
  const optW = (r.cardW - r.optPad * 2 - r.optGap) / 2;
  const o1 = R(r.cardX + r.optPad, r.optY, optW, r.optH);
  const o2 = R(r.cardX + r.optPad + optW + r.optGap, r.optY, optW, r.optH);
  const start = R(r.cardX + r.optPad, r.startY, r.cardW - r.optPad * 2, r.startH);
  [o1, o2, start].forEach((x, i) => assert(inside(x), '弹框元素 ' + i + ' 在屏幕内'));
  pair(o1, o2, '9键 vs 26键');
  pair(o1, start, '选项 vs 开始');
  assert(start.y + start.h <= cardR.y + cardR.h, '开始按钮在卡片内');
  assert(r.optY > r.subY + 6, '选项区不与副标题重叠');
}

// ---- 结算页 ----
{
  Game.startAiGame('en', 'easy');
  G.state = 'RESULT'; G.result = 'win'; G.rank = 'B'; G.score = 1876;
  Game.buildResultButtons ? Game.buildResultButtons() : null;
  const r = L.result;
  const banner = R(22, r.bannerY - 40, W - 44, 110);
  const rank = R(W / 2 - r.rankR, r.rankY - r.rankR, r.rankR * 2, r.rankR * 2);
  const statCard = R(22, r.rankY + 58, W - 44, 126);
  const btns = R((W - (r.btnW * 3 + 12)) / 2, r.btnY, r.btnW * 3 + 12, r.btnH);
  [banner, rank, statCard, btns].forEach((x, i) => assert(inside(x), '结算元素 ' + i + ' 在屏幕内'));
  pair(banner, rank, '胜利卡 vs 段位');
  pair(rank, statCard, '段位 vs 数据卡');
  assert(statCard.y + statCard.h <= r.scoreY - 6, '数据卡与得分不重叠');
  assert(r.scoreY + 10 <= r.btnY, '得分与按钮不重叠');
  // 数据行在卡片内
  const lastRowY = r.statY + 3 * 26;
  assert(lastRowY < statCard.y + statCard.h - 8, '四行数据都在卡片内');
}

// ---- 大厅 ----
{
  Game.gotoHome();
  G.state = 'LOBBY'; G.gameMode = 'pvp'; G.pvp.roomId = 'R1X43Q8';
  G.pvp.peer = { nickname: '小明', avatar: '' };
  Game.pvpReady();
  const ll = L.lobby;
  const roomCard = R(22, ll.roomY - 34, W - 44, 86);
  assert(inside(roomCard), '房间卡在屏幕内');
  assert(G.buttons.every((b) => inside(R(b.x, b.y, b.w, b.h))), '大厅按钮在屏幕内');
  const btns = G.buttons.map((b) => R(b.x, b.y, b.w, b.h));
  let ov = 0;
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) if (overlap(btns[i], btns[j])) ov++;
  assert(ov === 0, '大厅按钮互不重叠（重叠数 ' + ov + '）');
  pair(roomCard, btns[0], '房间卡 vs 按钮');
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
