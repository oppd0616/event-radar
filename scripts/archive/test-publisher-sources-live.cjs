// Direct public pages + the production identity prompt. Preview only: no cloud DB writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process')
const p=require('../../cloudfunctions/fetchEvents/lib/publisher-sources')
const {database}=require('../verify-event-write-quality')
const cli=require('../dashboard-cloudbase-cli.cjs').resolveCli()
async function main(){
  const proc=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','detail','fetchEvents','--json'],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true})
  if(proc.status!==0)throw Error('Cannot read live function configuration; output withheld')
  const detail=JSON.parse(proc.stdout.slice(proc.stdout.indexOf('{'))).data,env={}
  for(const item of detail.Environment.Variables)if(/^DEEPSEEK_/.test(item.Key))env[item.Key]=item.Value
  const filename=path.resolve(__dirname,'../../cloudfunctions/fetchEvents/index.js'),mod={exports:{}},db=database()
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.test={callDeepSeekDiscovery}',{
    module:mod,exports:mod.exports,require:name=>name==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({})}:name.startsWith('.')?require(path.resolve(path.dirname(filename),name)):require(name),process:{env},console,Buffer,URL,setTimeout,clearTimeout
  },{filename})
  const results=[],out=path.resolve(__dirname,'../../output/publisher-source-test');fs.mkdirSync(out,{recursive:true})
  for(const source of p.seeds){
    const result=await p.run(db,Date.now(),{sourceId:p.key(source.url),preview:true},{
      extract:async(items,options)=>{const rows=await mod.exports.test.callDeepSeekDiscovery(items,Date.now(),options);fs.writeFileSync(path.join(out,p.key(source.url)+'.json'),JSON.stringify({url:source.url,rows},null,2));return rows},
      known:async()=>false,save:async()=>{throw Error('Preview must never save')}
    });results.push(result);console.log(JSON.stringify(result))
  }
  fs.writeFileSync(path.join(out,'live-preview-results.json'),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
