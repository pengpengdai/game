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
const Drop = require('./drop');
const Config = require('./config');

const sys = Platform.getSystemInfoSync();
const W = sys.windowWidth || 375;
const H = sys.windowHeight || 667;

// 安全区：顶部状态栏/刘海、底部 Home 指示条
const SAFE = sys.safeArea || {};
const TOP_INSET = Math.max(0, SAFE.top !== undefined ? SAFE.top : (sys.statusBarHeight || 0));
const BOTTOM_INSET = SAFE.bottom ? Math.max(0, H - SAFE.bottom) : 0;
const USABLE_H = H - TOP_INSET - BOTTOM_INSET;

const AI_TIME = { easy: 25, normal: 32, hard: 42 };

// AI 人格：名字/头像字/台词（按难度对应，让输赢更有对象感）
const AI_ROLES = [
  { name: '键盘侠小王', initial: '王', color: '#FF6B35', taunt: '上次这局我 25 秒跑完，你能跟上吗？', lead: '我先走一步~', behind: '哟，手速可以啊' },
  { name: '摸鱼老张', initial: '张', color: '#1F2A44', taunt: '上班摸鱼中，陪你打一局', lead: '别急，我摸鱼呢', behind: '今天状态不错嘛' },
  { name: '竞赛选手阿May', initial: 'M', color: '#16A374', taunt: '全国赛第 8，别怕', lead: '节奏稳一点', behind: '可以啊，继续保持' },
];
const ROLE_BY_LEVEL = { easy: 0, normal: 1, hard: 2 };
const MILESTONES = [25, 50, 75];
const BEST_KEY = 'tp_best';
const TODAY_KEY = 'tp_today_best';   // 今日最佳 CPM（每日刷新）
const REVIVE_DAY_LIMIT = 5;
const PVP_REPORT_GAP = 120;   // 进度上报间隔 ms

const RANK_EN = [[300, 'S'], [225, 'A'], [150, 'B'], [100, 'C'], [0, 'D']];
const RANK_CN = [[120, 'S'], [90, 'A'], [60, 'B'], [36, 'C'], [0, 'D']];

const KB_KEY = 'tp_kb_layout';                  // 记住用户上次选的键盘
const KB_H = Math.round(Math.min(246, USABLE_H * 0.38));
const KB_TOP = H - BOTTOM_INSET - KB_H;

/** 开局倒计时秒数（来自 Config.COUNTDOWN_SEC：可统一、可按难度、可设 0 跳过） */
function countdownFor(level) {
  const c = Config.COUNTDOWN_SEC;
  let v = 3;
  if (typeof c === 'number') v = c;
  else if (c && typeof c === 'object') {
    v = typeof c[level] === 'number' ? c[level] : (typeof c.default === 'number' ? c.default : 3);
  }
  return Math.max(0, Number(v) || 0);
}

