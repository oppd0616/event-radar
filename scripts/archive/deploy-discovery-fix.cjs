const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '../..')
const base = path.join(root, 'output/deploy-discovery-fix-20261029')
const stage = path.join(base, 'stage')
const cli = require('../dashboard-cloudbase-cli.cjs').resolveCli()
function call(args, timeout = 120000) {
  const p = spawnSync(process.execPath, [cli, '-e', 'cloud1-d3gm0lbv1392513d1', ...args, '--json'], { cwd: root, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true })
  if (p.status !== 0) throw Error('Cloud operation failed: ' + args.slice(0, 3).join(' ') + '; sensitive output withheld')
  const v = JSON.parse(p.stdout.slice(p.stdout.indexOf('{')))
  if (v.success === false || v.error) throw Error('Cloud operation returned error; sensitive output withheld')
  return v.data
}
const vars = x => Object.fromEntries((x.Environment?.Variables || []).map(v => [v.Key, v.Value]).sort(([a], [b]) => a.localeCompare(b)))
const triggers = x => (x.Triggers || []).map(t => ({ name: t.TriggerName, type: t.Type, desc: t.TriggerDesc, enable: t.Enable })).sort((a,b)=>String(a.name).localeCompare(String(b.name)))
const before = call(['fn', 'detail', 'fetchEvents'])
fs.cpSync(path.join(base, 'before'), stage, { recursive: true })
for (const file of ['index.js', 'lib/discovery-evidence.js']) fs.copyFileSync(path.join(root, 'cloudfunctions/fetchEvents', file), path.join(stage, file))
call(['fn', 'code', 'update', 'fetchEvents', '--dir', stage], 240000)
const after = call(['fn', 'detail', 'fetchEvents'])
const environmentPreserved = JSON.stringify(vars(before)) === JSON.stringify(vars(after))
const triggersPreserved = JSON.stringify(triggers(before)) === JSON.stringify(triggers(after))
const runtimePreserved = ['Runtime', 'Timeout', 'MemorySize'].every(k => before[k] === after[k])
const result = { deployedAt: new Date().toISOString(), functionName: 'fetchEvents', environmentPreserved, triggersPreserved, runtimePreserved, runtime: after.Runtime, timeout: after.Timeout, triggers: triggers(after) }
fs.writeFileSync(path.join(base, 'deployment-result.json'), JSON.stringify(result, null, 2))
if (!environmentPreserved || !triggersPreserved || !runtimePreserved) throw Error('Deployment configuration mismatch; inspect privately before proceeding')
for (const mode of ['health', 'write-quality-health']) {
  const response = call(['fn', 'invoke', 'fetchEvents', '-d', JSON.stringify({ mode })])
  result[mode] = typeof response.RetMsg === 'string' ? JSON.parse(response.RetMsg) : response.RetMsg
}
fs.writeFileSync(path.join(base, 'deployment-result.json'), JSON.stringify(result, null, 2))
if (result.health?.discoveryEvidenceVersion !== '2026-10-29.1' || !result.health?.ok || !result['write-quality-health']?.ok) throw Error('Cloud health version/check mismatch')
result.codeHashes = Object.fromEntries(['index.js','lib/discovery-evidence.js'].map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,f))).digest('hex')]))
fs.writeFileSync(path.join(base, 'deployment-result.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
