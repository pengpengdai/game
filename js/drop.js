/**
 * drop.js - 「打字游戏」掉落消词玩法
 * 词语从上方掉落，打对即消除并按字数加分；漏到底部扣 1 颗星（默认 10 颗），星星归零失败。
 * 每消除 12 个词升 1 关（掉落更快、密度更高），升关额外 +1 星（上限 10）。
 * 与竞速模式共用系统输入法：拼音字母被剥离，只按汉字进度匹配。
 */
const Platform = require('./platform');
const Words = require('./words');
const Audio = require('./audio');

const sys = Platform.getSystemInfoSync();
const W = sys.windowWidth || 375;
const H = sys.windowHeight || 667;
const SAFE = sys.safeArea || {};
const TOP = Math.max(0, SAFE.top !== undefined ? SAFE.top : (sys.statusBarHeight || 0));
const BOTTOM = SAFE.bottom ? Math.max(0, H - SAFE.bottom) : 0;

const MAX_STARS = 10;
const LANES = 3;
const CELL = 34;   // 方块单元边长

// 俄罗斯方块式形状：3/4/5 字，坐标 [列, 行]，按阅读顺序对应第 1..n 个字
const SHAPES = {
  3: [
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [0, 2]],
  ],
  4: [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]],
  ],
  5: [
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  ],
};
const HUD_H = 66;
const LINE_GAP = 92;
const LEVEL_STEP = 12;      // 每关需要消除的词数

/** 关卡难度：第 1 关非常轻松，逐关加速 */
function tuning(level) {
  return {
    gap: Math.max(0.95, 3.0 - (level - 1) * 0.26),  // 生成间隔（秒，更慢）
    speed: 11 + (level - 1) * 6,                    // 下落速度 px/s（第 1 关很慢）
    maxWords: Math.min(6, 2 + level),               // 同屏上限（方块更大，数量更少）
  };
}

const S = {
  on: false, over: false, lang: 'cn',
  score: 0, stars: MAX_STARS, maxStars: MAX_STARS,
  level: 1, cleared: 0, levelCleared: 0,
  combo: 0, maxCombo: 0,
  words: [], buf: '', spawnAcc: 0, flash: 0,
  popups: [], revived: false, clearAt: 0,
  sparks: [], flyStars: [], shake: 0,
  lineY: H - BOTTOM - LINE_GAP,
  topY: TOP + HUD_H,
  W: W, H: H, TOP: TOP, BOTTOM: BOTTOM,
};

let nextId = 1;

function wordWidth(text) {
  return text.length * (S.lang === 'en' ? 12 : 18) + 22;
}

function laneFree(lane) {
  const y0 = S.topY - 10, y1 = S.topY + 150;
  return !S.words.some((w) => w.lane === lane && w.y < y1 && w.y + 34 > y0);
}

function spawn() {
  const len = S.lang === 'en' ? 3 : 3 + Math.floor(Math.random() * 3);   // 3~5 字
  const text = Words.pickDrop(S.lang, len);
  const list = SHAPES[len] || SHAPES[3];
  const shape = list[Math.floor(Math.random() * list.length)];
  const cols = Math.max.apply(null, shape.map((c) => c[0])) + 1;
  const rows = Math.max.apply(null, shape.map((c) => c[1])) + 1;
  const w = cols * CELL;
  const h = rows * CELL;
  let lane = Math.floor(Math.random() * LANES);
  for (let i = 0; i < LANES && !laneFree(lane); i++) lane = (lane + 1) % LANES;
  const laneW = W / LANES;
  const x = Math.max(6, Math.min(W - w - 6, lane * laneW + (laneW - w) / 2 + (Math.random() - 0.5) * 10));
  S.words.push({
    id: nextId++,
    text: text,
    typed: '',
    cells: shape.map((c) => ({ cx: c[0], cy: c[1] })),   // 依次对应 text 的第 1..n 个字
    cols: cols, rows: rows,
    lane: lane,
    x: x,
    y: S.topY - h - 4 - Math.random() * 16,
    w: w, h: h,
    speed: 1 + (Math.random() - 0.5) * 0.18,
    bornAt: Date.now(),
  });
}

function start(lang) {
  S.on = true; S.over = false;
  S.lang = lang === 'en' ? 'en' : 'cn';
  S.score = 0; S.stars = MAX_STARS;
  S.level = 1; S.cleared = 0; S.levelCleared = 0;
  S.combo = 0; S.maxCombo = 0;
  S.words = []; S.buf = ''; S.spawnAcc = 0; S.flash = 0;
  S.popups = []; S.revived = false; S.clearAt = 0;
  S.sparks = []; S.flyStars = []; S.shake = 0; S.pops = [];
  spawn();
  spawn();
}

function miss(word) {
  S.stars -= 1;
  S.flash = 0.55;
  S.combo = 0;
  Platform.vibrateHeavy();
  Audio.play('error');
  S.popups.push({ text: '-1 ★', x: word.x + word.w / 2, y: S.lineY - 10, at: Date.now(), color: 'red' });
  S.shake = 0.35;
  for (let i = 0; i < 8; i++) {
    S.sparks.push({
      x: word.x + word.w / 2, y: S.lineY - 12,
      vx: (Math.random() - 0.5) * 150, vy: -40 - Math.random() * 90,
      life: 0.45, max: 0.45, color: '225,72,63',
    });
  }
  if (S.stars <= 0) {
    S.stars = 0;
    S.over = true;
  }
}