const LAYOUT = {
  W: W, H: H, top: TOP_INSET, bottom: BOTTOM_INSET, usableH: USABLE_H,
  kbTop: KB_TOP, kbH: KB_H,
  home: {
    titleY: TOP_INSET + 66, subY: TOP_INSET + 96,
    bestY: TOP_INSET + 124, bestH: 92,
    modeLabelY: TOP_INSET + 236, modeBtnY: TOP_INSET + 252, modeBtnW: 148, modeBtnH: 44, modeGap: 12,
    levelLabelY: TOP_INSET + 306, levelBtnY: TOP_INSET + 322, levelBtnW: 104, levelBtnH: 42, levelGap: 10,
    startY: TOP_INSET + 378, startW: 260, startH: 56,
    pvpY: TOP_INSET + 448, pvpW: 260, pvpH: 48,
    lbBtnY: TOP_INSET + 508, lbBtnW: 128, lbBtnH: 44,
    soundX: W - 66, soundY: TOP_INSET + 16, soundW: 54, soundH: 32,
    lbModal: { x: 24, y: TOP_INSET + 120, w: W - 48, h: 386, closeY: TOP_INSET + 448 },
  },
  main: {
    cardX: 22, cardW: W - 44,
    card1Y: TOP_INSET + 132, card2Y: TOP_INSET + 264, cardH: 116,
    tipY: TOP_INSET + 402,
  },
  lobby: {
    titleY: TOP_INSET + 84, subY: TOP_INSET + 110,
    cardY: TOP_INSET + 132, cardH: 116,
    vsY: TOP_INSET + 288, statusY: TOP_INSET + 428,
    btnY: TOP_INSET + 364, btnW: 104, btnH: 50,
  },
  play: {
    headX: 14, headY: TOP_INSET + 12, headW: W - 28, headH: 94,
    statY: TOP_INSET + 114, statH: 36, statGap: 8,
    panelX: 14, panelY: TOP_INSET + 158, panelW: W - 28,
    panelH: KB_TOP - (TOP_INSET + 158) - 8,
    kbTop: KB_TOP, kbH: KB_H,
    pauseBtn: { x: W - 48, y: TOP_INSET + 14, w: 34, h: 34 },
  },
  ready: {
    cardX: 22, cardY: TOP_INSET + 92, cardW: W - 44, cardH: 340,
    titleY: TOP_INSET + 134, subY: TOP_INSET + 162,
    optY: TOP_INSET + 196, optH: 88, optPad: 18, optGap: 12,
    startY: TOP_INSET + 312, startH: 52,
    hintY: TOP_INSET + 388,
  },
  result: {
    bannerY: TOP_INSET + 96, rankY: TOP_INSET + 206, rankR: 36,
    cardY: TOP_INSET + 250, cardH: 112,
    curveY: TOP_INSET + 380, curveH: 44,
    scoreY: TOP_INSET + 476, btnY: TOP_INSET + 506, btnW: 96, btnH: 48,
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
  aiRole: AI_ROLES[0],                 // 当前 AI 人格
  todayBest: 0,                        // 今日最佳 CPM
  challenge: null,                     // 挑战码对局信息（幽灵对手）
  curve: [], curveAt: 0,               // 速度曲线采样
  milestoneDone: {},                   // 已播报的里程碑
  modal: null,                         // 通用弹窗（挑战码展示）
  codeMode: false,                     // 正在输入挑战码
  countdown: 0,
  lastInput: '',                       // 系统输入法上次的整段文本（中文增量用）
  inputBase: 0,                        // 输入框里已消费掉的字符数（调试用）
  matchedCn: 0,                        // 中文：已匹配的文章字数（不含标点）
  passMap: [], passMapSrc: null,       // 中文：文章字数映射（缓存）
  cnErrSig: '',                        // 中文：上次报错的签名，避免重复震动
  pause: { total: 0, startedAt: 0 },   // 暂停累计时长 / 本次暂停起点
  fx: {
    lastCharAt: 0, comboAt: 0, comboValue: 0, resultAt: 0, startAt: 0,
    errAt: 0, ripple: null,
  },
  kb: {
    layout: 'q26', visible: false, keys: [],
    pressed: '', pressedUntil: 0, tip: '',
    t9: {}, lastSlot: -1,
  },
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
function checkMilestone() {
  if (!G.passage.length) return;
  const pct = Math.round(G.typedLen / G.passage.length * 100);
  for (let i = 0; i < MILESTONES.length; i++) {
    const m = MILESTONES[i];
    if (pct >= m && !G.milestoneDone[m]) {
      G.milestoneDone[m] = true;
      G.fx.milestone = { text: m + '% · ' + (m === 25 ? '开局不错' : (m === 50 ? '已过半！' : '最后冲刺！')), at: Date.now() };
      Audio.play('milestone');
    }
  }
}

/** 玩家打完全文：结算前的最后一击 + 挑战码胜负判定 */
function onPlayerComplete() {
  G.playerFinished = true;
  G.result = G.challenge ? (G.score >= G.challenge.score ? 'win' : 'lose') : 'win';
  G.fx.finisherAt = Date.now();
  if (G.gameMode === 'ai') {
    G.overDelay = 1.2;
    Audio.play(G.result === 'win' ? 'win' : 'lose');
    Platform.hideKeyboard();
  } else {
    Net.send({ type: 'finish', stats: buildStats() });
    G.waitResultUntil = Date.now() + 6000;
  }
}

/** 挑战码：建立「幽灵对战」，对手按好友通关用时推进 */
function startChallenge(c) {
  G.gameMode = 'ai';
  G.mode = c.mode === 'en' ? 'en' : 'cn';
  G.level = c.level || 'easy';
  resetRound();
  G.passage = c.passage;
  const t = Math.max(5, Number(c.timeMs || 30000) / 1000);
  G.aiSpeed = 1 / t;
  const nick = c.nickname || '好友';
  G.aiRole = { name: nick, initial: String(nick).slice(0, 1), color: '#1F2A44', taunt: '接招吧，这是我的记录', lead: '别掉队哦', behind: '你比我还快？' };
  G.challenge = { code: c.code || '', nickname: nick, score: Number(c.score || 0), cpm: Number(c.cpm || 0), timeMs: t * 1000 };
  G.state = 'READY';
  G.slowBtn = null;
  G.kb.visible = false;
  buildKeyboard();
  buildReadyButtons();
  Audio.play('click');
}

/** 结束页：把自己的这一局生成挑战码 */
function makeChallenge() {
  Platform.showToast('生成挑战码…');
  Net.createChallenge({
    mode: G.mode, level: G.level, passage: G.passage,
    timeMs: Math.max(1000, Math.round(G.elapsed * 1000)), score: G.score, cpm: G.cpm,
    accuracy: G.accuracy, maxCombo: G.maxCombo, nickname: '我',
  }).then((res) => {
    if (!res || !res.code) { Platform.showToast('生成失败，检查网络'); return; }
    G.modal = { title: '挑战码已生成', code: res.code, tip: '发给好友，他输入这串码就能挑战你这局' };
    const bw = (W - 92) / 2;
    const by = (TOP_INSET + H - BOTTOM_INSET) / 2 + 62;
    setButtons([
      { x: 40, y: by, w: bw, h: 46, label: '复制挑战码', action: 'code_copy', primary: true },
      { x: 40 + bw + 12, y: by, w: bw, h: 46, label: '关闭', action: 'code_close' },
    ]);
  }).catch(() => Platform.showToast('生成失败，检查网络'));
}

/** 首页：输入挑战码 */
function openChallengeInput() {
  G.codeMode = true;
  G.modal = null;
  Platform.showKeyboard({ maxLength: 6, multiple: false, confirmHold: false, confirmType: 'done', defaultValue: '' });
  Platform.showToast('输入 6 位挑战码');
}

/** 提交挑战码：拉取好友记录并开局 */
function submitChallengeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  G.codeMode = false;
  Platform.hideKeyboard();
  if (code.length < 6) { Platform.showToast('挑战码需要 6 位'); return; }
  Platform.showToast('加载挑战中…');
  Net.fetchChallenge(code).then((c) => {
    if (!c || !c.passage) { Platform.showToast('挑战码不存在或已过期'); return; }
    startChallenge(c);
  }).catch(() => Platform.showToast('网络异常，稍后再试'));
}

function buildMainButtons() {
  const M = LAYOUT.main;
  setButtons([
    { x: M.cardX, y: M.card1Y, w: M.cardW, h: M.cardH, label: '', action: 'menu_race', card: true },
    { x: M.cardX, y: M.card2Y, w: M.cardW, h: M.cardH, label: '', action: 'menu_drop', card: true },
    { x: LAYOUT.home.soundX, y: LAYOUT.home.soundY, w: LAYOUT.home.soundW, h: LAYOUT.home.soundH, label: G.soundOn ? '♪ 开' : '♪ 关', action: 'sound', small: true },
  ]);
}

/** 进入「打字游戏」（掉落消词） */
function startDrop(lang) {
  G.state = 'DROP';
  G.gameMode = 'drop';
  G.modal = null;
  G.codeMode = false;
  Drop.start(lang || G.mode);
  buildDropButtons();
  Platform.showKeyboard({ maxLength: 40, multiple: false, confirmHold: false, confirmType: 'done', defaultValue: '' });
  Audio.play('click');
}

function buildDropButtons() {
  setButtons([{ x: W - 70, y: TOP_INSET + 8, w: 56, h: 30, label: '退出', action: 'drop_quit', small: true }]);
}

/** 掉落玩法结束：星星耗尽 */
function finishDrop() {
  G.state = 'DROP_RESULT';
  G.kb.visible = false;
  Platform.hideKeyboard();
  Audio.play('lose');
  Platform.vibrateHeavy();
  buildDropResultButtons();
}

function buildDropResultButtons() {
  const L = LAYOUT.result;
  const bw = (W - 44 - 12) / 2;
  const mk = (col, row, label, action, primary) => ({
    x: 22 + col * (bw + 12), y: L.btnY + row * 58, w: bw, h: 46, label, action, primary: !!primary,
  });
  const list = [];
  if (!Drop.S.revived) list.push(mk(0, 0, '看广告复活', 'drop_revive', true), mk(1, 0, '再来一局', 'drop_again'));
  else list.push(mk(0, 0, '再来一局', 'drop_again', true), mk(1, 0, '返回首页', 'drop_home'));
  if (Drop.S.revived) setButtons(list);
  else setButtons([list[0], list[1], mk(0, 1, '返回首页', 'drop_home')]);
}

/** 看广告复活：星星回到 3 颗，继续本局 */
function dropRevive() {
  Ad.show(Config.AD_REVIVE, (ok) => {
    if (!ok) return;
    Drop.revive();
    G.state = 'DROP';
    G.gameMode = 'drop';
    buildDropButtons();
    Platform.showKeyboard({ maxLength: 40, multiple: false, confirmHold: false, confirmType: 'done', defaultValue: '' });
    Platform.showToast('复活成功，守住星星！');
  });
}

function buildRaceButtons() {
  const L = LAYOUT.home;
  const M = L.lbModal;
  if (G.lb.showFriend || G.lb.showGlobal) {
    setButtons([{ x: W / 2 - 70, y: M.closeY, w: 140, h: 44, label: '关闭', action: 'lb_close', primary: true }]);
    return;
  }
  const x0 = (W - (L.modeBtnW * 2 + L.modeGap)) / 2;
  const lx0 = (W - (L.levelBtnW * 3 + L.levelGap * 2)) / 2;
  const cx = W / 2;
  setButtons([
    { x: x0, y: L.modeBtnY, w: L.modeBtnW, h: L.modeBtnH, label: '中文', action: 'mode:cn', active: G.mode === 'cn' },
    { x: x0 + L.modeBtnW + L.modeGap, y: L.modeBtnY, w: L.modeBtnW, h: L.modeBtnH, label: '英文', action: 'mode:en', active: G.mode === 'en' },
    { x: lx0, y: L.levelBtnY, w: L.levelBtnW, h: L.levelBtnH, label: '简单', action: 'level:easy', active: G.level === 'easy' },
    { x: lx0 + L.levelBtnW + L.levelGap, y: L.levelBtnY, w: L.levelBtnW, h: L.levelBtnH, label: '普通', action: 'level:normal', active: G.level === 'normal' },
    { x: lx0 + (L.levelBtnW + L.levelGap) * 2, y: L.levelBtnY, w: L.levelBtnW, h: L.levelBtnH, label: '困难', action: 'level:hard', active: G.level === 'hard' },
    { x: cx - L.startW / 2, y: L.startY, w: L.startW, h: L.startH, label: '开始比赛', action: 'start', primary: true },
    { x: cx - L.pvpW / 2, y: L.pvpY, w: L.pvpW, h: L.pvpH, label: '好友对战', action: 'pvp', secondary: true },
    { x: cx - L.lbBtnW - 52, y: L.lbBtnY, w: 96, h: L.lbBtnH, label: '好友榜', action: 'lb_friend', active: G.lb.showFriend },
    { x: cx - 48, y: L.lbBtnY, w: 96, h: L.lbBtnH, label: '全局榜', action: 'lb_global', active: G.lb.showGlobal },
    { x: cx + 56, y: L.lbBtnY, w: 96, h: L.lbBtnH, label: '挑战码', action: 'challenge_entry' },
    { x: L.soundX, y: L.soundY, w: L.soundW, h: L.soundH, label: G.soundOn ? '♪ 开' : '♪ 关', action: 'sound', small: true },
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
    const gap = 12;
    const bw = (W - 44 - gap) / 2;
    const mk2 = (col, row, label, action, primary) => ({
      x: 22 + col * (bw + gap), y: L.btnY + row * 58, w: bw, h: 46, label, action, primary: !!primary,
    });
    if (!win) setButtons([mk2(0, 0, '看广告复活', 'revive', true), mk2(1, 0, '挑战好友', 'make_challenge'), mk2(0, 1, '再来一局', 'again'), mk2(1, 1, '返回首页', 'home')]);
    else setButtons([mk2(0, 0, '再来一局', 'again', true), mk2(1, 0, '挑战好友', 'make_challenge'), mk2(0, 1, '分享战绩', 'share'), mk2(1, 1, '返回首页', 'home')]);
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
  try {
    const t = JSON.parse(Platform.getStorageSync(TODAY_KEY) || '{}');
    const day = new Date().toISOString().slice(0, 10);
    G.todayBest = (t && t.day === day) ? (Number(t.cpm) || 0) : 0;
  } catch (e) { G.todayBest = 0; }
  try {
    const savedKb = Platform.getStorageSync(KB_KEY);
    if (savedKb === 'q9' || savedKb === 'q26') G.kb.layout = savedKb;
  } catch (e) {}
  G.soundOn = Platform.getStorageSync('tp_sound_on') !== '0';
  buildMainButtons();
  handleLaunchOptions(Platform.getLaunchOptionsSync());
}

function handleLaunchOptions(opts) {
  if (!opts || !opts.query) return;
  const roomId = opts.query.roomId;
  if (roomId) G.pendingJoinRoom = String(roomId);
}

function gotoRaceHome() {
  G.state = 'RACE_HOME';
  G.gameMode = 'ai';
  G.pvp.waitingRematch = false;
  G.kb.visible = false;
  G.countdown = 0;
  G.pause.total = 0;
  G.pause.startedAt = 0;
  G.lastInput = '';
  G.inputBase = 0;
  G.matchedCn = 0;
  G.cnErrSig = '';
  G.passMapSrc = null;
  G.modal = null;
  G.codeMode = false;
  Drop.S.on = false;
  buildRaceButtons();
  Platform.hideKeyboard();
  Audio.play('click');
}

function gotoHome() {
  G.state = 'HOME';
  G.gameMode = 'ai';
  G.pvp.waitingRematch = false;
  G.kb.visible = false;
  G.countdown = 0;
  G.pause.total = 0;
  G.pause.startedAt = 0;
  G.lastInput = '';
  G.inputBase = 0;
  G.matchedCn = 0;
  G.cnErrSig = '';
  G.passMapSrc = null;
  G.modal = null;
  G.codeMode = false;
  Drop.S.on = false;
  buildMainButtons();
  Platform.hideKeyboard();
  Audio.play('click');
}

// ---- AI 单机 ----
function startAiGame(mode, level) {
  G.gameMode = 'ai';
  G.mode = mode; G.level = level;
  resetRound();
  G.passage = Words.pick(mode, level);
  G.challenge = null;
  G.aiRole = AI_ROLES[ROLE_BY_LEVEL[level] || 0];
  // 进度比例/秒：整篇文章在 AI_TIME[level] 秒内走完（1 = 终点）
  G.aiSpeed = 1 / AI_TIME[level];
  G.countdown = 0;
  G.state = 'READY';
  G.slowBtn = null;
  G.kb.visible = false;
  buildKeyboard();
  buildReadyButtons();
  Audio.play('click');
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
  G.curve = []; G.curveAt = 0; G.curveAcc = 0; G.milestoneDone = {};
  G.fx.milestone = null; G.fx.bubble = null; G.fx.finisherAt = 0; G.fx.tauntDone = false;
  G.fx.floats = []; G.fx.goAt = 0; G.fx.pulseAt = 0; G.fx.pulseColor = ''; G.fx.chaseAt = 0;
  G.startedAt = Date.now();
}

function openKeyboard() {
  Platform.showKeyboard({
    defaultValue: '', maxLength: 200, multiple: true,
    confirmHold: G.mode === 'cn', confirmType: 'done',
  });
}

// ---- 输入法选择 + 自绘键盘（英文模式）----
function buildKeyboard() {
  const keys = [];
  const pad = 5, gap = 6;
  const top = KB_TOP + 30;
  if (G.kb.layout === 'q26') {
    const kw = (W - pad * 2 - gap * 9) / 10;
    const kh = Math.round((KB_H - 30 - pad - gap * 3 - 6) / 4);
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rw = row.length * kw + (row.length - 1) * gap;
      const x0 = (W - rw) / 2;
      for (let i = 0; i < row.length; i++) {
        keys.push({ x: x0 + i * (kw + gap), y: top + ri * (kh + gap), w: kw, h: kh, type: 'char', chars: [row[i]], label: row[i] });
      }
    }
    const by = top + 3 * (kh + gap);
    const sw = Math.min(220, W * 0.58);
    keys.push({ x: (W - sw) / 2, y: by, w: sw, h: kh, type: 'space', chars: [' '], label: '空格' });
  } else {
    const kw = (W - pad * 2 - gap * 2) / 3;
    const kh = Math.round((KB_H - 30 - pad - gap * 2 - 6) / 3);
    const groups = ['abc', 'def', 'ghi', 'jkl', 'mno', 'pqrs', 'tuv', 'wxyz'];
    for (let i = 0; i < 9; i++) {
      const c = i % 3, r = Math.floor(i / 3);
      const x = pad + c * (kw + gap), y = top + r * (kh + gap);
      if (i < 8) keys.push({ x, y, w: kw, h: kh, type: 't9', chars: groups[i].split(''), label: groups[i], slot: i });
      else keys.push({ x, y, w: kw, h: kh, type: 'space', chars: [' '], label: '空格' });
    }
  }
  G.kb.keys = keys;
}

function hitKey(x, y) {
  const ks = G.kb.keys;
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i];
    if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) return k;
  }
  return null;
}

