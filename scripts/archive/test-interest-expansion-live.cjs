const {spawnSync}=require('child_process'),fs=require('fs'),path=require('path')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const tests=[{mode:'demand-health'},{mode:'search-only',domain:'game',topicKey:'valorant',namedTarget:false,demandSweep:true,debug:true},{mode:'search-only',domain:'tech',topicKey:'hackathon',namedTarget:false,debug:true}]
const results=[]
for(const input of tests){const run=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke','fetchEvents','-d',JSON.stringify(input),'--json'],{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});let result;try{if(run.status!==0)throw Error((run.stdout||run.stderr||String(run.error)).slice(0,350));const envelope=JSON.parse(run.stdout.slice(run.stdout.indexOf('{')));result=JSON.parse(envelope.data.RetMsg);if(result.errorCode)result.ok=false}catch(e){result={ok:false,error:e.message}}results.push({input,result});console.log(JSON.stringify({input,result}));}
fs.writeFileSync(path.resolve(__dirname,'../../docs/interest-expansion-live-20261013.json'),JSON.stringify(results,null,2))
if(results.some(x=>x.result.ok===false))process.exitCode=1
