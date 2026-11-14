const {spawnSync}=require('child_process')
const cli='C:/Users/oppd_/AppData/Local/pnpm/store/v11/links/@cloudbase/cli/3.8.3/b32e5ae3102772f827de31a62a04c1d53c3bb98616c99abfde08ff2f08552580/node_modules/@cloudbase/cli/bin/tcb'
const r=spawnSync(process.execPath,[cli,'-e','cloud1-d3gm0lbv1392513d1','fn','detail','fetchEvents','--json'],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024})
if(r.status!==0)throw Error('Function metadata query failed')
const result=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')))
function visit(x){if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){if(/trigger/i.test(k))console.log(JSON.stringify({[k]:v}));else if(!/env|secret|variable/i.test(k))visit(v)}}
visit(result)
