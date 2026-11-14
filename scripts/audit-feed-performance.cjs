// Read-only feed probe. CLI has no user OPENID, so this is a baseline rather
// than the signed-in user's personalized feed or their device/network latency.
const { spawnSync } = require('child_process')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const samples=Math.max(1,Math.min(5,Number(process.argv[3]) || 1))
for (const cardOnly of process.argv[2] === 'cards' ? Array(samples).fill(true) : [false, true]) {
  const start = Date.now()
  const result = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', 'fn', 'invoke', 'getEvents', '-d', JSON.stringify({ domain: 'all', pageSize: 20, cardOnly }), '--json'], { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 })
  if (result.status !== 0) { console.log(JSON.stringify({cardOnly, error:(result.stderr || result.stdout || String(result.error || result.status)).slice(0,300)}));continue }
  const envelope = JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))).data
  const response = JSON.parse(envelope.RetMsg)
  const list = response.list || []
  const fields = {}
  for (const row of list) for (const [key, value] of Object.entries(row)) fields[key] = (fields[key] || 0) + Buffer.byteLength(JSON.stringify(value) || '')
  console.log(JSON.stringify({ cardOnly, cliWallMs: Date.now() - start, functionDurationMs: envelope.Duration, rows: list.length, ids:list.map(e=>e._id), responseBytes: Buffer.byteLength(envelope.RetMsg), feedOrderCount: (response.feedOrder || []).length, largestFields: Object.entries(fields).sort((a, b) => b[1] - a[1]).slice(0, 12), error: response.error || null }))
}
