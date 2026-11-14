// Preserves all existing function environment variables; never logs credentials.
const { spawnSync } = require('node:child_process')
const cli = require('./dashboard-cloudbase-cli.cjs').resolveCli()
const envId = 'cloud1-d3gm0lbv1392513d1'
function run(args) {
  const p = spawnSync(process.execPath, [cli, '-e', envId, ...args, '--json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, windowsHide: true })
  if (p.status !== 0) throw Error('CloudBase operation failed (output withheld to protect environment values)')
  return JSON.parse(p.stdout.slice(p.stdout.indexOf('{'))).data
}
const detail = run(['fn', 'detail', 'fetchEvents'])
const reply = run(['fn', 'invoke', 'fetchEvents', '-d', JSON.stringify({ mode: 'wsa-budget-health' })])
const health = typeof reply.RetMsg === 'string' ? JSON.parse(reply.RetMsg) : reply.RetMsg
console.log(JSON.stringify({ phase: 'before', ...health }))
if (process.argv.includes('--apply')) {
  const variables = detail.Environment && detail.Environment.Variables
  if (!Array.isArray(variables) || !variables.length) throw Error('Missing live environment: refusing overwrite')
  const limitArg = process.argv.indexOf('--limit')
  const nextLimit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Math.max(health.monthlyLimit, health.calls + 100)
  if (!Number.isSafeInteger(nextLimit) || nextLimit < health.calls || nextLimit < 1) throw Error('Invalid monthly limit')
  const next = variables.filter(v => v.Key !== 'WSA_MONTHLY_CALL_LIMIT').map(v => ({Key: v.Key, Value: v.Value}))
  next.push({Key: 'WSA_MONTHLY_CALL_LIMIT', Value: String(nextLimit)})
  const body = { FunctionName: 'fetchEvents', Namespace: detail.Namespace || envId, Environment: { Variables: next } }
  run(['api', 'scf', 'UpdateFunctionConfiguration', '--api-version', '2018-04-16', '--body', JSON.stringify(body)])
  console.log(JSON.stringify({ phase: 'updated', oldLimit: health.monthlyLimit, newLimit: nextLimit, preservedVariables: variables.length }))
  const actual = run(['fn', 'detail', 'fetchEvents']).Environment.Variables
  if (actual.find(v => v.Key === 'WSA_MONTHLY_CALL_LIMIT')?.Value !== String(nextLimit)) throw Error('Monthly limit readback mismatch')
  for (const item of variables.filter(v => v.Key !== 'WSA_MONTHLY_CALL_LIMIT')) {
    if (actual.find(v => v.Key === item.Key)?.Value !== item.Value) throw Error('Unrelated environment setting changed')
  }
  console.log(JSON.stringify({ phase: 'verified', monthlyLimit: nextLimit, otherSettingsPreserved: true }))
}
