// Read-only source trial; source registration and cloud writes are deliberately absent.
const fs=require('fs'),path=require('path'),vm=require('vm'),{spawnSync}=require('child_process')
const {getText}=require('../../cloudfunctions/fetchEvents/lib/http'),p=require('../../cloudfunctions/fetchEvents/lib/publisher-sources')
const {database}=require('../verify-event-write-quality'),cli=require('../dashboard-cloudbase-cli.cjs').resolveCli()
const adapterMode=process.argv.includes('--adapter')
const out=path.resolve(__dirname,'../../output/17173-source-trial-20261030-'+(adapterMode?'adapter':'v3'));fs.mkdirSync(out,{recursive:true})
const report={at:new Date().toISOString(),readOnly:true,cloudWrites:0,requests:{pages:0,ai:0},rounds:[],permission:'not established by robots.txt'}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2))
async function page(url,name){const file=path.join(out,name+'.json');if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file));report.requests.pages++;const r=await getText(url,{allowedHosts:['news.17173.com'],timeoutMs:15000,maxBytes:1800000});const item=p.pageItem(r.text.replace(/http:\/\/news\.17173\.com\//g,'https://news.17173.com/'),{name:'17173',url});fs.writeFileSync(file,JSON.stringify(item,null,2));return item}
function cloud(args){const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true});if(r.status!==0)throw Error('Read-only cloud request failed; private output withheld');const x=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));if(x.success===false||x.error)throw Error('Cloud read failed');return x.data}
async function main(){
 const robots=await page('https://news.17173.com/robots.txt','robots');if(/User-agent:\s*\*\s*Disallow:\s*\/(?:\s|$)/i.test(robots.description))throw Error('Robots blocks generic access');
 const env={};for(const v of cloud(['fn','detail','fetchEvents']).Environment.Variables)if(/^DEEPSEEK_/.test(v.Key))env[v.Key]=v.Value
 const filename=path.resolve(__dirname,'../../cloudfunctions/fetchEvents/index.js'),mod={exports:{}},db=database()
 vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.trial={callDeepSeekDiscovery}',{module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),process:{env},console,Buffer,URL,setTimeout,clearTimeout},{filename})
 let docs=[]
 if(adapterMode){
  const adapter=require('../../cloudfunctions/fetchEvents/lib/game-news-source'),crypto=require('crypto')
  const fetch=async url=>{const file=path.join(out,crypto.createHash('sha256').update(url).digest('hex')+'.html');if(fs.existsSync(file))return {text:fs.readFileSync(file,'utf8')};report.requests.pages++;const r=await getText(url,{allowedHosts:['news.17173.com'],timeoutMs:15000,maxBytes:1800000});fs.writeFileSync(file,r.text);return r}
  const collected=await adapter.collect(['快闪','嘉年华'].map(x=>'https://news.17173.com/tag/'+encodeURIComponent(x)),{fetch,pageItem:p.pageItem,maxDetails:8});docs=collected.documents;report.collection=collected;save()
 }else{
 const popup=await page('https://news.17173.com/tag/'+encodeURIComponent('快闪'),'popup')
 const articleLinks=[...new Map(popup.links.filter(x=>/\/content\/.*\.shtml/.test(x.url)&&x.title!=='[详细]'&&x.title!=='0').map(x=>[x.url,x])).values()].sort((a,b)=>{const date=x=>{const m=x.url.match(/\/(\d{2})(\d{2})(20\d{2})\//);return m?m[3]+m[1]+m[2]:''};return date(b).localeCompare(date(a))}).slice(0,20)
 report.listing={url:popup.link,articleCount:articleLinks.length,titles:articleLinks.map(x=>x.title)};save()
 for(const [i,l]of articleLinks.entries()){if(i>=6)break;docs.push(await page(l.url,'detail-'+i))}
 }
 async function round(label,items){const file=path.join(out,label+'.json');let rows;if(fs.existsSync(file))rows=JSON.parse(fs.readFileSync(file));else {report.requests.ai++;rows=await mod.exports.trial.callDeepSeekDiscovery(items,Date.now(),{publisher:true});fs.writeFileSync(file,JSON.stringify(rows,null,2))}report.rounds.push({label,documents:items.length,rows});save();console.log(JSON.stringify({label,documents:items.length,rows}))}
 await round('round-1',docs)
 await round('round-2-cached-repeat',docs)
 if(!adapterMode){const extra=await page('https://news.17173.com/tag/'+encodeURIComponent('嘉年华'),'carnival');await round('round-3-other-type',[extra])}
 const rows=report.rounds.flatMap(r=>r.rows||[]);if(rows.length){const pattern='共创之夜|荣耀之路|瓦记冰室|SPOOKY|嘉年华|'+rows.map(r=>String(r.title).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');report.matches={};for(const table of ['events','eventCandidates']){report.matches[table]=cloud(['db','nosql','execute','--command',JSON.stringify([{TableName:table,CommandType:'QUERY',Command:JSON.stringify({find:table,filter:{title:{$regex:pattern}},projection:{_id:1,title:1,status:1,city:1},limit:200})}])]).results[0]}}
 report.completed=true;save();console.log(JSON.stringify({completed:true,requests:report.requests,matches:report.matches}))
}
main().catch(e=>{report.error=e.message;save();console.error(e.message);process.exitCode=1})


