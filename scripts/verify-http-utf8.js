const assert = require('assert')
const fs = require('fs'), vm = require('vm'), path = require('path')
const {EventEmitter} = require('events')
const value = {choices:[{message:{content:'全国大学英语四、六级考试：报名与截止时间'}}]}
const wire = Buffer.from(JSON.stringify(value))
const moduleMock = {exports:{}}
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cloudfunctions/fetchEvents/lib/http.js'),'utf8'), {
  module:moduleMock, Buffer, URL, setTimeout, clearTimeout,
  require(name) {
    if(name !== 'https') return require(name)
    return {request(options, callback) {
      const request = new EventEmitter()
      request.setTimeout = () => {}
      request.write = () => {}
      request.destroy = () => {}
      request.end = () => process.nextTick(() => {
        const response = new EventEmitter()
        response.statusCode = 200
        callback(response)
        // Worst-case split: each UTF-8 byte arrives separately.
        for(let i=0;i<wire.length;i++) response.emit('data',wire.subarray(i,i+1))
        response.emit('end')
      })
      return request
    }}
  }
})
moduleMock.exports.postJson('https://example.com',{},{}).then(result=>{
  assert.strictEqual(JSON.stringify(result),JSON.stringify(value))
  console.log('HTTP UTF-8 split-chunk regression passed')
}).catch(error=>{console.error(error);process.exitCode=1})
