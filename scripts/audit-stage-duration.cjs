const fs = require('fs'), path = require('path'), {spawnSync} = require('child_process')
const cli = 'C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
function decode(x) {
 if (Array.isArray(x)) return x.map(decode)
 if (x && typeof x === 'object') {
  for (const k of ['$numberLong','$numberInt','$numberDouble']) if (k in x) return Number(x[k])
  return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))
 }
 return x
}
const query = {find:'events',filter:{_id:'81028f68eac9ca2fa373f1d11d3d497c'},limit:1}
const run = spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify([{TableName:'events',CommandType:'QUERY',Command:JSON.stringify(query)}]),'--json'],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024})
if (run.status !== 0) throw Error((run.stderr || run.stdout || String(run.error)).slice(0,600))
const envelope=JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
const records=decode(envelope.data.results[0])
const dir=path.resolve(__dirname,'../docs/stage-duration-20261007')
fs.mkdirSync(dir,{recursive:true})
fs.writeFileSync(path.join(dir,'snapshot.json'),JSON.stringify(records,null,2))
const e=records[0]
console.log(JSON.stringify({dir,id:e._id,updatedAt:e.updatedAt,stages:e.stages,evidenceFields:Object.keys(e).filter(k=>/evidence|source/i.test(k))},null,2))
