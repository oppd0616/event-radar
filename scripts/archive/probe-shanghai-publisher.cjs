const fs=require('fs'),path=require('path'),{getText}=require('../../cloudfunctions/fetchEvents/lib/http'),{pageItem}=require('../../cloudfunctions/fetchEvents/lib/publisher-sources')
const out=path.resolve(__dirname,'../../output/shanghai-youth-pilot-20261028')
async function main(){
 fs.mkdirSync(out,{recursive:true});const result={at:new Date().toISOString(),requests:0,cacheHits:0,pages:[],permission:'unconfirmed; research only'}
 async function read(url,name){const file=path.join(out,name+'.json');if(fs.existsSync(file)){result.cacheHits++;return JSON.parse(fs.readFileSync(file))}result.requests++;let r;try{const got=await getText(url,{allowedHosts:['xintiandi.com'],timeoutMs:12000,maxBytes:1600000});r={url,item:pageItem(got.text,{name:'新天地',url})};if(name==='robots')r={url,text:got.text}}catch(e){r={url,error:e.message}}fs.writeFileSync(file,JSON.stringify(r,null,2));return r}
 const robots=await read('https://www.xintiandi.com/robots.txt','robots');result.pages.push(robots)
 // Stop rather than guess whether access is allowed when robots cannot be evaluated.
 if(robots.error||/Disallow:\s*\/(?:\s|$)/i.test(robots.text||'')){result.stopped='robots unavailable or restrictive; use search-index research only'}else{
  // This bounded probe stops for any disallow directives requiring path-specific review.
  if((robots.text.match(/Disallow:\s*\S+/gi)||[]).some(x=>!/^Disallow:\s*\/wp-admin\/$/i.test(x)))result.stopped='robots rules require manual review'
  else{const list=await read('https://www.xintiandi.com/en/events/','xintiandi-list');result.pages.push(list);if(list.item){for(const [i,link] of list.item.links.filter(x=>/\/event\//.test(x.url)).slice(0,3).entries()){const detail=await read(link.url,'xintiandi-detail-'+i);result.pages.push(detail);if(detail.error){result.stopped='detail unavailable; stop source';break}}}}
 }
 fs.writeFileSync(path.join(out,'publisher-probe.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({requests:result.requests,cacheHits:result.cacheHits,stopped:result.stopped,pages:result.pages.map(x=>({url:x.url,error:x.error,text:x.text?.slice(0,1500),title:x.item?.title,description:x.item?.description.slice(0,1800)}))}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
