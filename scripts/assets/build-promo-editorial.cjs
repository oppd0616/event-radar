// Native HTML/CSS composition: original screenshots and downloaded artwork remain unchanged.
const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(__dirname,'../../output/promo/20261013'),assets=path.join(out,'assets');
const uploads={game:'620d8a56-bc77-4046-8deb-f654896a58b2',guide:'8ddf2189-3f5a-4099-b10e-7a0f510cdd4a',math:'ae57de41-75ff-46e9-8409-0d0420bfd76b',art:'7c538641-30ea-4ce5-8d79-b6f43db23c28',sport:'3c80f4e5-baee-4652-be48-6acfe849c572'};
for(const [key,id] of Object.entries(uploads))fs.copyFileSync('C:/Users/oppd_/AppData/Local/Temp/codex-clipboard-'+id+'.png',path.join(assets,key+'-screen.png'));
const data=f=>`data:image/${f.endsWith('.png')?'png':'jpeg'};base64,`+fs.readFileSync(path.join(assets,f)).toString('base64');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const pic=(file,x,y,w,h,extra='')=>`<div class="photo" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}"><img src="${data(file)}"></div>`;
function crop(key,x,y,w,h,px,py,pw,ph,extra=''){
 const file=key+'-screen.png',buf=fs.readFileSync(path.join(assets,file)),iw=buf.readUInt32BE(16),scale=w/pw;
 return `<div class="screen" style="left:${x}px;top:${y}px;width:${w}px;height:${h||ph*scale}px;${extra}"><img src="${data(file)}" style="position:absolute;left:${-px*scale}px;top:${-py*scale}px;width:${iw*scale}px;max-width:none"></div>`;
}
const txt=(s,x,y,size=24,color='',width=960,cls='')=>`<div class="text ${cls}" style="left:${x}px;top:${y}px;font-size:${size}px;width:${width}px;${color?'color:'+color+';':''}">${s}</div>`;
const brand=(num,label)=>txt('追踪事件簿',56,48,25,'#25262c',500,'brand')+txt(label,760,51,18,'#727783',266,'right')+txt(num,975,1355,20,'#727783',48,'right');
const foot=(source)=>txt(source+'<br>真实页面截图 · 活动安排以主办方最新公告为准',56,1349,15,'#737783',885);
const heading=(a,b)=>txt(a+'<br><span style="color:#3458dc">'+b+'</span>',56,115,68,'',975,'heading');
const css=`*{box-sizing:border-box}body{margin:0;background:#eceef2;font-family:'Microsoft YaHei','Segoe UI',sans-serif;color:#20232b}.slide{width:1080px;height:1440px;overflow:hidden;position:relative;background:#f7f7f3}.text{position:absolute;line-height:1.58}.heading{font-weight:700;line-height:1.24;letter-spacing:-2.5px}.brand{font-weight:600;letter-spacing:1.5px}.right{text-align:right}.photo{position:absolute;overflow:hidden;border-radius:16px}.photo img{width:100%;height:100%;object-fit:contain;display:block}.screen{position:absolute;overflow:hidden;border-radius:24px;background:white;box-shadow:0 12px 35px #24345613;border:1px solid #e5e6e8}.note{position:absolute;border-top:1px solid #d5dae5;padding-top:22px}.text strong{font-weight:600}.tiny{font-size:15px;color:#737783}`;
const pages=[];
pages.push(['01-封面',brand('01','兴趣不止一种')+
 txt('不想随便逛逛<br><span style="color:#3458dc">想去点自己喜欢的地方</span>',56,118,77,'',990,'heading')+
 txt('一场展、一次快闪，或一个想认真挑战的机会。',60,341,27,'#656b75')+
 pic('whale-key.jpg',56,425,968,420,'background:#153e7e;')+
 txt('看一场展',82,454,27,'#fff',350)+txt('《鲸鱼的致敬》 · 上海',82,792,22,'#fff',700)+
 pic('cafe-official.jpg',56,880,470,264)+pic('math.png',554,880,470,152)+
 txt('去一次喜欢的 IP 快闪',60,1160,24,'',475)+txt('也给成长留个位置',560,1052,24,'',450)+
 txt('发现活动 · 查看参与方式 · 把喜欢的先关注',56,1253,26,'#3458dc')+
 foot('素材：浦东美术馆官网／无畏契约官方微博／数维杯官网')]);
