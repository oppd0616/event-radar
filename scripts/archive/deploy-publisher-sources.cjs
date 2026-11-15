const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process')
const cli=require('../dashboard-cloudbase-cli.cjs').resolveCli(),env='cloud1-d3gm0lbv1392513d1'
const stage=path.resolve(__dirname,'../../output/deploy-publisher-source-20261027')
function call(args,timeout=120000){
  const p=spawnSync(process.execPath,[cli,'-e',env,...args,'--json'],{cwd:stage,encoding:'utf8',timeout,maxBuffer:8*1024*1024,windowsHide:true})
  if(p.status!==0)throw Error('Cloud operation failed: '+args.slice(0,3).join(' ')+' (details withheld)')
  const x=JSON.parse(p.stdout.slice(p.stdout.indexOf('{')));if(x.success===false||x.error)throw Error('Cloud operation returned an error (details withheld)');return x.data
}
const before=call(['fn','detail','fetchEvents'])
call(['fn','deploy','fetchEvents','--force','--dir',path.join(stage,'fetchEvents'),'--install-dependency','false'],240000)
const after=call(['fn','detail','fetchEvents'])
const variables=x=>Object.fromEntries((x.Environment?.Variables||[]).map(v=>[v.Key,v.Value]))
const a=variables(before),b=variables(after)
if(Object.keys(a).length!==Object.keys(b).length||Object.entries(a).some(([k,v])=>b[k]!==v))throw Error('Function environment readback mismatch')
if(before.Runtime!==after.Runtime||before.Timeout!==after.Timeout)throw Error('Runtime/timeout changed')
const result={deployedAt:new Date().toISOString(),functionName:'fetchEvents',environmentPreserved:true,variableCount:Object.keys(a).length,runtime:after.Runtime,timeout:after.Timeout}
fs.writeFileSync(path.join(stage,'deployment-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
