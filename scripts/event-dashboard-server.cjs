const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const root = path.resolve(__dirname, '..');
const SERVICE_VERSION = 4;

function standaloneEnv(env = process.env) {
  // A detached desktop service must not retain the editor's temporary Node hooks.
  return Object.fromEntries(Object.entries(env).filter(([key]) =>
    !['NODE_OPTIONS', 'NODE_PATH'].includes(key.toUpperCase())));
}

function latest(prefix) {
  const files = fs.readdirSync(path.join(root, 'docs'))
    .filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort();
  return files.length
    ? JSON.parse(fs.readFileSync(path.join(root, 'docs', files.at(-1)), 'utf8').replace(/^\uFEFF/, ''))
    : null;
}

function snapshot() {
  const recent = latest('recent-events-');
  const audit = latest('event-updates-');
  const cutoff = recent ? Date.parse(recent.since.replace(' ', 'T') + '+08:00') : 0;
  return {
    recent,
    records: (audit?.records || []).filter(e => Number(e.updatedAt) >= cutoff || Number(e.createdAt) >= cutoff),
    comparisonBaseline: audit?.baselineAt
  };
}

function syncFailure(error, stdout = '', stderr = '') {
  // Classify child output without returning raw CLI output or credentials.
  const detail = [error?.message, stdout, stderr].join('\n');
  if (error?.killed || error?.code === 'ETIMEDOUT') {
    return { code: 'SYNC_TIMEOUT', message: '读取云端超时，请稍后重试；上次成功的数据仍保留。' };
  }
  if (error?.code === 'ENOENT' || /MODULE_NOT_FOUND|Cannot find module/.test(detail)) {
    return { code: 'SYNC_COMPONENT_MISSING', message: '本地同步程序或运行组件不存在，请重新打开桌面看板启动入口。' };
  }
  if (/not logged in|not login|please login|login expired|登录.*(失效|过期)|未登录|请.*登录|credential.*expired|AuthFailure|Unauthorized/i.test(detail)) {
    return { code: 'CLOUDBASE_AUTH_REQUIRED', message: 'CloudBase 授权已失效，需要重新登录后再同步；上次成功的数据仍保留。' };
  }
  if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|network|socket hang up|connect.*timed out/i.test(detail)) {
    return { code: 'CLOUD_CONNECTION_FAILED', message: '未能连接腾讯云，请检查网络后重试；上次成功的数据仍保留。' };
  }
  return { code: 'SYNC_FAILED', message: '同步程序执行失败；上次成功的数据仍保留。请重试，若持续失败可提供错误码排查。' };
}

function run(script) {
  return new Promise((resolve, reject) => execFile(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root, env: standaloneEnv(), timeout: 240000, maxBuffer: 16 * 1024 * 1024, windowsHide: true
  }, (error, stdout, stderr) => {
    if (!error) return resolve(stdout);
    const failure = syncFailure(error, stdout, stderr);
    // Log only diagnostic metadata, not CLI output containing account details.
    console.error(JSON.stringify({ at: new Date().toISOString(), script, code: failure.code,
      exitCode: error.code, syscall: error.syscall, killed: Boolean(error.killed),
      missingModule: /Cannot find module ['"]([^'"\r\n]+)['"]/.exec(stdout + '\n' + stderr)?.[1] }));
    reject(Object.assign(new Error(failure.message), { code: failure.code }));
  }));
}

function createDashboardServer({ readSnapshot = snapshot, runAudit = run } = {}) {
  let busy = false, lastError = '', lastErrorCode = '';
  const payload = () => ({ ...readSnapshot(), serviceVersion: SERVICE_VERSION, busy, lastError, lastErrorCode });
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/api/data' && req.method === 'GET') return json(200, payload());
      if (url.pathname === '/api/refresh' && req.method === 'POST') {
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}`) return json(403, { error: '请从当前看板页面发起同步。' });
        if (busy) return json(409, { error: '正在读取，请稍候。', code: 'SYNC_BUSY' });
        busy = true;
        lastError = '';
        lastErrorCode = '';
        try {
          await runAudit('audit-event-updates.cjs');
          await runAudit('audit-recent-events.cjs');
          busy = false;
          return json(200, payload());
        } catch (error) {
          lastError = error.message;
          lastErrorCode = error.code || 'SYNC_FAILED';
          return json(502, { error: lastError, code: lastErrorCode });
        } finally {
          busy = false;
        }
      }
      if (url.pathname === '/' && req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(fs.readFileSync(path.join(root, 'tools/event-dashboard/index.html')));
      }
      res.writeHead(404);
      res.end();
    } catch {
      json(500, { error: '本地数据读取失败，请重试或重新同步。', code: 'LOCAL_SNAPSHOT_FAILED' });
    }
  });
}

if (require.main === module) {
  const server = createDashboardServer();
  server.on('error', error => { console.error(`Dashboard startup failed: ${error.code}`); process.exitCode = 1; });
  server.listen(4181, '127.0.0.1', () => console.log(`Local dashboard v${SERVICE_VERSION}: http://127.0.0.1:4181`));
}

module.exports = { createDashboardServer, syncFailure, standaloneEnv };
