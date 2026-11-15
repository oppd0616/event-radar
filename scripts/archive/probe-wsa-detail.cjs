const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const pnpm = 'C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pnpm/bin/pnpm.mjs'
const cases = process.argv.includes('--types') ? [
  {key:'running',targetTitle:'2026北京马拉松',city:'北京',domain:'sports'},
  {key:'exam',targetTitle:'2026年下半年全国大学英语四、六级考试',city:'',domain:'academic'},
  {key:'auto',targetTitle:'2026全新一代智己LS6预售',city:'',domain:'auto'}
] : [{key:'detail',targetTitle:'LISA×名创优品联名快闪 Pop-Up World Tour 北京站',city:'北京',domain:'culture'}]
for (const sample of cases) {
if (process.argv.includes('--auto-only') && sample.key !== 'auto') continue
for (const variant of (process.argv.includes('--after-only') || process.argv.includes('--types') ? ['after'] : ['before', 'after'])) {
  const input = {mode:'wsa-detail-probe',...sample,variant,extract:variant==='after'}
  const result = spawnSync(process.execPath, [pnpm, 'dlx','--package','@cloudbase/cli','tcb','fn','invoke','fetchEvents','-d',JSON.stringify(input),'--env-id','cloud1-d3gm0lbv1392513d1','--json'], {encoding:'utf8',maxBuffer:10*1024*1024,timeout:120000})
  if (result.status !== 0) { console.log(JSON.stringify({variant,error:result.stdout || result.error?.message})); continue }
  const output = result.stdout.slice(result.stdout.indexOf('{'))
  const envelope = JSON.parse(output)
  const data = JSON.parse(envelope.data.RetMsg)
  fs.writeFileSync(path.join(__dirname, '../../docs/wsa-' + sample.key + '-' + variant + '.json'), JSON.stringify(data, null, 2))
  console.log(JSON.stringify({variant,ok:data.ok,queries:data.queries,rawRetrieved:data.rawRetrieved,retrieved:data.retrieved,directlyFetched:data.directlyFetched,errors:data.errors,extracted:data.extracted,validated:data.validated,rejected:data.rejected,items:(data.items||[]).map(item=>({title:item.title,url:item.url,directFetched:item.directFetched,fetchError:item.fetchError}))}))
}
}
