const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const tests=[{domain:'tech',topicKey:'hackathon'},{domain:'tech',topicKey:'hackathon'},{domain:'game',topicKey:'valorant'}]
const index=Number(process.argv[2]||0),input={mode:'real-only',namedTarget:false,...tests[index]}
if(!tests[index])throw Error('Unknown test')
const run=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','invoke','fetchEvents','-d',JSON.stringify(input),'--json'],{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024})
if(run.status!==0)throw Error((run.stderr||run.stdout||String(run.error)).slice(0,500))
const envelope=JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
const result=JSON.parse(envelope.data.RetMsg)
const file=path.resolve(__dirname,'../../docs/dynamic-discovery-test-'+index+'-'+Date.now()+'.json')
fs.writeFileSync(file,JSON.stringify({input,result},null,2))
console.log(JSON.stringify({file,input,result}))
