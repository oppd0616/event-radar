const dns = require('dns')
const net = require('net')
function isPublicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number)
    return !(a===0 || a===10 || a===127 || a>=224 ||
      (a===100 && b>=64 && b<=127) || (a===169 && b===254) ||
      (a===172 && b>=16 && b<=31) || (a===192 && (b===168 || b===0 || (b===2 && c===0))) ||
      (a===198 && (b===18 || b===19 || (b===51 && c===100))) || (a===203 && b===0 && c===113))
  }
  // Conservatively accept global-unicast IPv6 only; reject mapped IPv4,
  // translation/transition addresses and documentation ranges.
  return net.isIP(address)===6 && /^[23]/i.test(address) &&
    !/^2001:(?:0:|db8:|2:|10:|20:)/i.test(address) && !/^2002:/i.test(address)
}
function isPublicHttpUrl(value) {
  try {
    const u=new URL(String(value||'')),host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase()
    return ['https:','http:'].includes(u.protocol) && !u.username && !u.password &&
      (!u.port || u.port===(u.protocol==='https:'?'443':'80')) &&
      host!=='localhost' && !host.endsWith('.localhost') && !host.endsWith('.local') &&
      (!net.isIP(host) || isPublicAddress(host))
  } catch { return false }
}
function publicLookup(host,options,callback) {
  dns.lookup(host,{all:true},(error,rows)=>{
    if(error)return callback(error)
    if(!rows.length || rows.some(x=>!isPublicAddress(x.address)))return callback(new Error('unsafe destination address'))
    // Supply the checked addresses to this socket; do not resolve again.
    if(options && options.all)return callback(null,rows)
    const row=rows.find(x=>!options.family || x.family===options.family)||rows[0]
    callback(null,row.address,row.family)
  })
}
module.exports={isPublicAddress,isPublicHttpUrl,publicLookup}
