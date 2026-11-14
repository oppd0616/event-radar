const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const p=require('../cloudfunctions/fetchEvents/lib/publisher-sources')
const {database}=require('./verify-event-write-quality')
const now=Date.parse('2026-10-27T12:00:00+08:00'),HOUR=3600000
const source=p.seeds[0],sourceId=p.key(source.url)
function row(i){return {title:`人工智能开发者工作坊第${i}场`,domain:'tech',city:'上海',confidence:.95,evidenceIndex:0,detailUrl:`https://developer.cloud.tencent.com.cn/salon/salon-${i}`}}
const rows=Array.from({length:5},(_,i)=>row(i+1))
const html='<main>'+Array.from({length:130},(_,i)=>`<a href="/salon/activities?topic=${i}">分类活动${i}</a>`).join('')+rows.map(r=>`<a href="${r.detailUrl}"><h3>${r.title}</h3><footer>2026-10-31 上海 报名中</footer></a>`).join('')+'</main>'
function production(db){
  const filename=path.resolve(__dirname,'../cloudfunctions/fetchEvents/index.js'),mod={exports:{}}
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.test={saveDiscoveryCandidates,runPublisherSource,resolveRequestedNamedTarget}',{
    module:mod,exports:mod.exports,require:name=>name==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({})}:name.startsWith('.')?require(path.resolve(path.dirname(filename),name)):require(name),process,console,Buffer,URL,setTimeout,clearTimeout
  },{filename})
  return mod.exports
}
async function main(){
  const item=p.pageItem(html,source)
  assert.equal(item.links.length,5,'filters must not exhaust the detail link allowance')
  assert(item.description.includes('2026-10-31 上海 报名中'),'activity footers carry essential dates')
  assert(!item.links.some(x=>x.url.includes('?topic=')))
  assert(!p.pageItem('<html><script>renderEvents()</script></html>',source).readable)
  const structured=p.pageItem('<script type="application/ld+json">{"@type":"Event","name":"人工智能开发者工作坊","startDate":"2026-10-31"}</script>',source)
  assert(structured.readable)
  for(const url of ['http://example.com','https://127.0.0.1/a','https://a:b@example.com','https://example.com:8443','file:///etc/passwd'])assert.equal(p.safeUrl(url),'')
  assert.equal(p.proposals([{title:'开发者活动列表',link:'https://unknown-example.com/events'}],{domain:'tech'}).length,0)
  assert.equal(p.proposals([{title:'开发者活动列表',link:'https://developer.cloud.tencent.com.cn/other-events'}],{domain:'tech'}).length,1)
  const db=database(),prod=production(db),seen=new Set();let fetches=0,extracts=0
  assert.equal(prod.test.resolveRequestedNamedTarget('tech','developer','AI 沙龙——实践分享'),'AI 沙龙--实践分享')
  assert.equal(prod.test.resolveRequestedNamedTarget('tech','developer','site:evil.com AI沙龙'),'')
  const deps={fetch:async()=>{fetches++;return {text:html}},extract:async()=>{extracts++;return [...rows,{...row(99),title:'网页根本没有的幻想活动'},{...row(1),confidence:undefined},{...row(1),parentTitle:'大会议程'}]},known:async r=>seen.has(r.title),save:async(a,b,c,n)=>{const s=await prod.test.saveDiscoveryCandidates(a,b,c,n);if(s.discoveredCandidates)seen.add(a[0].title);return s}}
  const preview=await p.run(db,now,{sourceId,preview:true},deps)
  assert.equal(preview.eligible,5);assert.equal(preview.titles.length,3)
  assert.equal(Object.keys(db.records.eventCandidates).length,0,'preview must not write')
  const first=await p.run(db,now,{sourceId,preview:false},deps)
  assert.equal(first.queued,3)
  const candidates=Object.values(db.records.eventCandidates).filter(x=>x.kind==='discovery_detail')
  assert.equal(candidates.length,3)
  assert(candidates.every(x=>x.status==='waiting'&&x.sources[0].url.includes('/salon/salon-')&&x.sources[0].publisherSourceUrl===source.url))
  assert.equal(db.state.eventWrites,0,'discovery cannot bypass verification into events')
  const repeat=await p.run(db,now+1000,{sourceId,preview:false},deps)
  assert(repeat.skipped);assert.equal(fetches,2)
  const second=await p.run(db,now+6*HOUR,{sourceId,preview:false},deps)
  assert.equal(second.queued,2);assert(second.cacheHit);assert.equal(extracts,2,'unchanged page reuses parsed identities and drains remaining candidates')
  const third=await p.run(db,now+12*HOUR,{sourceId,preview:false},deps)
  assert.equal(third.queued,0);assert.equal(third.known,5)
  assert.equal(db.state.eventWrites,0)
  const concurrent=database();let concurrentFetches=0
  const concurrentDeps={...deps,fetch:async()=>{concurrentFetches++;await new Promise(r=>setTimeout(r,20));return {text:html}},known:async()=>true}
  const pair=await Promise.all([p.run(concurrent,now,{sourceId,preview:false},concurrentDeps),p.run(concurrent,now,{sourceId,preview:false},concurrentDeps)])
  assert.equal(concurrentFetches,1);assert(pair.some(x=>x.reason==='source_busy'))
  const bad=database();let attemptedExtraction=0
  const failure=await p.run(bad,now,{sourceId,preview:false},{...deps,fetch:async()=>({text:'<script>app()</script>'}),extract:async()=>{attemptedExtraction++;return []}})
  assert.equal(failure.ok,false);assert.equal(attemptedExtraction,0)
  assert.equal(bad.records.eventCandidates[sourceId].nextCheckAt,now+6*HOUR)
  const capacity=database()
  await p.enroll(capacity,Array.from({length:50},(_,i)=>({name:'发布源'+i,url:`https://publisher${i}.example.com/events`,domain:'tech'})),now)
  assert.equal((await p.health(capacity,now)).sources.length,30)
  await p.enroll(capacity,[],now+15*24*HOUR)
  assert.equal((await p.health(capacity,now+15*24*HOUR)).sources.length,0)
  const hostCap=database()
  assert.equal((await p.enroll(hostCap,Array.from({length:8},(_,i)=>({name:'栏目'+i,url:`https://publisher.example.com/events/${i}`,domain:'tech'})),now)).added,3)
  // Official publisher candidates have six bounded slots, independent of a full ordinary queue.
  const full=database(),fprod=production(full)
  const slots=Object.fromEntries(Array.from({length:60},(_,i)=>['existing'+i,now+24*HOUR]))
  await full.collection('eventCandidates').doc('discovery-capacity-candidate-tech').set({data:{fingerprint:'discovery-capacity-candidate-tech',slots}})
  const blocked=await p.run(full,now,{sourceId,preview:false},{...deps,extract:async()=>rows,known:async()=>false,save:fprod.test.saveDiscoveryCandidates})
  assert.equal(blocked.queued,3);assert.equal(blocked.deferred,0);assert.equal(full.state.eventWrites,0)
  assert.equal(Object.keys(full.records.eventCandidates['discovery-capacity-candidate-tech'].slots).length,60)
  const publisherCap=full.records.eventCandidates['discovery-capacity-publisher_candidate-tech']
  assert.equal(Object.keys(publisherCap.slots).length,3)
  for(let i=0;i<3;i++)publisherCap.slots['reserved'+i]=now+24*HOUR
  const deferred=await p.run(full,now+6*HOUR,{sourceId,preview:false},{...deps,extract:async()=>rows,known:async r=>rows.slice(0,3).some(x=>x.title===r.title),save:fprod.test.saveDiscoveryCandidates})
  assert.equal(deferred.queued,0);assert.equal(deferred.deferred,2)
  const candidate=Object.values(full.records.eventCandidates).find(x=>x.kind==='discovery_detail')
  assert.equal(candidate.discoveryCapacityKind,'publisher_candidate')
  const admission=require('../cloudfunctions/fetchEvents/lib/discovery-admission')
  await full.runTransaction(tx=>admission.release(tx,'tech',candidate._id))
  assert.equal(Object.keys(full.records.eventCandidates['discovery-capacity-publisher_candidate-tech'].slots).length,5)
  assert.equal(Object.keys(full.records.eventCandidates['discovery-capacity-candidate-tech'].slots).length,60)
  const stale=Object.values(full.records.eventCandidates).find(x=>x.kind==='discovery_detail'&&x._id!==candidate._id)
  stale.status='published'
  await full.runTransaction(tx=>admission.reserve(tx,'tech','replacement',now,now+24*HOUR,'publisher_candidate',6))
  assert(!full.records.eventCandidates['discovery-capacity-publisher_candidate-tech'].slots[stale._id])
  const repeatedTitle='WorkBuddy FDE 精英班 - 深圳场（敏捷班）'
  const recurring=[{...row(21),title:repeatedTitle,city:'深圳'},{...row(22),title:repeatedTitle,city:'深圳'},{...row(23),city:'深圳'}]
  const datedHtml=recurring.map((r,i)=>`<a href="${r.detailUrl}"><h3>${r.title}</h3><footer>${['2026-12-05','2026-11-14','2026-10-20'][i]} 深圳</footer></a>`).join('')
  const dated=await p.run(database(),now,{sourceId,preview:true},{...deps,fetch:async()=>({text:datedHtml}),extract:async()=>recurring,known:async()=>false})
  assert.equal(dated.eligible,2);assert.equal(dated.expired,1)
  assert.deepEqual(dated.titles,['2026-11-14 '+repeatedTitle,'2026-12-05 '+repeatedTitle],'distinct sessions stay separate and nearer dates get priority')
  const sharedDb=database(),sharedProd=production(sharedDb)
  const sharedRows=['2026人工智能开发者公开课深圳站','2026人工智能开源贡献工作坊深圳站'].map(title=>({title,domain:'tech',city:'深圳',confidence:.95,evidenceIndex:0,detailUrl:'https://developer.cloud.tencent.com.cn/salon/shared'}))
  const sharedHtml='深圳开发者公开活动与开源工作坊。'.repeat(10)+sharedRows.map(r=>`<a href="${r.detailUrl}"><h3>${r.title}</h3><footer>2026-11-01 深圳</footer></a>`).join('')
  const shared=await p.run(sharedDb,now,{sourceId,preview:false},{...deps,fetch:async()=>({text:sharedHtml}),extract:async()=>sharedRows,known:async()=>false,save:sharedProd.test.saveDiscoveryCandidates})
  assert.equal(shared.queued,2,'independent activities sharing one announcement must both reach candidate writer')
  assert.equal(Object.values(sharedDb.records.eventCandidates).filter(x=>x.kind==='discovery_detail'&&x.status==='waiting').length,2)
  const wrongCity=await p.run(database(),now,{sourceId,preview:true},{...deps,extract:async()=>rows.map(r=>({...r,city:'杭州'})),known:async()=>false})
  assert.equal(wrongCity.eligible,0,'city absent from source must not be admitted')
  console.log(JSON.stringify({ok:true,checks:['card dates & detail links','preview no writes','real candidate writer integration','unknown names rejected','repeat dedup','cached backlog continuation','concurrent lease','dynamic-page failure/backoff','source capacity/expiry/per-host cap','ordinary capacity preserved; 6 publisher slots; correct release','expired cards filtered','separate recurring sessions; nearer dates first'],firstQueued:first.queued,secondQueued:second.queued,thirdQueued:third.queued,formalEventWrites:db.state.eventWrites},null,2))
}
main().catch(e=>{console.error(e);process.exitCode=1})
