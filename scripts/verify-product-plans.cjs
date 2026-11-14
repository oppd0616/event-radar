const assert=require('assert/strict'),{plan,comparePlans}=require('../cloudfunctions/manageFollows/model')
const fs=require('fs'),path=require('path')
const now=Date.parse('2026-09-30T14:00:00+08:00'),DAY=86400000
const event={status:'published',startTime:now+2*DAY,timePrecision:'datetime'}
assert.equal(plan(event,now).key,'soon')
assert.equal(plan({...event,startTime:now+20*DAY},now).key,'upcoming')
assert.equal(plan({...event,startTime:now-DAY,endTime:now+DAY},now).key,'ongoing')
assert.equal(plan({...event,startTime:now-2*DAY,endTime:now-DAY},now).key,'ended')
assert.equal(plan({...event,timePrecision:'month_range',startTime:now-DAY},now).label,'日期待公布')
assert.equal(plan({...event,participationGuide:{accessEndTime:now+DAY}},now).key,'deadline')
assert.equal(plan({...event,participationGuide:{accessEndTime:Date.parse('2026-09-30T00:00:00+08:00')}},now).key,'deadline','date-only deadline lasts through the day')
assert.equal(plan(null,now).key,'unknown')
const sorted=['upcoming','soon','ongoing','deadline'].map(key=>({plan:{key,at:1},record:{followedAt:1}})).sort(comparePlans)
assert.deepEqual(sorted.map(row=>row.plan.key),['deadline','ongoing','soon','upcoming'])
for(const file of ['miniprogram/pages/home/home.js','miniprogram/pages/home/home.wxml','cloudfunctions/getEvents/index.js']) {
  const source=fs.readFileSync(path.resolve(__dirname,'../'+file),'utf8')
  assert(!/feedMode|explorationFeed|拓展兴趣/.test(source),'removed exploration entry and filter: '+file)
}
console.log('PASS: plan timing/order, date-only deadlines, exploration removed without changing normal recommendations')
