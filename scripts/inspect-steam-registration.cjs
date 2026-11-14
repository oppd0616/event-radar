const http=require('../cloudfunctions/fetchEvents/lib/http');
http.getText('https://act.steamchina.com/2026MPGF',{timeoutMs:15000,maxBytes:1500000}).then(r=>{
 const t=typeof r==='string'?r:r.text||r.body||r.html||'';
 console.log(JSON.stringify({keys:Object.keys(r),scripts:[...t.matchAll(/<script[^>]*src=["']([^"']+)/g)].map(m=>m[1]),forms:t.match(/.{0,60}(游戏名称|开发商|公司名称|app.?id|参展|开发者).{0,100}/gi)},null,2));
}).catch(e=>{console.error(e.message);process.exitCode=1});
