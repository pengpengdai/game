/**
 * engine.js - 核心逻辑（AI 单机 + 好友对战 PVP + 复活/减速/再战 + 排行榜上报）
 * 状态机：HOME → (AI) PLAY → RESULT
 *         HOME → LOBBY → PLAY → RESULT（PVP）
 */
const Platform = require('./platform');
const Words = require('./words');
const Net = require('./net');
const Audio = require('./audio');
const Ad = require('./ad');
const Config = require('./config');

const sys = Platform.getSystemInfoSync();
const W = sys.windowWidth || 375;
const H = sys.windowHeight || 667;

const AI_TIME = { easy: 25, normal: 32, hard: 42 };
const BEST_KEY = 'tp_best';
const REVIVE_DAY_LIMIT = 5;
const PVP_REPORT_GAP = 120;   // 进度上报间隔 ms

const RANK_EN = [[300, 'S'], [225, 'A'], [150, 'B'], [100, 'C'], [0, 'D']];
const RANK_CN = [[120, 'S'], [90, 'A'], [60, 'B'], [36, 'C'], [0, 'D']];

const LAYOUT = {
  W: W, H: H,
  home: {
    titleY: 78, subY: 112,
    modeLabelY: 150, modeBtnY: 178, modeBtnW: 130, modeBtnH: 46, modeGap: 16,
    levelLabelY: 246, levelBtnY: 274, levelBtnW: 100, levelBtnH: 46, levelGap: 12,
    bestY: 336,
    startY: 366, startW: 240, startH: 52,
    pvpY: 428, pvpW: 240, pvpH: 52,
    lbBtnY: 492, lbBtnW: 110, lbBtnH: 40,
    winY: 548, winH: 108,
    soundX: W - 76, soundY: 18, soundW: 64, soundH: 30,
  },
  lobby: {
    titleY: 110, roomY: 160, statusY: 205,
    btnY: 300, btnW: 130, btnH: 50,
  },
  play: {
    statY: 24, statH: 52, statGap: 8,
    trackY: 94, laneH: 32, laneGap: 10, finishX: W - 30,
    comboY: 178,
    panelX: 20, panelY: 202, panelW: W - 40, panelH: 190,
    echoY: H - 128, echoH: 50, hintY: H - 64,
  },
  result: {
    bannerY: 100, rankY: 196, rankR: 48,
    statY: 286, scoreY: 396, btnY: 444, btnW: 110, btnH: 48,
  },
};

const G = {
  state: 'HOME', gameMode: 'ai', mode: 'cn', level: 'easy',
  passage: '', typedLen: 0, totalKeys: 0, wrongKeys: 0,
  score: 0, combo: 0, maxCombo: 0, elapsed: 0, cpm: 0, accuracy: 100, rank: 'D',
  aiProgress: 0, aiSpeed: 0, aiFinished: false, gameOver: false,
  playerFinished: false, result: null, overDelay: 0, flash: 0, lastValue: '',
  best: 0, buttons: [], startedAt: 0, touchStart: null, layout: LAYOUT,
  pvp: {
    roomId: '', peer: { nickname: '', avatar: '' }, ready: false, peerReady: false,
    peerTypedLen: 0, peerScore: 0, peerCombo: 0, peerFinished: false,
    waitingRematch: false, lastReportAt: 0, peerLeft: false,
  },
  reviveUsed: false, slowUsed: false, aiPauseUntil: 0,
  slowBtn: null,
  lb: { showFriend: false, showGlobal: false, globalList: [], mine: null },
  soundOn: true,
  pendingJoinRoom: '',
  odReady: false, odPosted: false,
};

function rankFor(mode, cpm) {
  const table = mode === 'en' ? RANK_EN : RANK_CN;
  for (let i = 0; i < table.length; i++) if (cpm >= table[i][0]) return table[i][1];
  return 'D';
}
function setButtons(list) { G.buttons = list; }

