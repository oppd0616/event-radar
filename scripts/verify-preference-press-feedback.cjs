const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../miniprogram/pages/subscribe')
const template = fs.readFileSync(path.join(root, 'subscribe.wxml'), 'utf8')
const style = fs.readFileSync(path.join(root, 'subscribe.wxss'), 'utf8')
const rows = template.match(/<(?:view|button)\b[^>]*hover-class="row-pressed"[^>]*>/g) || []
assert.equal(rows.length, 9)
for (const row of rows) {
  assert(row.includes('hover-start-time="20"'))
  assert(row.includes('hover-stay-time="60"'), 'release feedback must not linger after expanding settings')
}
assert(style.includes('button.action-row.row-pressed'), 'button background reset must not hide feedback')
assert(/\.setting-row \{[^}]*margin:0;[^}]*padding:0 24rpx;/.test(style), 'highlight should cover the full row, not an inset strip')
assert(!style.includes('.editor-chip:active'))
assert(template.includes('hover-class="editor-chip-pressed"'))
assert(style.includes('prefers-reduced-motion'))
console.log('PASS: consistent full-row press feedback, short release delay, native chip hover and reduced motion')
