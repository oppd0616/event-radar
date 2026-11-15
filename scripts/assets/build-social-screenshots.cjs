const fs=require('fs');
const path=require('path');
const {chromium:engine}=require('C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const chromium={launch:options=>engine.launch({...options,channel:'msedge'})};
const root=path.resolve(__dirname,'../..'), out=path.join(root,'output/promo/screenshots-clean');
const sources={
 home:'C:/Users/oppd_/AppData/Local/Temp/codex-clipboard-71fc4e3a-3678-4832-94c6-bd1e0f4e2d8d.png',
 follows:'C:/Users/oppd_/AppData/Local/Temp/codex-clipboard-cbc945c8-a2b3-4961-b504-aabc5d5c7022.png',
 detail:'C:/Users/oppd_/AppData/Local/Temp/codex-clipboard-e8c95f29-006a-4534-aeaf-202cd11a0bdd.png',
 overview:'C:/Users/oppd_/AppData/Local/Temp/codex-clipboard-238245e1-50cb-4084-88f6-230b495b4186.png'
};
// Source-pixel viewport boundaries: omit the simulator surround, preserve screen pixels.
const crops={home:[19,9,545,1179,573],follows:[0,0,541,1175,564],detail:[5,12,545,1178,583],overview:[0,0,1280,2774,1280]};
const specs=[
 ['home','01-发现活动','成长的机会，\n多看见一点。','发现','竞赛、考试、会议','浏览近期活动，\n查看日期与参与入口。','看到喜欢的，先关注','不必马上决定，\n留着之后慢慢了解。'],
 ['follows','02-我的关注','喜欢的活动，\n留在一处。','关注','不用当场做决定','先关注，之后回来\n再看详情与参与方式。','结束了，也能回看','全部关注与已结束收藏\n分开查看。'],
 ['detail','03-活动详情','这场演出，\n怎么去？','详情','时间、地点、票价','在详情页集中查看，\n再到购票平台确认。','关注与提醒分开','关注保存兴趣；\n提醒由自己选择。'],
 ['overview','04-首页浏览','近期值得关注，\n从这里开始。','首页','兴趣不止一种','科技、演出、游戏……\n切换领域，发现活动。','按你的方式浏览','综合、时间、热度，\n找到这一刻想看的。']
];
const css=`*{box-sizing:border-box}body{margin:0;background:#edf0f7;font-family:'Microsoft YaHei',sans-serif;color:#17202d}.slide{width:1080px;height:1440px;position:relative;overflow:hidden;background:#f5f6fa}.brand{position:absolute;top:62px;left:68px;font-size:25px;letter-spacing:2px}.index{position:absolute;right:68px;top:62px;color:#58657a;font-size:22px}h1{position:absolute;left:66px;top:121px;margin:0;font-size:76px;line-height:1.22;letter-spacing:-3px;font-weight:700;white-space:pre-line}h1 span{color:#2856ec}.phone{position:absolute;left:530px;top:322px;width:478px;padding:8px;background:#fff;border-radius:43px;box-shadow:0 30px 70px #22385b20,0 0 0 1px #dfe4ec}.phone img{display:block;width:462px;border-radius:35px}.features{position:absolute;left:68px;top:590px;width:420px}.feature{margin-bottom:89px}.rule{width:40px;height:4px;background:#2856ec;margin-bottom:26px}.feature h2{font-size:32px;margin:0 0 20px;font-weight:600}.feature p{font-size:23px;color:#697486;line-height:1.9;margin:0;white-space:pre-line}.foot{position:absolute;left:68px;bottom:43px;color:#7a8493;font-size:17px}.tag{position:absolute;left:68px;top:444px;padding:9px 17px;border:1px solid #cbd5ed;border-radius:25px;color:#2856ec;font-size:20px}`;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
 for(const [src,name,title,tag,h1,p1,h2,p2] of specs){
  const local=path.join(out,src+'-original.png');
  if(fs.existsSync(sources[src])) fs.copyFileSync(sources[src],local);
  const img=fs.readFileSync(local).toString('base64');
  const lines=title.split('\n');
  const [x,y,w,h,iw]=crops[src],scale=462/w;
  const frame=`.phone{padding:0;width:462px;border-radius:38px;overflow:hidden;height:${h*scale}px}.phone img{position:absolute;left:${-x*scale}px;top:${-y*scale}px;width:${iw*scale}px;max-width:none;border-radius:0}`;
  const html=`<!doctype html><meta charset="utf-8"><style>${css}${frame}</style><main class="slide"><div class="brand">追踪事件簿</div><div class="index">功能展示 / ${tag}</div><h1>${lines[0]}<br><span>${lines[1]}</span></h1><div class="tag">${tag}</div><div class="features"><div class="feature"><div class="rule"></div><h2>${h1}</h2><p>${p1}</p></div><div class="feature"><div class="rule"></div><h2>${h2}</h2><p>${p2}</p></div></div><div class="phone"><img src="data:image/png;base64,${img}"></div><div class="foot">真实页面展示 · 活动安排以主办方最新公告为准</div></main>`;
  fs.writeFileSync(path.join(out,name+'.html'),html);
  await page.setContent(html);
  await page.locator('img').evaluate(img=>img.decode());
  await page.screenshot({path:path.join(out,name+'.png')});
 }
 await browser.close();console.log(out);
})().catch(e=>{console.error(e);process.exit(1)});
