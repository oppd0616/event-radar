const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict')
const {database}=require('./verify-event-write-quality')
async function main(){
 const filename=path.resolve(__dirname,'../cloudfunctions/fetchEvents/index.js'),mod={exports:{}},db=database(),requests=[]
 const fakePost=async(url,headers,body)=>{
  const prompt=body.messages[0].content
  const items=JSON.parse(prompt.slice(prompt.lastIndexOf('搜索结果：\n')+'搜索结果：\n'.length))
  requests.push(items)
  return {choices:[{message:{content:JSON.stringify(items.map(x=>({title:x.title,domain:'culture',city:'上海',evidenceIndex:x.evidenceIndex})))}}]}
 }
 vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\npostJson=fakePost;module.exports.test=callDeepSeekDiscovery',{
  module:mod,exports:mod.exports,fakePost,require:n=>n==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),
  process:{env:{DEEPSEEK_API_KEY:'test-only'}},console,Buffer,URL,setTimeout,clearTimeout
 },{filename})
 const items=Array.from({length:20},(_,i)=>({title:`上海艺术展览第${i}场`,description:'上海',link:`https://example.com/${i}`}))
 const rows=await mod.exports.test(items,Date.parse('2026-10-29T12:00:00+08:00'),{publisher:true,city:'上海'})
 assert.equal(requests.length,2);assert.equal(rows.length,20)
 assert.equal(requests[1][0].title,items[10].title)
 assert(rows.every(x=>items[x.evidenceIndex].title===x.title))
 assert.equal(db.state.eventWrites,0)
 assert.equal(Object.keys(db.records.eventCandidates||{}).length,0)
 requests.length=0
 await mod.exports.test(items,Date.now(),{})
 assert.equal(requests.length,1,'ordinary discovery cost must remain unchanged')
 console.log('PASS: production publisher batches all 20, includes explicit indices, remaps correctly, no database writes; ordinary discovery remains one call')
}
main().catch(e=>{console.error(e);process.exitCode=1})