function kbPress(k) {
  G.kb.pressed = k.label;
  G.kb.pressedUntil = Date.now() + 140;
  G.fx.ripple = { x: k.x + k.w / 2, y: k.y + k.h / 2, at: Date.now() };
  Platform.vibrateShort();
  if (k.type === 'space') { G.kb.tip = ''; input(' '); return; }
  if (k.type === 't9') {
    if (G.kb.lastSlot !== k.slot) { G.kb.lastSlot = k.slot; G.kb.t9[k.slot] = -1; }
    const ni = ((G.kb.t9[k.slot] === undefined ? -1 : G.kb.t9[k.slot]) + 1) % k.chars.length;
    G.kb.t9[k.slot] = ni;
    G.kb.tip = k.label + ' → ' + k.chars[ni];
    input(k.chars[ni]);
    return;
  }
  G.kb.tip = '';
  input(k.chars[0]);
}

function startPlay() {
  G.state = 'PLAY';
  G.countdown = 0;
  G.startedAt = Date.now();
  G.fx.startAt = Date.now();
  G.pause.total = 0;
  G.pause.startedAt = 0;
  G.lastInput = '';
  G.inputBase = 0;
  G.matchedCn = 0;
  G.cnErrSig = '';
  G.passMapSrc = null;
  G.kb.visible = G.mode === 'en';
  G.kb.tip = '';
  G.kb.t9 = {};
  G.kb.lastSlot = -1;
  G.buttons = buildPlayButtons();
  G.fx.goAt = Date.now();
  if (G.mode === 'cn') openKeyboard();
  Audio.play('click');
}

