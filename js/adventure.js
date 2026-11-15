/**
 * adventure.js - 「打字冒险」：打字击败怪物
 * 每个怪物 = 一首诗/一段文本（血量 = 字符数）。打对字推进进度，打完整首即击败。
 * 怪物会蓄力攻击：倒计时归零扣 1 颗心（默认 3 心），心归零失败（可看广告复活）。
 * 击败后进入下一只更强怪物；打完一圈关卡 +1，攻击更快。
 */
const Platform = require('./platform');
const Audio = require('./audio');

const sys = Platform.getSystemInfoSync();
const W = sys.windowWidth || 375;
const H = sys.windowHeight || 667;

const MONSTERS = [
  { name: '小史莱姆', poem: '床前明月光疑是地上霜', color: '#5FB868', kind: 'slime', atk: 15 },
  { name: '灯笼妖', poem: '举头望明月低头思故乡', color: '#FF9350', kind: 'lantern', atk: 14 },
  { name: '书灵', poem: '春眠不觉晓处处闻啼鸟夜来风雨声', color: '#8FA0C0', kind: 'ghost', atk: 13 },
  { name: '诗妖', poem: '独在异乡为异客每逢佳节倍思亲遥知兄弟登高处', color: '#B47BE0', kind: 'poet', atk: 12 },
  { name: '龙王', poem: '长风破浪会有时直挂云帆济沧海人生得意须尽欢', color: '#E1483F', kind: 'dragon', atk: 11 },
];

const MAX_HEARTS = 3;

const A = {
  on: false, over: false, revived: false,
  hearts: MAX_HEARTS, maxHearts: MAX_HEARTS,
  idx: 0, round: 1,
  passage: '', typed: 0, atkIn: 15, atkTotal: 15,
  score: 0, kills: 0, chars: 0, combo: 0, maxCombo: 0,
  bufBase: 0, shake: 0, flash: 0, hitAt: 0, popAt: 0,
  sparks: [], pops: [], monster: MONSTERS[0],
  W: W, H: H,
};

let lastMonsterPoem = '';

function loadMonster() {
  const m = MONSTERS[A.idx % MONSTERS.length];
  A.monster = m;
  A.passage = m.poem;
  A.typed = 0;
  A.atkTotal = Math.max(6, m.atk - (A.round - 1) * 1.2);
  A.atkIn = A.atkTotal;
  lastMonsterPoem = m.poem;
}

function start() {
  A.on = true; A.over = false; A.revived = false;
  A.hearts = MAX_HEARTS;
  A.idx = 0; A.round = 1;
  A.score = 0; A.kills = 0; A.chars = 0; A.combo = 0; A.maxCombo = 0;
  A.bufBase = 0; A.shake = 0; A.flash = 0; A.hitAt = 0; A.popAt = 0;
  A.sparks = []; A.pops = [];
  loadMonster();
}

function spawnSparks(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 150;
    A.sparks.push({
      x: x, y: y,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
      life: 0.45 + Math.random() * 0.25, max: 0.7,
      color: color || '255,107,53',
    });
  }
}

function monsterAttack() {
  A.hearts -= 1;
  A.flash = 0.5;
  A.shake = 0.4;
  A.hitAt = Date.now();
  Platform.vibrateHeavy();
  Audio.play('error');
  spawnSparks(W / 2, 170, '225,72,63', 10);
  A.atkIn = A.atkTotal;
  if (A.hearts <= 0) {
    A.hearts = 0;
    A.over = true;
  }
}

function update(dt) {
  if (!A.on || A.over) return;
  A.flash = Math.max(0, A.flash - dt);
  A.shake = Math.max(0, A.shake - dt);
  A.atkIn -= dt;
  if (A.atkIn <= 0) monsterAttack();

  for (let i = A.sparks.length - 1; i >= 0; i--) {
    const sp = A.sparks[i];
    sp.life -= dt;
    if (sp.life <= 0) { A.sparks.splice(i, 1); continue; }
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vy += 130 * dt;
  }
}

function defeatMonster() {
  A.kills += 1;
  A.popAt = Date.now();
  A.score += A.passage.length * 2;
  spawnSparks(W / 2, 190, '255,176,80', 14);
  Audio.play('win');
  Platform.vibrateLight();
  A.pops.push({ text: '击败 ' + A.monster.name + '！', x: W / 2, y: 200, at: Date.now() });
  A.idx += 1;
  if (A.idx % MONSTERS.length === 0) A.round += 1;
  loadMonster();
}

function input(value) {
  if (!A.on || A.over) return;
  const raw = String(value || '');
  const clean = raw.replace(/[^\u3400-\u4dbf\u4e00-\u9fff]/g, '');
  if (!clean) return;
  if (clean.length < A.bufBase) { A.bufBase = clean.length; return; }
  const added = clean.slice(A.bufBase);
  if (!added) return;
  A.bufBase = clean.length;

  for (const ch of Array.from(added)) {
    if (A.over) return;
    if (ch === A.passage.charAt(A.typed)) {
      A.typed += 1;
      A.chars += 1;
      A.combo += 1;
      A.maxCombo = Math.max(A.maxCombo, A.combo);
      A.score += 10 + Math.min(A.combo, 20);
      Audio.playKey(A.combo);
      if (A.typed >= A.passage.length) defeatMonster();
    } else {
      A.combo = 0;
      A.flash = 0.22;
      Audio.play('error');
      Platform.vibrateLight();
    }
  }
}

/** 复活：回到 2 颗心，继续当前怪物 */
function revive() {
  A.over = false;
  A.revived = true;
  A.hearts = 2;
  A.atkIn = A.atkTotal;
  A.flash = 0;
  A.shake = 0;
  A.bufBase = 0;
  Platform.setKeyboardValue('');
}

module.exports = { A, start, update, input, revive, MONSTERS, MAX_HEARTS, W, H };
