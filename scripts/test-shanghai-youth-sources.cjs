// Manual read-only research: no cloud function invocation or database writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),{spawnSync}=require('child_process')
const root=path.resolve(__dirname,'..'),temporaryOverride=process.argv.includes('--ignore-monthly-limit'),out=path.join(root,temporaryOverride?'output/shanghai-youth-pilot-20261029-retry':'output/shanghai-youth-pilot-20261028')
const {database}=require('./verify-event-write-quality'),cli=require('./dashboard-cloudbase-cli.cjs').resolveCli()
const plans={
  1:['上海 快闪 主题餐厅 2026年10月28日至11月27日 活动 日期 地点','上海 新天地 蟠龙天地 虹桥天地 瑞虹天地 鸿寿坊 创智天地 2026 10月 11月 活动'],
  2:['上海 快闪 主题餐厅 2026年10月28日至11月27日 活动 日期 地点','上海 前滩太古里 兴业太古汇 2026 10月 11月 限时活动'],
  3:['上海 市集 潮流展览 2026年10月28日至11月27日 活动 日期 地点','上海 新天地 蟠龙天地 虹桥天地 瑞虹天地 鸿寿坊 创智天地 2026 11月 市集 展览']}
function cloud(args){const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true});if(r.status!==0)throw Error('Cloud read failed; credentials/output withheld');return JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).data}
function query(table,filter,projection,skip=0){return cloud(['db','nosql','execute','--command',JSON.stringify([{TableName:table,CommandType:'QUERY',Command:JSON.stringify({find:table,filter,projection,sort:{_id:1},skip,limit:100})}])]).results[0]}
function decode(x){if(Array.isArray(x))return x.map(decode);if(x&&typeof x==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in x)return Number(x[k]);return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))}return x}
function save(name,value){fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2))}
async function main(){
 fs.mkdirSync(out,{recursive:true});const mode=process.argv[2]
 if(mode==='snapshot'){
  for(const table of ['events','eventCandidates']){const rows=[];for(let skip=0;skip<5000;skip+=100){const page=decode(query(table,{title:{$exists:true}},{_id:1,title:1,domain:1,city:1,startTime:1,endTime:1,status:1,source:1,aliases:1,sessionKey:1,canonicalEventId:1,participationGuide:1},skip));if(!Array.isArray(page))throw Error('Invalid snapshot');rows.push(...page);if(page.length<100)break;if(skip===4900)throw Error('Snapshot incomplete: limit');}save(table+'-snapshot.json',rows);console.log(JSON.stringify({table,count:rows.length}))}return
 }
 const round=Number(mode);if(!plans[round])throw Error('Use 1, 2, 3 or snapshot');if(fs.existsSync(path.join(out,'round-'+round+'.json')))throw Error('Round already exists; refusing accidental repeat')
 const detail=cloud(['fn','detail','fetchEvents']),env={};for(const v of detail.Environment.Variables)if(/^(WSA_|DEEPSEEK_|TENCENT_TOKENHUB_|TENCENT_SEARCH_|TENCENT_REASONING_)/.test(v.Key))env[v.Key]=v.Value
 const month=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}).slice(0,7)
 const usage=decode(query('eventCandidates',{kind:'api_usage',provider:'tencent_wsa',month},{calls:1,monthlyLimit:1}));const used=usage.reduce((n,x)=>n+Number(x.calls||0),0)
 const previous=[1,2,3].flatMap(n=>{const f=path.join(out,'round-'+n+'.json');return fs.existsSync(f)?[JSON.parse(fs.readFileSync(f))]:[]});const localCalls=previous.filter(x=>x.provider==='tencent_wsa').reduce((n,x)=>n+x.searchCalls,0)
 const roundQueries=plans[round].map(q=>temporaryOverride?q.replace('10月28日至11月27日','10月29日至11月28日'):q)
 const needed=roundQueries.filter(q=>!fs.existsSync(path.join(out,'search-'+crypto.createHash('sha256').update(q).digest('hex').slice(0,12)+'.json'))).length
 const budgetBlocked=!temporaryOverride&&used+localCalls+needed>1500
 Object.assign(process.env,env);const wsa=require('../cloudfunctions/fetchEvents/lib/wsa-search'),tokenhub=require('../cloudfunctions/fetchEvents/lib/tencent-search-model')
 const priorFundingFailure=previous.some(r=>r.errors.some(e=>/http 402/.test(e.error)))
 const search=budgetBlocked?async q=>{if(priorFundingFailure)throw Error('Skipped: known TokenHub funding failure; no request sent');if(!tokenhub.tokenHubConfigured())throw Error('WSA cap reached; existing TokenHub fallback is not configured');return tokenhub.callTencentWebSearch(q,{city:'上海',count:10,timeoutMs:40000})}:q=>wsa.search(q)
 const filename=path.join(root,'cloudfunctions/fetchEvents/index.js'),mod={exports:{}},db=database()
 vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.preview={callDeepSeekDiscovery}',{module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),process:{env},console,Buffer,URL,setTimeout,clearTimeout},{filename})
 const result={round,at:new Date().toISOString(),readOnly:true,temporaryMonthlyLimitOverride:temporaryOverride,window:temporaryOverride?['2026-10-29','2026-11-28']:['2026-10-28','2026-11-27'],provider:budgetBlocked?'tencent_tokenhub':'tencent_wsa',budgetBlocked,searchCalls:0,cacheHits:0,extractionCalls:0,cloudUsageBefore:used,queries:[],items:[],rows:[],errors:[]}
 for(const original of plans[round]){const q=temporaryOverride?original.replace('10月28日至11月27日','10月29日至11月28日'):original;const name='search-'+crypto.createHash('sha256').update(q).digest('hex').slice(0,12)+'.json',file=path.join(out,name);let response;if(fs.existsSync(file)){response=JSON.parse(fs.readFileSync(file));result.cacheHits++}else{if(!(budgetBlocked&&priorFundingFailure))result.searchCalls++;try{response=await search(q);save(name,response)}catch(e){result.errors.push({query:q,error:e.message});continue}}result.queries.push({query:q,returned:response.items.length});result.items.push(...response.items)}
 result.items=[...new Map(result.items.map(x=>[x.link.replace(/#.*$/,''),x])).values()].slice(0,20)
 if(result.items.length){result.extractionCalls++;try{result.rows=(await mod.exports.preview.callDeepSeekDiscovery(result.items,temporaryOverride?Date.now():Date.parse('2026-10-28T12:00:00+08:00'),{publisher:true,city:'上海'})).slice(0,20)}catch(e){result.errors.push({stage:'extract',error:e.message})}}
 save('round-'+round+'.json',result);console.log(JSON.stringify({round,searchCalls:result.searchCalls,cacheHits:result.cacheHits,documents:result.items.length,rows:result.rows,errors:result.errors}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