// ========== 界面按钮 ==========
function buildHomeButtons() {
  const L = LAYOUT.home;
  const x0 = (W - (L.modeBtnW * 2 + L.modeGap)) / 2;
  const lx0 = (W - (L.levelBtnW * 3 + L.levelGap * 2)) / 2;
  const cx = W / 2;
  setButtons([
    { x: x0, y: L.modeBtnY, w: L.modeBtnW, h: L.modeBtnH, label: '中文', action: 'mode:cn', active: G.mode === 'cn' },
    { x: x0 + L.modeBtnW + L.modeGap, y: L.modeBtnY, w: L.modeBtnW, h: L.modeBtnH, label: '英文', action: 'mode:en', active: G.mode === 'en' },
    { x: lx0, y: L.levelBtnY, w: L.levelBtnW, h: L.levelBtnH, label: '简单', action: 'level:easy', active: G.level === 'easy' },
    { x: lx0 + L.levelBtnW + L.levelGap, y: L.levelBtnY, w: L.levelBtnW, h: L.levelBtnH, label: '普通', action: 'level:normal', active: G.level === 'normal' },
    { x: lx0 + (L.levelBtnW + L.levelGap) * 2, y: L.levelBtnY, w: L.levelBtnW, h: L.levelBtnH, label: '困难', action: 'level:hard', active: G.level === 'hard' },
    { x: cx - L.startW / 2, y: L.startY, w: L.startW, h: L.startH, label: '开始比赛（AI）', action: 'start', primary: true },
    { x: cx - L.pvpW / 2, y: L.pvpY, w: L.pvpW, h: L.pvpH, label: '好友对战', action: 'pvp', secondary: true },
    { x: cx - L.lbBtnW - 6, y: L.lbBtnY, w: L.lbBtnW, h: L.lbBtnH, label: '好友榜', action: 'lb_friend', active: G.lb.showFriend },
    { x: cx + 6, y: L.lbBtnY, w: L.lbBtnW, h: L.lbBtnH, label: '全局榜', action: 'lb_global', active: G.lb.showGlobal },
    { x: L.soundX, y: L.soundY, w: L.soundW, h: L.soundH, label: G.soundOn ? '音效:开' : '音效:关', action: 'sound', small: true },
  ]);
}

function buildLobbyButtons() {
  const L = LAYOUT.lobby;
  const btns = [];
  if (G.gameMode === 'pvp' && G.pvp.roomId) btns.push({ label: '邀请好友', action: 'invite', primary: true });
  if (!G.pvp.ready) btns.push({ label: '就绪', action: 'ready', primary: true });
  btns.push({ label: '离开', action: 'leave' });
  const totalW = btns.length * L.btnW + Math.max(0, btns.length - 1) * 12;
  const x0 = (W - totalW) / 2;
  const list = btns.map((b, i) => ({
    x: x0 + i * (L.btnW + 12), y: L.btnY, w: L.btnW, h: L.btnH,
    label: b.label, action: b.action, primary: !!b.primary,
  }));
  setButtons(list);
}

function buildResultButtons() {
  const L = LAYOUT.result;
  const totalW = L.btnW * 3 + 12;
  const x0 = (W - totalW) / 2;
  const mk = (i, label, action, primary) => ({
    x: x0 + i * (L.btnW + 6), y: L.btnY, w: L.btnW, h: L.btnH, label, action, primary: !!primary,
  });
  const win = G.result === 'win';
  if (G.gameMode === 'ai') {
    if (!win) setButtons([mk(0, '看广告复活', 'revive', true), mk(1, '再来一局', 'again'), mk(2, '返回首页', 'home')]);
    else setButtons([mk(0, '再来一局', 'again', true), mk(1, '分享战绩', 'share'), mk(2, '返回首页', 'home')]);
  } else {
    if (G.pvp.waitingRematch) {
      setButtons([{ x: W / 2 - L.btnW / 2, y: L.btnY, w: L.btnW, h: L.btnH, label: '返回首页', action: 'home' }]);
    } else if (!win) {
      setButtons([mk(0, '看广告再战', 'rematch', true), mk(1, '返回首页', 'home'), mk(2, '分享战绩', 'share')]);
    } else {
      setButtons([mk(0, '再来一局', 'rematch', true), mk(1, '分享战绩', 'share'), mk(2, '返回首页', 'home')]);
    }
  }
}

// ========== 流程 ==========
function bootstrap() {
  try { G.best = Number(Platform.getStorageSync(BEST_KEY)) || 0; } catch (e) { G.best = 0; }
  G.soundOn = Platform.getStorageSync('tp_sound_on') !== '0';
  buildHomeButtons();
  handleLaunchOptions(Platform.getLaunchOptionsSync());
}

