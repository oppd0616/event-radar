const fs = require('fs')
const path = require('path')
const source = path.resolve(__dirname, '../shared/stage-state.js')
for (const file of ['../cloudfunctions/getEvents/stage-state.js', '../cloudfunctions/fetchEvents/lib/stage-state.js', '../miniprogram/utils/stage-state.js']) {
  fs.copyFileSync(source, path.resolve(__dirname, file))
}
