// Reuse already known, explicitly trusted detail URLs before paying for rediscovery.
const seeds=require('../config/publisher-sources')
const {classifySource}=require('../config/source-policy'),{safeUrl,pageItem}=require('./publisher-sources')
async function read(candidate,deps){
 const selected=[]
 for(const source of candidate.sources||[]){const url=safeUrl(source.detailUrl||source.url);if(!url||selected.includes(url))continue
  const quality=classifySource(url,candidate.domain)
  const seeded=seeds.some(s=>s.domain===candidate.domain&&new URL(s.url).hostname===new URL(url).hostname)
  const reviewedNews=candidate.domain==='game'&&source.channel==='publisher_direct'&&String(source.publisherSourceUrl||'').startsWith('https://news.17173.com/tag/')&&require('./game-news-source').articleUrl(url,url)
  if(quality.authority<68&&!seeded&&!reviewedNews)continue
  selected.push(url);if(selected.length>=2)break
 }
 const items=[]
 for(const url of selected){try{const u=new URL(url),response=await deps.fetch(url,{allowedHosts:[u.hostname],timeoutMs:6500,maxBytes:1000000}),item=u.hostname==='news.17173.com'?require('./game-news-source').detail(response.text,url,pageItem):pageItem(response.text,{name:'已知活动详情',url})
  // The fetched page must prove the identity itself; never reuse the candidate title as proof.
  if(!item.readable||!deps.matches(candidate.title,item.title)||!deps.yearCompatible(candidate,item))continue
  const text=item.description.split('\n公开详情链接：')[0]
  if(text.length<160)continue
  items.push({...item,description:text.slice(0,12000),searchProvider:'publisher_direct',...(()=>{const q=classifySource(url,candidate.domain);return {sourceTier:q.tier,sourceAuthority:q.authority}})()})
 }catch(error){/* Search remains the recovery path for inaccessible or mismatched pages. */}}
 return items
}
module.exports={VERSION:'2026-10-30.2',read}