function handleLaunchOptions(opts) {
  if (!opts || !opts.query) return;
  const roomId = opts.query.roomId;
  if (roomId) G.pendingJoinRoom = String(roomId);
}

function gotoHome() {
  G.state = 'HOME';
  G.gameMode = 'ai';
  G.pvp.waitingRematch = false;
  buildHomeButtons();
  Platform.hideKeyboard();
  Audio.play('click');
}

// ---- AI 单机 ----
function startAiGame(mode, level) {
  G.gameMode = 'ai';
  G.mode = mode; G.level = level;
  resetRound();
  G.passage = Words.pick(mode, level);
  G.aiSpeed = G.passage.length / AI_TIME[level];
  G.state = 'PLAY';
  G.buttons = [];
  G.slowBtn = null;
  openKeyboard();
}

function resetRound() {
  G.typedLen = 0; G.totalKeys = 0; G.wrongKeys = 0; G.score = 0;
  G.combo = 0; G.maxCombo = 0; G.flash = 0; G.elapsed = 0;
  G.cpm = 0; G.accuracy = 100; G.rank = 'D';
  G.aiProgress = 0; G.aiFinished = false; G.gameOver = false;
  G.playerFinished = false; G.result = null; G.overDelay = 0;
  G.lastValue = '';
  G.reviveUsed = false; G.slowUsed = false; G.aiPauseUntil = 0;
  G.pvp.peerTypedLen = 0; G.pvp.peerScore = 0; G.pvp.peerCombo = 0;
  G.pvp.peerFinished = false; G.pvp.peerLeft = false;
  G.startedAt = Date.now();
}

function openKeyboard() {
  Platform.showKeyboard({
    defaultValue: '', maxLength: 200, multiple: true,
    confirmHold: G.mode === 'cn', confirmType: 'done',
  });
}

// ---- PVP ----
async function startPvpLobby() {
  Audio.play('click');
  G.gameMode = 'pvp';
  G.mode = G.mode; G.level = G.level;
  G.state = 'LOBBY';
  G.pvp.ready = false; G.pvp.peerReady = false;
  G.pvp.peer = { nickname: '', avatar: '' };
  G.pvp.waitingRematch = false;
  G.buttons = [];
  try {
    await Net.ensureLogin();
    const res = await Net.createRoom({ mode: G.mode, level: G.level });
    G.pvp.roomId = res.roomId;
    Net.connect();
    Net.send({ type: 'join_room', roomId: res.roomId });
    buildLobbyButtons();
  } catch (e) {
    Platform.showToast('服务器未配置或网络不可用');
    gotoHome();
  }
}

function pvpJoin(roomId) {
  Audio.play('click');
  G.gameMode = 'pvp';
  G.state = 'LOBBY';
  G.pvp.roomId = roomId;
  G.pvp.ready = false; G.pvp.peerReady = false;
  G.pvp.peer = { nickname: '', avatar: '' };
  G.pvp.waitingRematch = false;
  G.buttons = [];
  Net.ensureLogin().then(() => {
    Net.connect();
    Net.send({ type: 'join_room', roomId: roomId });
  }).catch(() => Platform.showToast('登录失败'));
}

function pvpReady() {
  if (G.pvp.ready) return;
  G.pvp.ready = true;
  Net.send({ type: 'ready' });
  Audio.play('click');
  buildLobbyButtons();
}

function pvpLeave() {
  Net.send({ type: 'leave' });
  gotoHome();
}

function pvpRequestRematch() {
  if (G.pvp.waitingRematch) return;
  G.pvp.waitingRematch = true;
  Net.send({ type: 'rematch' });
  Audio.play('click');
  buildResultButtons();
  Platform.showToast('已请求再战，等待对手…');
}

