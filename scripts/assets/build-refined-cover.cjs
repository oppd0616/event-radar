const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../../output/promo/20261013'),out=path.join(root,'产品封面');
const data=f=>`data:image/${f.endsWith('.png')?'png':'jpeg'};base64,`+fs.readFileSync(path.join(root,'assets',f)).toString('base64');
const text=(s,x,y,size,w,color='#20252f',weight=400,extra='')=>`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;font-size:${size}px;line-height:1.25;color:${color};font-weight:${weight};${extra}">${s}</div>`;
function screen(f,x,y,w,px,py,pw,ph,style=''){const s=w/pw,iw=fs.readFileSync(path.join(root,'assets',f)).readUInt32BE(16);return `<div class="screen" style="left:${x}px;top:${y}px;width:${w}px;height:${ph*s}px;${style}"><img src="${data(f)}" style="position:absolute;width:${iw*s}px;left:${-px*s}px;top:${-py*s}px"></div>`;}
const html=`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:'Microsoft YaHei',sans-serif;color:#20252f}main{width:1080px;height:1440px;position:relative;overflow:hidden;background:#f6f6f2}.screen{position:absolute;overflow:hidden;background:white;border-radius:23px;border:1px solid #fff;box-shadow:0 2px 1px #cad0dc,0 18px 40px #2134541a} .scene{position:absolute;left:0;top:500px;width:1080px;height:650px;background:radial-gradient(ellipse at 58% 65%,#e1e7f2,transparent 65%)} .hero{position:absolute;left:54px;top:126px;font-size:109px;line-height:1.18;font-weight:700;letter-spacing:-5px}.hero span{color:#315bd9}.rule{position:absolute;left:60px;right:60px;height:1px;background:#d9dce2}</style><main>
${text('追踪事件簿',60,48,26,500,'#222936',700,'letter-spacing:2px')}
<div class="hero">找<span>喜欢</span>的活动<br>试试这个小程序</div>
${text('看展 · 演出 · 游戏快闪 · 竞赛成长',64,416,27,960,'#747b86')}
<div class="scene"></div>
<div style="position:absolute;left:60px;top:526px;width:430px;height:549px;background:#123d81;border-radius:24px;overflow:hidden;box-shadow:0 2px 0 #c2cbda,0 18px 38px #273a5a19;transform:rotate(-3deg)">
<img src="${data('whale-key.jpg')}" style="position:absolute;width:760px;height:428px;object-fit:contain;left:-165px;top:75px">
${text('把兴趣，带到生活里。',27,30,25,380,'#fff',500)}
${text('鲸鱼的致敬',28,451,33,380,'#fff',600)}
${text('浦东美术馆 · 展览主视觉',29,503,17,380,'#ceddf7')}
</div>
${screen('game-screen.png',492,514,520,51,142,500,665,'transform:rotate(2deg);')}
${screen('game-screen.png',408,992,604,51,822,500,215,'transform:rotate(-1deg);box-shadow:0 2px 1px #c8d0dd,0 22px 48px #1b2d5024;')}
<div class="rule" style="top:1304px"></div>
${text('按兴趣发现',60,1332,25,280,'#252b36',600)}
${text('看清参与方式',396,1332,25,300,'#252b36',600)}
${text('先关注，再决定',756,1332,25,310,'#252b36',600)}
${text('真实页面局部 · 展览主视觉来源：浦东美术馆官网',60,1400,14,960,'#9297a0')}
</main>`;
fs.writeFileSync(path.join(out,'产品封面-精修版.html'),html);
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});const p=await b.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});await p.setContent(html);await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:path.join(out,'追踪事件簿-精修封面.png')});await b.close();})();
