const assert=require('assert/strict'),s=require('../cloudfunctions/fetchEvents/lib/known-detail-evidence'),{failureState}=require('../cloudfunctions/fetchEvents/lib/search-runtime')
async function main(){const candidate={title:'2026深圳AI开发工作坊',domain:'tech',sources:[{url:'https://developer.cloud.tencent.com.cn/salon/test'}]},matches=(a,b)=>b.includes(a),yearCompatible=()=>true,body='<title>'+candidate.title+'</title><p>'+candidate.title+' 活动时间2026年11月14日，深圳公众活动。'.repeat(20)+'</p>';let calls=0
const deps={matches,yearCompatible,fetch:async()=>{calls++;return {text:body}}}
assert.equal((await s.read(candidate,deps)).length,1);assert.equal(calls,1)
assert.equal((await s.read({...candidate,sources:[{url:'https://unknown.example/test'}]},deps)).length,0)
assert.equal((await s.read(candidate,{...deps,fetch:async()=>({text:body.replaceAll(candidate.title,'其他活动')})})).length,0)
assert.equal((await s.read(candidate,{...deps,yearCompatible:()=>false})).length,0)
assert.equal((await s.read(candidate,{...deps,fetch:async()=>{throw Error('timeout')}})).length,0)
assert.equal((await s.read({...candidate,sources:[{url:'https://127.0.0.1/test'}]},deps)).length,0)
const news={...candidate,domain:'game',sources:[{url:'https://news.17173.com/content/10112026/100540354.shtml',channel:'publisher_direct',publisherSourceUrl:'https://news.17173.com/tag/test'}]};assert.equal((await s.read(news,deps)).length,1);assert.equal((await s.read({...news,sources:[{...news.sources[0],channel:'unknown'}]},deps)).length,0)
const now=Date.parse('2026-10-30T22:00:00+08:00'),error=Object.assign(new Error('monthly budget exhausted'),{code:'WSA_MONTHLY_BUDGET_EXHAUSTED'}),state=failureState(error,{retryCount:2},now)
assert.equal(state.nextCheckAt,Date.parse('2026-11-01T00:00:00+08:00'));assert.equal(state.retryCount,2);assert.equal(state.waitingCategory,'search_quota');assert.equal(state.lastErrorCode,'monthly_search_limit')
console.log('PASS: bounded trusted detail reuse, fetched identity/year checks, private/unknown URLs rejected, network recovery, monthly quota resumes next month without retry penalty')}
main().catch(e=>{console.error(e);process.exitCode=1})
