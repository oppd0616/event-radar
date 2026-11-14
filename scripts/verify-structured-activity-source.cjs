const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict')
const a=require('../cloudfunctions/fetchEvents/lib/structured-activity-source'),p=require('../cloudfunctions/fetchEvents/lib/publisher-sources'),{database}=require('./verify-event-write-quality')
const now=Date.parse('2026-10-30T12:00:00+08:00'),source=a.sources.zuicool
const cache=path.resolve(__dirname,'../output/showstart-zuicool-trial-20261030'),html=fs.readFileSync(path.join(cache,crypto.createHash('sha256').update(source.url).digest('hex')+'.html'),'utf8')
async function main(){
 const parsed=a.parse(html,source,now);assert(parsed.rows.length>=14);assert(parsed.item.links.every(x=>x.dates.length));assert(parsed.rows.some(x=>x.title.includes('Keep')))
 const closed=parsed.rows.find(x=>x.title.includes('千八'));assert(closed,'closed registration must not hide future race')
 const db=database(),seen=new Set(),deps={fetch:async()=>({text:html}),extract:async()=>{throw Error('structured source must avoid AI')},known:async r=>seen.has(r.detailUrl),save:async rows=>{rows.forEach(r=>seen.add(r.detailUrl));return {discoveredCandidates:rows.length}}}
 const before=JSON.stringify(db.records),preview=await p.run(db,now,{pilotSource:'zuicool',preview:true},deps);assert.equal(JSON.stringify(db.records),before);assert.equal(preview.extractionCalls,0)
 let total=0,rounds=[]
 for(let i=0;i<25;i++){const r=await p.run(db,now+i*21600001,{pilotSource:'zuicool',preview:false},deps);assert(r.ok);assert(r.queued<=3);total+=r.queued;rounds.push({queued:r.queued,known:r.known,backlog:r.backlog});if(!r.queued)break}
 assert.equal(total,seen.size);assert(total>=14);assert(!db.records.eventCandidates['publisher-source-registry-v1'],'manual pilot must not enroll source');assert.equal(db.state.eventWrites,0)
 const card=(title,schedule)=>`<div class="reg-race-block"><h4>${title}</h4><a href="https://reg.zuicool.com/123">详情</a><p style="flex: 1;">${schedule}</p>`
 assert.equal(a.parse(card('已关闭 未来跑步','2026年11月7日 上海市'),source,now).rows.length,1)
 assert.equal(a.parse(card('过去跑步','2026年10月1日 上海市'),source,now).rows.length,0)
 assert.equal(a.parse(card('缺年份跑步','11月7日 上海市'),source,now).rows.length,0)
 assert.equal(a.parse(card('线上跑步','2026年11月7日 不限地点'),source,now).rows.length,0)
 assert.equal(a.parse(card('错误日期跑步','2026年11月31日 上海市'),source,now).rows.length,0)
 const out=path.resolve(__dirname,'../output/structured-activity-pilot-20261030');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'cached-regression.json'),JSON.stringify({readOnly:true,formalWrites:0,aiCalls:0,sourceAudit:parsed.audit,preview,rounds,total,checks:['preview has no writes','manual source not enrolled','platform links preserved','registration close not event expiry','no year/invalid date rejected','per-detail evidence isolated','bounded rounds drain known candidates']},null,2));console.log(JSON.stringify({audit:parsed.audit,total,rounds,aiCalls:0,formalWrites:0},null,2))
}
main().catch(e=>{console.error(e);process.exitCode=1})
