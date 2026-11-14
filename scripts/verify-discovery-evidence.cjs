const assert = require('node:assert/strict')
const {validate, discover, timing} = require('../cloudfunctions/fetchEvents/lib/discovery-evidence')
async function main() {
  const items = Array.from({length:20}, (_, i) => ({title:`活动测试第${i}场`, description:'上海 2026-11-01', link:`https://example.com/${i}`}))
  const row = (i, extra={}) => ({title:items[i].title, city:'上海', domain:'culture', evidenceIndex:i, ...extra})
  assert.equal(validate([row(5,{evidenceIndex:6,detailUrl:items[5].link})],items,{city:'上海'}).accepted[0].evidenceIndex,5)
  assert.equal(validate([row(0,{title:'完全虚构的艺术展'})],items,{}).accepted.length,0)
  assert.equal(validate([row(0,{city:'北京'})],items,{city:'上海'}).accepted.length,0)
  assert.equal(validate([row(0,{city:''})],items,{city:'上海'}).accepted.length,0)
  assert.equal(validate([row(0,{detailUrl:'https://invented.test/event'})],items,{}).accepted[0].detailUrl,undefined)
  assert.equal(validate([row(0),row(0)],items,{}).accepted.length,1)
  let calls=0, audit
  const all=await discover(items,{city:'上海',onDiscoveryAudit:x=>audit=x},async batch=>{calls++;return batch.map((x,i)=>({title:x.title,city:'上海',evidenceIndex:i}))})
  assert.equal(calls,2); assert.equal(audit.documents,20); assert.equal(all.length,20)
  assert.equal(all[1].evidenceIndex,10,'second query must be represented before the result cap')
  assert(all.every(x=>items[x.evidenceIndex].title===x.title),'global indices must survive batching')
  const multi=[{title:'角色快闪',description:'上海 10/31—11/29 苏河湾；北京 11/1—11/5',link:'https://example.com/a'}]
  assert.equal(validate([{title:'角色快闪',city:'北京',evidenceIndex:0}],multi,{city:'上海'}).accepted.length,0)
  assert.equal(validate([{title:'角色快闪',city:'上海',evidenceIndex:0}],multi,{city:'上海'}).accepted.length,1)
  const stages=[{title:'魔法市集',description:'魔法周 魔法市集 独立魔法展 上海',link:'https://example.com/b'}]
  assert.equal(validate([{title:'魔法市集',city:'上海',evidenceIndex:0,parentTitle:'魔法周'},{title:'独立魔法展',city:'上海',evidenceIndex:0,parentTitle:'魔法周'}],stages,{}).accepted.length,2)
  const traditional=[{title:'膨脹麵包節',description:'上海 2026年10月30日至11月1日',link:'https://example.com/t'}]
  assert.equal(validate([{title:'膨胀面包节',city:'上海',evidenceIndex:0}],traditional,{}).accepted.length,1)
  const now=Date.parse('2026-10-29T18:00:00+08:00'),quote='艺术展2026年10月1日至10月20日'
  assert.equal(timing({title:'艺术展',discoveryEndDate:'2026-10-20',discoveryEndQuote:quote},quote,now),'expired')
  assert.equal(timing({title:'艺术展',discoveryEndDate:'2026-10-01',discoveryEndQuote:quote},quote,now),'unverified','start is not end')
  assert.equal(timing({title:'艺术展',discoveryEndDate:'2026-10-20',discoveryEndQuote:'艺术展报名2026年10月1日至10月20日'},'艺术展报名2026年10月1日至10月20日',now),'unverified')
  const spaced='艺术展2026年10 月 1 日 至 10 月 20 日'
  assert.equal(timing({title:'艺术展',discoveryEndDate:'2026-10-20',discoveryEndQuote:spaced},spaced,now),'expired')
  console.log('PASS: evidence repair, invented title/URL, city isolation, dedupe, all 20 documents, fair batching, global indices and distinct child identities')
}
main().catch(e=>{console.error(e);process.exitCode=1})