pages.push(['02-艺术展览',brand('02','文娱 / 艺术展览')+heading('想换个心情，','就走进一场展。')+
 pic('whale-key.jpg',56,334,452,254,'background:#153e7e;')+
 txt('卡罗莱娜·凯塞多<br>鲸鱼的致敬',56,625,35,'',455,'heading')+
 txt('上海 · 浦东美术馆',56,742,25,'#68717d',454)+
 txt('把“有点想去”<br>变成一个具体的安排。',56,828,34,'',452)+
 txt('先看展期，再了解地点与参与方式。<br>喜欢的活动，可以先关注。',56,990,23,'#68717d',450)+
 crop('art',564,330,460,0,9,22,545,1177)+
 foot('展览主视觉：浦东美术馆官网 · 截图中的日期核实提示予以保留')]);
pages.push(['03-联名快闪',brand('03','游戏 / 联名快闪')+heading('喜欢一个游戏，','不止可以看比赛。')+
 pic('cafe-official.jpg',56,320,968,544.5)+
 txt('瓦记冰室',56,918,41,'',300,'heading')+
 txt('无畏契约<br>新特工快闪茶餐厅',56,988,26,'#636a74',310)+
 txt('同一个兴趣，<br>也能有不同玩法。',56,1120,25,'#3458dc',305)+
 crop('game',382,909,642,384,51,822,500,299,'border-radius:20px;')+
 foot('活动海报：无畏契约官方微博（新浪页面） · 右下为你提供的真实首页局部')]);
pages.push(['04-竞赛成长',brand('04','竞赛成长 / 数学建模')+heading('不只收藏想去的，','也留意想挑战的。')+
 pic('math.png',56,323,968,312.6,'background:#eaf8ff;')+
 txt('数维杯 · 秋季赛',56,705,35,'',440,'heading')+
 txt('比赛什么时候开始？<br>报名什么时候截止？',56,804,30,'',445)+
 txt('把关键日期放在一起，<br>再决定要不要认真准备。',56,945,25,'#68717d',444)+
 txt('关注 ≠ 报名<br>提醒由自己选择开启',56,1120,23,'#3458dc',440)+
 crop('math',550,676,474,647,12,135,545,744,'border-radius:22px;')+
 foot('竞赛横幅：数维杯官网 · 截图保留原始信息与核实提示')]);
pages.push(['05-参与方式',brand('05','详情 / 参与方式')+heading('心动以后，','知道下一步怎么做。')+
 pic('math.png',56,337,452,146)+
 txt('不是只告诉你<br>“有这个活动”。',56,543,36,'',465,'heading')+
 txt('<strong>报名入口</strong><br><span style="color:#68717d">从哪里开始参与</span>',56,708,27,'',440)+
 txt('<strong>费用与条件</strong><br><span style="color:#68717d">先看是否适合自己</span>',56,877,27,'',440)+
 txt('<strong>重要规则</strong><br><span style="color:#68717d">报名之前，再核对一遍</span>',56,1046,27,'',440)+
 crop('guide',564,330,460,0,18,28,545,1177)+
 foot('竞赛横幅：数维杯官网 · 右侧为真实参与方式页面，非报名或获奖承诺')]);
pages.push(['06-体育页-校对预览',brand('06','校对预览 / 暂不发布')+heading('热爱不只在屏幕里，','也可以在现场。')+
 pic('tennis.jpg',56,330,452,727,'background:#eeeae3;')+
 crop('sport',564,330,460,0,7,15,545,1178)+
 txt('这张暂不用于公开宣传',56,1086,29,'#b24c37',452,'heading')+
 txt('官网海报：10 月 5—18 日<br>原截图简介：10 月 1—16 日<br>需核对赛程并重截页面后替换。',56,1155,23,'#875f53',452)+
 foot('赛事海报：上海劳力士大师赛官网 · 保留原海报及截图，不改写冲突日期')]);
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
 for(const [name,body] of pages){const html=`<!doctype html><meta charset="utf-8"><style>${css}</style><main class="slide">${body}</main>`;fs.writeFileSync(path.join(out,name+'.html'),html);await page.setContent(html);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(out,name+'.png')});}
 const contact=await browser.newPage({viewport:{width:1200,height:1100},deviceScaleFactor:1});
 await contact.setContent(`<style>body{margin:0;background:#e7e9ed;font-family:'Microsoft YaHei';padding:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}img{display:block;width:100%}figure{margin:0}figcaption{padding:5px;font-size:12px}</style>`+pages.map(([n])=>`<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(out,n+'.png')).toString('base64')}"><figcaption>${esc(n)}</figcaption></figure>`).join(''));
 await contact.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await contact.screenshot({path:path.join(out,'总览.png'),fullPage:true});await browser.close();console.log(JSON.stringify({out,pages:pages.map(p=>p[0])}));
})().catch(e=>{console.error(e);process.exit(1)});
