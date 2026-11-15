/**
 * racer.js - 「打字赛车」：打字速度决定名次
 * 一条赛道 3 辆车：玩家 + 2 名 AI 车手。打对一个字前进一格，先到终点者第一。
 * 名次 = 1 + 已经在玩家之前冲线的对手数；结算按名次给分。
 */
const Platform = require('./platform');
const Words = require('./words');
const Audio = require('./audio');

const sys = Platform.getSystemInfoSync();
const W = sys.windowWidth || 375;
const H = sys.windowHeight || 667;

const AI_RIVALS = [
  { name: '红色闪电', targetSec: 26, color: '#E1483F' },   // 约 26 秒跑完
  { name: '蓝色疾风', targetSec: 34, color: '#1F2A44' },
];

const R = {
  on: false, over: false, finished: false,
  passage: '', typed: 0, buf: '',
  rivals: [], t: 0, rank: 0, score: 0, cpm: 0,
  flash: 0, pops: [], sparks: [],
  W: W, H: H,
};

function start() {
  R.on = true; R.over = false; R.finished = false;
  R.passage = Words.pick('cn', 'normal');
  R.typed = 0; R.buf = ''; R.t = 0; R.rank = 0; R.score = 0; R.cpm = 0;
  R.flash = 0; R.pops = []; R.sparks = [];
  R.rivals = AI_RIVALS.map((r) => ({
    name: r.name, color: r.color, p: 0, speed: 1 / r.targetSec, finishedAt: 0,
  }));
}

function update(dt) {
  if (!R.on || R.over) return;
  R.flash = Math.max(0, R.flash - dt);
  R.t += dt;

  for (let i = 0; i < R.rivals.length; i++) {
    const rv = R.rivals[i];
    if (rv.p < 1) {
      rv.p = Math.min(1, rv.p + rv.speed * dt);
      if (rv.p >= 1) rv.finishedAt = R.t;
    }
  }

  for (let i = R.sparks.length - 1; i >= 0; i--) {
    const sp = R.sparks[i];
    sp.life -= dt;
    if (sp.life <= 0) { R.sparks.splice(i, 1); continue; }
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vy += 140 * dt;
  }
  if (!R.finished) checkFinish();
}

function progress() {
  return R.typed / Math.max(1, R.passage.length);
}

function checkFinish() {
  if (progress() < 1) return;
  R.finished = true;
  R.over = true;
  let ahead = 0;
  for (let i = 0; i < R.rivals.length; i++) if (R.rivals[i].p >= 1) ahead += 1;
  R.rank = 1 + ahead;
  R.cpm = Math.round(R.typed / Math.max(0.001, R.t / 60));
  R.score = (4 - R.rank) * 120 + R.typed * 10;
  R.pops.push({ text: R.rank === 1 ? '第一名！' : '第 ' + R.rank + ' 名', x: W / 2, y: 200, at: Date.now() });
  Audio.play(R.rank === 1 ? 'win' : 'lose');
  Platform.vibrateHeavy();
}

function input(value) {
  if (!R.on || R.over) return;
  const clean = String(value || '').replace(/[^\u3400-\u4dbf\u4e00-\u9fff]/g, '');
  if (!clean) return;
  let m = 0;
  const pass = R.passage;
  while (m < clean.length && R.typed + m < pass.length && clean[m] === pass.charAt(R.typed + m)) m += 1;
  if (m > 0) {
    R.typed += m;
    R.score += m * (10 + Math.min(R.typed, 40));
    Audio.playKey(R.typed);
    for (let i = 0; i < 3; i++) {
      R.sparks.push({
        x: 60 + progress() * (W - 120),
        y: 226 + Math.random() * 6,
        vx: -60 - Math.random() * 40, vy: -10 - Math.random() * 24,
        life: 0.5, max: 0.5, color: i % 2 ? '255,176,80' : '255,107,53',
      });
    }
    R.buf = clean;
    checkFinish();
  } else if (clean.length > R.buf.length) {
    R.flash = 0.25;
    Audio.play('error');
    Platform.vibrateLight();
  }
  R.buf = clean;
}

module.exports = { R, start, update, input, progress, AI_RIVALS, W, H };
