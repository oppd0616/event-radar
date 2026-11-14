const assert=require('assert')
const {inspect,select}=require('../cloudfunctions/fetchEvents/lib/candidate-scheduler')
const now=1200000*1000
const rows=Array.from({length:630},(_,i)=>({_id:String(i).padStart(4,'0'),kind:'detail_enrichment',targetEventId:'event-'+i,status:'waiting',nextCheckAt:1,createdAt:1}))
rows.push({_id:'9999',kind:'discovery_detail',title:'new event beyond first page',status:'waiting',nextCheckAt:now-1,createdAt:now-1})
const db={collection:()=>({where:filter=>{
 let skip=0,limit=100
 return {orderBy(){return this},skip(n){skip=n;return this},limit(n){limit=n;return this},async get(){return {data:rows.filter(x=>x.status===filter.status).slice(skip,skip+limit)}}}
}})}
async function main(){
 const state=await inspect(db,now)
 assert.equal(state.rows.length,631)
 assert.equal(state.selected._id,'9999','new discovery beyond 100 must participate')
 assert.equal(select(rows,now+1200000)._id,'0000','maintenance must also receive a slot')
 const ready={_id:'ready',kind:'discovery_detail',status:'ready_to_extract',nextCheckAt:now-1}
 assert.equal(select([...rows,ready],now)._id,'ready','finish cached search within its lane')
 assert.equal(select([{...ready,nextCheckAt:now+1}],now),null,'respect retry backoff')
 assert.equal(select(rows.filter(x=>x.kind!=='discovery_detail'),now)._id,'0000','empty lane should drain other work')
 const expired = { ...ready, discoveryAdmissionVersion: 1, discoveryExpiresAt: now }
 assert.equal(select([expired], now), null, 'expired temporary discoveries stop spending search resources')
 assert.equal(select([{ ...ready, createdAt: 1 }], now)._id, 'ready', 'legacy queue is not expired by the new policy')
 console.log('Candidate scheduler passed: full pagination, lane fairness, cached continuation and cooldown')
}
main().catch(e=>{console.error(e);process.exitCode=1})
