const assert=require('assert/strict'),dns=require('dns')
const {isPublicAddress:isPublic,isPublicHttpUrl:safe,publicLookup}=require('../cloudfunctions/resolveEventCover/public-network')
for(const ip of ['0.0.0.0','10.0.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1'])assert(!isPublic(ip),ip)
for(const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert(isPublic(ip),ip)
for(const url of ['http://127.1/','http://2130706433/','http://[::1]/','http://user:pass@example.com','https://example.com:8080/'])assert(!safe(url),url)
assert(safe('https://example.com/'))
const original=dns.lookup
async function run(rows,all){dns.lookup=(_h,_o,cb)=>cb(null,rows);return new Promise(resolve=>publicLookup('test.example',{all},(error,address)=>resolve({error,address})))}
;(async()=>{assert((await run([{address:'127.0.0.1',family:4}])).error);assert((await run([{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}])).error);assert.equal((await run([{address:'8.8.8.8',family:4}])).address,'8.8.8.8');assert(Array.isArray((await run([{address:'8.8.8.8',family:4}],true)).address));console.log('PASS: URL, IPv4/IPv6, mixed DNS rejection and checked socket lookup')})().finally(()=>dns.lookup=original).catch(e=>{console.error(e);process.exitCode=1})
