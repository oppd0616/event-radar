const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const {createRequire}=require('node:module')
const {createPublicPoolCache,fetchPages}=require('../cloudfunctions/getEvents/public-feed-pool')
const later=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const tick=()=>new Promise(resolve=>setImmediate(resolve))
async function verifyPool(){
  const pending=new Map(),calls=[]
  const page=fetchPages((offset)=>{calls.push(offset);const wait=later();pending.set(offset,wait);return wait.promise},500)
  assert.deepEqual(calls,[0])
  pending.get(0).resolve({data:Array.from({length:100},(_,i)=>i)});await tick()
  assert.deepEqual(calls,[0,100,200,300,400],'remaining pages must start together after the first full page')
  for(const offset of [400,200,300,100]) pending.get(offset).resolve({data:Array.from({length:100},(_,i)=>offset+i)})
  assert.deepEqual((await page).data,Array.from({length:500},(_,i)=>i),'completion order cannot alter pool order')
  let shortCalls=0
  assert.equal((await fetchPages(async()=>{shortCalls++;return {data:[1]}},500)).data.length,1)
  assert.equal(shortCalls,1)
  await assert.rejects(fetchPages(async offset=>{if(offset===200)throw Error('offline');return {data:Array(100).fill(0)}},500))
  let time=1000,count=0,wait=later()
  const cache=createPublicPoolCache(async domain=>{count++;await wait.promise;return {domain}}, {clock:()=>time})
  const a=cache('all'),b=cache('all');await tick();assert.equal(count,1)
  wait.resolve();await Promise.all([a,b]);await cache('all');assert.equal(count,1)
  await cache('game');assert.equal(count,2,'domains cannot share the wrong pool')
  time+=20000;await cache('all');assert.equal(count,3,'public data expires at 20 seconds')
  let failures=0
  const retry=createPublicPoolCache(async()=>{if(++failures===1)throw Error('offline');return {cacheable:false}})
  await assert.rejects(retry('all'));await retry('all');await retry('all');assert.equal(failures,3,'failed or degraded queries are not cached')
}

async function verifyFeed(){
  const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/recommendation-ranking-fixture-20260930.json'),'utf8'))
  const original=JSON.stringify(fixture.events),filename=path.resolve(__dirname,'../cloudfunctions/getEvents/index.js')
  const native=createRequire(filename),source=fs.readFileSync(filename,'utf8')
  const prefs={game:{preferredDomains:[{domain:'game',weight:3}],preferredTopics:[{domain:'game',key:'valorant',weight:3}]},tech:{preferredDomains:[{domain:'tech',weight:3}],preferredTopics:[{domain:'tech',key:'hackathon',weight:3}]}}
  function load(optimized){
    let user='game',eventReads=0,userReads=0
    const command={gte:value=>({op:'gte',value,and(other){return {op:'range',value,high:other.value}}}),lte:value=>({op:'lte',value})}
    const db={command,collection(name){
      let where={},field,order,offset=0,size=100
      const query={where(value){where=value;return query},orderBy(f,o){field=f;order=o;return query},skip(n){offset=n;return query},limit(n){size=n;return query},async get(){
        if(name==='users'){userReads++;return {data:[prefs[user]]}}
        eventReads++
        let rows=fixture.events.filter(row=>Object.entries(where).every(([key,value])=>value && value.op ? value.op==='gte' ? row[key]>=value.value : value.op==='lte' ? row[key]<=value.value : row[key]>=value.value && row[key]<=value.high : row[key]===value))
        if(field) rows.sort((a,b)=>(Number(a[field])-Number(b[field]))*(order==='desc'?-1:1))
        return {data:rows.slice(offset,offset+size)}
      }};return query
    }}
    class FixedDate extends Date { constructor(...args){super(...(args.length?args:[fixture.now]))} static now(){return fixture.now} }
    const module={exports:{}}
    const previousFile=path.resolve(__dirname,'../output/backups/getEvents-before-cold-start-20261023/index.js')
    const code=!optimized && fs.existsSync(previousFile) ? fs.readFileSync(previousFile,'utf8') : source
    vm.runInNewContext(code,{module,exports:module.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({OPENID:user})}:n==='opencc-js'?{Converter:()=>x=>x}:n==='./public-feed-pool'&&!optimized?{createPublicPoolCache:loader=>loader,fetchPages:async(query,max)=>{const data=[];for(let offset=0;offset<max;offset+=100){const page=await query(offset,Math.min(100,max-offset));data.push(...page.data);if(page.data.length<100)break}return {data}}}:native(n),Date:FixedDate,URL,console},{filename})
    return {main:module.exports.main,setUser(value){user=value},counts:()=>({eventReads,userReads})}
  }
  const before=load(false),after=load(true)
  for(const domain of ['all','game','tech']) for(const user of ['game','tech']) for(const sortMode of ['comprehensive','time','popularity']){
    before.setUser(user);after.setUser(user)
    const input={domain,sortMode,cardOnly:true,pageSize:20,cursor:0}
    const expected=await before.main(input),actual=await after.main(input)
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)),`${domain}/${user}/${sortMode} must retain response and ranking`)
  }
  assert.equal(after.counts().userReads,18,'preferences are freshly loaded for every user request')
  assert(after.counts().eventReads<before.counts().eventReads,'warm public pool must reduce database queries')
  assert.equal(JSON.stringify(fixture.events),original,'cached public records must not be mutated by ranking')
  console.log('Feed comparison:',JSON.stringify({requests:18,before:before.counts(),after:after.counts()}))
}

async function verifyPrefetch(){
  const filename=path.resolve(__dirname,'../miniprogram/utils/api.js'),native=createRequire(filename)
  let calls=[],pending=[],epoch=1
  const cache={version:()=>epoch,invalidate(){epoch++}}
  const module={exports:{}},params={domain:'all',cursor:0,pageSize:20,cardOnly:true,sortMode:'time',feedOrder:undefined}
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,require:n=>n==='./feed-cache'?cache:native(n),Date,console,getApp:()=>({globalData:{useMock:false}}),wx:{getStorageSync:()=> 'time',cloud:{callFunction(input){calls.push(input);pending.push(input)}}}})
  const api=module.exports
  api.prefetchHome();const home=api.getEvents(params)
  assert.equal(calls.length,1,'App and homepage must reuse one cold-start request')
  pending[0].success({result:{list:[{_id:'first'}]}});assert.equal((await home).list[0]._id,'first')
  api.prefetchHome();const changed=api.getEvents({...params,sortMode:'comprehensive'})
  assert.equal(calls.length,3,'a different sort must never consume the prefetched result')
  pending[1].success({result:{}});pending[2].success({result:{}});await changed
  api.prefetchHome();cache.invalidate();const invalid=api.getEvents(params)
  assert.equal(calls.length,5,'changed preferences or privacy invalidate the pending prefetch')
  pending[3].success({result:{}});pending[4].success({result:{}});await invalid
  api.prefetchHome();pending[5].fail(Error('offline'));await tick()
  const retry=api.getEvents(params);assert.equal(calls.length,7)
  pending[6].success({result:{}});await retry
}
(async()=>{await verifyPool();await verifyFeed();await verifyPrefetch();console.log('PASS: two-round recall, single-flight public cache, TTL/failure retry, user isolation, immutable records and App/home request reuse')})().catch(error=>{console.error(error);process.exitCode=1})
