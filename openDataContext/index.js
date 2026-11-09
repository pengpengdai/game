/**
 * 开放数据域：好友排行榜渲染（抖音 tt.*）
 * 快手发布时：将本文件复制为 ks 版，API 前缀换成 ks 即可（ks.getFriendCloudStorage 同构）。
 * 主域通过 tt.getOpenDataContext().postMessage({type:'render'}) 触发刷新。
 */
const sharedCanvas = tt.getSharedCanvas();
const ctx = sharedCanvas.getContext('2d');

function renderBoard(rows) {
  const W = sharedCanvas.width;
  const H = sharedCanvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#9a8f85';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('· 好友榜 · 最高分 TOP 10 ·', W / 2, 14);

  const top = rows.slice(0, 10);
  if (!top.length) {
    ctx.fillStyle = '#9a8f85';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText('暂无好友成绩，邀请好友一起玩吧', W / 2, H / 2);
    return;
  }
  top.forEach((r, i) => {
    const y = 34 + i * Math.min(20, (H - 40) / Math.max(top.length, 1));
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = i === 0 ? '#ff7043' : '#4a3f35';
    ctx.fillText(String(i + 1), 12, y);
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText((r.nickname || '好友').slice(0, 8), 34, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b0723a';
    ctx.fillText(String(r.score || 0), W - 12, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9a8f85';
    ctx.font = '10px Arial, sans-serif';
    ctx.fillText((r.cpm || 0) + ' 字/分', W - 70, y);
  });
}

tt.onMessage((msg) => {
  if (!msg || msg.type !== 'render') return;
  tt.getFriendCloudStorage({
    keyList: ['best'],
    success: (res) => {
      const rows = (res.data || [])
        .map((d) => {
          try {
            const kv = (d.KVDataList || []).find((k) => k.key === 'best');
            if (!kv) return null;
            const v = JSON.parse(kv.value);
            return { nickname: d.nickname, avatarUrl: d.avatarUrl, score: v.score || 0, cpm: v.cpm || 0 };
          } catch (e) { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
      renderBoard(rows);
    },
    fail: () => renderBoard([]),
  });
});
