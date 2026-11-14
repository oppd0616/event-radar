// Read-only public-page experiment. Cloud access reads configuration and records only.
const fs=require('fs'),path=require('path'),vm=require('vm'),{spawnSync}=require('child_process')
const p=require('../cloudfunctions/fetchEvents/lib/publisher-sources'),{getText}=require('../cloudfunctions/fetchEvents/lib/http')
const {database}=require('./verify-event-write-quality'),cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
const out=path.resolve(__dirname,'../output/broad-publisher-source-test-20261027');fs.mkdirSync(out,{recursive:true})
function call(args){const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true});if(r.status!==0)throw Error('Read-only cloud request failed; raw output withheld');return JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).data}
async function main(){
 const detail=call(['fn','detail','fetchEvents']),env={};for(const v of detail.Environment.Variables)if(/^DEEPSEEK_/.test(v.Key))env[v.Key]=v.Value
 const filename=path.resolve(__dirname,'../cloudfunctions/fetchEvents/index.js'),mod={exports:{}},db=database()
 vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.test={callDeepSeekDiscovery}',{module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),process:{env},console,Buffer,URL,setTimeout,clearTimeout},{filename})
 const sources=[{name:'活动行上海',url:'https://sh.huodongxing.com/events',host:'huodongxing.com'},{name:'活动行北京',url:'https://bj.huodongxing.com/events',host:'huodongxing.com'},{name:'豆瓣同城上海',url:'https://www.douban.com/location/shanghai/',host:'douban.com'}],results=[]
 for(const [i,s] of sources.entries()){
  const r={name:s.name,url:s.url};results.push(r)
  try{const a=await getText(s.url,{allowedHosts:[s.host],timeoutMs:12000,maxBytes:2400000});fs.writeFileSync(path.join(out,i+'.html'),a.text);const item=p.pageItem(a.text,s);fs.writeFileSync(path.join(out,i+'-parsed.json'),JSON.stringify(item,null,2));r.bytes=Buffer.byteLength(a.text);r.links=item.links.length;r.rows=await mod.exports.test.callDeepSeekDiscovery([item],Date.now(),{publisher:true,city:''});r.rows=r.rows||[]
   const b=p.pageItem((await getText(s.url,{allowedHosts:[s.host],timeoutMs:12000,maxBytes:2400000})).text,s);r.repeat={links:b.links.length,sharedLinks:item.links.filter(x=>b.links.some(y=>y.url===x.url)).length}
  }catch(e){r.error=e.message}console.log(JSON.stringify(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checkedAt:new Date().toISOString(),readOnly:true,results},null,2))
 }
 const titles=results.flatMap(x=>x.rows||[]).map(x=>x.title).filter(Boolean)
 if(titles.length){const terms=titles.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));const matches={};for(const table of ['events','eventCandidates']){const q={find:table,filter:{$or:terms.map(t=>({title:{$regex:t}}))},projection:{_id:1,title:1,status:1,domain:1,city:1},limit:200};matches[table]=call(['db','nosql','execute','--command',JSON.stringify([{TableName:table,CommandType:'QUERY',Command:JSON.stringify(q)}])]).results[0]}fs.writeFileSync(path.join(out,'exact-title-cloud-matches.json'),JSON.stringify(matches,null,2));console.log(JSON.stringify({exactTitleMatches:matches}))}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
