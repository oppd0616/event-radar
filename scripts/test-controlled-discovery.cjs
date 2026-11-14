// Small live discovery test: creates candidates only; does not bulk-refresh events.
const { spawnSync } = require('child_process')
const fs = require('fs'), path = require('path')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const tests = [
  { mode: 'real-only', domain: 'finance', topicKey: 'web3', namedTarget: false },
  { mode: 'real-only', domain: 'culture', topicKey: 'fashion_design', namedTarget: false },
  { mode: 'real-only', domain: 'auto', topicKey: 'motorsport', namedTarget: false },
  { mode: 'search-only', domain: 'game', topicKey: 'honor_of_kings', namedTarget: 'KPL总决赛' }
]
const reports = []
const selected = process.argv[2] == null ? tests : [tests[Number(process.argv[2])]]
for (const input of selected) {
  const run = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', 'fn', 'invoke', 'fetchEvents', '-d', JSON.stringify(input), '--json'], { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 })
  let result
  try {
    if (run.status !== 0) throw Error((run.stdout || run.stderr || String(run.error)).slice(0, 500))
    const envelope = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
    result = typeof envelope.data.RetMsg === 'string' ? JSON.parse(envelope.data.RetMsg) : envelope.data.RetMsg
    if (result.errorCode || result.statusCode >= 400) result.ok = false
  } catch (error) { result = { ok: false, error: error.message } }
  reports.push({ input, result })
  console.log(JSON.stringify({ input, result }))
}
const target = path.resolve(__dirname, '../docs/controlled-discovery-live-20261012' + (process.argv[2] == null ? '' : '-' + process.argv[2]) + '.json')
fs.writeFileSync(target, JSON.stringify(reports, null, 2))
console.log(target)
if (reports.some(x => x.result.ok === false)) process.exitCode = 1
