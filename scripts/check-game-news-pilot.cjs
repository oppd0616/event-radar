const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
const out=path.resolve(__dirname,'../output/game-news-cloud-pilot-'+require('../cloudfunctions/fetchEvents/lib/game-news-source').VERSION);fs.mkdirSync(out,{recursive:true})
const apply=process.argv.includes('--apply'),label=process.argv.includes('--repeat')?(apply?'repeat-apply':'repeat-preview'):apply?'apply':'preview'
const p=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke','fetchEvents','-d',JSON.stringify({mode:'publisher-source-run',pilotSource:'17173',preview:!apply}),'--json'],{encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024,windowsHide:true})
if(p.status!==0)throw Error('Cloud pilot request failed; raw output withheld')
const r=JSON.parse(p.stdout.slice(p.stdout.indexOf('{'))),result=JSON.parse(r.data.RetMsg)
fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify({at:new Date().toISOString(),requestId:r.data.RequestId,duration:r.data.Duration,result},null,2))
console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1

