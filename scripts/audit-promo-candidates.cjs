// Read-only event inventory for choosing real promotional examples.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
function decode(x) {
  if (Array.isArray(x)) return x.map(decode)
  if (x && typeof x === 'object') {
    for (const k of ['$numberLong', '$numberInt', '$numberDouble']) if (k in x) return Number(x[k])
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, decode(v)]))
  }
  return x
}
const records = []
for (let skip = 0; skip < 2000; skip += 100) {
  const query = { find: 'events', filter: {}, projection: { title: 1, domain: 1, status: 1, city: 1, location: 1, venue: 1, startTime: 1, endTime: 1, summary: 1, mergedInto: 1, sourceUrl: 1, officialUrl: 1, participationGuide: 1 }, sort: { _id: 1 }, skip, limit: 100 }
  const run = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', 'db', 'nosql', 'execute', '--command', JSON.stringify([{ TableName: 'events', CommandType: 'QUERY', Command: JSON.stringify(query) }]), '--json'], { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 })
  if (run.status !== 0) throw Error((run.stderr || run.stdout || String(run.error)).slice(0, 500))
  const env = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
  const page = decode(env.data?.results?.[0])
  if (!Array.isArray(page)) throw Error('Unexpected query response')
  records.push(...page)
  if (page.length < 100) break
  if (skip === 1900) throw Error('Safety pagination limit')
}
const report = { readOnly: true, queriedAt: new Date().toISOString(), records }
const file = path.resolve(__dirname, '../docs/promo-candidates-20261013.json')
fs.writeFileSync(file, JSON.stringify(report, null, 2))
const date = v => typeof v === 'number' ? new Date(v + 8 * 3600000).toISOString().slice(0, 10) : v
console.log(JSON.stringify({ file, count: records.length, events: records.map(r => ({ id: r._id, title: r.title, domain: r.domain, status: r.status, city: r.city, start: date(r.startTime), end: date(r.endTime), mergedInto: r.mergedInto })) }, null, 2))
