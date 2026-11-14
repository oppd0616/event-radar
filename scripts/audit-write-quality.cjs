// Replay the final write gate against a saved CloudBase export; no network/writes to DB.
const fs=require('fs'),path=require('path')
const {inspectEventWrite}=require('../cloudfunctions/fetchEvents/lib/event-write-quality')
const dir=path.resolve(process.argv[2])
function decode(value) {
  if(Array.isArray(value)) return value.map(decode)
  if(value && typeof value==='object') {
    for(const key of ['$numberLong','$numberInt','$numberDouble']) if(key in value) return Number(value[key])
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]))
  }
  return value
}
const backup=decode(JSON.parse(fs.readFileSync(path.join(dir,'backup.json'),'utf8')))
const rows=backup.records.map(event=>({id:event._id,title:event.title,issues:inspectEventWrite(event)}))
const counts={}
rows.forEach(row=>row.issues.forEach(issue=>{const kind=issue.split(':')[0];counts[kind]=(counts[kind]||0)+1}))
const report={snapshotAt:backup.at,readOnly:true,qualityVersion:1,total:rows.length,passed:rows.filter(row=>!row.issues.length).length,blocked:rows.filter(row=>row.issues.length).length,counts,rows}
const file=path.join(dir,'write-quality.json')
fs.writeFileSync(file,JSON.stringify(report,null,2))
console.log(JSON.stringify({...report,rows:undefined,file},null,2))