// ========== 网络消息 ==========
function onNet(type, data) {
  data = data || {};
  switch (type) {
    case 'joined':
      if (G.state === 'LOBBY') {
        G.pvp.peer = data.opponent || { nickname: '', avatar: '' };
        G.pvp.roomId = data.roomId || G.pvp.roomId;
        buildLobbyButtons();
      }
      break;
    case 'peer_joined':
      if (G.state === 'LOBBY') {
        G.pvp.peer = data.opponent || G.pvp.peer;
        buildLobbyButtons();
        Audio.play('click');
      }
      break;
    case 'peer_ready':
      G.pvp.peerReady = true;
      if (G.state === 'LOBBY') buildLobbyButtons();
      Audio.play('click');
      break;
    case 'game_start':
      G.mode = data.mode || G.mode;
      G.level = data.level || G.level;
      G.passage = data.passage || '';
      resetRound();
      G.state = 'PLAY';
      G.buttons = [];
      G.slowBtn = null;
      G.pvp.waitingRematch = false;
      openKeyboard();
      Audio.play('click');
      break;
    case 'peer_progress':
      G.pvp.peerTypedLen = data.typedLen || 0;
      G.pvp.peerScore = data.score || 0;
      G.pvp.peerCombo = data.combo || 0;
      break;
    case 'peer_finish':
      G.pvp.peerFinished = true;
      break;
    case 'result':
      G.result = data.win ? 'win' : 'lose';
      finishRound(data.stats, data.opponentStats);
      break;
    case 'peer_left':
      if (G.state === 'LOBBY') {
        Platform.showToast('好友已离开');
        gotoHome();
      } else if (G.state === 'PLAY' && !G.result) {
        G.result = 'win';
        finishRound(null, null);
      }
      break;
    case 'peer_rematch':
      Platform.showToast('对手已同意，准备开始！');
      G.pvp.waitingRematch = false;
      break;
    case 'error':
      Platform.showToast(data.msg || '请求失败');
      if (G.state === 'LOBBY') gotoHome();
      break;
    default: break;
  }
}

// ========== 输入 ==========
function input(value) {
  if (G.state !== 'PLAY') return;
  if (G.gameMode === 'ai' && G.gameOver) return;
  if (G.gameMode === 'pvp' && G.playerFinished) return;
  if (!value) return;
  G.lastValue = value;

  if (G.mode === 'cn' && /^[a-zA-Z]+$/.test(value)) return;

  const pass = G.passage;
  let adv = 0, extra = 0;
  for (let i = 0; i < value.length; i++) {
    const idx = G.typedLen + i;
    if (idx < pass.length) {
      if (value[i] === pass[idx]) adv++;
      else { extra = value.length - i; break; }
    } else extra++;
  }

  if (extra > 0) {
    G.wrongKeys += extra;
    G.combo = 0;
    G.flash = 0.5;
    Platform.vibrateShort();
    Audio.play('error');
    Platform.setKeyboardValue('');
    return;
  }

  if (adv > 0) {
    G.typedLen += adv;
    G.totalKeys += adv;
    G.combo += adv;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    G.score += adv * (10 + Math.min(G.combo, 50));
    Audio.play('tick');
    if (G.combo >= 5 && G.combo % 5 === 0) Audio.play('combo');
    if (G.mode === 'en') Platform.setKeyboardValue('');

    if (G.gameMode === 'pvp') reportProgress();

    if (G.typedLen >= pass.length) {
      if (G.gameMode === 'ai') {
        G.playerFinished = true;
        G.result = 'win';
        G.overDelay = 1.2;
        Audio.play('win');
        Platform.hideKeyboard();
      } else {
        G.playerFinished = true;
        Net.send({ type: 'finish', stats: buildStats() });
        G.waitResultUntil = Date.now() + 6000; // 兜底：等结果超时判胜
      }
    }
  }
}

function buildStats() {
  return {
    typedLen: G.typedLen, score: G.score, combo: G.maxCombo,
    cpm: G.typedLen / (Math.max(G.elapsed, 1 / 60) / 60),
    accuracy: (G.totalKeys + G.wrongKeys) > 0
      ? Math.round(G.totalKeys / (G.totalKeys + G.wrongKeys) * 100) : 100,
    maxCombo: G.maxCombo, passageHash: Words.hashPassage(G.passage),
  };
}

function reportProgress() {
  const now = Date.now();
  if (now - G.pvp.lastReportAt < PVP_REPORT_GAP) return;
  G.pvp.lastReportAt = now;
  Net.send({ type: 'progress', typedLen: G.typedLen, score: G.score, combo: G.combo });
}

