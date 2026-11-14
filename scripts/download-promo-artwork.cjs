const fs=require('fs'),path=require('path');
const out=path.resolve(__dirname,'../output/promo/20261013/assets');
const items=[
 ['whale-key.jpg','https://www.museumofartpd.org.cn/Upload/Image/6e53741c695140cd9d5d8d9647f7f1d1.jpg','https://www.museumofartpd.org.cn/exhibitiondetail?id=212'],
 ['whale-1.jpg','https://www.museumofartpd.org.cn/Upload/Image/bef5a561ad624d4f8cbef5db20f1a31b.jpg','https://www.museumofartpd.org.cn/exhibitiondetail?id=212'],
 ['whale-2.jpg','https://www.museumofartpd.org.cn/Upload/Image/4f2ec2e707bf45feb4cb613a711a0fc4.jpg','https://www.museumofartpd.org.cn/exhibitiondetail?id=212'],
 ['cafe-official.jpg','https://wx2.sinaimg.cn/large/0088Ue8Qgy1ihxi0ct8xaj32yo1o0kjl.jpg','https://www.sina.cn/news/detail/5352561776788522.html'],
 ['cafe-article.png','https://i.17173cdn.com/2fhnvk/YWxqaGBf/cms3/sNXmCObueuoBetD.png','https://news.17173.com/content/10112026/110701692.shtml'],
 ['cafe-article.jpg','https://i.17173cdn.com/2fhnvk/YWxqaGBf/cms3/MxMtPpbueuoBetr.jpg','https://news.17173.com/content/10112026/110701692.shtml'],
 ['tennis.jpg','https://www.rolexshanghaimasters.com/assets/image/rolex/rolex_webimg_mobile.jpg','https://www.rolexshanghaimasters.com/'],
 ['math.png','https://www.nmmcm.org.cn/static/upload/image/20260819/1787126178283320.png','https://www.nmmcm.org.cn/']
];
(async()=>{const results=await Promise.all(items.map(async([file,url,source])=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Mozilla/5.0',Referer:source}});if(!r.ok)throw Error('HTTP '+r.status);const type=r.headers.get('content-type');if(!type?.startsWith('image/'))throw Error(type);const data=Buffer.from(await r.arrayBuffer());fs.writeFileSync(path.join(out,file),data);return {file,url,source,type,bytes:data.length,rights:'Publicly accessible promotional material; redistribution permission not verified.'}}catch(e){return {file,url,source,error:e.message}}}));fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))})()
