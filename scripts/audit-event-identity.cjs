const fs=require('fs'),path=require('path'),vm=require('vm')
const dir=path.resolve(process.argv[2])
function decode(v){if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object'){for(const k of ['$numberLong','$numberInt','$numberDouble'])if(k in v)return Number(v[k]);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]))}return v}
const records=decode(JSON.parse(fs.readFileSync(path.join(dir,'backup.json'),'utf8'))).records
const filename=path.resolve(__dirname,'../cloudfunctions/fetchEvents/index.js'),mod={exports:{}}
vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.test={sameDiscoveredEvent,mergeDiscoveredEvent,seriesIdentityTitle}',{
 module:mod,exports:mod.exports,require:n=>n==='wx-server-sdk'?{init(){},database:()=>({command:{}})}:n.startsWith('.')?require(path.resolve(path.dirname(filename),n)):require(n),process,console,Buffer,URL,setTimeout,clearTimeout
},{filename})
const {sameDiscoveredEvent,seriesIdentityTitle}=mod.exports.test
const pairs=[]
for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
 const a=records[i],b=records[j],same=sameDiscoveredEvent(a,b),ka=seriesIdentityTitle(a),kb=seriesIdentityTitle(b)
 const similar=ka.length>=8&&kb.length>=8&&(ka.includes(kb)||kb.includes(ka))
 if(same||similar)pairs.push({same,ids:[a._id,b._id],titles:[a.title,b.title],domains:[a.domain,b.domain],cities:[a.city,b.city],dates:[a.startTime,b.startTime].map(t=>new Date(t).toISOString()),stageCounts:[(a.stages||[]).length,(b.stages||[]).length]})
}
fs.writeFileSync(path.join(dir,'identity-pairs.json'),JSON.stringify({total:records.length,pairs},null,2))
console.log(JSON.stringify({total:records.length,pairs},null,2))
