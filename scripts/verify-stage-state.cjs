const assert = require('assert/strict'), fs = require('fs'), path = require('path')
const source = fs.readFileSync(path.resolve(__dirname,'../shared/stage-state.js'),'utf8')
for (const file of ['../cloudfunctions/getEvents/stage-state.js','../cloudfunctions/fetchEvents/lib/stage-state.js','../miniprogram/utils/stage-state.js']) {
 assert.equal(fs.readFileSync(path.resolve(__dirname,file),'utf8'),source)
}
const {stateOf} = require('../shared/stage-state')
const at = s => Date.parse(s+'+08:00')
const stage = {key:'group',startTime:at('2026-09-24T17:00:00'),timePrecision:'datetime',endTime:0}
assert.equal(stateOf(stage,at('2026-10-01T12:00:00')),'started')
assert.equal(stateOf(stage,at('2026-09-24T16:00:00')),'upcoming')
stage.endTime = at('2026-10-04T00:00:00'); stage.endTimePrecision = 'date'
assert.equal(stateOf(stage,at('2026-10-01T12:00:00')),'active')
assert.equal(stateOf(stage,at('2026-10-04T23:59:59')),'active')
assert.equal(stateOf(stage,at('2026-10-05T00:00:00')),'done')
assert.equal(stateOf({...stage,endTimePrecision:'datetime'},at('2026-10-04T00:00:01')),'done')
assert.equal(stateOf({...stage,endTime:0},at('2026-10-19T00:00:00'),{eventEndTime:at('2026-10-18T00:00:00'),eventEndPrecision:'date'}),'done')
assert.equal(stateOf({...stage,timePrecision:'month_range'},at('2026-10-01T12:00:00')),'pending')
assert.equal(stateOf({key:'on_sale',startTime:at('2026-09-16T11:00:00'),timePrecision:'datetime'},at('2026-10-01T12:00:00')),'done')
assert.equal(stateOf({...stage,endTime:0},at('2026-09-24T12:00:00'),{exactClock:false}),'active')
assert.equal(stateOf({...stage,endTime:at('2026-09-23T00:00:00')},at('2026-10-01T12:00:00')),'started')
console.log('Stage state verification passed: shared policy, unknown ends, mixed precision, China date boundaries and point nodes')
