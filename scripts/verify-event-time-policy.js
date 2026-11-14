const assert = require('assert')
const fs = require('fs')
const path = require('path')

const paths = [
  '../cloudfunctions/fetchEvents/lib/event-time-policy.js',
  '../cloudfunctions/getEvents/event-time-policy.js',
  '../cloudfunctions/sendSubscribeMessages/event-time-policy.js',
  '../miniprogram/utils/event-time-policy.js'
].map((file) => path.resolve(__dirname, file))
const copies = paths.map((file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))
copies.forEach((text) => assert.strictEqual(text, copies[0], 'time policy copies must stay identical'))

const { requiresExactEventTime } = require(paths[0])
assert.strictEqual(requiresExactEventTime({ title: '演唱会', city: '上海', timePrecision: 'datetime' }), false)
assert.strictEqual(requiresExactEventTime({ title: '线下讲座', city: '北京', participation: { type: 'registration' } }), false)
assert.strictEqual(requiresExactEventTime({ title: '演唱会', city: '上海', participationOptions: [{ type: 'livestream' }] }), true)
assert.strictEqual(requiresExactEventTime({ title: '线上直播', city: '上海' }), true)
assert.strictEqual(requiresExactEventTime({ title: '线上考试', city: '线上', participation: { type: 'registration' } }), true)
assert.strictEqual(requiresExactEventTime({ title: '创意大赛', city: '线上', participation: { type: 'registration' } }), false)
assert.strictEqual(requiresExactEventTime({ title: '线下展览', city: '上海', participationOptions: {} }), false)
console.log('Event time policy verification passed')