function update(dt) {
  if (!S.on || S.over) return;
  S.flash = Math.max(0, S.flash - dt);

  const T = tuning(S.level);
  S.spawnAcc += dt;
  if (S.spawnAcc >= T.gap) {
    S.spawnAcc = 0;
    if (S.words.length < T.maxWords) spawn();
  }

  const base = T.speed;
  S.shake = Math.max(0, S.shake - dt);
  for (let i = S.words.length - 1; i >= 0; i--) {
    const w = S.words[i];
    w.y += base * w.speed * dt;
    if (w.y + (w.h || CELL) >= S.lineY) {
      S.words.splice(i, 1);
      miss(w);
      if (S.over) return;
    }
  }

  if (S.popups.length > 8) S.popups.splice(0, S.popups.length - 8);

  for (let i = S.sparks.length - 1; i >= 0; i--) {
    const sp = S.sparks[i];
    sp.life -= dt;
    if (sp.life <= 0) { S.sparks.splice(i, 1); continue; }
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vy += 120 * dt;
  }
  const now = Date.now();
  for (let i = S.flyStars.length - 1; i >= 0; i--) {
    if (now - S.flyStars[i].at > S.flyStars[i].dur * 1000) S.flyStars.splice(i, 1);
  }
}

/** 找出下一个待打的字为 ch 的词（同字时可切换目标；优先选最靠下的） */
function findTarget(ch) {
  let best = null;
  for (let i = 0; i < S.words.length; i++) {
    const w = S.words[i];
    const nc = w.text.charAt(w.typed.length);
    if (nc === ch) {
      if (!best || w.y > best.y) best = w;
    }
  }
  return best;
}

function clearWord(w) {
  const idx = S.words.indexOf(w);
  if (idx >= 0) S.words.splice(idx, 1);
  const gain = w.text.length * 10 + Math.min(S.combo, 20) * 2;
  S.score += gain;
  S.cleared += 1;
  S.levelCleared += 1;
  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  S.clearAt = Date.now();
  S.popups.push({
    text: '+' + gain,
    x: Math.min(W - 46, Math.max(46, w.x + w.w / 2)),
    y: w.y,
    at: Date.now(),
    color: 'gold',
  });
  Audio.play(S.combo >= 5 && S.combo % 5 === 0 ? 'combo' : 'win');
  Platform.vibrateLight();

  // 消除特效：词条爆开 + 火花四散 + 星星飞向 HUD
  S.pops = S.pops || [];
  S.pops.push({ text: w.text, x: w.x + w.w / 2, y: w.y + 15, at: Date.now() });
  if (S.pops.length > 6) S.pops.shift();
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 140;
    S.sparks.push({
      x: w.x + w.w / 2, y: w.y + 15,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
      life: 0.5 + Math.random() * 0.25, max: 0.75,
      color: i % 3 === 0 ? '255,107,53' : (i % 3 === 1 ? '255,176,80' : '22,163,116'),
    });
  }
  S.flyStars.push({ x: w.x + w.w / 2, y: w.y + 8, at: Date.now(), dur: 0.55, to: S.stars });

  if (S.levelCleared >= LEVEL_STEP) {
    S.levelCleared = 0;
    S.level += 1;
    if (S.stars < MAX_STARS) {
      S.stars += 1;
      S.popups.push({ text: '+1 ★', x: W / 2, y: S.topY + 90, at: Date.now(), color: 'star' });
      Audio.play('milestone');
    }
  }
}

/** 处理一个汉字/字母 */
function typeChar(ch) {
  const target = findTarget(ch);
  if (!target) {
    // 对不上任何词：轻微错误反馈，不扣星
    S.combo = 0;
    S.flash = 0.22;
    Platform.vibrateLight();
    Audio.play('error');
    return;
  }
  target.typed += ch;
  Audio.playKey(S.combo);
  if (target.typed.length >= target.text.length) clearWord(target);
}

/** 系统输入法回调（整段文本），剥离拼音字母后只取新增部分 */
function input(value) {
  if (!S.on || S.over) return;
  const raw = String(value || '');
  const clean = S.lang === 'en'
    ? raw.replace(/[^a-zA-Z]/g, '').toLowerCase()
    : raw.replace(/[^\u3400-\u4dbf\u4e00-\u9fff]/g, '');
  if (!clean) return;

  let added = '';
  if (clean.length > S.buf.length && clean.indexOf(S.buf) === 0) added = clean.slice(S.buf.length);
  else if (clean === S.buf) return;
  else if (clean.indexOf(S.buf) > 0) added = clean.slice(clean.indexOf(S.buf) + S.buf.length);
  else added = clean.slice(-1);        // 输入法改写：只取最后一个字
  S.buf = clean;

  const chars = Array.from(added);
  for (let i = 0; i < chars.length; i++) typeChar(chars[i]);

  if (S.buf.length > 60) { S.buf = ''; Platform.setKeyboardValue(''); }
}

/** 复活：星星回到 3 颗，清掉下半屏的词 */
function revive() {
  if (!S.on) return;
  S.over = false;
  S.revived = true;
  S.stars = 3;
  S.flash = 0;
  S.combo = 0;
  S.words = S.words.filter((w) => w.y < S.topY + (S.lineY - S.topY) * 0.45);
  S.buf = '';
  S.sparks = [];
  S.flyStars = [];
  Platform.setKeyboardValue('');
}

module.exports = { S, start, update, input, revive, tuning, MAX_STARS, LANES, HUD_H, LINE_GAP, W, H, TOP, BOTTOM };
