// Read-only production search smoke test; does not refresh or alter events.
const { spawnSync } = require('node:child_process')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
for (const query of process.argv.length > 2 ? process.argv.slice(2) : ['黑客松', '无畏契约', '小组赛', '四六级', '演唱会 上海']) {
  let result
  for (let attempt = 0; attempt < 2; attempt++) {
    result = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', 'fn', 'invoke', 'getEvents', '-d', JSON.stringify({ search: true, query, pageSize: 5 }), '--json'], { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 })
    if (result.status === 0) break
  }
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).slice(0, 250))
  const envelope = JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))).data
  const response = JSON.parse(envelope.RetMsg)
  if (!Array.isArray(response.list) || response.total === undefined) throw new Error('Invalid search response: ' + JSON.stringify(response).slice(0, 300))
  if (new Set(response.list.map(item => item._id)).size !== response.list.length) throw new Error('Duplicate search rows')
  console.log(JSON.stringify({ query, total: response.total, durationMs: envelope.Duration, titles: response.list.map(item => item.displayTitle || item.title) }))
}
