const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../output/promo/20261013'),out=path.join(root,'产品封面');fs.mkdirSync(out,{recursive:true});
const data=f=>`data:image/${f.endsWith('.png')?'png':'jpeg'};base64,`+fs.readFileSync(path.join(root,'assets',f)).toString('base64');
const t=(s,x,y,size,w,color='#22252b',weight=400)=>`<div style="position:absolute;left:${x}px;top:${y}px;font-size:${size}px;width:${w}px;color:${color};font-weight:${weight};line-height:1.25">${s}</div>`;
const img=(f,x,y,w,h)=>`<img src="${data(f)}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;object-fit:contain;border-radius:16px;box-shadow:0 2px 1px #ffffff,0 12px 25px #152c591c;transform:perspective(1200px) rotateY(4deg)">`;
const scale=510/545,iw=fs.readFileSync(path.join(root,'assets/game-screen.png')).readUInt32BE(16);
const shot=`<div style="position:absolute;left:510px;top:415px;width:510px;height:${1010*scale}px;overflow:hidden;border-radius:27px;transform:perspective(2200px) rotateY(-5deg) rotateZ(1.4deg);box-shadow:3px 2px 0 #fff,7px 6px 0 #cbd1df,10px 9px 0 #b7c1d2,24px 30px 55px #263e6c30;background:white;border:1px solid #fff"><img src="${data('game-screen.png')}" style="position:absolute;left:${-30*scale}px;top:${-141*scale}px;width:${iw*scale}px"></div>`;
const body=t('追踪事件簿',60,49,25,400,'#252832',700)+
`<div class="headline ink">找喜欢的活动</div><div class="headline blue">试试这个小程序</div>`+
t('看展 · 演出 · 游戏快闪 · 竞赛成长',62,390,25,940,'#737985')+
`<div style="position:absolute;left:60px;top:432px;width:386px;height:1px;background:#d8dce3"></div>`+
t('01',62,466,21,60,'#365ad6',600)+t('按兴趣发现',111,457,35,330,'#22252b',600)+t('从你喜欢的方向开始找',111,511,24,335,'#777d86')+
t('02',62,591,21,60,'#365ad6',600)+t('看清参与方式',111,582,35,330,'#22252b',600)+t('日期、地点、入口放在一起',111,636,23,335,'#777d86')+
t('03',62,716,21,60,'#365ad6',600)+t('先关注，再决定',111,707,35,340,'#22252b',600)+t('把有点心动的活动留住',111,761,24,335,'#777d86')+
img('whale-key.jpg',60,846,386,217)+img('cafe-official.jpg',60,1090,386,217)+shot+
t('真实页面局部 · 海报：浦东美术馆 / 无畏契约官方微博',60,1401,14,965,'#848992');
const html=`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:'Microsoft YaHei',sans-serif}main{position:relative;width:1080px;height:1440px;background:radial-gradient(ellipse at 88% 66%,#dce4f4 0%,transparent 49%),linear-gradient(125deg,#fcfbf7,#f1f2f0);overflow:hidden}.headline{position:absolute;left:55px;font-family:'Microsoft YaHei',sans-serif;font-size:108px;font-weight:900;letter-spacing:-5px;line-height:1.12;transform:skewX(-5deg);transform-origin:left bottom}.ink{top:120px;color:#252932;text-shadow:0 1px 0 #fff,1px 3px 0 #d6d9df,2px 5px 0 #d6d9df,4px 9px 14px #1d2f4814}.blue{top:247px;color:#365ddd;text-shadow:0 -1px 0 #c2d4ff,1px 2px 0 #294dbb,2px 4px 0 #294dbb,3px 6px 0 #294dbb,4px 8px 0 #294dbb,7px 14px 18px #233f9f25}</style><main>${body}</main>`;
fs.writeFileSync(path.join(out,'产品封面-立体质感版.html'),html);
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});const p=await b.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});await p.setContent(html);await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:path.join(out,'追踪事件簿-立体质感版.png')});await b.close();})();
