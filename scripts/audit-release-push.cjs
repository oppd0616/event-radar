// Read-only release check: never invokes the sender or outputs user identifiers.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
function call(args) {
  const r = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', ...args, '--json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  if (r.status !== 0) throw Error('Read-only CloudBase query failed')
  return JSON.parse(r.stdout.slice(r.stdout.indexOf('{')))
}
const metadata = call(['fn', 'detail', 'sendSubscribeMessages'])
const triggers = []
function visit(x) {
  if (!x || typeof x !== 'object') return
  for (const [k, v] of Object.entries(x)) {
    if (/trigger/i.test(k)) triggers.push({ [k]: v })
    else if (!/env|secret|variable/i.test(k)) visit(v)
  }
}
visit(metadata)
const counts = {}, since = Date.now() - 7 * 86400000
let scanned = 0, latest = 0, complete = false
for (let skip = 0; skip < 10000; skip += 100) {
  const command = { find: 'pushLogs', filter: { sentAt: { $gte: since } }, projection: { _id: 0, status: 1, sentAt: 1, deliveredAt: 1 }, sort: { sentAt: -1 }, skip, limit: 100 }
  const page = call(['db', 'nosql', 'execute', '--command', JSON.stringify([{ TableName: 'pushLogs', CommandType: 'QUERY', Command: JSON.stringify(command) }])]).data.results[0]
  if (!Array.isArray(page)) throw Error('Unexpected log response')
  for (const row of page) {
    counts[row.status || 'unknown'] = (counts[row.status || 'unknown'] || 0) + 1
    const value = row.deliveredAt || row.sentAt
    latest = Math.max(latest, Number(typeof value === 'object' && value ? value.$numberLong || value.$numberDouble : value) || 0)
  }
  scanned += page.length
  if (page.length < 100) { complete = true; break }
}
const report = { at: new Date().toISOString(), readOnly: true, triggers, lastSevenDays: { scanned, complete, counts, latestRecordAt: latest ? new Date(latest).toISOString() : null }, caveat: 'No sender invocation. Failed-send reservations may be removed, so these are retained logs, not a complete attempt/failure count. Phone receipt is not verified.' }
const file = path.resolve(__dirname, '../docs/release-push-audit-20260929.json')
fs.writeFileSync(file, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ file, ...report }))
