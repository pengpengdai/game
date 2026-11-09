/**
 * render.js - Canvas 渲染层（HOME / LOBBY / PLAY / RESULT + 排行榜窗口）
 */
const Platform = require('./platform');
const Game = require('./engine');

const canvas = Platform.createCanvas();
const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
const sys = Platform.getSystemInfoSync();
const W = sys.windowWidth || 375;
const H = sys.windowHeight || 667;
const dpr = sys.pixelRatio || 1;

if (canvas) {
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
}

const G = Game.G;
const L = G.layout;
const FONT = 'Arial, "Helvetica Neue", "PingFang SC", sans-serif';
const FONT_PASSAGE = '18px ' + FONT;

const COLORS = {
  bg: '#f6f1ea', card: '#ffffff', textDark: '#4a3f35', textGray: '#9a8f85',
  barBg: '#e8e2d9', ai: '#ef6c00', me: '#1e88e5',
  win: '#2e7d32', lose: '#d32f2f',
  btn: '#8d6e63', btnActive: '#ff7043', btnPrimary: '#43a047', btnSecondary: '#5c6bc0',
  rankBg: '#8d6e63', gold: '#b0723a',
};

let odCanvas = null;
function getOdCanvas() {
  if (odCanvas) return odCanvas;
  try {
    const odc = Platform.getOpenDataContext();
    odCanvas = odc && odc.canvas ? odc.canvas : null;
  } catch (e) { odCanvas = null; }
  return odCanvas;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(str, x, y, size, color, align, bold) {
  ctx.fillStyle = color || COLORS.textDark;
  ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function drawButtons() {
  for (let i = 0; i < G.buttons.length; i++) {
    const b = G.buttons[i];
    ctx.fillStyle = b.primary ? COLORS.btnPrimary : (b.secondary ? COLORS.btnSecondary : (b.active ? COLORS.btnActive : COLORS.btn));
    roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.small ? 14 : 18, '#ffffff', 'center', true);
  }
}

function drawStatBox(x, y, w, h, label, value) {
  ctx.fillStyle = COLORS.card;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  text(label, x + w / 2, y + 14, 11, COLORS.textGray, 'center', false);
  text(value, x + w / 2, y + h - 16, 17, COLORS.textDark, 'center', true);
}

// ========== 首页 ==========
function drawHome() {
  const lh = L.home;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  text('打字比赛', W / 2, lh.titleY, 40, COLORS.textDark, 'center', true);
  text('TYPING RACE · AI 竞速 / 好友对战', W / 2, lh.subY, 13, COLORS.textGray, 'center', false);

  text('语言模式', W / 2, lh.modeLabelY, 14, COLORS.textGray, 'center', false);
  text('比赛难度', W / 2, lh.levelLabelY, 14, COLORS.textGray, 'center', false);
  drawButtons();

  text('最高分：' + G.best, W / 2, lh.bestY, 20, COLORS.gold, 'center', true);

  // 排行榜窗口
  if (G.lb.showFriend || G.lb.showGlobal) {
    const winX = (W - (L.home.winW || 335)) / 2;
    const winY = lh.winY;
    const winW = L.home.winW || 335;
    const winH = L.home.winH || 108;
    ctx.fillStyle = COLORS.card;
    roundRect(winX, winY, winW, winH, 10);
    ctx.fill();
    if (G.lb.showFriend) drawFriendBoard(winX, winY, winW, winH);
    else drawGlobalBoard(winX, winY, winW, winH);
  }
}

function drawFriendBoard(x, y, w, h) {
  const od = getOdCanvas();
  if (od && od.width > 0) {
    try { ctx.drawImage(od, x, y, w, h); } catch (e) {
      text('好友榜加载中…', x + w / 2, y + h / 2, 14, COLORS.textGray, 'center', false);
    }
    return;
  }
  text('好友榜（需抖音/快手环境与开放数据域）', x + w / 2, y + h / 2, 14, COLORS.textGray, 'center', false);
}

function drawGlobalBoard(x, y, w, h) {
  const list = G.lb.globalList || [];
  if (!list.length) {
    text('全局榜暂无数据，先去打一局吧', x + w / 2, y + h / 2, 14, COLORS.textGray, 'center', false);
    return;
  }
  text('· ' + (G.mode === 'en' ? '英文' : '中文') + ' / ' + levelName(G.level) + ' ·', x + w / 2, y + 14, 11, COLORS.textGray, 'center', false);
  const rows = list.slice(0, 5);
  rows.forEach((r, i) => {
    const ty = y + 36 + i * 17;
    text(String(i + 1), x + 20, ty, 13, i === 0 ? '#ff7043' : COLORS.textDark, 'left', i === 0);
    text(r.nickname || '玩家', x + 48, ty, 13, COLORS.textDark, 'left', false);
    text(String(r.score || 0), x + w - 70, ty, 13, COLORS.gold, 'right', true);
  });
  if (G.lb.mine) {
    text('我的排名：第 ' + G.lb.mine.rank + ' 名', x + w / 2, y + h - 16, 12, COLORS.textGray, 'center', false);
  }
}

function levelName(lv) {
  return { easy: '简单', normal: '普通', hard: '困难' }[lv] || lv;
}

// ========== 对战大厅 ==========
function drawLobby() {
  const ll = L.lobby;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  text('好友对战', W / 2, ll.titleY, 36, COLORS.textDark, 'center', true);
  text('房间号：' + G.pvp.roomId, W / 2, ll.roomY, 22, COLORS.btnSecondary, 'center', true);
  text('语言 ' + (G.mode === 'en' ? '英文' : '中文') + ' · 难度 ' + levelName(G.level), W / 2, ll.roomY + 32, 14, COLORS.textGray, 'center', false);

  let status;
  if (!G.pvp.peer.nickname) status = '等待好友加入…（通过邀请分享卡片进入）';
  else if (!G.pvp.peerReady) status = '好友「' + G.pvp.peer.nickname + '」已加入，请就绪开始';
  else if (!G.pvp.ready) status = '好友已就绪，等你点「就绪」';
  else status = '双方已就绪，即将开始…';
  text(status, W / 2, ll.statusY, 14, COLORS.textGray, 'center', false);

  drawButtons();
  text('就绪后双方同时开始，先打完者胜', W / 2, ll.btnY + 70, 12, '#c9bfb4', 'center', false);
}

// ========== 比赛 ==========
function drawPlay() {
  const lp = L.play;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const statW = (W - 40 - lp.statGap * 2) / 3;
  const speed = G.typedLen > 0 ? Math.round(G.typedLen / (Math.max(G.elapsed, 0.5) / 60)) : 0;
  const acc = (G.totalKeys + G.wrongKeys) > 0
    ? Math.round(G.totalKeys / (G.totalKeys + G.wrongKeys) * 100) : 100;
  drawStatBox(20, lp.statY, statW, lp.statH, '得分', String(G.score));
  drawStatBox(20 + statW + lp.statGap, lp.statY, statW, lp.statH, '速度 字/分', String(speed));
  drawStatBox(20 + (statW + lp.statGap) * 2, lp.statY, statW, lp.statH, '正确率', acc + '%');

  // 竞速赛道
  const laneX = 24;
  const laneW = lp.finishX - laneX - 14;
  let lanes;
  if (G.gameMode === 'pvp') {
    const peerName = G.pvp.peer.nickname || '对手';
    lanes = [
      { label: peerName, color: COLORS.ai, prog: G.pvp.peerFinished ? 1 : (G.pvp.peerTypedLen / Math.max(G.passage.length, 1)) },
      { label: '我', color: COLORS.me, prog: G.typedLen / Math.max(G.passage.length, 1) },
    ];
  } else {
    lanes = [
      { label: '对手', color: COLORS.ai, prog: G.aiFinished ? 1 : G.aiProgress },
      { label: '我', color: COLORS.me, prog: G.typedLen / Math.max(G.passage.length, 1) },
    ];
  }
  for (let i = 0; i < lanes.length; i++) {
    const y = lp.trackY + i * (lp.laneH + lp.laneGap);
    const la = lanes[i];
    text(la.label.length > 4 ? la.label.slice(0, 4) + '…' : la.label, laneX - 34, y + lp.laneH / 2, 13, COLORS.textDark, 'right', true);
    ctx.fillStyle = COLORS.barBg;
    roundRect(laneX, y, laneW, lp.laneH, 16);
    ctx.fill();
    const fillW = Math.max(0, laneW * Math.min(1, Math.max(0, la.prog)));
    if (fillW > 2) {
      ctx.fillStyle = la.color;
      roundRect(laneX, y, fillW, lp.laneH, 16);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(laneX + fillW, y + lp.laneH / 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = la.color;
      ctx.fill();
    }
  }
  ctx.strokeStyle = COLORS.lose;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lp.finishX, lp.trackY - 6);
  ctx.lineTo(lp.finishX, lp.trackY + lp.laneH * 2 + lp.laneGap + 6);
  ctx.stroke();
  text('终点', lp.finishX, lp.trackY - 18, 11, COLORS.lose, 'center', true);

  // 减速广告按钮（AI 单机）
  if (G.slowBtn) {
    const b = G.slowBtn;
    ctx.fillStyle = '#ff7043';
    roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    text(b.label, b.x + b.w / 2, b.y + b.h / 2, 14, '#ffffff', 'center', true);
  }

  // 连击
  if (G.combo >= 5) text('连击 ×' + G.combo, W / 2, lp.comboY, 18, '#ff7043', 'center', true);

  // 文章面板
  ctx.fillStyle = COLORS.card;
  roundRect(lp.panelX, lp.panelY, lp.panelW, lp.panelH, 12);
  ctx.fill();
  drawPassage(lp.panelX + 16, lp.panelY + 12, lp.panelW - 32, lp.panelH - 24);

  // 输入回显
  ctx.fillStyle = G.flash > 0 ? '#ffebee' : COLORS.card;
  roundRect(lp.panelX, lp.echoY, lp.panelW, lp.echoH, 10);
  ctx.fill();
  ctx.strokeStyle = G.flash > 0 ? COLORS.lose : '#e0d8ce';
  ctx.lineWidth = 2;
  roundRect(lp.panelX, lp.echoY, lp.panelW, lp.echoH, 10);
  ctx.stroke();
  text('当前输入', lp.panelX + 14, lp.echoY + lp.echoH / 2, 12, COLORS.textGray, 'left', false);
  const echo = G.lastValue || (G.playerFinished ? '已完成，等待结果…' : '（等待输入…）');
  text(echo.length > 22 ? echo.slice(0, 22) + '…' : echo, lp.panelX + 86, lp.echoY + lp.echoH / 2, 15, COLORS.textDark, 'left', false);

  const hint = G.gameMode === 'pvp'
    ? '与好友竞速中：先打完者胜'
    : (G.mode === 'cn' ? '中文模式：选好候选词自动推进 · 按「完成」提交' : '英文模式：逐字输入自动推进');
  text(hint, W / 2, lp.hintY, 12, COLORS.textGray, 'center', false);
}

function drawPassage(x0, y0, maxW, maxH) {
  ctx.font = FONT_PASSAGE;
  const lines = layoutLines(G.passage, maxW);
  let idx = 0, y = y0 + 18;
  for (let li = 0; li < lines.length && li < 4; li++) {
    const ln = lines[li];
    let x = x0;
    for (let ci = 0; ci < ln.length; ci++) {
      const ch = ln[ci];
      const w = ctx.measureText(ch).width;
      const isTyped = idx < G.typedLen;
      const isCur = idx === G.typedLen;
      if (isCur) {
        ctx.fillStyle = G.flash > 0 ? 'rgba(244,67,54,0.35)' : 'rgba(33,150,243,0.28)';
        ctx.fillRect(x - 1, y - 14, w + 2, 21);
      }
      ctx.fillStyle = isTyped ? '#2e7d32' : (isCur ? '#0d47a1' : '#b0a89e');
      ctx.font = isTyped ? 'bold ' + FONT_PASSAGE : FONT_PASSAGE;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, x, y);
      x += w;
      idx++;
    }
    y += 25;
  }
}

