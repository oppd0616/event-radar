const {spawnSync}=require('child_process')
const fs=require('fs'),path=require('path')
const input=JSON.parse(process.argv[2])
const pnpm='C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pnpm/bin/pnpm.mjs'
const longTimeoutCli='C:/Users/oppd_/AppData/Local/Temp/codex-cloudbase-cli-long/cli.js'
const installedCli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const launcher=fs.existsSync(longTimeoutCli)?[longTimeoutCli]:fs.existsSync(installedCli)?[installedCli]:[pnpm,'dlx','--package','@cloudbase/cli','tcb']
const run=spawnSync(process.execPath,[...launcher,'fn','invoke','fetchEvents','-d',JSON.stringify(input),'--env-id','cloud1-d3gm0lbv1392513d1','--json'],{encoding:'utf8',timeout:420000,maxBuffer:16*1024*1024})
if(run.status!==0){console.error(run.stderr,run.stdout);process.exit(1)}
const envelope=JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
const data=JSON.parse(envelope.data.RetMsg)
const dir=path.join(__dirname,'../docs/v21-validation')
fs.mkdirSync(dir,{recursive:true})
const file=path.join(dir,Date.now()+'-'+input.mode+'.json')
fs.writeFileSync(file,JSON.stringify({input,result:data},null,2))
console.log(JSON.stringify({file,...data}))
