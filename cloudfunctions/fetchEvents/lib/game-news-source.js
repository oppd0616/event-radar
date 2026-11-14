// Opt-in public news pilot. Only explicit apply may write candidates and progress metadata.
const VERSION='2026-10-30.2'
const HOST='news.17173.com'
function articleUrl(raw,base) {
  try {const u=new URL(raw,base);if(u.hostname!==HOST||u.username||u.password||u.port||!['http:','https:'].includes(u.protocol)||!/^\/(?:c\/tg\/)?content\/\d{8}\/\d+\.shtml$/.test(u.pathname))return '';u.protocol='https:';u.hash='';u.search='';return u.href}catch{return ''}
}
function publication(url) {const m=url.match(/\/(\d{2})(\d{2})(20\d{2})\//);return m?m[3]+m[1]+m[2]:''}
function listing(html,url,pageItem) {
  // Resolve HTTP links only on this explicitly supported host; other hosts remain rejected.
  const upgraded=String(html).replace(/http:\/\/news\.17173\.com\//g,'https://news.17173.com/')
  const item=pageItem(upgraded,{url,name:'17173游戏资讯'})
  const links=new Map()
  for(const x of item.links){const target=articleUrl(x.url,url);if(!target||/^(?:\[详细\]|0|评论)$/.test(x.title))continue;const old=links.get(target);if(!old||x.title.length>old.title.length)links.set(target,{...x,url:target})}
  return [...links.values()].sort((a,b)=>publication(b.url).localeCompare(publication(a.url))).slice(0,20)
}
function detail(html,url,pageItem) {
  const item=pageItem(html,{url,name:'17173游戏资讯'})
  // Remove game recommendations, community responses and site chrome from evidence.
  const text=item.description.split('\n公开详情链接：')[0]
  const end=text.search(/【来源[：:]|〖来源[：:]|我想了解这个游戏|今日热游|首页精选/)
  item.description=(end>=0?text.slice(0,end):text).slice(0,45000)
  item.title=item.title.replace(/[_－]游戏新闻.*$|_网络游戏新闻.*$|__17173.*$/,'')
  item.links=[{title:item.title,url,dates:[]}]
  item.readable=item.description.length>100
  return item
}
async function collect(urls,deps) {
  const articles=new Map(),reads=[],documents=[],lanes=[]
  for(const url of urls){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!==HOST)throw Error('Unsupported game-news source');const r=await deps.fetch(url);reads.push(url);const fresh=listing(r.text,url,deps.pageItem);const pending=(deps.pendingArticles||[]).filter(x=>x.publisherSourceUrl===url&&articleUrl(x.url,url));const lane=[...new Map([...pending,...fresh].map(x=>[x.url,x])).values()].slice(0,60);lanes.push(lane);for(const x of lane)if(!articles.has(x.url))articles.set(x.url,x)}
  const history=Array.isArray(deps.history)?deps.history:[], now=deps.now||Date.now()
  const eligible=x=>!history.some(h=>h.url===x.url&&h.nextReadAt>now)
  const selected=[],seen=new Set(),cap=Math.min(8,deps.maxDetails||8)
  for(let index=0;index<60&&selected.length<cap;index++)for(const lane of lanes){const x=lane[index];if(x&&eligible(x)&&!seen.has(x.url)&&selected.length<cap){seen.add(x.url);selected.push({...x,publisherSourceUrl:urls[lanes.indexOf(lane)]})}}
  for(const x of selected){const r=await deps.fetch(x.url);reads.push(x.url);const doc=detail(r.text,x.url,deps.pageItem);doc.publisherSourceUrl=x.publisherSourceUrl;if(doc.readable)documents.push(doc)}
  return {documents,reads,listingArticles:articles.size,pendingArticles:lanes.flatMap((lane,i)=>lane.filter(x=>!seen.has(x.url)&&(!history.some(h=>h.url===x.url)|| (deps.pendingArticles||[]).some(h=>h.url===x.url))).map(x=>({url:x.url,title:x.title,publisherSourceUrl:urls[i]}))).slice(0,120),selected:selected.map(x=>x.url)}
}
// Conservative review flags only: similar headlines never authorize an automatic merge.
function duplicateReview(rows) {
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
  const pairs=[]
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const a=rows[i],b=rows[j];if(!a.city||norm(a.city)!==norm(b.city))continue
    const left=norm(a.title),right=norm(b.title)
    if(left===right||Array.from({length:Math.max(0,left.length-9)},(_,k)=>left.slice(k,k+10)).some(x=>right.includes(x)))pairs.push({indices:[i,j],action:'review_same_event',automaticMerge:false})
  }
  return pairs
}
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
function dateProof(row,doc,now) {
  const start=String(row.newsStartDate||''),end=String(row.newsEndDate||''),quote=String(row.newsDateQuote||'')
  const valid=d=>/^20\d\d-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d
  if(!valid(start)||!valid(end)||end<start||!quote||quote.length>1400||!norm(doc.description).includes(norm(quote))||!norm(quote).includes(norm(row.title)))return 'unverified'
  if(/报名|预约|开票|售票|发布时间|发稿时间|投稿/.test(quote)||!/活动|展期|快闪|举办|嘉年华|将于|时间[：:]|演出/.test(quote))return 'unverified'
  const mentions=(d,requireYear)=>{const [y,m,day]=d.split('-').map(Number);return new RegExp((requireYear?y+'[年/.-]':'(?:'+y+'[年/.-])?')+'0?'+m+'[月/.-]0?'+day+'(?![0-9])').test(quote.replace(/\s+/g,''))}
  const titleYear=String(row.title).match(/20\d{2}/g)||[]
  const contextualYear=titleYear.length===1&&titleYear[0]===start.slice(0,4)&&start.slice(0,4)===end.slice(0,4)&&!(quote.match(/20\d{2}/g)||[]).some(y=>y!==titleYear[0])
  if(!(mentions(start,true)||(contextualYear&&mentions(start,false)))||!mentions(end,start.slice(0,4)!==end.slice(0,4)))return 'unverified'
  // Date order and intervening range markers prevent treating two independent dates as a run.
  if(start!==end&&!/至|到|—|–|~|～|日\s*-\s*\d|\d\s*-\s*\d/.test(quote))return 'unverified'
  return Date.parse(end+'T23:59:59.999+08:00')<now?'expired':'supported'
}
async function run(db,now,options,deps) {
  const {getText}=require('./http'),{read}=require('./identity-store')
  const stateId='publisher-pilot-17173-v1',ref=db.collection('eventCandidates').doc(stateId)
  const preview=options.dryRun===true||options.preview!==false
  let state=await read(ref)||{},lease=''
  if(!preview){lease=require('crypto').randomBytes(12).toString('hex');const claimed=await db.runTransaction(async tx=>{const r=tx.collection('eventCandidates').doc(stateId),old=await read(r)||{};if(old.leaseUntil>now||old.nextCheckAt>now)return false;state=old;const {_id,...previous}=old;await r.set({data:{...previous,fingerprint:stateId,kind:'publisher_pilot_state',status:'meta',leaseToken:lease,leaseUntil:now+240000}});return true});if(!claimed)return {ok:true,preview,skipped:true,reason:'pilot_not_due_or_busy'}}
  const result={ok:true,preview,stage:'game_news_pilot',version:VERSION,pageRequests:0,aiCalls:0,queued:0,known:0,expired:0,unverified:0,duplicateReview:[],titles:[]}
  try {
    let documents,rows,collected
    if(state.version===VERSION&&state.parsedAt&&now-state.parsedAt<21600000&&Array.isArray(state.documents)&&Array.isArray(state.identities)){documents=state.documents;rows=state.identities;result.cacheHit=true}
    else {collected=await collect(['快闪','嘉年华'].map(x=>'https://'+HOST+'/tag/'+encodeURIComponent(x)),{pageItem:deps.pageItem,maxDetails:6,history:state.articleHistory,pendingArticles:state.pendingArticles,now,fetch:async url=>{result.pageRequests++;return (deps.fetch||getText)(url,{allowedHosts:[HOST],timeoutMs:10000,maxBytes:1600000})}});documents=collected.documents.map(d=>({...d,description:d.description.slice(0,8000)}));result.selectedArticles=collected.selected;result.listingArticles=collected.listingArticles;result.aiCalls=documents.length?1:0;rows=documents.length?await deps.extract(documents,{publisher:true,gameNews:true,city:''}):[]}
    if(!Array.isArray(rows))throw Error('Invalid identity extraction')
    let records=[]
    if(deps.records)records=await deps.records()
    else if(rows.length)for(const table of ['events','eventCandidates'])for(let offset=0;offset<2000;offset+=100){const r=await db.collection(table).where({domain:'game'}).skip(offset).limit(100).get();records.push(...r.data);if(r.data.length<100)break}
    const accepted=[],retryUrls=new Set()
    for(const row of rows){const doc=documents[Number(row.evidenceIndex)];if(!doc||row.domain!=='game'||!row.city||!norm(doc.description).includes(norm(row.title))||!norm(doc.description).includes(norm(row.city)))continue
      const timing=dateProof(row,doc,now);if(timing==='expired'){result.expired++;continue}if(timing!=='supported'){result.unverified++;retryUrls.add(doc.link);continue}
      const same=records.some(r=>{
        if(['merged','archived','rejected','quarantined'].includes(r.status)||r.city&&norm(r.city)!==norm(row.city))return false
        return norm(r.title)===norm(row.title)||(norm(row.title).length>=8&&norm(r.title).includes(norm(row.title)))
      })
      if(same){result.known++;continue}
      const pairs=duplicateReview([...accepted.map(x=>x.row),row]);if(pairs.length){result.duplicateReview.push({title:row.title,reason:'possible_same_event',automaticMerge:false});retryUrls.add(doc.link);continue}
      accepted.push({row,doc})
    }
    result.titles=accepted.slice(0,2).map(x=>x.row.title);result.deferred=Math.max(0,accepted.length-2)
    for(const {doc} of accepted.slice(2))retryUrls.add(doc.link)
    if(!preview)for(const {row,doc}of accepted.slice(0,2)){const evidence={...doc,publisherSourceUrl:doc.publisherSourceUrl||'https://'+HOST+'/tag/'+encodeURIComponent('快闪')};const saved=await deps.save([{...row,evidenceIndex:0}],[evidence],{domain:'game',topicKey:'',city:row.city,sharedAnnouncement:true},now);result.queued+=saved.discoveredCandidates||0;result.deferred+=saved.admissionDeferred||0;if(saved.admissionDeferred)retryUrls.add(doc.link)}
    const previous=Array.isArray(state.articleHistory)?state.articleHistory:[]
    const history=new Map(previous.filter(h=>h.checkedAt>now-90*86400000).map(h=>[h.url,h]))
    if(collected)for(const url of collected.selected){const readable=documents.some(d=>d.link===url);history.set(url,{url,checkedAt:now,nextReadAt:now+(retryUrls.has(url)||!readable?86400000:30*86400000)})}
    const articleHistory=[...history.values()].sort((a,b)=>b.checkedAt-a.checkedAt).slice(0,400)
    result.progressEntries=articleHistory.length
    const pendingArticles=collected?[...collected.pendingArticles,...documents.filter(d=>retryUrls.has(d.link)).map(d=>({url:d.link,title:d.title,publisherSourceUrl:d.publisherSourceUrl}))].slice(0,120):(state.pendingArticles||[])
    result.pendingArticles=pendingArticles.length
    if(!preview)await db.runTransaction(async tx=>{const r=tx.collection('eventCandidates').doc(stateId),old=await read(r);if(old.leaseToken!==lease)throw Error('Pilot lease lost');await r.update({data:{version:VERSION,articleHistory,pendingArticles,documents,identities:rows,parsedAt:result.cacheHit?state.parsedAt:now,nextCheckAt:now+21600000,leaseUntil:0,leaseToken:'',lastResult:result,updatedAt:now}})})
    return result
  }catch(error){if(!preview)await db.runTransaction(async tx=>{const r=tx.collection('eventCandidates').doc(stateId),old=await read(r);if(old&&old.leaseToken===lease)await r.update({data:{leaseUntil:0,leaseToken:'',nextCheckAt:now+21600000,lastError:String(error.message).slice(0,180)}})});return {...result,ok:false,error:String(error.message).slice(0,180)}}
}
module.exports={VERSION,articleUrl,publication,listing,detail,collect,duplicateReview,dateProof,run}

