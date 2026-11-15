/**
 * db.js - 存储层（默认内存实现，零依赖即可运行）
 * 生产环境：替换为 MySQL（users/game_records）+ Redis（排行榜/限次/房间态），
 * 接口签名保持一致即可无缝切换。
 */
class MemoryDB {
  constructor() {
    this.users = new Map();      // id -> user
    this.records = [];           // game_records
    this.lb = new Map();         // 'mode:level' -> Map uid -> {score,cpm,ts}
    this.counters = new Map();   // 日限次计数
    this.challenges = new Map(); // 挑战码 -> 记录（异步对战）
    this._uid = 1;
  }

  async upsertUser(platform, openid) {
    for (const u of this.users.values()) {
      if (platform === 'douyin' && u.tt_openid === openid) return u;
      if (platform === 'kuaishou' && u.ks_openid === openid) return u;
      if (u.unionid && u.unionid === openid) return u;
    }
    const id = this._uid++;
    const user = {
      id,
      unionid: null,
      tt_openid: platform === 'douyin' ? openid : null,
      ks_openid: platform === 'kuaishou' ? openid : null,
      nickname: '玩家' + id,
      avatar_url: '',
      created_at: new Date().toISOString(),
    };
    this.users.set(id, user);
    return user;
  }

  getUser(id) { return this.users.get(Number(id)) || null; }

  /** 生成 6 位挑战码（去掉易混字符 0/O/1/I） */
  async createChallenge(data) {
    const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) code += AL[Math.floor(Math.random() * AL.length)];
    } while (this.challenges.has(code));
    this.challenges.set(code, Object.assign({}, data, { code, created_at: Date.now() }));
    if (this.challenges.size > 500) {
      const oldest = this.challenges.keys().next().value;
      this.challenges.delete(oldest);
    }
    return { code };
  }

  getChallenge(code) {
    return this.challenges.get(String(code || '').toUpperCase()) || null;
  }

  async addRecord(rec) {
    this.records.push(rec);
    // 排行榜：每用户每模式/难度只保留最高分
    const key = rec.mode + ':' + rec.level;
    let m = this.lb.get(key);
    if (!m) { m = new Map(); this.lb.set(key, m); }
    const cur = m.get(rec.user_id);
    if (!cur || rec.score > cur.score) {
      m.set(rec.user_id, { score: rec.score, cpm: rec.cpm, ts: Date.now() });
    }
  }

  async getLb(mode, level, limit, uid) {
    const m = this.lb.get(mode + ':' + level) || new Map();
    const arr = [...m.entries()].sort((a, b) => b[1].score - a[1].score);
    const list = arr.slice(0, limit).map(([userId, v]) => {
      const u = this.users.get(userId);
      return {
        rank: arr.findIndex((e) => e[0] === userId) + 1,
        userId, nickname: u ? u.nickname : '', avatar: u ? u.avatar_url : '',
        score: v.score, cpm: v.cpm,
      };
    });
    let mine = null;
    const idx = arr.findIndex((e) => e[0] === uid);
    if (idx >= 0) mine = { rank: idx + 1, score: arr[idx][1].score, cpm: arr[idx][1].cpm };
    return { list, mine };
  }

  async incrDay(key) {
    const n = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, n);
    return n;
  }
}

module.exports = new MemoryDB();
