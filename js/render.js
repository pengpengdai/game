/**
 * render.js - Canvas 渲染层（视觉：速度竞技主题）
 * 状态：HOME / LOBBY / READY / COUNTDOWN / PLAY / RESULT
 */
const Platform = require('./platform');
const Game = require('./engine');
const Drop = require('./drop');

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
const FONT = '-apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';

const C = {
  bgTop: '#FFF7EC', bgBot: '#EFE5D6',
  ink: '#22201D', ink2: '#5C554C', muted: '#9A928A',
  card: '#FFFFFF', line: '#E9E1D6',
  orange: '#FF6B35', orange2: '#FF9350', orangeDeep: '#DE4E1C',
  navy: '#1F2A44', navy2: '#2C3B5C', navySoft: '#8FA0C0',
  green: '#16A374', red: '#E1483F', gold: '#C98A2E',
  keyFace: '#FBF8F2', keyEdge: '#CFC5B6', keyInk: '#2A2E36',
  kb1: '#232B3A', kb2: '#161C27',
};

function f(size, weight) { return (weight || 600) + ' ' + size + 'px ' + FONT; }

function rr(x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fillRR(x, y, w, h, r, color) {
  rr(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function txt(str, x, y, size, color, align, weight) {
  ctx.fillStyle = color || C.ink;
  ctx.font = f(size, weight);
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function vgrad(x, y0, y1, c0, c1) {
  const g = ctx.createLinearGradient(x, y0, x, y1 || y0 + 1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

function bg() {
  ctx.fillStyle = vgrad(0, 0, H, C.bgTop, C.bgBot);
  ctx.fillRect(0, 0, W, H);
  // 柔光斑
  const g = ctx.createRadialGradient(W * 0.18, 40, 10, W * 0.18, 40, 260);
  g.addColorStop(0, 'rgba(255,107,53,0.16)');
  g.addColorStop(1, 'rgba(255,107,53,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 340);
  const g2 = ctx.createRadialGradient(W * 0.9, H * 0.9, 10, W * 0.9, H * 0.9, 220);
  g2.addColorStop(0, 'rgba(31,42,68,0.10)');
  g2.addColorStop(1, 'rgba(31,42,68,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, H - 300, W, 300);
  // 斜纹质感
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = C.ink2;
  ctx.lineWidth = 1;
  for (let i = -H; i < W; i += 18) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H * 0.35, H * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

function cardEl(x, y, w, h, r, opt) {
  const o = opt || {};
  ctx.save();
  rr(x, y, w, h, r || 18);
  ctx.fillStyle = o.fill || C.card;
  ctx.fill();
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  if (o.stroke !== false) {
    rr(x, y, w, h, r || 18);
    ctx.strokeStyle = o.stroke || 'rgba(60,48,38,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function chip(x, y, w, h, label, value, accent) {
  fillRR(x, y, w, h, h / 2, '#FFFFFF');
  txt(label, x + 12, y + h / 2, 10, C.muted, 'left', 400);
  txt(value, x + w - 12, y + h / 2, 14, accent || C.ink, 'right', 700);
}

// ========== 图标 ==========
function iconBolt(x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(size * 0.55, 0);
  ctx.lineTo(size * 0.2, size * 0.58);
  ctx.lineTo(size * 0.46, size * 0.58);
  ctx.lineTo(size * 0.3, size);
  ctx.lineTo(size * 0.82, size * 0.38);
  ctx.lineTo(size * 0.52, size * 0.38);
  ctx.lineTo(size * 0.78, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function iconSpeaker(x, y, on) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = on ? C.orange : C.muted;
  ctx.beginPath();
  ctx.moveTo(-8, -3);
  ctx.lineTo(-3, -3);
  ctx.lineTo(3, -8);
  ctx.lineTo(3, 8);
  ctx.lineTo(-3, 3);
  ctx.lineTo(-8, 3);
  ctx.closePath();
  ctx.fill();
  if (on) {
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(4, 0, 5 + i * 4, -0.6, 0.6);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(6, -6); ctx.lineTo(13, 6); ctx.stroke();
  }
  ctx.restore();
}

// ========== 首页 ==========
const MILESTONES = [500, 1000, 2000, 3000, 5000, 8000];

function menuCard(x, y, w, h, title, sub, kind) {
  cardEl(x, y, w, h, 20);
  const cx = x + 60, cy = y + h / 2;
  if (kind === 'race') {
    fillRR(x + 22, cy - 26, 76, 52, 14, '#FFF1E6');
    ctx.beginPath();
    ctx.arc(x + 60, cy, 17, 0, Math.PI * 2);
    ctx.fillStyle = C.navy;
    ctx.fill();
    txt('VS', x + 60, cy, 11, '#fff', 'center', 800);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      fillRR(x + 24 + c * 8 + r * 2, cy + 20 + r * 7, 6, 4, 1.5, 'rgba(255,107,53,0.55)');
    }
  } else {
    fillRR(x + 22, cy - 26, 76, 52, 14, '#EAF2FF');
    const t1 = '词语', t2 = '掉落';
    fillRR(x + 32, cy - 18, 56, 18, 9, 'rgba(31,42,68,0.88)');
    txt(t1, x + 60, cy - 9, 9, '#fff', 'center', 700);
    fillRR(x + 40, cy + 2, 48, 16, 8, 'rgba(255,107,53,0.92)');
    txt(t2, x + 64, cy + 10, 9, '#fff', 'center', 700);
  }
  txt(title, x + 118, cy - 14, 21, C.ink, 'left', 800);
  txt(sub, x + 118, cy + 10, 11, C.muted, 'left', 400);
  txt('›', x + w - 26, cy, 22, C.orange, 'right', 800);
}

function drawHome() {
  const M = L.main;
  const T = L.top || 0;
  bg();

  const bob = Math.sin(Date.now() / 650) * 2;
  fillRR(22, T + 40 + bob, 44, 44, 12, C.orange);
  iconBolt(22 + 12, T + 48 + bob, 22, '#FFFFFF');
  txt('打字比赛', 78, T + 52, 24, C.ink, 'left', 800);
  txt('速度竞技 · 两种玩法', 78, T + 74, 11, C.muted, 'left', 400);
  if (G.todayBest > 0) {
    fillRR(W - 118, T + 62, 96, 22, 11, 'rgba(201,138,46,0.12)');
    txt('今日 ' + G.todayBest + ' 字/分', W - 70, T + 73, 10, C.gold, 'center', 700);
  }

  menuCard(M.cardX, M.card1Y, M.cardW, M.cardH, '打字比赛', 'AI / 好友竞速 · 30 秒一局', 'race');
  menuCard(M.cardX, M.card2Y, M.cardW, M.cardH, '打字游戏', '词语掉落 · 打对消除 · 守住 10 颗星', 'drop');

  txt('选一个玩法开始', W / 2, M.tipY, 11, C.muted, 'center', 400);
  drawButtons();
}

function drawDrop() {
  const D = Drop.S;
  const T = L.top || 0;
  bg();

  // 顶部 HUD
  cardEl(14, T + 8, W - 28, 52, 16);
  txt(String(D.score), 32, T + 30, 20, C.gold, 'left', 800);
  txt('分', 32 + (String(D.score).length * 12), T + 33, 9, C.muted, 'left', 400);
  txt('第 ' + D.level + ' 关', W / 2, T + 22, 13, C.ink, 'center', 700);
  txt('已消除 ' + D.cleared, W / 2, T + 40, 9, C.muted, 'center', 400);

  // 星星（右对齐 10 颗）
  const starR = 5.2, gapS = 11;
  const sx0 = W - 22 - (MAX_STAR_SLOTS - 1) * gapS;
  for (let i = 0; i < MAX_STAR_SLOTS; i++) {
    const filled = i < D.stars;
    drawStar(sx0 + i * gapS, T + 34, starR, filled ? C.gold : 'rgba(34,32,29,0.14)');
  }

  // 危险线
  const ly = D.lineY;
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(225,72,63,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(16, ly);
  ctx.lineTo(W - 16, ly);
  ctx.stroke();
  ctx.restore();
  txt('漏到线下扣 1 ★', W / 2, ly - 9, 9, 'rgba(225,72,63,0.75)', 'center', 600);

  // 掉落词
  for (let i = 0; i < D.words.length; i++) {
    const w = D.words[i];
    const typed = w.typed.length;
    const padX = 10, h = 30;
    const x = w.x, y = w.y;
    fillRR(x, y + 2, w.w, h, 12, 'rgba(31,42,68,0.18)');
    fillRR(x, y, w.w, h, 12, '#FFFFFF');
    let tx = x + padX;
    ctx.textBaseline = 'middle';
    for (let ci = 0; ci < w.text.length; ci++) {
      const ch = w.text[ci];
      ctx.font = (ci <= typed ? 700 : 600) + ' 16px ' + FONT;
      const cw = ctx.measureText(ch).width;
      if (ci === typed) {
        fillRR(tx - 2, y + 5, cw + 4, 20, 6, 'rgba(255,107,53,0.18)');
      }
      ctx.fillStyle = ci < typed ? C.green : (ci === typed ? C.orangeDeep : 'rgba(34,32,29,0.66)');
      ctx.textAlign = 'left';
      ctx.fillText(ch, tx, y + h / 2);
      tx += cw;
    }
  }

  // 弹字
  for (let i = D.popups.length - 1; i >= 0; i--) {
    const p = D.popups[i];
    const age = (Date.now() - p.at) / 900;
    if (age >= 1) { D.popups.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = 1 - age;
    const color = p.color === 'red' ? C.red : (p.color === 'star' ? C.gold : C.orangeDeep);
    txt(p.text, p.x, p.y - age * 34, 15, color, 'center', 800);
    ctx.restore();
  }

  // 漏词红闪
  if (D.flash > 0) {
    ctx.fillStyle = 'rgba(225,72,63,' + (D.flash * 0.55).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  // 底部输入提示（系统输入法）
  const bottomY = ly + 16;
  cardEl(20, bottomY, W - 40, Math.max(46, H - (L.bottom || 0) - bottomY - 14), 16);
  txt('用输入法打字 · 打对自动消除', W / 2, bottomY + 24, 12, C.ink, 'center', 700);
  txt('打掉整词才消除 · 只打对前缀不算', W / 2, bottomY + 44, 10, C.muted, 'center', 400);

  drawButtons();
}

function drawDropResult() {
  const D = Drop.S;
  const lr = L.result;
  bg();
  cardEl(22, lr.bannerY - 34, W - 44, 96, 20, { glow: 'rgba(225,72,63,0.12)' });
  txt('星星耗尽了', W / 2, lr.bannerY, 28, C.red, 'center', 800);
  txt('第 ' + D.level + ' 关 · 消除 ' + D.cleared + ' 个词', W / 2, lr.bannerY + 30, 12, C.muted, 'center', 400);

  cardEl(22, lr.cardY, W - 44, 112, 18);
  const cells = [
    ['得分', String(D.score)],
    ['消除词数', String(D.cleared)],
    ['最高连击', '×' + D.maxCombo],
    ['到达关卡', '第 ' + D.level + ' 关'],
  ];
  const cw = (W - 44 - 24) / 2;
  for (let i = 0; i < cells.length; i++) {
    const cxx = 22 + 14 + (i % 2) * (cw + 10);
    const cyy = lr.cardY + 28 + Math.floor(i / 2) * 50;
    txt(cells[i][0], cxx, cyy, 10, C.muted, 'left', 400);
    txt(cells[i][1], cxx, cyy + 20, 17, C.ink, 'left', 800);
  }
  txt(D.revived ? '已用过复活' : '看广告可复活，星星回到 3 颗', W / 2, lr.curveY + 12, 11, C.muted, 'center', 400);
  drawButtons();
}

function drawStar(cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

const MAX_STAR_SLOTS = 10;

function drawRaceHome() {
  const lh = L.home;
  const T = L.top || 0;
  bg();

  // 品牌区（预留状态栏高度）+ 键帽轻微呼吸跳动
  const bob = Math.sin(Date.now() / 650) * 2;
  fillRR(22, T + 40 + bob, 44, 44, 12, C.orange);
  iconBolt(22 + 12, T + 48 + bob, 22, '#FFFFFF');
  txt('打字比赛', 78, T + 52, 24, C.ink, 'left', 800);
  txt('速度竞技 · AI 对决 / 好友对战', 78, T + 74, 11, C.muted, 'left', 400);
  if (G.todayBest > 0) {
    fillRR(W - 118, T + 62, 96, 22, 11, 'rgba(201,138,46,0.12)');
    txt('今日 ' + G.todayBest + ' 字/分', W - 70, T + 73, 10, C.gold, 'center', 700);
  }

  // 音效
  drawButton(G.buttons.find((b) => b.action === 'sound'));

  // 成就卡
  const best = G.best || 0;
  let next = MILESTONES.find((m) => best < m) || (Math.floor(best / 1000) + 1) * 1000;
  const prev = [0].concat(MILESTONES.filter((m) => m <= best)).pop();
  const pct = Math.min(1, (best - prev) / Math.max(1, next - prev));
  cardEl(22, lh.bestY, W - 44, lh.bestH, 18, { glow: 'rgba(255,107,53,0.18)' });
  txt('最高分', 40, lh.bestY + 26, 11, C.muted, 'left', 400);
  txt(String(best), 40, lh.bestY + 54, 30, C.ink, 'left', 800);
  txt('还差 ' + Math.max(0, next - best) + ' 分解锁新成就', 40, lh.bestY + 78, 10, C.muted, 'left', 400);
  fillRR(40, lh.bestY + 86, W - 100, 3, 1.5, 'rgba(34,32,29,0.10)');
  fillRR(40, lh.bestY + 86, Math.max(4, (W - 100) * pct), 3, 1.5, C.orange);
  iconBolt(W - 44, lh.bestY + 40, 22, 'rgba(255,107,53,0.35)');

  // 语言 / 难度
  txt('语言', 22, lh.modeLabelY, 11, C.muted, 'left', 600);
  txt('难度', 22, lh.levelLabelY, 11, C.muted, 'left', 600);
  drawPills();

  drawPills();
  drawButton(G.buttons.find((b) => b.action === 'start'));
  for (let i = 0; i < G.buttons.length; i++) {
    const b = G.buttons[i];
    if (b.action === 'start' || b.action === 'sound') continue;
    if (b.action && (b.action.indexOf('mode:') === 0 || b.action.indexOf('level:') === 0)) continue;
    drawButton(b);
  }

  if (G.lb.showFriend || G.lb.showGlobal) drawBoardModal();
}

function drawPills() {
  for (let i = 0; i < G.buttons.length; i++) {
    const b = G.buttons[i];
    if (!b.action || b.action.indexOf('mode:') !== 0 && b.action.indexOf('level:') !== 0) continue;
    const active = !!b.active;
    if (active) {
      rr(b.x, b.y, b.w, b.h, b.h / 2);
      ctx.fillStyle = b.action.indexOf('mode:') === 0
        ? vgrad(0, b.y, b.y + b.h, C.orange2, C.orange)
        : vgrad(0, b.y, b.y + b.h, C.navy2, C.navy);
      ctx.fill();
    } else {
      fillRR(b.x, b.y, b.w, b.h, b.h / 2, 'rgba(255,255,255,0.75)');
      rr(b.x, b.y, b.w, b.h, b.h / 2);
      ctx.strokeStyle = 'rgba(60,48,38,0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    txt(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 15, active ? '#FFFFFF' : C.ink2, 'center', active ? 800 : 600);
  }
}

function drawButton(b) {
  if (!b || b.card) return;
  if (b.action === 'pause') {
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(31,42,68,0.10)';
    ctx.fill();
    ctx.fillStyle = C.navy;
    ctx.fillRect(b.x + b.w / 2 - 5, b.y + 11, 3, 12);
    ctx.fillRect(b.x + b.w / 2 + 2, b.y + 11, 3, 12);
    return;
  }
  if (b.action === 'sound') {
    fillRR(b.x, b.y, b.w, b.h, b.h / 2, 'rgba(255,255,255,0.85)');
    iconSpeaker(b.x + b.w / 2, b.y + b.h / 2, G.soundOn);
    return;
  }
  if (b.action === 'start') {
    const k = 1 + Math.sin(Date.now() / 900) * 0.008;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(k, k);
    fillRR(-b.w / 2, -b.h / 2 + 3, b.w, b.h, b.h / 2, C.orangeDeep);
    rr(-b.w / 2, -b.h / 2, b.w, b.h, b.h / 2);
    ctx.fillStyle = vgrad(0, -b.h / 2, b.h / 2, C.orange2, C.orange);
    ctx.fill();
    txt(b.label, -6, 1, 17, '#FFFFFF', 'center', 800);
    txt('›', b.w / 2 - 20, 1, 20, 'rgba(255,255,255,0.85)', 'center', 700);
    ctx.restore();
    return;
  }
  if (b.secondary) {
    cardEl(b.x, b.y, b.w, b.h, b.h / 2, { fill: '#FFFFFF', stroke: 'rgba(31,42,68,0.22)' });
    txt(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 15, C.navy, 'center', 700);
    return;
  }
  if (b.primary) {
    fillRR(b.x, b.y + 2, b.w, b.h - 2, (b.h - 2) / 2, C.orangeDeep);
    rr(b.x, b.y, b.w, b.h - 2, (b.h - 2) / 2);
    ctx.fillStyle = vgrad(0, b.y, b.y + b.h, C.orange2, C.orange);
    ctx.fill();
    txt(b.label, b.x + b.w / 2, b.y + b.h / 2, b.small ? 13 : 16, '#FFFFFF', 'center', 800);
    return;
  }
  if (b.active) {
    fillRR(b.x, b.y, b.w, b.h, 12, 'rgba(255,107,53,0.14)');
    txt(b.label, b.x + b.w / 2, b.y + b.h / 2, 14, C.orangeDeep, 'center', 700);
    return;
  }
  cardEl(b.x, b.y, b.w, b.h, 12, { fill: 'rgba(255,255,255,0.92)' });
  txt(b.label, b.x + b.w / 2, b.y + b.h / 2, b.small ? 12 : 14, C.ink2, 'center', 600);
}

function drawButtons() {
  for (let i = 0; i < G.buttons.length; i++) drawButton(G.buttons[i]);
}

function drawBoardModal() {
  ctx.fillStyle = 'rgba(26,22,18,0.42)';
  ctx.fillRect(0, 0, W, H);
  const M = L.home.lbModal;
  cardEl(M.x, M.y, M.w, M.h, 20);
  txt(G.lb.showFriend ? '好友排行榜' : '全局排行榜', M.x + 24, M.y + 32, 16, C.ink, 'left', 800);
  txt(G.lb.showFriend ? '和好友比一比' : (G.mode === 'en' ? '英文' : '中文') + ' · ' + levelName(G.level), M.x + 24, M.y + 54, 11, C.muted, 'left', 400);
  if (G.lb.showFriend) drawFriendBoard(M.x + 20, M.y + 72, M.w - 40, M.h - 120);
  else drawGlobalBoard(M.x + 20, M.y + 72, M.w - 40, M.h - 120);
  for (let i = 0; i < G.buttons.length; i++) drawButton(G.buttons[i]);
}

function drawFriendBoard(x, y, w, h) {
  const od = getOdCanvas();
  if (od && od.width > 0) {
    try { ctx.drawImage(od, x, y, w, h); } catch (e) { txt('好友榜加载中…', x + w / 2, y + h / 2, 13, C.muted); }
    return;
  }
  txt('需在抖音 / 快手环境查看好友榜', x + w / 2, y + h / 2 - 8, 13, C.muted);
  txt('开发者工具中关系链数据不可用', x + w / 2, y + h / 2 + 14, 11, 'rgba(154,146,138,0.8)');
}

let odCanvas = null;
function getOdCanvas() {
  if (odCanvas) return odCanvas;
  try {
    const odc = Platform.getOpenDataContext();
    odCanvas = odc && odc.canvas ? odc.canvas : null;
  } catch (e) { odCanvas = null; }
  return odCanvas;
}

function drawGlobalBoard(x, y, w, h) {
  const list = G.lb.globalList || [];
  if (!list.length) {
    txt('暂无数据，先打一局上榜', x + w / 2, y + h / 2, 13, C.muted);
    return;
  }
  list.slice(0, 6).forEach((r, i) => {
    const ry = y + 18 + i * 34;
    fillRR(x, ry - 14, w, 30, 10, i < 3 ? 'rgba(255,107,53,0.08)' : '#FAF7F2');
    txt(String(i + 1), x + 18, ry, 13, i === 0 ? C.orange : C.ink2, 'left', 800);
    txt(r.nickname || '玩家', x + 44, ry, 13, C.ink, 'left', 600);
    txt(String(r.score || 0), x + w - 16, ry, 14, C.gold, 'right', 800);
  });
  if (G.lb.mine) txt('我的排名 第 ' + G.lb.mine.rank + ' 名', x + w / 2, y + h - 8, 11, C.muted);
}

function levelName(lv) { return { easy: '简单', normal: '普通', hard: '困难' }[lv] || lv; }

// ========== 大厅 ==========
function drawLobby() {
  const ll = L.lobby;
  bg();
  txt('好友对战', W / 2, ll.titleY, 26, C.ink, 'center', 800);
  txt('同文竞速 · 先打完者胜', W / 2, ll.subY, 11, C.muted, 'center', 400);

  cardEl(22, ll.cardY, W - 44, ll.cardH, 20);
  txt('房间号', W / 2, ll.cardY + 24, 10, C.muted, 'center', 400);
  txt(G.pvp.roomId || '— — —', W / 2, ll.cardY + 54, 30, C.navy, 'center', 800);
  txt((G.mode === 'en' ? '英文' : '中文') + ' · ' + levelName(G.level), W / 2, ll.cardY + 84, 11, C.muted, 'center', 400);

  // 双方
  const y = ll.vsY;
  const left = { x: 78, name: '我', color: C.navy, ready: G.pvp.ready };
  const right = { x: W - 78, name: G.pvp.peer.nickname || '等待加入', color: C.orange, ready: G.pvp.peerReady };
  [left, right].forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, y, 30, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, y, 30, 0, Math.PI * 2);
    ctx.strokeStyle = p.ready ? C.green : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    txt(p.name.slice(0, 1), p.x, y, 20, '#fff', 'center', 800);
    txt(p.name.length > 5 ? p.name.slice(0, 5) + '…' : p.name, p.x, y + 46, 12, C.ink, 'center', 600);
    txt(p.ready ? '已就绪' : '未就绪', p.x, y + 64, 10, p.ready ? C.green : C.muted, 'center', 600);
  });
  ctx.beginPath();
  ctx.arc(W / 2, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(31,42,68,0.10)';
  ctx.fill();
  txt('VS', W / 2, y, 12, C.navy, 'center', 800);

  const status = !G.pvp.peer.nickname ? '分享给好友，等他进来' : (!G.pvp.ready ? '点「就绪」，双方同时开打' : '等待双方就绪…');
  txt(status, W / 2, ll.statusY, 12, C.muted, 'center', 400);

  drawButtons();
}

// ========== 对局 ==========
// ---- 体感层：打字符粒子 / 分数飘字 / 全屏脉冲 / 紧迫感 ----
let lastTypedSeen = 0;
let particles = [];
let particleFrame = 0;
const charPos = {};

function syncParticles() {
  if (G.typedLen < lastTypedSeen) { lastTypedSeen = G.typedLen; particles = []; return; }
  if (G.typedLen === lastTypedSeen) return;
  const colors = [C.orange, C.gold, C.green];
  for (let i = lastTypedSeen; i < G.typedLen; i++) {
    const q = charPos[i];
    if (!q) continue;
    for (let k = 0; k < 3; k++) {
      particles.push({
        x: q.x + q.w / 2 + (Math.random() - 0.5) * q.w,
        y: q.y - 2,
        vx: (Math.random() - 0.5) * 28,
        vy: -20 - Math.random() * 22,
        life: 0.5 + Math.random() * 0.15, max: 0.65,
        r: 1.5 + Math.random() * 2.2,
        color: colors[(i + k) % 3],
      });
    }
  }
  lastTypedSeen = G.typedLen;
  if (particles.length > 120) particles.splice(0, particles.length - 120);
}

function drawParticles() {
  const now = performance.now();
  const dt = Math.min(0.04, (now - (particleFrame || now)) / 1000);
  particleFrame = now;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 62 * dt;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloats() {
  const lp = L.play;
  const list = G.fx.floats || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    const age = (Date.now() - f.at) / 900;
    if (age >= 1) { list.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = 1 - age;
    txt(f.text, lp.panelX + 40 + i * 2, lp.panelY + 26 - age * 30, 14, C.orangeDeep, 'left', 800);
    ctx.restore();
  }
}

function drawPulse() {
  if (!G.fx.pulseAt) return;
  const age = (Date.now() - G.fx.pulseAt) / 600;
  if (age >= 1) { G.fx.pulseAt = 0; return; }
  ctx.fillStyle = 'rgba(' + (G.fx.pulseColor || '255,107,53') + ',' + (0.20 * (1 - age)).toFixed(3) + ')';
  ctx.fillRect(0, 0, W, H);
}

function drawTension() {
  if (G.state !== 'PLAY' && G.state !== 'COUNTDOWN' && G.state !== 'PAUSED') return;
  const total = Math.max(1, G.passage.length);
  const myP = G.typedLen / total;
  const aiP = G.gameMode === 'pvp'
    ? (G.pvp.peerFinished ? 1 : (G.pvp.peerTypedLen || 0) / total)
    : G.aiProgress;
  const gap = aiP - myP;
  const cy = (L.top + H - L.bottom) / 2;
  if (gap > 0.12) {
    // 落后：边缘红晕呼吸
    const a = Math.min(0.42, 0.14 + gap * 0.5) * (0.72 + 0.28 * Math.sin(Date.now() / 240));
    const g = ctx.createRadialGradient(W / 2, cy, H * 0.30, W / 2, cy, H * 0.70);
    g.addColorStop(0, 'rgba(225,72,63,0)');
    g.addColorStop(1, 'rgba(225,72,63,' + a.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (myP - aiP > 0.15 && myP > 0.15) {
    // 领先：暖光包围
    const g = ctx.createRadialGradient(W / 2, cy, H * 0.34, W / 2, cy, H * 0.74);
    g.addColorStop(0, 'rgba(255,176,80,0)');
    g.addColorStop(1, 'rgba(255,176,80,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawGo() {
  if (!G.fx.goAt) return;
  const age = (Date.now() - G.fx.goAt) / 1000;
  if (age > 0.55) { G.fx.goAt = 0; return; }
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - age / 0.55);
  const sc = 0.72 + age * 1.5;
  ctx.translate(W / 2, (L.top + H - L.bottom) / 2 - 40);
  ctx.scale(sc, sc);
  txt('GO!', 0, 0, 46, C.orange, 'center', 800);
  ctx.restore();
}

function drawBubble() {
  if (!G.fx.bubble) return;
  const age = (Date.now() - G.fx.bubble.at) / 1000;
  if (age > 2.4) { G.fx.bubble = null; return; }
  ctx.save();
  ctx.globalAlpha = age < 1.8 ? 1 : Math.max(0, (2.4 - age) / 0.6);
  const lp = L.play;
  const text = G.fx.bubble.text;
  ctx.font = f(11, 600);
  const tw = ctx.measureText(text).width;
  const w = tw + 22, h = 30;
  const bx = lp.headX + lp.headW - w - 10, by = lp.headY + lp.headH + 4;
  ctx.beginPath();
  ctx.moveTo(bx + w - 24, by + 2);
  ctx.lineTo(bx + w - 16, by - 7);
  ctx.lineTo(bx + w - 10, by + 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(31,42,68,0.92)';
  ctx.fill();
  fillRR(bx, by, w, h, 12, 'rgba(31,42,68,0.92)');
  txt(text, bx + w / 2, by + h / 2, 11, '#fff', 'center', 600);
  ctx.restore();
}

function drawMilestone() {
  if (!G.fx.milestone) return;
  const age = (Date.now() - G.fx.milestone.at) / 1000;
  if (age > 1.5) { G.fx.milestone = null; return; }
  const lp = L.play;
  ctx.save();
  ctx.globalAlpha = age < 0.9 ? 1 : Math.max(0, (1.5 - age) / 0.6);
  // 放在记分板顶部，避免盖住文章文字
  const y = lp.headY + 1;
  const w = 168, cx = W / 2;
  fillRR(cx - w / 2, y, w, 24, 12, 'rgba(255,107,53,0.92)');
  txt(G.fx.milestone.text, cx, y + 12, 11, '#fff', 'center', 700);
  ctx.restore();
}

function drawFinisher() {
  if (!G.fx.finisherAt) return;
  const age = (Date.now() - G.fx.finisherAt) / 1000;
  if (age > 0.9) { G.fx.finisherAt = 0; return; }
  const lp = L.play;
  const cx = W / 2, cy = lp.panelY + Math.min(70, lp.panelH / 2);
  const p = age / 0.9;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const rp = Math.min(1, p * 1.7 - i * 0.22);
    if (rp <= 0) continue;
    ctx.beginPath();
    ctx.arc(cx, cy, 28 + rp * 150, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,107,53,' + (0.55 * (1 - rp)).toFixed(3) + ')';
    ctx.lineWidth = 7 * (1 - rp) + 1;
    ctx.stroke();
  }
  const sc = 1 + Math.sin(Math.min(1, p * 1.5) * Math.PI) * 0.32;
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);
  txt('完成！', 0, 0, 30, '#fff', 'center', 800);
  ctx.restore();
}

function drawBattle() {
  bg();
  drawTension();
  drawScoreboard();
  drawStatChips();
  drawPassageCard();
  syncParticles();
  drawParticles();
  drawFloats();

  drawBubble();
  drawMilestone();
  drawFinisher();
  drawPulse();
  drawGo();

  if (G.kb.visible) drawKeyboard();
  else if (G.state === 'READY') drawKbPlaceholder();
  else if (G.mode === 'cn' && G.state === 'PLAY') drawSystemKbPanel();

  if (G.slowBtn && G.state === 'PLAY') {
    const b = G.slowBtn;
    fillRR(b.x, b.y + 2, b.w, b.h - 2, 14, C.orangeDeep);
    rr(b.x, b.y, b.w, b.h - 2, 14);
    ctx.fillStyle = vgrad(0, b.y, b.y + b.h, C.orange2, C.orange);
    ctx.fill();
    txt('⚡ ' + b.label, b.x + b.w / 2, b.y + b.h / 2, 12, '#fff', 'center', 700);
  }
}

function laneData() {
  const n = Math.max(G.passage.length, 1);
  if (G.gameMode === 'pvp') {
    return [
      { me: true, name: '我', p: G.typedLen / n, color: C.navy, tag: G.playerFinished ? '已完成' : '' },
      { me: false, name: G.pvp.peer.nickname || '对手', p: G.pvp.peerFinished ? 1 : G.pvp.peerTypedLen / n, color: C.orange, tag: G.pvp.peerFinished ? '已完成' : '' },
    ];
  }
  return [
    { me: true, name: '我', p: G.typedLen / n, color: C.navy, tag: G.playerFinished ? '已完成' : '' },
    { me: false, name: (G.aiRole && G.aiRole.name) || 'AI 对手', initial: (G.aiRole && G.aiRole.initial) || '对',
      p: G.aiFinished ? 1 : G.aiProgress, color: C.orange, tag: G.aiFinished ? '已完成' : (G.challenge ? '好友记录' : '') },
  ];
}

function drawScoreboard() {
  const lp = L.play;
  cardEl(lp.headX, lp.headY, lp.headW, lp.headH, 18);
  const rows = laneData();
  const mid = W / 2;
  const cy = lp.headY + 34;
  const trackY = lp.headY + 62;

  // 中央 VS
  ctx.beginPath();
  ctx.arc(mid, cy, 15, 0, Math.PI * 2);
  ctx.fillStyle = C.navy;
  ctx.fill();
  txt('VS', mid, cy, 10, '#fff', 'center', 800);

  // 两侧镜像布局
  const L0 = { avX: lp.headX + 28, nameX: lp.headX + 48, nameAlign: 'left', pctX: mid - 34, pctAlign: 'right', trackX: lp.headX + 14, trackW: mid - lp.headX - 44 };
  const R0 = { avX: lp.headX + lp.headW - 28, nameX: lp.headX + lp.headW - 48, nameAlign: 'right', pctX: mid + 34, pctAlign: 'left', trackX: mid + 16, trackW: lp.headX + lp.headW - 16 - (mid + 16) };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const S = i === 0 ? L0 : R0;
    // 头像
    ctx.beginPath();
    ctx.arc(S.avX, cy, 13, 0, Math.PI * 2);
    ctx.fillStyle = r.color;
    ctx.fill();
    txt(r.me ? '我' : (r.initial || r.name.slice(0, 1) || '对'), S.avX, cy, 10, '#fff', 'center', 800);
    // 名字
    txt(r.name.length > 6 ? r.name.slice(0, 6) + '…' : r.name, S.nameX, lp.headY + 22, 12, C.ink, S.nameAlign, 700);
    // 进度百分比
    txt(Math.round(Math.min(1, Math.max(0, r.p)) * 100) + '%', S.pctX, lp.headY + 22, 15, r.color, S.pctAlign, 800);
    if (r.tag) txt(r.tag, S.nameX, lp.headY + 40, 9, C.green, S.nameAlign, 700);

    // 跑道
    fillRR(S.trackX, trackY, S.trackW, 9, 4.5, 'rgba(34,32,29,0.07)');
    const fw = Math.max(0, S.trackW * Math.min(1, Math.max(0, r.p)));
    if (fw > 1) {
      rr(S.trackX, trackY, Math.max(fw, 9), 9, 4.5);
      ctx.fillStyle = r.color;
      ctx.fill();
    }
    // 跑者光点
    const dotX = S.trackX + Math.min(S.trackW, fw);
    ctx.beginPath();
    ctx.arc(dotX, trackY + 4.5, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dotX, trackY + 4.5, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = r.color;
    ctx.fill();
    // 终点旗
    const fx = S.trackX + S.trackW + 6;
    ctx.strokeStyle = 'rgba(34,32,29,0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx, trackY - 5);
    ctx.lineTo(fx, trackY + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx, trackY - 5);
    ctx.lineTo(fx + 8, trackY - 2);
    ctx.lineTo(fx, trackY + 2);
    ctx.closePath();
    ctx.fillStyle = C.red;
    ctx.fill();
  }

  // 连击浮字
  const since = Date.now() - G.fx.comboAt;
  if (G.fx.comboAt && since < 900) {
    const p = since / 900;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(W - 36, lp.panelY + 44 - p * 36);
    txt('×' + G.fx.comboValue, 0, 0, 26, C.orange, 'right', 800);
    txt('COMBO', 0, 22, 9, C.orange, 'right', 700);
    ctx.restore();
  }
}

function drawStatChips() {
  const lp = L.play;
  const gap = lp.statGap;
  const w = (lp.panelW - gap * 3) / 4;
  const speed = G.typedLen > 0 ? Math.round(G.typedLen / (Math.max(G.elapsed, 0.5) / 60)) : 0;
  const acc = (G.totalKeys + G.wrongKeys) > 0 ? Math.round(G.totalKeys / (G.totalKeys + G.wrongKeys) * 100) : 100;
  const items = [
    ['得分', String(G.score), C.gold],
    ['速度', speed + '/分', C.ink],
    ['正确率', acc + '%', acc >= 95 ? C.ink : C.red],
    ['连击', '×' + G.combo, G.combo >= 5 ? C.orange : C.ink],
  ];
  for (let i = 0; i < items.length; i++) {
    chip(lp.panelX + i * (w + gap), lp.statY, w, lp.statH, items[i][0], items[i][1], items[i][2]);
  }
}

function passageLines(maxW) {
  ctx.font = f(17, 400);
  const out = [];
  if (G.mode === 'en') {
    const words = G.passage.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const cand = line ? line + ' ' + words[i] : words[i];
      if (line && ctx.measureText(cand).width > maxW) { out.push(line); line = words[i]; }
      else line = cand;
    }
    if (line) out.push(line);
    let acc = 0;
    return out.map((t, i) => {
      const start = acc;
      acc += t.length + 1;
      return { text: t, start, end: Math.min(G.passage.length - 1, start + t.length - 1) };
    });
  }
  let line = '', start = 0;
  for (let i = 0; i < G.passage.length; i++) {
    const cand = line + G.passage[i];
    if (line && ctx.measureText(cand).width > maxW) {
      out.push({ text: line, start, end: start + line.length - 1 });
      start = i;
      line = G.passage[i];
    } else line = cand;
  }
  if (line) out.push({ text: line, start, end: start + line.length - 1 });
  return out;
}

function drawPassageCard() {
  const lp = L.play;
  const shake = G.flash > 0 ? Math.sin(Date.now() / 45) * 2.2 : 0;
  const err = G.flash > 0;
  ctx.save();
  ctx.translate(shake, 0);
  cardEl(lp.panelX, lp.panelY, lp.panelW, lp.panelH, 18, { stroke: err ? 'rgba(225,72,63,0.7)' : undefined });
  if (err) {
    rr(lp.panelX, lp.panelY, lp.panelW, lp.panelH, 18);
    ctx.strokeStyle = 'rgba(225,72,63,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 左侧进度轨
  const railH = lp.panelH - 36;
  fillRR(lp.panelX + 9, lp.panelY + 18, 3, railH, 1.5, 'rgba(34,32,29,0.08)');
  const prog = Math.min(1, G.typedLen / Math.max(1, G.passage.length));
  fillRR(lp.panelX + 9, lp.panelY + 18, 3, Math.max(3, railH * prog), 1.5, C.orange);

  const padX = 22, innerW = lp.panelW - padX - 16;
  const lineH = 30;
  const lines = passageLines(innerW);
  const cur = G.typedLen;
  let curLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (cur >= lines[i].start && cur <= lines[i].end + 1) { curLine = i; break; }
    if (cur > lines[i].end) curLine = i + 1;
  }
  const viewH = Math.max(1, Math.floor((lp.panelH - 34) / lineH));
  const from = Math.max(0, Math.min(curLine - viewH + 1, lines.length - viewH));

  for (const key in charPos) delete charPos[key];
  for (let li = from; li < lines.length && li < from + viewH; li++) {
    const ln = lines[li];
    const y = lp.panelY + 26 + (li - from) * lineH;
    let x = lp.panelX + padX;
    for (let ci = 0; ci < ln.text.length; ci++) {
      const ch = ln.text[ci];
      const cw = ctx.measureText(ch).width;
      const idx = ln.start + ci;
      const typed = idx < G.typedLen;
      const isCur = idx === G.typedLen;
      if (isCur) {
        const blink = Math.floor(Date.now() / 420) % 2 === 0;
        fillRR(x - 3, y - 14, cw + 6, 28, 7, err ? 'rgba(225,72,63,0.20)' : (blink ? 'rgba(255,107,53,0.20)' : 'rgba(255,107,53,0.09)'));
        if (blink || err) {
          ctx.fillStyle = err ? C.red : C.orange;
          ctx.fillRect(x - 1, y + 12, cw + 2, 2);
        }
      }
      ctx.font = (typed ? 700 : 400) + ' 17px ' + FONT;
      ctx.fillStyle = typed ? C.green : (isCur ? (err ? C.red : C.orangeDeep) : 'rgba(34,32,29,0.55)');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, x, y);
      charPos[idx] = { x: x, y: y, w: cw };
      x += cw;
    }
  }
  ctx.restore();
}

function drawKbPlaceholder() {
  const lp = L.play;
  ctx.fillStyle = 'rgba(34,32,29,0.04)';
  ctx.fillRect(0, lp.kbTop, W, lp.kbH);
  rr(20, lp.kbTop + 22, W - 40, lp.kbH - 44, 16);
  ctx.strokeStyle = 'rgba(34,32,29,0.12)';
  ctx.setLineDash && ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash && ctx.setLineDash([]);
  txt('键盘将在这里出现', W / 2, lp.kbTop + lp.kbH / 2 - 10, 14, C.ink2, 'center', 600);
  txt('选好输入方式 → 点「开始打字」', W / 2, lp.kbTop + lp.kbH / 2 + 14, 11, C.muted, 'center', 400);
}

function drawSystemKbPanel() {
  const lp = L.play;
  ctx.fillStyle = 'rgba(34,32,29,0.05)';
  ctx.fillRect(0, lp.kbTop, W, lp.kbH);
  txt('系统输入法', W / 2, lp.kbTop + 22, 11, C.muted, 'center', 600);
}

function drawKeyboard() {
  const lp = L.play;
  fillRR(0, lp.kbTop, W, lp.kbH + 24, 20, C.kb1);
  // 顶部渐变
  const g = vgrad(0, lp.kbTop, lp.kbTop + lp.kbH, C.kb2, C.kb1);
  rr(0, lp.kbTop, W, lp.kbH + 24, 20);
  ctx.fillStyle = g;
  ctx.fill();

  const tip = G.kb.tip || (G.kb.layout === 'q9' ? '连点同一键切换字母' : '点字母输入 · 空白键＝空格');
  txt(tip, W / 2, lp.kbTop + 16, 11, G.kb.tip ? '#FFC7A8' : 'rgba(255,255,255,0.45)', 'center', G.kb.tip ? 700 : 400);

  const now = Date.now();
  const rp = G.fx.ripple;
  if (rp && now - rp.at < 420) {
    const p = (now - rp.at) / 420;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, 10 + p * 26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,143,94,' + (0.5 * (1 - p)) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (let i = 0; i < G.kb.keys.length; i++) {
    const k = G.kb.keys[i];
    const pressed = G.kb.pressed === k.label && now < G.kb.pressedUntil;
    const isSpace = k.type === 'space';
    // 键帽底边
    fillRR(k.x, k.y + 3, k.w, k.h, 9, pressed ? C.orangeDeep : C.keyEdge);
    // 键面
    rr(k.x, k.y, k.w, k.h - 3, 9);
    ctx.fillStyle = pressed ? C.orange : C.keyFace;
    ctx.fill();

    if (k.type === 't9') {
      const idxSel = G.kb.t9[k.slot];
      const chars = k.chars;
      const step = 11;
      for (let ci = 0; ci < chars.length; ci++) {
        const cx = k.x + k.w / 2 + (ci - (chars.length - 1) / 2) * step;
        const on = idxSel === ci;
        txt(chars[ci], cx, k.y + (k.h - 3) / 2, 11, on ? C.orangeDeep : 'rgba(42,46,54,0.5)', 'center', on ? 800 : 600);
      }
    } else {
      txt(k.label, k.x + k.w / 2, k.y + (k.h - 3) / 2, isSpace ? 12 : 15, pressed ? '#fff' : C.keyInk, 'center', pressed ? 800 : 600);
    }
  }
}

// ========== 开局弹框 ==========
function drawReadyDialog() {
  ctx.fillStyle = 'rgba(20,16,12,0.46)';
  ctx.fillRect(0, 0, W, H);
  const R = L.ready;
  cardEl(R.cardX, R.cardY, R.cardW, R.cardH, 22);

  // 顶部装饰条
  fillRR(R.cardX, R.cardY, R.cardW, 5, 3, C.orange);
  txt('准备开始', W / 2, R.titleY, 21, C.ink, 'center', 800);
  const info = G.challenge
    ? ('挑战 ' + G.challenge.nickname + ' · 目标 ' + G.challenge.score + ' 分')
    : ((G.mode === 'en' ? '英文' : '中文') + ' · ' + levelName(G.level) + ' · ' +
      (G.gameMode === 'pvp' ? '好友对战' : 'AI 竞速 · ' + ((G.aiRole && G.aiRole.name) || '对手')));
  txt(info, W / 2, R.subY, 11, C.muted, 'center', 400);
  if (G.gameMode === 'ai' && G.aiRole && G.aiRole.taunt && G.mode === 'cn') {
    txt('「' + G.aiRole.taunt + '」', W / 2, R.subY + 20, 10, C.ink2, 'center', 400);
  }

  if (G.mode === 'en') {
    txt('选择输入方式', W / 2, R.optY - 24, 12, C.ink2, 'center', 700);
    const opts = G.buttons.filter((b) => b.kb);
    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      const active = G.kb.layout === o.kb;
      cardEl(o.x, o.y, o.w, o.h, 16, { fill: active ? '#FFF3EC' : '#F8F5F0', stroke: active ? 'rgba(255,107,53,0.6)' : 'rgba(60,48,38,0.10)', glow: active ? 'rgba(255,107,53,0.20)' : null });
      if (active) { rr(o.x, o.y, o.w, o.h, 16); ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.stroke(); }
      const px = o.x + o.w / 2, py = o.y + 28;
      ctx.fillStyle = active ? C.orange : '#CFC6B9';
      if (o.kb === 'q26') {
        for (let r = 0; r < 3; r++) {
          const cols = 5 - Math.min(1, r);
          for (let c = 0; c < cols; c++) fillRR(px - 31 + c * 13 + r * 3.5, py - 13 + r * 9, 11, 7, 2.5, active ? C.orange : '#CFC6B9');
        }
      } else {
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) fillRR(px - 21 + c * 15, py - 14 + r * 11, 12, 8, 2.5, active ? C.orange : '#CFC6B9');
      }
      txt(o.label, o.x + o.w / 2, o.y + o.h - 16, 15, active ? C.orangeDeep : C.ink2, 'center', active ? 800 : 600);
    }
    txt('推荐 26 键：英文逐字输入最快', W / 2, R.startY - 16, 10, C.muted, 'center', 400);
  } else {
    fillRR(R.cardX + 18, R.optY + 6, R.cardW - 36, 108, 14, '#F8F5F0');
    txt('中文模式使用系统输入法', W / 2, R.optY + 34, 14, C.ink, 'center', 700);
    txt('九宫格 / 全键盘由系统输入法设置决定', W / 2, R.optY + 58, 11, C.muted, 'center', 400);
    txt('选好候选词后自动前进', W / 2, R.optY + 80, 11, C.muted, 'center', 400);
  }

  for (let i = 0; i < G.buttons.length; i++) drawButton(G.buttons[i]);
  txt('开始后有 3 秒倒计时，键盘才会出现', W / 2, R.startY + R.startH + 18, 10, C.muted, 'center', 400);
}

function drawCountdown() {
  ctx.fillStyle = 'rgba(20,16,12,0.46)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = (L.top + H - L.bottom) / 2 - 40;
  const frac = 1 - (G.countdown - Math.floor(G.countdown));
  const n = Math.ceil(G.countdown);

  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 47, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.strokeStyle = C.orange;
  ctx.lineWidth = 7;
  ctx.stroke();

  const scale = 1 + (1 - frac) * 0.35;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  txt(n > 0 ? String(n) : 'GO', 0, 0, 40, C.orange, 'center', 800);
  ctx.restore();

  txt('准备打字…', cx, cy + 84, 13, 'rgba(255,255,255,0.9)', 'center', 600);
}

// ========== 结算 ==========
function confetti(t) {
  const colors = ['#FF6B35', '#FFB74D', '#16A374', '#4C8DFF', '#FF5C8A'];
  for (let i = 0; i < 30; i++) {
    const seed = i * 9973;
    const rx = (seed % 1000) / 1000;
    const speed = 0.22 + ((seed >> 3) % 100) / 420;
    const phase = (t * speed + rx * 3) % 1;
    const x = rx * (W + 40) - 20 + Math.sin(phase * 6 + i) * 8;
    const y = -30 + phase * (H * 0.8);
    const s = 5 + ((seed >> 5) % 4);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(phase * 6 + rx * 5);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, phase - 0.55) / 0.45) * 0.9;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-s / 2, -s / 3, s, s * 0.62);
    ctx.restore();
  }
}

function drawSpeedCurve() {
  const lr = L.result;
  const pts = G.curve || [];
  if (pts.length < 2) return;
  const x = 30, y = lr.curveY, w = W - 60, h = lr.curveH;
  cardEl(x - 6, y - 16, w + 12, h + 26, 14);
  txt('速度曲线', x, y - 5, 9, C.muted, 'left', 400);
  txt(G.gameMode === 'pvp' ? '我 / 对手' : '我 / 对手', x + w, y - 5, 9, C.muted, 'right', 400);

  const reveal = Math.min(1, (Date.now() - (G.fx.resultAt || 0)) / 700);
  const n = Math.max(2, Math.ceil(pts.length * reveal));
  const shown = pts.slice(0, n);
  const tMax = Math.max(1, shown[shown.length - 1].t);
  const vMax = Math.max(1, G.passage.length);
  const px = (t) => x + (t / tMax) * w;
  const py = (v) => y + 6 + (1 - Math.min(1, v / vMax)) * (h - 8);

  // 图例
  fillRR(x + w - 66, y - 12, 6, 6, 3, 'rgba(31,42,68,0.95)');
  fillRR(x + w - 34, y - 12, 6, 6, 3, 'rgba(255,107,53,0.9)');

  ctx.strokeStyle = 'rgba(34,32,29,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const yy = y + 6 + (h - 8) * i / 4;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  }

  const line = (key, color, width) => {
    ctx.beginPath();
    for (let i = 0; i < shown.length; i++) {
      const X = px(shown[i].t), Y = py(shown[i][key] || 0);
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  line('ai', 'rgba(255,107,53,0.9)', 2);
  line('me', 'rgba(31,42,68,0.95)', 2.6);
}

function drawModal() {
  if (!G.modal) return;
  ctx.fillStyle = 'rgba(20,16,12,0.46)';
  ctx.fillRect(0, 0, W, H);
  const cy = (L.top + H - L.bottom) / 2;
  cardEl(30, cy - 150, W - 60, 300, 22);
  txt(G.modal.title, W / 2, cy - 112, 20, C.ink, 'center', 800);
  fillRR(50, cy - 84, W - 100, 74, 16, '#FFF3EC');
  txt(G.modal.code, W / 2, cy - 47, 32, C.orangeDeep, 'center', 800);
  txt(G.modal.tip, W / 2, cy + 12, 11, C.muted, 'center', 400);
  drawButtons();
}

function drawResult() {
  const lr = L.result;
  bg();
  const win = G.result === 'win';
  if (win) confetti((Date.now() % 60000) / 1000);

  const t = Date.now() - (G.fx.resultAt || 0);
  const pop = Math.min(1, t / 420);
  const c = win ? C.green : C.red;

  cardEl(22, lr.bannerY - 40, W - 44, 110, 20, { glow: win ? 'rgba(22,163,116,0.20)' : 'rgba(225,72,63,0.12)' });
  ctx.save();
  ctx.translate(W / 2, lr.bannerY);
  ctx.scale(0.85 + pop * 0.15, 0.85 + pop * 0.15);
  txt(win ? '胜 利' : '失 败', 0, 0, 34, c, 'center', 800);
  ctx.restore();
  txt(win ? '你赢了' + (G.gameMode === 'pvp' ? '对手' : ' AI') + '！' : '再快一点，就能赢！', W / 2, lr.bannerY + 36, 12, C.muted, 'center', 400);

  // 段位徽章（光环）
  for (let i = 2; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(W / 2, lr.rankY, lr.rankR + 6 + i * 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,138,46,' + (0.10 - i * 0.02) + ')';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(W / 2, lr.rankY, lr.rankR, 0, Math.PI * 2);
  ctx.fillStyle = win ? C.gold : '#B4AA9E';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2, lr.rankY, lr.rankR, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  ctx.translate(W / 2, lr.rankY);
  const flip = Math.min(1, t / 460);
  const sy = 0.55 + 0.45 * flip + Math.sin(flip * Math.PI) * 0.18;
  ctx.scale(1, sy);
  txt(G.rank, 0, 0, 32, '#fff', 'center', 800);
  ctx.restore();
  txt('段位', W / 2, lr.rankY + lr.rankR + 14, 10, C.muted, 'center', 400);

  // 数据卡 2×2
  const cardY = lr.cardY;
  cardEl(22, cardY, W - 44, lr.cardH, 18);
  const cells = [
    ['用时', G.elapsed.toFixed(1) + ' 秒'],
    ['速度', G.cpm + ' 字/分'],
    ['正确率', G.accuracy + '%'],
    ['最高连击', '×' + G.maxCombo],
  ];
  const cw = (W - 44 - 24) / 2;
  for (let i = 0; i < cells.length; i++) {
    const cxx = 22 + 14 + (i % 2) * (cw + 10);
    const cyy = cardY + 28 + Math.floor(i / 2) * 50;
    txt(cells[i][0], cxx, cyy, 10, C.muted, 'left', 400);
    txt(cells[i][1], cxx, cyy + 20, 17, C.ink, 'left', 800);
  }
  ctx.strokeStyle = 'rgba(34,32,29,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, cardY + 60);
  ctx.lineTo(W - 30, cardY + 63);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2, cardY + 12);
  ctx.lineTo(W / 2, cardY + 100);
  ctx.stroke();

  drawSpeedCurve();

  const rollT = Math.min(1, t / 900);
  const shownScore = Math.round(G.score * (1 - Math.pow(1 - rollT, 3)));
  txt(String(shownScore), W / 2, lr.scoreY, 30, C.gold, 'center', 800);
  txt('得分', W / 2, lr.scoreY - 22, 10, C.muted, 'center', 400);
  if (G.challenge) {
    const gapScore = G.challenge.score - G.score;
    txt(win ? '你赢了 ' + G.challenge.nickname + '！' : ('还差 ' + gapScore + ' 分追上 ' + G.challenge.nickname),
      W / 2, lr.scoreY + 18, 10, win ? C.green : C.red, 'center', 600);
  } else if (G.gameMode === 'ai' && !win) txt('看广告复活：AI 退回 60% 继续本局', W / 2, lr.scoreY + 18, 10, C.muted, 'center', 400);
  if (G.pvp.waitingRematch) txt('等待对手同意再战…', W / 2, lr.scoreY + 18, 10, C.muted, 'center', 400);

  drawButtons();
}

function drawNoKeyboard() {
  bg();
  txt('当前环境不支持小游戏 API', W / 2, H / 2 - 10, 14, C.red);
  txt('请使用抖音 / 快手开发者工具运行', W / 2, H / 2 + 22, 12, C.muted);
}

function drawPaused() {
  ctx.fillStyle = 'rgba(20,16,12,0.46)';
  ctx.fillRect(0, 0, W, H);
  const cy = (L.top + H - L.bottom) / 2;
  cardEl(40, cy - 150, W - 80, 300, 22);
  txt('已暂停', W / 2, cy - 96, 24, C.ink, 'center', 800);
  txt('计时与对手都已冻结', W / 2, cy - 66, 11, C.muted, 'center', 400);

  const prog = G.typedLen / Math.max(1, G.passage.length);
  txt(Math.round(prog * 100) + '%', W / 2, cy - 20, 26, C.orange, 'center', 800);
  txt('当前进度', W / 2, cy + 4, 10, C.muted, 'center', 400);
  fillRR(70, cy + 18, W - 140, 6, 3, 'rgba(34,32,29,0.10)');
  fillRR(70, cy + 18, Math.max(6, (W - 140) * prog), 6, 3, C.orange);
  txt('已用 ' + G.elapsed.toFixed(1) + ' 秒 · 连击 ×' + G.combo, W / 2, cy + 44, 11, C.muted, 'center', 400);

  drawButtons();
}

function render() {
  if (!ctx) return;
  if (!Platform.hasKeyboard) { drawNoKeyboard(); return; }
  if (G.state === 'HOME') drawHome();
  else if (G.state === 'RACE_HOME') drawRaceHome();
  else if (G.state === 'LOBBY') drawLobby();
  else if (G.state === 'READY') { drawBattle(); drawReadyDialog(); }
  else if (G.state === 'COUNTDOWN') { drawBattle(); drawCountdown(); }
  else if (G.state === 'PLAY') { drawBattle(); drawButtons(); }
  else if (G.state === 'PAUSED') { drawBattle(); drawPaused(); }
  else if (G.state === 'RESULT') drawResult();
  else if (G.state === 'DROP') drawDrop();
  else if (G.state === 'DROP_RESULT') drawDropResult();
  if (G.modal) drawModal();
}

module.exports = { render };
