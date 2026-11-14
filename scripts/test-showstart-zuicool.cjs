// Read-only public-source evaluation; no enrollment, deployment or database writes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{getText}=require('../cloudfunctions/fetchEvents/lib/http'),p=require('../cloudfunctions/fetchEvents/lib/publisher-sources')
const out=path.resolve(__dirname,'../output/showstart-zuicool-trial-20261030');fs.mkdirSync(out,{recursive:true})
const report={at:new Date().toISOString(),cloudWrites:0,requests:0,sources:[]}
async function fetch(url){const file=path.join(out,crypto.createHash('sha256').update(url).digest('hex')+'.html');if(fs.existsSync(file))return {text:fs.readFileSync(file,'utf8'),cached:true};report.requests++;const r=await getText(url,{allowedHosts:[new URL(url).hostname],timeoutMs:15000,maxBytes:2400000});fs.writeFileSync(file,r.text);return r}
async function main(){for(const [name,url]of [['秀动','https://www.showstart.com/'],['最酷','https://reg.zuicool.com/']]){const s={name,url,permission:'unconfirmed'};report.sources.push(s);try {try{const robots=await fetch(new URL('/robots.txt',url).href);s.robots=robots.text;if(/User-agent:\s*\*\s*Disallow:\s*\/(?:\s|$)/i.test(robots.text)){s.blocked=true;continue}}catch(e){s.robotsError=e.message;if(!/404/.test(e.message)){s.stopped=true;continue}}
 const r=await fetch(url),item=p.pageItem(r.text,{name,url});s.bytes=Buffer.byteLength(r.text);s.links=item.links;s.readable=item.readable;s.excerpt=item.description.slice(0,1800);fs.writeFileSync(path.join(out,name+'-parsed.json'),JSON.stringify(item,null,2))
 s.samples=[]
 if(name==='最酷'){
  const plain=x=>String(x).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
  s.cards=r.text.split(/<div class="reg-race-block">/).slice(1,21).map(block=>{
   const title=plain((block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)||[])[1]||''),url=(block.match(/href="(https:\/\/reg\.zuicool\.com\/\d+)"/)||[])[1]||''
   const schedule=plain((block.match(/<p style="flex: 1;[\s\S]*?>([\s\S]*?)<\/p>/)||[])[1]||'')
   const dates=[...schedule.matchAll(/(20\d\d)年(\d{1,2})月(\d{1,2})日/g)].map(m=>m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'))
   return {title:title.replace(/报名中|已关闭/g,'').trim(),url,registrationClosed:/已关闭/.test(title),online:/不限地点|线上/.test(schedule+' '+title),dates,schedule,note:plain((block.match(/<p style="font-size: 12px[\s\S]*?>([\s\S]*?)<\/p>/)||[])[1]||'')}
  })
  const labels=['Keep超跑节','江浙之巅','全民健身走'];const all=r.text.split(/<div class="reg-race-block">/).slice(1)
  s.detailSelection=labels.map(label=>{const b=all.find(x=>x.includes(label));return b&&(b.match(/href="(https:\/\/reg\.zuicool\.com\/\d+)"/)||[])[1]}).filter(Boolean)
 }else s.detailSelection=item.links.filter(x=>/\/event\/\d+$/.test(x.url)).slice(0,2).map(x=>x.url)
 for(const [i,target]of s.detailSelection.entries()){try{const d=await fetch(target),parsed=p.pageItem(d.text,{name,url:target});s.samples.push({url:target,title:parsed.title,text:parsed.description.slice(0,16000)});fs.writeFileSync(path.join(out,name+'-detail-'+i+'.json'),JSON.stringify(parsed,null,2))}catch(e){s.detailError=e.message;break}}
 }catch(e){s.error=e.message}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({name:s.name,error:s.error,readable:s.readable,links:s.links?.length,cards:s.cards?.length,samples:s.samples?.map(x=>({title:x.title,url:x.url})),detailError:s.detailError}))}}}
main().catch(e=>{console.error(e.message);process.exitCode=1})
