// Read-only source trial; source registration and cloud writes are deliberately absent.
const fs=require('fs'),path=require('path'),vm=require('vm'),{spawnSync}=require('child_process')
const {getText}=require('../../cloudfunctions/fetchEvents/lib/http'),p=require('../../cloudfunctions/fetchEvents/lib/publisher-sources')
const {database}=require('../verify-event-write-quality'),cli=require('../dashboard-cloudbase-cli.cjs').resolveCli()
const out=path.resolve(__dirname,'../../output/game-news-progress-20261030');fs.mkdirSync(out,{recursive:true})
const report={at:new Date().toISOString(),readOnly:true,cloudWrites:0,requests:{pages:0,ai:0},rounds:[],permission:'not established by robots.txt'}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2))
function cloud(args){const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1',...args,'--json'],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true});if(r.status!==0)throw Error('Read-only cloud request failed; private output withheld');const x=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));if(x.success===false||x.error)throw Error('Cloud read failed');return x.data}
async function main(){
 report.requests.pages++;const robots=p.pageItem((await getText('https://news.17173.com/robots.txt',{allowedHosts:['news.17173.com'],timeoutMs:15000,maxBytes:1800000})).text,{url:'https://news.17173.com/robots.txt',name:'robots'});if(/User-agent:\s*\*\s*Disallow:\s*\/(?:\s|$)/i.test(robots.description))throw Error('Robots blocks generic access');
 const env={};for(const v of cloud(['fn','detail','fetchEvents']).Environment.Variables)if(/^DEEPSEEK_/.test(v.Key))env[v.Key]=v.Value
 const filename=path.resolve(__dirname,'../../cloudfunctions/fetchEvents/index.js'),mod={exports:{}},db=database()
 vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.trial={callDeepSeekDiscovery}',{module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>db,getWXContext:()=>({})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),process:{env},console,Buffer,URL,setTimeout,clearTimeout},{filename})

 const adapter=require('../../cloudfunctions/fetchEvents/lib/game-news-source')
 const url='https://news.17173.com/content/10112026/100540354.shtml'
 const file=path.join(out,'announcement.html');let html
 if(fs.existsSync(file))html=fs.readFileSync(file,'utf8');else {report.requests.pages++;html=(await getText(url,{allowedHosts:['news.17173.com'],timeoutMs:15000,maxBytes:1800000})).text;fs.writeFileSync(file,html)}
 const doc=adapter.detail(html,url,p.pageItem)
 fs.writeFileSync(path.join(out,'announcement.json'),JSON.stringify(doc,null,2))
 for(const label of ['historical-1','historical-2']){
  report.requests.ai++
  const rows=await mod.exports.trial.callDeepSeekDiscovery([doc],Date.parse('2026-10-12T12:00:00+08:00'),{publisher:true,gameNews:true,city:''})
  report.rounds.push({label,rows,dates:rows.map(row=>({title:row.title,historical:adapter.dateProof(row,doc,Date.parse('2026-10-12T12:00:00+08:00')),today:adapter.dateProof(row,doc,Date.parse('2026-10-30T12:00:00+08:00'))}))});save()
 }
 report.completed=true;save();console.log(JSON.stringify(report,null,2))
}
main().catch(e=>{report.error=e.message;save();console.error(e.message);process.exitCode=1})
