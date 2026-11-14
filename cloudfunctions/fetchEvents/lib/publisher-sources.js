const crypto=require('crypto')
const {getText}=require('./http')
const {read}=require('./discovery-admission')
const {classifySource}=require('../config/source-policy')
const seeds=require('../config/publisher-sources')
const HOUR=3600000,DAY=24*HOUR,LIMIT=30,REGISTRY='publisher-source-registry-v1'
const hash=value=>crypto.createHash('sha256').update(value).digest('hex')
const key=url=>'publisher-source-'+hash(url).slice(0,28)
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
function datesIn(text){return [...String(text||'').matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)].map(m=>`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`).filter(x=>Number.isFinite(Date.parse(x+'T00:00:00+08:00')))}
function safeUrl(value) {
  try {const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!/[a-z]/i.test(u.hostname)||!u.hostname.includes('.')||/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))return '';u.hash='';return u.toString()}catch{return ''}
}
function plain(s) {return String(s||'').replace(/<(script|style|nav)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim()}
function pageItem(html,source) {
  const main=(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)||[])[1]||html
  // Card footers often contain the date/status. Never strip them as site chrome.
  const cleaned=main.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi,' ')
  const sourceUrl=new URL(source.url)
  const links=[]
  for(const m of cleaned.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href=(m[1].match(/href=["']([^"']+)["']/i)||[])[1]
    if(!href)continue
    let url;try{url=safeUrl(new URL(href.replace(/&amp;/g,'&'),source.url).toString())}catch{continue}
    if(!url)continue
    const target=new URL(url)
    if(target.hostname===sourceUrl.hostname&&target.pathname.replace(/\/$/,'')===sourceUrl.pathname.replace(/\/$/,''))continue
    const title=plain((m[2].match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)||[])[1]||m[2])
    if(title)links.push({title:title.slice(0,240),context:plain(m[2]).slice(0,700),dates:datesIn(plain((m[2].match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)||[])[1]||'')),url})
  }
  const title=plain((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||source.name)
  const text=plain(cleaned)
  // Preserve structured public events when the list is rendered client-side.
  const structured=[]
  for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const visit=x=>{if(Array.isArray(x))return x.forEach(visit);if(!x||typeof x!=='object')return;if(/Event$/.test(x['@type']||'')&&x.name)structured.push({name:x.name,startDate:x.startDate,endDate:x.endDate,url:safeUrl(x.url),location:x.location,eventStatus:x.eventStatus});if(x['@graph'])visit(x['@graph'])};visit(JSON.parse(m[1])) }catch{}
  }
  const unique=[...new Map(links.map(x=>[x.url+'|'+x.title,x])).values()]
  const useful=unique.filter(x=>/活动|沙龙|大会|报名|工作坊|黑客松|交流|开放|meetup|event|workshop|hackathon|salon|competition/i.test(x.title+' '+x.url))
  const selected=useful.concat(unique.filter(x=>!useful.includes(x))).slice(0,100)
  const description=text.slice(0,26000)+'\n公开详情链接：\n'+selected.map(x=>x.title+' '+x.url+' '+x.context).join('\n')+(structured.length?'\n结构化活动：'+JSON.stringify(structured.slice(0,30)):'')
  return {title,description:description.slice(0,45000),link:source.url,sourceName:source.name,searchProvider:'publisher_direct',directFetched:true,publisherSource:true,links:selected,readable:text.length>100||structured.length>0}
}
function proposals(items,context) {
  const trusted=url=>{try{return classifySource(url,context.domain).authority>=85||seeds.some(s=>new URL(s.url).hostname===new URL(url).hostname)}catch{return false}}
  return (items||[]).filter(x=>/活动(?:列表|中心|日历|广场)|开发者活动|社区活动|技术沙龙|events?\s*(?:calendar|list)|upcoming\s+events/i.test(x.title||'') &&
    trusted(x.link) && safeUrl(x.link)).slice(0,2)
    .map(x=>({name:String(x.title).slice(0,80),url:safeUrl(x.link),domain:context.domain,topicKey:context.topicKey||'',seed:false}))
}
async function enroll(db,entries,now) {
  return db.runTransaction(async tx=>{
    const ref=tx.collection('eventCandidates').doc(REGISTRY),old=await read(ref)
    const sources=(old?.sources||[]).filter(s=>s.seed||s.expiresAt>now)
    let added=0
    for(const entry of entries) {
      const url=safeUrl(entry.url);if(!url||sources.some(s=>s.url===url)||sources.length>=LIMIT)continue
      if(!entry.seed&&sources.filter(s=>new URL(s.url).hostname===new URL(url).hostname).length>=3)continue
      sources.push({...entry,url,id:key(url),addedAt:now,expiresAt:entry.seed?0:now+14*DAY});added++
    }
    if(added||!old||sources.length!==(old.sources||[]).length)await ref.set({data:{fingerprint:REGISTRY,kind:'publisher_source_registry',status:'meta',sources,updatedAt:now}})
    return {added,sources}
  })
}
async function health(db,now) {
  const registry=await read(db.collection('eventCandidates').doc(REGISTRY))
  const sources=[]
  for(const entry of registry?.sources||[]) {
    const state=await read(db.collection('eventCandidates').doc(entry.id))
    sources.push({...entry,lastCheckedAt:state?.lastCheckedAt||0,nextCheckAt:state?.nextCheckAt||0,lastOutcome:state?.lastOutcome||'not_checked',failures:state?.failures||0,totalQueued:state?.totalQueued||0,lastError:state?.lastError||'',active:!!entry.seed||entry.expiresAt>now})
  }
  return {ok:true,stage:'publisher_source_health',limit:LIMIT,sources}
}
async function run(db,now,options,deps) {
  const preview=options.preview!==false
  const manual=options.pilotSource?require('./structured-activity-source').sources[options.pilotSource]:null
  if(options.pilotSource&&!manual)return {ok:false,error:'unsupported_pilot_source',preview}
  const registry=preview?await read(db.collection('eventCandidates').doc(REGISTRY)):null
  const registered=manual?{sources:[{...manual,id:key(manual.url),manual:true}]}:preview ? {sources:[...new Map([...seeds.map(s=>({...s,id:key(s.url),seed:true})),...(registry?.sources||[]).filter(s=>s.seed||s.expiresAt>now)].map(s=>[s.id,s])).values()]} : await enroll(db,seeds.map(s=>({...s,seed:true})),now)
  const list=[]
  for(const source of registered.sources) {
    if(options.sourceId&&options.sourceId!==source.id)continue
    const state=await read(db.collection('eventCandidates').doc(source.id))||{}
    if(preview||Number(state.nextCheckAt||0)<=now)list.push({source,state})
  }
  list.sort((a,b)=>Number(a.state.lastCheckedAt||0)-Number(b.state.lastCheckedAt||0)||a.source.id.localeCompare(b.source.id))
  const selected=list[0];if(!selected)return {ok:true,stage:'publisher_source_run',skipped:true,reason:'no_due_source',preview}
  const {source}=selected;let {state}=selected
  const token=crypto.randomBytes(12).toString('hex')
  if(!preview) {
    const claimed=await db.runTransaction(async tx=>{
      const doc=tx.collection('eventCandidates').doc(source.id),current=await read(doc)||{}
      if(Number(current.leaseUntil||0)>now||Number(current.nextCheckAt||0)>now)return false
      state=current
      const {_id,...previous}=current
      await doc.set({data:{...previous,fingerprint:source.id,kind:'publisher_source_state',status:'meta',leaseToken:token,leaseUntil:now+4*60000}})
      return true
    })
    if(!claimed)return {ok:true,stage:'publisher_source_run',skipped:true,reason:'source_busy',preview}
  }
  async function finish(patch) {
    if(preview)return
    await db.runTransaction(async tx=>{
      const doc=tx.collection('eventCandidates').doc(source.id),current=await read(doc)
      if(current?.leaseToken!==token)throw Error('Publisher source lease lost')
      await doc.update({data:{...patch,leaseUntil:0,leaseToken:'',lastCheckedAt:now}})
    })
  }
  const result={ok:true,stage:'publisher_source_run',sourceId:source.id,sourceName:source.name,url:source.url,preview,parsed:0,eligible:0,known:0,queued:0,deferred:0,expired:0,extractionCalls:0,titles:[]}
  try {
    const response=await (deps.fetch||getText)(source.url,{allowedHosts:[new URL(source.url).hostname],timeoutMs:10000,maxBytes:1600000})
    const structured=source.manual?require('./structured-activity-source').parse(response.text,source,now):null
    const item=structured?structured.item:pageItem(response.text,source)
    result.pageRequests=1
    if(structured)result.sourceAudit=structured.audit
    if(!item.readable)throw Error('dynamic_or_empty_page: no readable activity content')
    const contentHash=hash(item.description),unchanged=state.contentHash===contentHash
    let rows
    if(structured){rows=structured.rows;result.structured=true}
    else if(unchanged&&Array.isArray(state.identities)&&now-Number(state.parsedAt||0)<DAY){rows=state.identities;result.cacheHit=true}
    else {result.extractionCalls=1;rows=await deps.extract([item],{publisher:true,topicKey:source.topicKey,city:''});if(!Array.isArray(rows))throw Error('invalid identity extraction')}
    result.parsed=rows.length
    const unique=new Set(),accepted=[],valid=[]
    for(const raw of rows.slice(0,structured?60:20)) {
      const row=raw&&{...raw}
      if(!row||!row.title||norm(row.title).length<5||Number(row.evidenceIndex)!==0||!Number.isFinite(Number(row.confidence))||Number(row.confidence)<0.6)continue
      if(row.parentTitle||row.isUmbrella)continue // First phase tracks independent listings only.
      if(row.city&&row.city!=='线上'&&!norm(item.description).includes(norm(row.city)))continue // City needs literal evidence before admission.
      if(!norm(item.description).includes(norm(row.title)))continue // No invented names.
      if(!['tech','auto','finance','ent','culture','game','sports','anime','academic'].includes(row.domain))continue
      const detail=item.links.find(x=>x.url===safeUrl(row.detailUrl)&&norm(x.title).includes(norm(row.title)))
      // Only explicitly dated card footers qualify for deterministic expiry checks.
      const dates=detail?.dates||[]
      const lastDate=dates.length?Date.parse([...dates].sort().slice(-1)[0]+'T23:59:59+08:00'):0
      if(lastDate&&lastDate<now){result.expired++;continue}
      if(detail&&dates.length===1&&item.links.some(x=>x.url!==detail.url&&norm(x.title)===norm(detail.title)&&x.dates.length===1&&x.dates[0]!==dates[0]))row.title=dates[0]+' '+row.title
      const identity=[norm(row.title),row.domain,norm(row.city)].join('|')
      if(unique.has(identity))continue;unique.add(identity)
      const evidence={...item,links:undefined,readable:undefined}
      if(detail){evidence.link=detail.url;evidence.title=row.title;evidence.description=structured?row.title+' '+detail.context:item.description;}
      evidence.publisherSourceUrl=source.url
      valid.push({row,evidence,priority:lastDate||Number.MAX_SAFE_INTEGER})
    }
    valid.sort((a,b)=>a.priority-b.priority)
    for(const {row,evidence} of valid){
      result.eligible++
      if(await deps.known(row,evidence)){result.known++;continue}
      if(accepted.length<3)accepted.push({row:{...row,evidenceIndex:0},evidence})
    }
    result.titles=accepted.map(x=>x.row.title)
    result.backlog=Math.max(0,result.eligible-result.known-accepted.length)
    if(!preview)for(const {row,evidence} of accepted) {
      const saved=await deps.save([row],[evidence],{domain:source.domain,topicKey:source.topicKey,city:row.city||'',sharedAnnouncement:valid.filter(x=>x.evidence.link===evidence.link).length>1},now)
      result.queued+=saved.discoveredCandidates||0
      result.deferred+=saved.admissionDeferred||0
    }
    result.outcome=result.queued?'new_candidates':result.titles.length&&preview?'preview_candidates':result.deferred?'queue_full':unchanged?'unchanged':'no_new_candidates'
    const emptyStreak=result.eligible?0:Number(state.emptyStreak||0)+1
    await finish({contentHash,identities:rows.slice(0,structured?60:20),parsedAt:result.cacheHit?state.parsedAt:now,failures:0,lastError:'',lastOutcome:result.outcome,totalQueued:Number(state.totalQueued||0)+result.queued,emptyStreak,nextCheckAt:now+(emptyStreak>=3?48*HOUR:6*HOUR)})
    if(!preview&&result.eligible&&!source.seed&&!source.manual)await db.runTransaction(async tx=>{const doc=tx.collection('eventCandidates').doc(REGISTRY),r=await read(doc);if(r)await doc.update({data:{sources:r.sources.map(s=>s.id===source.id?{...s,expiresAt:now+90*DAY}:s)}})})
    return result
  } catch(error) {
    const failures=Number(state.failures||0)+1
    await finish({failures,lastError:String(error.message).slice(0,180),lastOutcome:'fetch_or_extract_failed',nextCheckAt:now+Math.min(7*DAY,6*HOUR*2**Math.min(failures-1,5))})
    return {...result,ok:false,error:String(error.message).slice(0,180)}
  }
}
module.exports={VERSION:'2026-10-30.1',seeds,key,safeUrl,pageItem,proposals,enroll,health,run,LIMIT}
