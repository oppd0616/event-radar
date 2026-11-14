const fs=require('node:fs'),{getText}=require('../cloudfunctions/fetchEvents/lib/http')
const {pageItem}=require('../cloudfunctions/fetchEvents/lib/publisher-sources')
const source={url:'https://developer.cloud.tencent.com.cn/salon/salon-2534',name:'腾讯云技术沙龙'}
getText(source.url,{allowedHosts:['developer.cloud.tencent.com.cn'],timeoutMs:10000,maxBytes:1600000}).then(r=>{
  fs.writeFileSync('output/publisher-source-test/guangzhou-detail.html',r.text)
  const item=pageItem(r.text,source)
  fs.writeFileSync('output/publisher-source-test/guangzhou-detail.txt',item.description)
  console.log(item.description.slice(0,2200))
}).catch(e=>{console.error(e.message);process.exitCode=1})
