const {spawnSync}=require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const query={find:'eventCandidates',filter:{_id:{$in:['wsa-quality-eval-20260927-v35','api-usage-wsa-2026-09']}},limit:2}
const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','db','nosql','execute','--command',JSON.stringify([{TableName:'eventCandidates',CommandType:'QUERY',Command:JSON.stringify(query)}]),'--json'],{encoding:'utf8',timeout:120000,maxBuffer:1048576})
if(r.status!==0)throw Error((r.stderr||r.stdout).slice(0,400))
const data=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')))
console.log(JSON.stringify(data.data.results[0]))
