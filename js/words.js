/**
 * words.js - 题库 + 服务端同源工具
 * 中文：经典名句/日常短句，无标点；英文：谚语/名言，全小写无撇号
 * pickBySeed：好友对战双方用同一 seed 抽取同一篇文章（公平）
 */
const ZH = {
  easy: [
    '你好世界欢迎来到打字比赛',
    '今天的天气真不错适合出去走走',
    '好好学习天天向上',
    '少壮不努力老大徒伤悲',
    '一寸光阴一寸金',
    '千里之行始于足下',
    '书中自有黄金屋',
    '熟能生巧勤能补拙',
    '世上无难事只怕有心人',
    '早睡早起身体好',
  ],
  normal: [
    '生活不止眼前的苟且还有诗和远方的田野',
    '宝剑锋从磨砺出梅花香自苦寒来',
    '长风破浪会有时直挂云帆济沧海',
    '会当凌绝顶一览众山小',
    '春眠不觉晓处处闻啼鸟夜来风雨声花落知多少',
    '床前明月光疑是地上霜举头望明月低头思故乡',
    '人生得意须尽欢莫使金樽空对月',
    '山重水复疑无路柳暗花明又一村',
    '采菊东篱下悠然见南山',
    '大江东去浪淘尽千古风流人物',
  ],
  hard: [
    '故天将降大任于斯人也必先苦其心志劳其筋骨饿其体肤空乏其身',
    '天下之事常成于困约而败于奢靡',
    '不以物喜不以己悲居庙堂之高则忧其民处江湖之远则忧其君',
    '独在异乡为异客每逢佳节倍思亲遥知兄弟登高处遍插茱萸少一人',
    '明月几时有把酒问青天不知天上宫阙今夕是何年',
    '千锤万凿出深山烈火焚烧若等闲粉骨碎身浑不怕要留清白在人间',
    '世有伯乐然后有千里马千里马常有而伯乐不常有',
    '路漫漫其修远兮吾将上下而求索',
    '劝君更尽一杯酒西出阳关无故人',
    '落霞与孤鹜齐飞秋水共长天一色',
  ],
};

// 掉落消词玩法的词库（短词/短语，长度 2~4 字，便于快速识别与输入）
const DROP_CN = [
  '你好', '加油', '速度', '键盘', '比赛', '专注', '节奏', '成语', '春天', '月光',
  '小雨', '努力', '坚持', '朋友', '开心', '漂亮', '认真', '老师', '同学', '明天',
  '休息', '安静', '勇敢', '出发', '清风', '白云', '读书', '快乐', '理想', '飞翔',
  '阳光', '花开', '星河', '晚安', '早餐', '地铁', '周末', '咖啡', '海边', '森林',
  '微笑', '奔跑', '星光', '山风', '夏夜', '秋叶', '冬雪', '初心', '远方', '成长',
];
// 按字数分池（掉落方块用 3~5 字）
const DROP_CN3 = ['打工人', '小可爱', '图书馆', '咖啡店', '公交车', '星期天', '好朋友', '运动会', '电影院', '键盘侠', '文艺范', '慢半拍'];
const DROP_CN4 = ['阳光明媚', '前程似锦', '心想事成', '万事如意', '平平安安', '天天向上', '马到成功', '花好月圆', '一帆风顺', '岁月静好', '未来可期', '清风徐来'];
const DROP_CN5 = ['世界那么大', '生活很美好', '一起去海边', '明天会更好', '星光不问路', '岁月不饶人', '山河已无恙', '人间值得来'];

const DROP_EN = [
  'sun', 'moon', 'star', 'rain', 'book', 'game', 'fast', 'type', 'key', 'win',
  'blue', 'happy', 'light', 'music', 'smile', 'cloud', 'green', 'magic', 'night', 'river',
];

const EN = {
  easy: [
    'the quick brown fox jumps over the lazy dog',
    'practice makes perfect',
    'time is money my friend',
    'keep calm and carry on',
    'all that glitters is not gold',
    'a journey of a thousand miles begins with a single step',
    'where there is a will there is a way',
    'actions speak louder than words',
    'the early bird catches the worm',
    'every cloud has a silver lining',
  ],
  normal: [
    'to be or not to be that is the question',
    'the best way to predict the future is to create it',
    'success is the sum of small efforts repeated day in and day out',
    'life is what happens when you are busy making other plans',
    'it does not matter how slowly you go as long as you do not stop',
    'happiness is not something ready made it comes from your own actions',
    'a friend in need is a friend indeed',
    'knowledge is power and power is responsibility',
    'the secret of getting ahead is getting started',
    'do what you can with what you have where you are',
  ],
  hard: [
    'the only way to do great work is to love what you do if you have not found it yet keep looking do not settle',
    'whether you think you can or you think you cannot you are right',
    'in the middle of difficulty lies opportunity and courage is what it takes to seize it',
    'it always seems impossible until it is done so keep pushing forward one step at a time',
    'your time is limited so do not waste it living someone else s life',
    'the future belongs to those who believe in the beauty of their dreams and work for them daily',
    'do not judge each day by the harvest you reap but by the seeds that you plant',
    'what we achieve inwardly will change outer reality so start with yourself today',
    'the greatest glory in living lies not in never falling but in rising every time we fall',
    'dream big and dare to fail then learn from every mistake and grow stronger',
  ],
};

const POOLS = { zh: ZH, en: EN };
const LEVELS = ['easy', 'normal', 'hard'];

function pick(mode, level) {
  const pool = POOLS[mode === 'en' ? 'en' : 'zh'][level] || ZH.easy;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 确定性伪随机（同 seed 必出同文） */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickBySeed(mode, level, seed) {
  const pool = POOLS[mode === 'en' ? 'en' : 'zh'][level] || ZH.easy;
  const rnd = mulberry32(seed >>> 0);
  return pool[Math.floor(rnd() * pool.length)];
}

/** 文章指纹（成绩上报用） */
function hashPassage(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/** 掉落玩法：随机取一个词（可按字数取 3~5 字块） */
function pickDrop(lang, len) {
  if (len && lang !== 'en') {
    const byLen = { 3: DROP_CN3, 4: DROP_CN4, 5: DROP_CN5 };
    const pool = byLen[len] || DROP_CN;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = lang === 'en' ? DROP_EN : DROP_CN;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { pick, pickBySeed, hashPassage, LEVELS, ZH, EN, DROP_CN, DROP_EN, DROP_CN3, DROP_CN4, DROP_CN5, pickDrop };
