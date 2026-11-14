const assert=require('assert/strict'),s=require('../cloudfunctions/fetchEvents/lib/game-news-source'),p=require('../cloudfunctions/fetchEvents/lib/publisher-sources'),{database}=require('./verify-event-write-quality')
const now=Date.parse('2026-10-12T12:00:00+08:00'),id='publisher-pilot-17173-v1',tag='https://news.17173.com/tag/'+encodeURIComponent('快闪')
const urls=Array.from({length:15},(_,i)=>`https://news.17173.com/content/10112026/${1000+i}.shtml`)
const html=urls.map((u,i)=>`<a href="${u}">公众活动公告${i}</a>`).join('')
const fetch=async u=>({text:u.includes('/tag/')?html:'<title>游戏玩家活动公告</title><p>'+('深圳公众体验活动。'.repeat(30))+'</p>'})
async function main(){
 const db=database();let calls=0
 const deps={pageItem:p.pageItem,fetch,extract:async()=>{calls++;return []},records:async()=>[],save:async()=>{throw Error('No eligible rows')}}
 const first=await s.run(db,now,{preview:false},deps);assert.equal(first.selectedArticles.length,6)
 const second=await s.run(db,now+21600001,{preview:false},deps);assert.equal(second.selectedArticles.length,6);assert(!second.selectedArticles.some(u=>first.selectedArticles.includes(u)))
 const third=await s.run(db,now+43200002,{preview:false},deps);assert.equal(third.selectedArticles.length,3)
 const fourth=await s.run(db,now+64800003,{preview:false},deps);assert.equal(fourth.aiCalls,0);assert.equal(fourth.pageRequests,2);assert.equal(calls,3);assert.equal(db.records.eventCandidates[id].articleHistory.length,15)
 // A pending article survives disappearance from the listing.
 const archived=await s.collect([tag],{pageItem:p.pageItem,now,fetch:async u=>({text:u===tag?'':(await fetch(u)).text}),pendingArticles:[{url:urls[0],title:'旧公告',publisherSourceUrl:tag}]});assert.deepEqual(archived.selected,[urls[0]])
 // Synthetic, explicitly labelled fixture: independent events sharing one announcement.
 const quote1='KPL奇妙日 活动时间2026年10月24日—10月25日，深圳国际会展中心。'
 const quote2='王者荣耀共创之夜 活动时间2026年10月25日，深圳市体育中心。'
 const doc={title:'合并公告（合成测试）',link:urls[0],description:quote1+quote2}
 const rows=[{title:'KPL奇妙日',newsStartDate:'2026-10-24',newsEndDate:'2026-10-25',newsDateQuote:quote1},{title:'王者荣耀共创之夜',newsStartDate:'2026-10-25',newsEndDate:'2026-10-25',newsDateQuote:quote2}].map(r=>({...r,domain:'game',city:'深圳',evidenceIndex:0}))

 const contextQuote='2026周年庆・共创之夜 ◈时间：10月25日18:30线下演出 ◈地点：深圳市体育中心。'
 const contextRow={...rows[1],title:'2026周年庆・共创之夜',newsDateQuote:contextQuote}
 assert.equal(s.dateProof(contextRow,{description:contextQuote},now),'supported')
 assert.equal(s.dateProof({...contextRow,title:'共创之夜'},{description:contextQuote},now),'unverified','unrelated year cannot supply event year')
 assert.equal(s.dateProof({...contextRow,newsStartDate:'2025-10-25',newsEndDate:'2025-10-25'},{description:contextQuote},now),'unverified')
 const fixture=database();fixture.records.eventCandidates[id]={_id:id,version:s.VERSION,parsedAt:now-1,documents:[doc],identities:rows}
 const result=await s.run(fixture,now,{preview:true},{...deps,records:async()=>[{title:rows[0].title,city:'深圳',sources:[{url:doc.link}]}]});assert.equal(result.known,1);assert.deepEqual(result.titles,[rows[1].title])
 for(const row of rows){assert.equal(s.dateProof(row,doc,now),'supported');assert.equal(s.dateProof(row,doc,Date.parse('2026-10-30T12:00:00+08:00')),'expired')}
 // Model failure must not consume the unread queue.
 const failureDb=database();const failed=await s.run(failureDb,now,{preview:false},{...deps,extract:async()=>{throw Error('AI unavailable')}});assert.equal(failed.ok,false);assert(!failureDb.records.eventCandidates[id].articleHistory)

 const fs=require('fs'),path=require('path'),vm=require('vm'),writerDb=database(),mod={exports:{}}
 const filename=path.resolve(__dirname,'../cloudfunctions/fetchEvents/index.js')
 vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.save=saveDiscoveryCandidates',{module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>writerDb,getWXContext:()=>({})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),process,console,Buffer,URL,setTimeout,clearTimeout},{filename})
 const siblings=['2026周年庆嘉年华暨KPL奇妙日','2026周年庆共创之夜']
 const evidence={title:siblings.join('与'),link:urls[0],description:siblings.join('与'),publisherSourceUrl:tag}
 for(const title of siblings){const saved=await mod.exports.save([{title,domain:'game',city:'深圳',confidence:.95,evidenceIndex:0}],[evidence],{domain:'game',city:'深圳',sharedAnnouncement:true},now);assert.equal(saved.discoveredCandidates,1)}
 assert.equal(Object.values(writerDb.records.eventCandidates).filter(x=>x.kind==='discovery_detail'&&x.status==='waiting').length,2,'production writer must preserve siblings')
 const repeat=await mod.exports.save([{title:siblings[0],domain:'game',city:'深圳',confidence:.95,evidenceIndex:0}],[evidence],{domain:'game',city:'深圳',sharedAnnouncement:true},now+1)
 assert.equal(repeat.discoveredCandidates,0)
 assert.equal(db.state.eventWrites,0)
 console.log('PASS: 15 articles advance 6+6+3, drained batch avoids AI, pending survives listing removal, shared article keeps independent events, historical/expired dates, failure preserves progress, zero event writes')
}
main().catch(e=>{console.error(e);process.exitCode=1})
