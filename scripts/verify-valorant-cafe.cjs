const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const action=process.argv[2]||'inspect',title=process.argv[3]||'无畏契约新特工快闪茶餐厅 瓦记冰室'
function run(args){const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'],{encoding:'utf8',timeout:240000,maxBuffer:16*1024*1024});if(r.status!==0)throw Error((r.stderr||r.stdout||String(r.error)).slice(0,800));return JSON.parse(r.stdout.slice(r.stdout.indexOf('{')))}
let result
if(action==='detail'){
 const envelope=run(['fn','invoke','getEvents','-d',JSON.stringify({id:'8429e93365a8b610182f41bea4d4676f'})])
 result=JSON.parse(envelope.data.RetMsg)
}else if(action==='inspect'){
 result={}
 for(const table of ['events','eventCandidates']){
  const q={find:table,filter:{title:{$regex:'瓦记|茶餐厅|瓦記'}},limit:50}
  result[table]=run(['db','nosql','execute','--command',JSON.stringify([{TableName:table,CommandType:'QUERY',Command:JSON.stringify(q)}])]).data.results[0]
 }
}else{
 const input=action==='discover'?{mode:'real-only',domain:'game',topicKey:'valorant',city:'上海',namedTarget:title}:action==='recheck'?{mode:'candidate-recheck',targetTitle:title}:null
 if(!input)throw Error('Unknown action')
 const envelope=run(['fn','invoke','fetchEvents','-d',JSON.stringify(input)])
 result={input,result:JSON.parse(envelope.data.RetMsg)}
}
const file=path.resolve(__dirname,'../docs/valorant-cafe-'+action+'-'+Date.now()+'.json')
fs.writeFileSync(file,JSON.stringify(result,null,2));console.log(JSON.stringify({file,...result},null,2))