function buildReadyButtons() {
  const R = LAYOUT.ready;
  const optW = (R.cardW - R.optPad * 2 - R.optGap) / 2;
  const optX1 = R.cardX + R.optPad;
  const optX2 = optX1 + optW + R.optGap;
  const list = [];
  if (G.mode === 'en') {
    list.push({ x: optX1, y: R.optY, w: optW, h: R.optH, label: '9键', action: 'kb:q9', active: G.kb.layout === 'q9', kb: 'q9' });
    list.push({ x: optX2, y: R.optY, w: optW, h: R.optH, label: '26键', action: 'kb:q26', active: G.kb.layout === 'q26', kb: 'q26' });
  }
  list.push({
    x: R.cardX + R.optPad, y: R.startY, w: R.cardW - R.optPad * 2, h: R.startH,
    label: G.mode === 'en' ? '开始打字' : '开始打字（系统输入法）', action: 'start_race', primary: true, small: G.mode !== 'en',
  });
  setButtons(list);
}

/** 对局中的悬浮按钮：暂停；中文模式额外提供「唤起键盘」 */
function buildPlayButtons() {
  const list = [];
  if (G.gameMode === 'ai') {
    const p = LAYOUT.play.pauseBtn;
    list.push({ x: p.x, y: p.y, w: p.w, h: p.h, label: 'Ⅱ', action: 'pause', small: true, circle: true });
  }
  if (G.mode === 'cn') {
    list.push({
      x: 20, y: KB_TOP + Math.round((KB_H - 48) / 2) - 20, w: W - 40, h: 48,
      label: '点此唤起键盘', action: 'kb_show', secondary: true,
    });
  }
  return list;
}

