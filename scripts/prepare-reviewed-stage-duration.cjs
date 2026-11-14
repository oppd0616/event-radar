const fs=require('fs'), path=require('path'), assert=require('assert/strict')
const dir=path.resolve(__dirname,'../docs/stage-duration-20261007')
const event=JSON.parse(fs.readFileSync(path.join(dir,'snapshot.json')))[0]
assert.equal(event._id,'81028f68eac9ca2fa373f1d11d3d497c')
const official='https://valorantesports.com/en-US/news/champions-shanghai-everything-you-need-to-know'
const stages=structuredClone(event.stages)
const group=stages.find(s=>s.key==='group')
assert(group && Number(group.endTime)===0,'Already repaired or requires renewed review')
// The official 2026 overview explicitly pairs Groups Stage with Sept 24 to Oct 4.
group.endTime=Date.parse('2026-10-04T00:00:00+08:00')
group.endTimePrecision='date'
group.endTimeEvidence={sourceUrl:official,sourceTier:'official',quote:'Groups Stage (Sept 24 to Oct 4)',year:2026,publishedAt:'2026-09-11',verified:true,checkedAt:Date.now()}
const plans=[{id:event._id,expectedUpdatedAt:event.updatedAt,set:{stages},evidence:{url:official,quote:'Groups Stage (Sept 24 to Oct 4)',year:2026}}]
fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(plans,null,2))
console.log(JSON.stringify({dir,phase:group.key,startTime:group.startTime,endTime:group.endTime,evidence:group.endTimeEvidence}))