function confirmClear() {
  if (G.state === 'PLAY') Platform.setKeyboardValue('');
}

// ========== 复活 / 减速 / 再战 ==========
function doRevive() {
  G.state = 'PLAY';
  G.gameOver = false;
  G.aiFinished = false;
  G.aiProgress = 0.6;   // AI 回退到 60%
  G.overDelay = 0;
  G.reviveUsed = true;
  G.buttons = [];
  openKeyboard();
  Audio.play('click');
  Platform.showToast('复活成功，加油！');
}

function reviveAi() {
  Ad.show(Config.AD_REVIVE, (ok) => {
    if (!ok) return;
    Net.reviveConfirm('revive').then(() => doRevive()).catch(() => {
      // 服务端不可用 → 本地每日限次兜底
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const key = 'tp_revive_' + today;
      const cnt = Number(Platform.getStorageSync(key)) || 0;
      if (cnt >= REVIVE_DAY_LIMIT) { Platform.showToast('今日复活次数已用完'); return; }
      Platform.setStorageSync(key, cnt + 1);
      doRevive();
    });
  });
}

function slowAi() {
  if (G.slowUsed) return;
  Ad.show(Config.AD_SLOW, (ok) => {
    if (!ok) return;
    G.slowUsed = true;
    G.aiPauseUntil = Date.now() + 5000;
    G.slowBtn = null;
    Net.reviveConfirm('slow_down').catch(() => {});
    Platform.showToast('对手暂停 5 秒！');
  });
}

function rematchPvp() {
  const needAd = G.result === 'lose';
  const doSend = () => {
    G.pvp.waitingRematch = true;
    Net.send({ type: 'rematch' });
    buildResultButtons();
    Platform.showToast('已请求再战，等待对手…');
  };
  if (!needAd) { doSend(); return; }
  Ad.show(Config.AD_REMATCH, (ok) => {
    if (!ok) return;
    Net.reviveConfirm('rematch').then(() => doSend()).catch(() => doSend());
  });
}

// ========== 每帧更新 ==========
function update(dt) {
  if (G.flash > 0) G.flash -= dt;

  if (G.state === 'PLAY') {
    G.elapsed = (Date.now() - G.startedAt) / 1000;

    if (G.gameMode === 'ai') {
      if (!G.gameOver && !G.playerFinished) {
        const paused = G.slowUsed && Date.now() < G.aiPauseUntil;
        if (!paused) {
          G.aiProgress = Math.min(1, G.aiProgress + G.aiSpeed * dt);
          if (G.aiProgress >= 1) {
            G.gameOver = true;
            G.result = 'lose';
            G.overDelay = 1.2;
            Audio.play('lose');
            Platform.hideKeyboard();
          }
        }
        // 对手接近终点 → 出现减速广告按钮
        if (!G.slowUsed && G.aiProgress >= 0.8 && !G.slowBtn && !G.gameOver && !G.playerFinished) {
          G.slowBtn = { x: W / 2 - 110, y: LAYOUT.play.trackY + LAYOUT.play.laneH * 2 + LAYOUT.play.laneGap + 10, w: 220, h: 34, label: '看广告让对手暂停 5 秒' };
        }
      }
      if (G.overDelay > 0) {
        G.overDelay -= dt;
        if (G.overDelay <= 0) finishRound(null, null);
      }
    } else {
      // PVP：打完等结果兜底
      if (G.playerFinished && !G.result && Date.now() > (G.waitResultUntil || 0)) {
        G.result = 'win';
        finishRound(buildStats(), null);
      }
    }
  }
}