function pauseGame() {
  if (G.state !== 'PLAY') return;
  G.state = 'PAUSED';
  G.pause.startedAt = Date.now();
  G.kb.visible = false;
  Platform.hideKeyboard();
  const cy = (TOP_INSET + H - BOTTOM_INSET) / 2;
  const bw = (W - 80 - 48 - 12) / 2;
  setButtons([
    { x: 40 + 24, y: cy + 78, w: bw, h: 46, label: '继续', action: 'resume', primary: true },
    { x: 40 + 24 + bw + 12, y: cy + 78, w: bw, h: 46, label: '退出', action: 'pause_home' },
  ]);
  Audio.play('click');
}

function resumeGame() {
  if (G.state !== 'PAUSED') return;
  G.pause.total += Date.now() - G.pause.startedAt;
  G.pause.startedAt = 0;
  G.state = 'PLAY';
  G.kb.visible = G.mode === 'en';
  if (G.mode === 'cn') openKeyboard();
  G.buttons = buildPlayButtons();
  Audio.play('click');
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
      G.countdown = 0;
      G.state = 'READY';
      G.buttons = [];
      G.slowBtn = null;
      G.kb.visible = false;
      G.pvp.waitingRematch = false;
      buildKeyboard();
      buildReadyButtons();
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
/** 两个字符串的最长公共前缀长度 */
function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/** 中文模式：标点/空格自动跳过（文章标点自动通过，联想候选自带的标点忽略） */
function isPunct(ch) {
  if (!ch) return false;
  return /[\u2000-\u206F\u3000-\u303F\uFE10-\uFE1F\uFE30-\uFE4F\uFF00-\uFFEF]/.test(ch)
    || " \t\r\n,.;:!?()[]{}'\"`<>/\\|@#$%^&*+-=~_，。、；：！？（）《》〈〉【】“”‘’…—·".includes(ch);
}

/** 中文文章映射：只保留需要用户输入的字（标点/空格跳过），记录其在原文中的下标 */
function buildPassMap() {
  const pm = [];
  for (let i = 0; i < G.passage.length; i++) {
    if (!isPunct(G.passage[i])) pm.push({ ch: G.passage[i], i: i });
  }
  G.passMap = pm;
  G.passMapSrc = G.passage;
  return pm;
}

/**
 * 中文模式：无状态对齐（不依赖增量 diff，抗输入法任意改写）
 * 每次拿输入框整段文本 → 剥掉拼音字母/标点 → 与文章逐字前缀对齐 → 推进到最长匹配处。
 * 关键：不清空输入框。真机上 setKeyboardValue 会打断输入法组合状态，
 * 导致后续输入不再上报、光标永久卡死（用户反馈的「打到黄金屋，光标停在自」）。
 */
function inputCn(value) {
  if (G.passMapSrc !== G.passage) buildPassMap();
  const pm = G.passMap;
  const pass = G.passage;
  G.lastInput = value;
  G.inputBase = value.length;

  // 只保留汉字：拼音字母、标点、空格、数字等一律视为噪声
  const clean = value.replace(/[^\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, '');
  if (!clean) return;

  // 对齐 A：输入框是从文章开头累积的整段文本
  let m0 = 0;
  while (m0 < clean.length && m0 < pm.length && clean[m0] === pm[m0].ch) m0++;
  // 对齐 B：输入框只含「当前进度之后」的内容（输入框被系统清空后继续打）
  let mT = 0;
  while (mT < clean.length && G.matchedCn + mT < pm.length && clean[mT] === pm[G.matchedCn + mT].ch) mT++;
  // 优先「从头对齐」：只要输入框里包含了已打内容（m0 >= 已匹配数）就以它为准，
  // 避免文章有重复片段时尾对齐误判跳字；仅当输入框被系统清空后才用尾对齐。
  let fromStart = true, abs;
  if (m0 >= G.matchedCn) {
    abs = m0;
  } else {
    fromStart = false;
    abs = m0;                        // 从头也没走通，尾部也没走通 → 不推进
    if (G.matchedCn + mT > abs) abs = G.matchedCn + mT;
  }

  if (abs > G.matchedCn) {
    const adv = abs - G.matchedCn;
    G.matchedCn = abs;
    // 进度推进到已匹配字之后，并自动跨过紧随其后的标点
    let nl = pm[abs - 1].i + 1;
    while (nl < pass.length && isPunct(pass[nl])) nl++;
    G.typedLen = nl;
    G.totalKeys += adv;
    G.combo += adv;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    G.score += adv * (10 + Math.min(G.combo, 50));
    Audio.playKey(G.combo);
    G.fx.lastCharAt = Date.now();
    checkMilestone();
    G.fx.floats.push({ text: '+' + (adv * (10 + Math.min(G.combo, 50) || 0)), at: Date.now() });
    if (G.fx.floats.length > 6) G.fx.floats.shift();
    if (G.combo >= 5 && G.combo % 5 === 0) {
      Audio.play('combo');
      G.fx.comboAt = Date.now();
      G.fx.comboValue = G.combo;
    }
    if (G.combo >= 10 && G.combo % 10 === 0) { G.fx.pulseAt = Date.now(); G.fx.pulseColor = '255,107,53'; }
    if (G.totalKeys > 0 && G.totalKeys % 10 === 0) Platform.vibrateLight();
    G.cnErrSig = '';
    if (!G.kb.visible) G.buttons = buildPlayButtons();
    if (G.gameMode === 'pvp') reportProgress();

    if (G.matchedCn >= pm.length) onPlayerComplete();
    return;
  }

  // 没有推进：只在「确有对不上的汉字」时给一次反馈；不清空输入框，用户退格即可继续
  const at = fromStart ? m0 : mT;
  if (at < clean.length && at < pm.length) {
    const sig = at + '|' + clean.slice(at, at + 2);
    if (sig !== G.cnErrSig) {
      G.cnErrSig = sig;
      G.wrongKeys += 1;
      G.combo = 0;
      G.flash = 0.5;
      G.fx.errAt = Date.now();
      Platform.vibrateShort();
      Audio.play('error');
    }
  }
}

function input(value) {
  if (G.state === 'DROP') { Drop.input(value); return; }
  if (G.state !== 'PLAY') return;
  if (G.gameMode === 'ai' && G.gameOver) return;
  if (G.gameMode === 'pvp' && G.playerFinished) return;
  if (typeof value !== 'string' || !value) return;
  G.lastValue = value;

  if (G.mode === 'cn') { inputCn(value); return; }

  // 英文：自绘键盘逐键输入，严格逐字比对
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
    G.fx.errAt = Date.now();
    Platform.vibrateHeavy();
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
    Audio.playKey(G.combo);
    G.fx.lastCharAt = Date.now();
    checkMilestone();
    G.fx.floats.push({ text: '+' + (adv * (10 + Math.min(G.combo, 50) || 0)), at: Date.now() });
    if (G.fx.floats.length > 6) G.fx.floats.shift();
    if (G.combo >= 5 && G.combo % 5 === 0) {
      Audio.play('combo');
      G.fx.comboAt = Date.now();
      G.fx.comboValue = G.combo;
    }
    if (G.combo >= 10 && G.combo % 10 === 0) { G.fx.pulseAt = Date.now(); G.fx.pulseColor = '255,107,53'; }
    if (G.totalKeys > 0 && G.totalKeys % 10 === 0) Platform.vibrateLight();
    Platform.setKeyboardValue('');
    if (G.gameMode === 'pvp') reportProgress();

    if (G.typedLen >= pass.length) onPlayerComplete();
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
  G.buttons = buildPlayButtons();
  G.lastInput = '';
  G.inputBase = 0;
  G.cnErrSig = '';
  // 把结算页停留的时间计入暂停，避免复活后计时跳增
  if (G.fx.resultAt) G.pause.total += Date.now() - G.fx.resultAt;
  G.kb.visible = G.mode === 'en';
  G.kb.tip = '';
  G.kb.t9 = {};
  G.kb.lastSlot = -1;
  if (G.mode === 'cn') openKeyboard();
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

  if (G.state === 'DROP') {
    Drop.update(dt);
    if (Drop.S.over) finishDrop();
    return;
  }

  if (G.state === 'PAUSED') return;   // 暂停：冻结计时与 AI

  if (G.state === 'COUNTDOWN') {
    G.countdown -= dt;
    if (G.countdown <= 0) { G.countdown = 0; startPlay(); }
    return;
  }

  if (G.state === 'PLAY') {
    G.elapsed = (Date.now() - G.startedAt - (G.pause.total || 0)) / 1000;

    // 速度曲线采样（每 0.8s 帧时间一个点，结算页画两条折线）
    G.curveAcc = (G.curveAcc || 0) + dt;
    if (G.curveAcc >= 0.8) {
      G.curveAcc -= 0.8;
      const total = G.passage.length || 1;
      G.curve.push({
        t: Math.round(G.elapsed * 10) / 10,
        me: G.typedLen,
        ai: G.gameMode === 'pvp' ? (G.pvp.peerTypedLen || 0) : Math.round(G.aiProgress * total),
      });
      if (G.curve.length > 160) G.curve.shift();
    }

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
        // 被反超瞬间：重震 + 红色脉冲
        if (!G.fx.chaseAt && G.aiProgress > G.typedLen / (G.passage.length || 1) + 0.02 && G.aiProgress > 0.15) {
          G.fx.chaseAt = Date.now();
          G.fx.pulseAt = Date.now();
          G.fx.pulseColor = '225,72,63';
          Platform.vibrateHeavy();
        }
        // AI 垃圾话：过半时冒一次气泡（领先就嘲讽、落后就夸）
        if (G.aiRole && !G.fx.tauntDone && G.aiProgress >= 0.5) {
          G.fx.tauntDone = true;
          const lead = G.aiProgress * (G.passage.length || 1) > G.typedLen;
          G.fx.bubble = { text: lead ? G.aiRole.lead : G.aiRole.behind, at: Date.now() };
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

  // 今日最佳 CPM（首页展示 + 冲榜钩子）
  try {
    const day = new Date().toISOString().slice(0, 10);
    if (G.cpm > (Number(G.todayBest) || 0)) {
      G.todayBest = G.cpm;
      Platform.setStorageSync(TODAY_KEY, JSON.stringify({ day: day, cpm: G.cpm }));
    }
  } catch (e) {}

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
  G.fx.resultAt = Date.now();
  G.lastInput = '';
  G.inputBase = 0;
  G.kb.visible = false;
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
  buildRaceButtons();
}

function toggleFriendLb() {
  G.lb.showFriend = !G.lb.showFriend;
  G.lb.showGlobal = false;
  refreshOpenData();
  buildRaceButtons();
}

// ========== 点击 ==========
function tap(x, y) {
  // 对局中的减速按钮
  if (G.state === 'PLAY' && G.slowBtn) {
    const b = G.slowBtn;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { slowAi(); return; }
  }
  // 自绘键盘
  if (G.state === 'PLAY' && G.kb.visible) {
    const k = hitKey(x, y);
    if (k) { kbPress(k); return; }
  }
  for (let i = 0; i < G.buttons.length; i++) {
    const b = G.buttons[i];
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    const a = b.action;
    if (a === 'menu_race') gotoRaceHome();
    else if (a === 'menu_drop') startDrop('cn');
    else if (a === 'drop_quit') gotoHome();
    else if (a === 'drop_again') startDrop(Drop.S.lang);
    else if (a === 'drop_home') gotoHome();
    else if (a === 'drop_revive') dropRevive();
    else if (a === 'start' || a === 'again') startAiGame(G.mode, G.level);
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
    else if (a === 'lb_close') { G.lb.showFriend = false; G.lb.showGlobal = false; buildRaceButtons(); }
    else if (a === 'challenge_entry') openChallengeInput();
    else if (a === 'make_challenge') makeChallenge();
    else if (a === 'code_copy') { Platform.setClipboardData(G.modal && G.modal.code); Platform.showToast('挑战码已复制'); }
    else if (a === 'code_close') { G.modal = null; buildResultButtons(); }
    else if (a === 'kb:q9' || a === 'kb:q26') {
      G.kb.layout = a === 'kb:q9' ? 'q9' : 'q26';
      Platform.setStorageSync(KB_KEY, G.kb.layout);
      buildKeyboard();
      buildReadyButtons();
      Audio.play('click');
    }
    else if (a === 'start_race') {
      const sec = countdownFor(G.level);
      G.buttons = [];
      Audio.play('click');
      if (sec <= 0) startPlay();          // 配置为 0 → 跳过倒计时直接开打
      else { G.state = 'COUNTDOWN'; G.countdown = sec; }
    }
    else if (a === 'pause') pauseGame();
    else if (a === 'resume') resumeGame();
    else if (a === 'pause_home') gotoHome();
    else if (a === 'kb_show') openKeyboard();
    else if (a.indexOf('mode:') === 0) { G.mode = a.slice(5); buildRaceButtons(); }
    else if (a.indexOf('level:') === 0) { G.level = a.slice(6); buildRaceButtons(); }
    return;
  }

  // 没点到按钮：中文模式下点任意空白处重新唤起系统键盘
  if (G.state === 'PLAY' && G.mode === 'cn') openKeyboard();
}

function toggleSound() {
  G.soundOn = !G.soundOn;
  Platform.setStorageSync('tp_sound_on', G.soundOn ? '1' : '0');
  if (G.soundOn) { Audio.init(); Audio.startBgm(); } else Audio.stopBgm();
  buildRaceButtons();
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
  update, tap, input, confirmClear, onNet, firstTouch, handleLaunchOptions, startPlay, buildKeyboard,
  buildLobbyButtons, pauseGame, resumeGame,
  startChallenge, submitChallengeCode, makeChallenge, openChallengeInput,
  gotoRaceHome, startDrop, finishDrop, dropRevive,
};
