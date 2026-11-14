const fs = require('fs')
const path = require('path')
const sharp = require('C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')
const keys = ['tech','auto','finance','ent','culture','game','sports','academic','anime']
const names = ['科技','汽车','财经','演出','文娱','游戏','体育','竞赛成长','次元']
async function main() {
  const sources=keys.map(key=>fs.readFileSync(path.join(__dirname,'../miniprogram/assets/preference-domains',key+'.svg'),'utf8'))
  // Pack transparent raster assets for consistent mini-program image rendering.
  await Promise.all(keys.map((key,i)=>sharp(Buffer.from(sources[i])).resize(96,96).png().toFile(path.join(__dirname,'../miniprogram/assets/preference-domains',key+'.png'))))
  const placed=(i,x,y,size)=>sources[i].replace('width="24" height="24"',`x="${x}" y="${y}" width="${size}" height="${size}"`)
  const cells=keys.map((key,i)=>{
    const x=72+i%3*210,y=125+Math.floor(i/3)*140
    return placed(i,x+47,y,42)+`<text x="${x+68}" y="${y+72}" text-anchor="middle" font-size="17" fill="#454c5c">${names[i]}</text>`
  })
  const chips=keys.map((key,i)=>{
    const x=48+i%3*212,y=625+Math.floor(i/3)*52,selected=i%2===0
    return `<rect x="${x}" y="${y}" width="190" height="38" rx="8" fill="${selected?'#eceef5':'#fff'}" stroke="${selected?'#eceef5':'#e7e8e3'}"/><g opacity="${selected?1:.65}">${placed(i,x+18,y+9,20)}</g><text x="${x+48}" y="${y+24}" font-size="13" fill="${selected?'#4d5876':'#6e7168'}">${names[i]}</text>`
  })
  const preview=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="820" font-family="Microsoft YaHei"><rect width="720" height="820" fill="#fafaf8"/><text x="48" y="57" font-size="25" font-weight="600" fill="#252b35">各有所爱。</text><text x="48" y="84" font-size="12" fill="#7b8190">偏好页领域图标 · 轻双色版</text>${cells.join('')}<path d="M48 555h624" stroke="#e5e7ec"/><text x="48" y="592" font-size="15" fill="#454c5c">放回偏好页</text><text x="672" y="592" text-anchor="end" font-size="11" fill="#7b8190">选中 / 未选中示意</text>${chips.join('')}</svg>`
  await sharp(Buffer.from(preview)).png().toFile(path.join(__dirname,'../docs/design-assets/domain-icons/偏好页图标-轻双色版.png'))
}
main().catch(error=>{console.error(error);process.exitCode=1})