function layoutLines(text, maxW) {
  const lines = [];
  if (G.mode === 'en') {
    const words = text.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const cand = line ? line + ' ' + words[i] : words[i];
      if (line && ctx.measureText(cand).width > maxW) { lines.push(line); line = words[i]; }
      else line = cand;
    }
    if (line) lines.push(line);
  } else {
    let line = '';
    for (let i = 0; i < text.length; i++) {
      const cand = line + text[i];
      if (line && ctx.measureText(cand).width > maxW) { lines.push(line); line = text[i]; }
      else line = cand;
    }
    if (line) lines.push(line);
  }
  return lines;
}

// ========== 结算 ==========
function drawResult() {
  const lr = L.result;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const win = G.result === 'win';
  const c = win ? COLORS.win : COLORS.lose;
  const vs = G.gameMode === 'pvp' ? '对手' : 'AI';
  text(win ? '胜 利' : '失 败', W / 2, lr.bannerY, 42, c, 'center', true);
  text(win ? '你赢了' + vs + '！' : vs + '抢先到达终点，再试一次！', W / 2, lr.bannerY + 32, 14, COLORS.textGray, 'center', false);

  // 段位
  ctx.beginPath();
  ctx.arc(W / 2, lr.rankY, lr.rankR, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.rankBg;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  text(G.rank, W / 2, lr.rankY, 40, '#ffffff', 'center', true);

  const rows = [
    ['用时', G.elapsed.toFixed(1) + ' 秒'],
    ['速度', G.cpm + ' 字/分'],
    ['正确率', G.accuracy + '%'],
    ['最高连击', '×' + G.maxCombo],
  ];
  for (let i = 0; i < rows.length; i++) {
    text(rows[i][0], W / 2 - 120, lr.statY + i * 30, 15, COLORS.textGray, 'left', false);
    text(rows[i][1], W / 2 + 120, lr.statY + i * 30, 17, COLORS.textDark, 'right', true);
  }

  text('得分  ' + G.score, W / 2, lr.scoreY, 38, COLORS.gold, 'center', true);

  if (G.gameMode === 'ai' && !win) {
    text('看广告复活：AI 进度回退，继续本局', W / 2, lr.scoreY + 32, 12, COLORS.textGray, 'center', false);
  }
  if (G.pvp.waitingRematch) {
    text('等待对手同意再战…', W / 2, lr.scoreY + 32, 12, COLORS.textGray, 'center', false);
  }

  drawButtons();
}

function drawNoKeyboard() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  text('当前平台不支持系统键盘（需 tt/ks.showKeyboard）', W / 2, H / 2 - 10, 14, COLORS.lose, 'center', false);
  text('请使用抖音 / 快手开发者工具运行', W / 2, H / 2 + 22, 14, COLORS.textGray, 'center', false);
}

function render() {
  if (!ctx) return;
  if (!Platform.hasKeyboard) { drawNoKeyboard(); return; }
  if (G.state === 'HOME') drawHome();
  else if (G.state === 'LOBBY') drawLobby();
  else if (G.state === 'PLAY') drawPlay();
  else if (G.state === 'RESULT') drawResult();
}

module.exports = { render };
