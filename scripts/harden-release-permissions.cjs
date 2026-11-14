const fs = require('fs'), path = require('path'), assert = require('assert/strict'), { spawnSync } = require('child_process')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const EnvId = 'cloud1-d3gm0lbv1392513d1'
const Resources = ['events', 'eventCandidates', 'users', 'subscriptions', 'behaviorLogs', 'pushLogs', 'discoveryTargets']
const blockedFunctions = ['fetchEvents', 'seedEvents', 'sendSubscribeMessages']
const dir = path.resolve('docs/release-permissions-20260929')
fs.mkdirSync(dir, { recursive: true })
const save = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2))
function api(action, body) {
  const run = spawnSync(process.execPath, [cli, 'api', 'tcb', action, '--api-version', '2018-06-08', '--body', JSON.stringify({ EnvId, ...body }), '--json'], { encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 })
  if (run.status !== 0) throw Error((run.stderr || run.stdout).slice(0, 500))
  const result = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
  assert(result.data && result.data.Data, 'Unexpected API result')
  return result.data.Data
}
function read() {
  return {
    collections: api('DescribeResourcePermission', { ResourceType: 'collection', Resources }),
    functions: api('DescribeResourcePermission', { ResourceType: 'function' })
  }
}
const before = read()
if (process.argv[2] === 'prepare') {
  const rules = JSON.parse(before.functions.PermissionList[0].SecurityRule)
  for (const name of blockedFunctions) rules[name] = { invoke: false }
  save('before.json', before)
  save('plan.json', { collections: Resources, rules })
  console.log(JSON.stringify({ prepared: true, dir, collections: Resources, blockedFunctions }))
} else if (process.argv[2] === 'apply') {
  const expected = JSON.parse(fs.readFileSync(path.join(dir, 'before.json'), 'utf8'))
  assert.deepEqual(before, expected, 'Permissions changed since preparation')
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'))
  const results = []
  for (const name of plan.collections) {
    const result = api('ModifyResourcePermission', { ResourceType: 'collection', Resource: name, Permission: 'ADMINONLY' })
    assert.equal(result.Success, true)
    results.push({ resource: name, success: true })
    save('operations.json', results)
  }
  const result = api('ModifyResourcePermission', { ResourceType: 'function', Permission: 'CUSTOM', SecurityRule: JSON.stringify(plan.rules) })
  assert.equal(result.Success, true)
  const after = read()
  save('after.json', after)
  assert.equal(after.collections.PermissionList.length, Resources.length)
  for (const entry of after.collections.PermissionList) assert.equal(entry.Permission, 'ADMINONLY')
  const rules = JSON.parse(after.functions.PermissionList[0].SecurityRule)
  assert.deepEqual(rules, plan.rules)
  save('verification.json', { verified: true, collections: Resources.length, blockedFunctions, defaultRulePreserved: true })
  console.log(JSON.stringify({ verified: true, dir, collections: Resources.length, blockedFunctions }))
} else throw Error('Use prepare or apply')
