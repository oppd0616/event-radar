const TICKETS = [['mall.bilibili.com','哔哩哔哩会员购'],['show.bilibili.com','哔哩哔哩会员购'],['damai.cn','大麦'],['maoyan.com','猫眼'],['showstart.com','秀动']]
const LIVE = [['live.bilibili.com','哔哩哔哩直播'],['douyu.com','斗鱼直播'],['huya.com','虎牙直播']]
function evidenceEntrance(item, evidence) {
  if(!item || !item.url) return null
  let url; try { url=new URL(item.url); if(!['http:','https:'].includes(url.protocol))return null }catch(_){return null}
  const requested=url.href
  const proved=(evidence||[]).some(e=>String(e.link||'')===requested || String(e.description||'').includes(requested))
  if(!proved)return null // Never substitute another page under the original label.
  const ticket=TICKETS.find(([host])=>url.hostname===host || url.hostname.endsWith('.'+host))
  if(ticket)return {...item,url:requested,platform:ticket[1],type:'registration',note:'购票入口'}
  const live=LIVE.find(([host])=>url.hostname===host || url.hostname.endsWith('.'+host))
  if(live && item.type==='livestream')return {...item,url:requested,platform:live[1]}
  const host=url.hostname.replace(/^www\./,'')
  const stem=host.split('.').slice(-2)[0]
  const label=String(item.platform||'').toLowerCase()
  if(label && !label.includes(stem) && /官网|官方|app|小程序|票务|购票|报名|直播/i.test(label)) {
    return {...item,url:requested,type:'website',platform:host,note:'查看来源页面；实际参与方式请按页面说明核实'}
  }
  return {...item,url:requested}
}
module.exports={evidenceEntrance}
