// Curated semantic links, not event-name exceptions. Copies ship with each function.
const IPS = {
 valorant: {label:'无畏契约', pattern:/无畏契约|瓦[洛罗]兰特|特戰英豪|\bvalorant\b|\bvct\b/i},
 lol: {label:'英雄联盟', pattern:/英雄联盟|league of legends|\blol\b|\blpl\b/i},
 honor_of_kings: {label:'王者荣耀', pattern:/王者荣耀|\bkpl\b/i},
 peace_elite: {label:'和平精英', pattern:/和平精英|\bpel\b/i}
}
const PRACTICE = new Set(['computer_data','programming','ai','ai_competition','developer','open_source'])
function identityKeys(event) {
 const text=[event.title,event.summary,...(event.tags||[])].join(' ')
 return Object.keys(IPS).filter(key=>IPS[key].pattern.test(text))
}
function demandRoutes(domain, keys) {
 const routes=new Map()
 const add=(d,k,f)=>{const id=d+':'+k; if(!routes.has(id)||routes.get(id).factor<f)routes.set(id,{domain:d,topicKey:k,factor:f})}
 for(const key of keys||[]) {
  add(IPS[key]?'game':domain,key,1)
  if(PRACTICE.has(key))add('tech','hackathon',0.5)
 }
 return [...routes.values()]
}
function discoveryQuery(domain,key,now) {
 if(domain!=='game'||!IPS[key])return ''
 const forms=['联名网吧 概念网吧 线下观赛 玩家见面会','联名茶餐厅 主题餐厅 冰室 餐饮联动','联名快闪 主题店 限时体验 玩家活动']
 const slot=Math.floor((now+8*3600000)/86400000)%forms.length
 return IPS[key].label+' '+forms[slot]+' 官方公告 活动日期 城市 地址 预约 公众参与'
}
module.exports={IPS,PRACTICE,identityKeys,demandRoutes,discoveryQuery}
