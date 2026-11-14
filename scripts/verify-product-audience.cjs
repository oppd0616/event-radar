const assert = require('node:assert/strict')
const { assessProductAudience: assess } = require('../cloudfunctions/fetchEvents/lib/product-audience')
const { inspectEventWrite } = require('../cloudfunctions/fetchEvents/lib/event-write-quality')
const fixtures = [
  [{title:'城市运动日',participationGuide:{eligibility:'并非仅限亲子家庭'}},'allow'],
  [{title:'亲子健康欢乐跑',participationGuide:{eligibility:'设个人参赛包与亲子参赛包'}},'review'],
  [{title:'亲子跑',participationGuide:{eligibility:'仅限亲子家庭'}},'exclude'],
  [{title:'城市活动',participationGuide:{eligibility:'仅限退休人员'}},'exclude'],
  [{title:'武汉东湖山径赛',participationGuide:{eligibility:'亲子组为1大1小组合',price:'乐野15km188；亲子8km296'}},'allow'],
  ...['公开路跑','城市徒步','博物馆夜场','艺术展览','黑客松','大学生竞赛','主题餐厅','游戏快闪','音乐节'].map(title=>[{title},'allow']),
  [{title:'青年艺术展',summary:'探讨儿童与老年人的生活'},'allow'],
  [{title:'儿童专场',participationGuide:{eligibility:'成人组和儿童组'}},'review']
]
for(const [event,decision] of fixtures){assert.equal(assess(event).decision,decision,event.title);const issues=inspectEventWrite({...event,startTime:Date.now()});assert.equal(issues.some(x=>x.startsWith('product_audience_')),decision!=='allow')}
console.log(`Passed ${fixtures.length} audience cases and publication-gate checks`)
;(async()=>{
  const {database,base}=require('./verify-event-write-quality')
  const {createEventWriter}=require('../cloudfunctions/fetchEvents/lib/event-write-quality')
  const db=database(),write=createEventWriter(db)
  const blocked=await write('family',{...base,title:'亲子欢乐跑'},null,'insert')
  assert.equal(blocked.written,false)
  assert.equal(Object.keys(db.records.events).length,0)
  assert(Object.values(db.records.eventCandidates).some(x=>x.productAudience.decision==='review'))
  assert.equal((await write('general',{...base,title:'城市徒步'},null,'insert')).written,true)
  assert.equal(db.records.events.general.productAudience.decision,'allow')
  console.log('PASS: rejected publication has no event write, retains review evidence; public event stores assessment')
})().catch(e=>{console.error(e);process.exitCode=1})
