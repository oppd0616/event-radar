// Read-only CloudBase query; saves a compact local audit without invoking discovery.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process')
const cli = require('./dashboard-cloudbase-cli.cjs').resolveCli()
const now = Date.now(), since = now - 48 * 3600000
function decode(value) {
  if (Array.isArray(value)) return value.map(decode)
  if (value && typeof value === 'object') {
    for (const key of ['$numberLong', '$numberInt', '$numberDouble']) if (key in value) return Number(value[key])
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]))
  }
  return value
}
const records = []
for (let skip = 0; ; skip += 100) {
  const query = { find: 'events', filter: { $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }] }, projection: { _id: 1, title: 1, domain: 1, status: 1, city: 1, createdAt: 1, updatedAt: 1, startTime: 1, endTime: 1, mergedInto: 1, canonicalEventId: 1 }, sort: { _id: 1 }, skip, limit: 100 }
  const run = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', 'db', 'nosql', 'execute', '--command', JSON.stringify([{ TableName: 'events', CommandType: 'QUERY', Command: JSON.stringify(query) }]), '--json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  if (run.status !== 0) throw Error((run.stderr || run.stdout || String(run.error)).slice(0, 600))
  const envelope = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
  const page = decode(envelope.data.results[0])
  if (!Array.isArray(page)) throw Error('Unexpected query response')
  records.push(...page)
  if (page.length < 100) break
  if (skip >= 4900) throw Error('Audit safety limit reached')
}
const time = value => value ? new Date(Number(value) + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') : ''
const fresh = records.filter(item => item.createdAt >= since).sort((a, b) => b.createdAt - a.createdAt)
const row = item => ({ ...item, createdAt: time(item.createdAt), updatedAt: time(item.updatedAt), startTime: time(item.startTime), endTime: time(item.endTime) })
const report = { readOnly: true, since: time(since), until: time(now), timezone: 'Asia/Shanghai', freshCount: fresh.length, freshByStatus: Object.fromEntries([...new Set(fresh.map(item => item.status))].map(status => [status, fresh.filter(item => item.status === status).length])), oldRecordsTouched: records.filter(item => !(item.createdAt >= since)).length, fresh: fresh.map(row) }
const file = path.resolve(__dirname, '../docs/recent-events-' + now + '.json')
fs.writeFileSync(file, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ file, ...report }))
