/**
 * index.js - 服务端启动入口
 * 运行：node src/index.js   （零依赖；环境变量 PORT/HOST/JWT_SECRET 可覆盖）
 */
const { createApp } = require('./app');
const config = require('./config');

const app = createApp();
app.server.listen(config.PORT, config.HOST, () => {
  console.log('[typing-race-server] listening on ' + config.HOST + ':' + config.PORT + ' (ws: /ws)');
});