// ========== 结算 ==========
function finishRound(myStats, peerStats) {
  const mins = Math.max(G.elapsed, 1 / 60) / 60;
  G.cpm = Math.round(G.typedLen / mins);
  G.accuracy = (G.totalKeys + G.wrongKeys) > 0
    ? Math.round(G.totalKeys / (G.totalKeys + G.wrongKeys) * 100) : 100;
  G.rank = rankFor(G.mode, G.cpm);
  G.state = 'RESULT';

  const isNewBest = G.score > G.best;
  if (isNewBest) {
    G.best = G.score;
    Platform.setStorageSync(BEST_KEY, G.best);
    // 好友榜托管数据 + 通知开放数据域刷新
    try {
      Platform.setUserCloudStorage([{ key: 'best', value: JSON.stringify({ score: G.score, cpm: G.cpm, ts: Date.now() }) }]);
      refreshOpenData();
    } catch (e) {}
  }

  if (G.gameMode === 'ai') Audio.play(G.result === 'win' ? 'win' : 'lose');
  else Audio.play(G.result === 'win' ? 'win' : 'lose');

  // 成绩上报（服务端排行榜）
  Net.postRecord({
    mode: G.mode, level: G.level, result: G.result,
    score: G.score, cpm: G.cpm, accuracy: G.accuracy, maxCombo: G.maxCombo,
    roomId: G.gameMode === 'pvp' ? G.pvp.roomId : null,
    passageHash: Words.hashPassage(G.passage),
  });

  buildResultButtons();
  Platform.hideKeyboard();
  Audio.play('click');
}

// ========== 开放数据域（好友榜）==========
function refreshOpenData() {
  const odc = Platform.getOpenDataContext();
  if (!odc || !odc.canvas) return;
  odc.canvas.width = LAYOUT.home.winW || 335;
  odc.canvas.height = LAYOUT.home.winH || 108;
  if (odc.postMessage) odc.postMessage({ type: 'render' });
  G.odPosted = true;
}

// ========== 排行榜拉取 ==========
async function openGlobalLb() {
  G.lb.showGlobal = !G.lb.showGlobal;
  G.lb.showFriend = false;
  if (G.lb.showGlobal) {
    const res = await Net.fetchLeaderboard(G.mode, G.level);
    if (res) { G.lb.globalList = res.list || []; G.lb.mine = res.mine || null; }
    refreshOpenData();
  }
  buildHomeButtons();
}

function toggleFriendLb() {
  G.lb.showFriend = !G.lb.showFriend;
  G.lb.showGlobal = false;
  refreshOpenData();
  buildHomeButtons();
}

// ========== 点击 ==========
function tap(x, y) {
  // 对局中的减速按钮
  if (G.state === 'PLAY' && G.slowBtn) {
    const b = G.slowBtn;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { slowAi(); return; }
  }
  for (let i = 0; i < G.buttons.length; i++) {
    const b = G.buttons[i];
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    const a = b.action;
    if (a === 'start' || a === 'again') startAiGame(G.mode, G.level);
    else if (a === 'pvp') startPvpLobby();
    else if (a === 'home') gotoHome();
    else if (a === 'share') shareResult();
    else if (a === 'revive') reviveAi();
    else if (a === 'rematch') rematchPvp();
    else if (a === 'invite') inviteFriend();
    else if (a === 'ready') pvpReady();
    else if (a === 'leave') pvpLeave();
    else if (a === 'lb_friend') toggleFriendLb();
    else if (a === 'lb_global') openGlobalLb();
    else if (a === 'sound') toggleSound();
    else if (a.indexOf('mode:') === 0) { G.mode = a.slice(5); buildHomeButtons(); }
    else if (a.indexOf('level:') === 0) { G.level = a.slice(6); buildHomeButtons(); }
    return;
  }
}

function toggleSound() {
  G.soundOn = !G.soundOn;
  Platform.setStorageSync('tp_sound_on', G.soundOn ? '1' : '0');
  if (G.soundOn) { Audio.init(); Audio.startBgm(); } else Audio.stopBgm();
  buildHomeButtons();
}

function inviteFriend() {
  if (!G.pvp.roomId) return;
  Platform.shareAppMessage({
    title: '来和我打字对战！房间号 ' + G.pvp.roomId,
    query: 'roomId=' + G.pvp.roomId,
  });
}

function shareResult() {
  Platform.shareAppMessage({
    title: '我在「打字比赛」拿了 ' + G.score + ' 分，段位 ' + G.rank + '，你能超过我吗？',
  });
}

/** 首次触摸：初始化音频 */
function firstTouch() {
  if (G.soundOn) { Audio.init(); Audio.startBgm(); }
}

module.exports = {
  G, bootstrap, gotoHome, startAiGame, startPvpLobby, pvpJoin, pvpReady, pvpLeave,
  update, tap, input, confirmClear, onNet, firstTouch, handleLaunchOptions,
};
