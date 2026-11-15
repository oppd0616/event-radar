// Default: search-only. --queue-hong-kong admits identities to mandatory verification,
// never directly writes formal events or forces publication.
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const cases = [
  { city: '香港', topicKey: 'seasonal_event' },
  { city: '上海', topicKey: 'venue_experience' },
  { city: '北京', topicKey: 'creative_workshop' }
]
const reports = []
const queueHongKong = process.argv.includes('--queue-hong-kong')
const preview = process.argv.includes('--preview')
const recheck = process.argv.includes('--recheck')
const street = process.argv.includes('--street')
const hubDiscovery = process.argv.includes('--hubs')
let selected = preview || recheck ? (street ? ['蘭桂坊怪物巡禮夜變裝派對', '萬聖狂歡祭．中環'] : ['海洋公園哈囉喂全園祭2026', 'Spooky Halloween 2026']).map(targetTitle => ({
  mode: recheck ? 'candidate-recheck' : 'detail-pipeline-preview', targetTitle, city: '香港', topicKey: 'seasonal_event'
})) : queueHongKong || hubDiscovery ? cases.slice(0, 1) : cases
if (process.argv.includes('--lkf-id')) selected=[{mode:'candidate-recheck',candidateId:'discovery-384395fe0751d1af2d058942100fc849',refresh:process.argv.includes('--refresh')}]
if (process.argv.includes('--opening-refresh')) selected=[{mode:'opening-schedule-refresh',candidateId:'discovery-384395fe0751d1af2d058942100fc849',targetEventId:'1b92c0bd3fe824f45a0c49fbdb7d20a0'}]
for (const sample of selected) {
  const input = { mode: queueHongKong || hubDiscovery ? 'real-only' : 'search-only', domain: 'culture', cityLifeSweep: true, namedTarget: false, debug: true, ...sample }
  const run = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', 'fn', 'invoke', 'fetchEvents', '-d', JSON.stringify(input), '--json'], {
    encoding: 'utf8', timeout: 330000, maxBuffer: 8 * 1024 * 1024
  })
  let result
  try {
    if (run.status !== 0) throw Error((run.stderr || run.stdout || String(run.error)).slice(0, 400))
    const envelope = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
    result = typeof envelope.data.RetMsg === 'string' ? JSON.parse(envelope.data.RetMsg) : envelope.data.RetMsg
  } catch (error) { result = { ok: false, error: error.message } }
  reports.push({ input, result })
  console.log(JSON.stringify({ input, result }))
}
const report = path.resolve(__dirname, '../../docs/city-experiences-live-' + Date.now() + '.json')
fs.writeFileSync(report, JSON.stringify({ ranAt: new Date().toISOString(), reports }, null, 2))
console.log(report)
if (reports.some(row => !row.result || row.result.ok === false)) process.exitCode = 1
