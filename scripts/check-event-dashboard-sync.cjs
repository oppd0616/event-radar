const assert = require('node:assert/strict');
const http = require('node:http');
const { createDashboardServer, syncFailure, standaloneEnv } = require('./event-dashboard-server.cjs');

(async () => {
  assert.deepEqual(standaloneEnv({ Path: 'runtime', NODE_OPTIONS: '--require missing-hook', node_path: 'temporary', USERPROFILE: 'profile' }), { Path: 'runtime', USERPROFILE: 'profile' });
  assert.equal(syncFailure(new Error('unknown failure')).code, 'SYNC_FAILED');
  assert.equal(syncFailure(new Error('command failed'), '', '请先登录 CloudBase').code, 'CLOUDBASE_AUTH_REQUIRED');
  assert.equal(syncFailure(new Error('command failed'), '', 'ECONNRESET').code, 'CLOUD_CONNECTION_FAILED');
  assert.equal(syncFailure({ code: 'ENOENT' }).code, 'SYNC_COMPONENT_MISSING');
  assert.equal(syncFailure({ killed: true }).code, 'SYNC_TIMEOUT');
  const calls = [];
  let fail = false, gate;
  const server = createDashboardServer({
    readSnapshot: () => ({ recent: { until: 'fixture' }, records: [] }),
    runAudit: async script => {
      calls.push(script);
      if (gate) await gate;
      if (fail) throw Object.assign(new Error('test connection failure'), { code: 'CLOUD_CONNECTION_FAILED' });
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(base + '/api/refresh', { method: 'POST' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).busy, false);
    assert.deepEqual(calls, ['audit-event-updates.cjs', 'audit-recent-events.cjs']);
    fail = true;
    response = await fetch(base + '/api/refresh', { method: 'POST' });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, 'CLOUD_CONNECTION_FAILED');
    const state = await (await fetch(base + '/api/data')).json();
    assert.equal(state.busy, false);
    assert.equal(state.lastErrorCode, 'CLOUD_CONNECTION_FAILED');
    assert.equal(state.recent.until, 'fixture');
    fail = false;
    let release;
    gate = new Promise(resolve => { release = resolve; });
    const active = fetch(base + '/api/refresh', { method: 'POST' });
    while (!(await (await fetch(base + '/api/data')).json()).busy) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    response = await fetch(base + '/api/refresh', { method: 'POST' });
    assert.equal(response.status, 409);
    release();
    await active;
    gate = null;
    response = await fetch(base + '/api/refresh', { method: 'POST', headers: { Origin: 'https://example.invalid' } });
    assert.equal(response.status, 403);
    const localHost = `localhost:${server.address().port}`;
    const localResponse = await new Promise((resolve, reject) => {
      const request = http.request(base + '/api/refresh', {
        method: 'POST', headers: { Host: localHost, Origin: 'http://' + localHost }
      }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(body) }));
      });
      request.on('error', reject);
      request.end();
    });
    assert.equal(localResponse.status, 200);
    assert.equal(localResponse.data.lastError, '');
    console.log('Dashboard sync checks passed: classification, success, recovery, concurrency, local origin.');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
