// Layout checks use the shipped WXSS converted to CSS, not a native-device claim.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const runtime=process.env.CODEX_NODE_MODULES || 'C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
const {chromium}=require(path.join(runtime,'playwright'))
const root=path.resolve(__dirname,'../miniprogram')
const read=name=>fs.readFileSync(path.join(root,name),'utf8')
const output=path.resolve(__dirname,'../output/qa/interaction-polish')
const css=(name,width)=>read(name).replace(/(-?[\d.]+)rpx/g,(_,n)=>Number(n)*width/750+'px').replace(/\bpage\s*\{/g,'body {')
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true})
  fs.mkdirSync(output,{recursive:true})
  try {
    for(const width of [320,375,430]) {
      const page=await browser.newPage({viewport:{width,height:812}})
      const strength=read('pages/subscribe/subscribe.wxml').match(/<view class="strength-options">([\s\S]*?)\n        <\/view>/)[0]
        .replace(/\{\{activeEditWeight \* 100\}\}/g,'2').replace(/\{\{[^}]*\}\}/g,'')
        .replace(/<view/g,'<div').replace(/<\/view>/g,'</div>')
      await page.setContent(`<style>body{margin:0}${css('app.wxss',width)}${css('pages/subscribe/subscribe.wxss',width)}</style><div class="page-container preference-page"><div class="interest-title">我的兴趣</div><div class="interest-subtitle">决定发现页更先出现什么</div><div class="interest-surface"><div class="editor-label">选择领域</div><div class="interest-chips"><div class="interest-chip">科技</div><div class="interest-chip">游戏</div><div class="interest-chip">文娱</div></div><div class="strength-editor"><div class="strength-heading">科技的推荐强度</div>${strength}</div></div></div>`)
      for(const index of [0,3,1,2]) {
        await page.locator('.strength-indicator').evaluate((el,i)=>el.style.transform=`translateX(${i*100}%)`,index)
        await page.waitForTimeout(210)
        const indicator=await page.locator('.strength-indicator').boundingBox()
        const option=await page.locator('.strength-option').nth(index).boundingBox()
        assert(Math.abs(indicator.x-option.x)<1 && Math.abs(indicator.width-option.width)<1,'selection must align with every option at '+width)
      }
      await page.screenshot({path:path.join(output,`preferences-${width}.png`)})
      await page.emulateMedia({reducedMotion:'reduce'})
      assert.equal(await page.locator('.strength-indicator').evaluate(el=>getComputedStyle(el).transitionDuration),'0s')
      await page.setContent(`<style>body{margin:0}${css('app.wxss',width)}${css('pages/home/home.wxss',width)}</style><div class="page-container tab-page"><div class="hd"><div class="hd-left"><div class="hd-kicker">EVENT RADAR</div><div class="hd-title">近期值得关注</div></div></div><div class="feed-controls"><div class="tabs-wrap" style="height:38px;display:flex;align-items:center;justify-content:space-around;background:#FAFAF8"><span>推荐</span><span>科技</span><span>演出</span><span>文娱</span><span>游戏</span></div><div class="sort-row"><div class="sort-control"><div class="sort-indicator"></div><div class="sort-option sort-option-active">综合</div><div class="sort-option">时间</div><div class="sort-option">热度</div></div><div class="search-entry"><div class="search-entry-surface"><div class="search-glyph"><div class="search-glyph-ring"></div><div class="search-glyph-handle"></div></div></div></div></div></div><div style="height:2400px;background:#fff;border-radius:16px;padding:12px">活动列表占位（布局测试）</div></div>`)
      await page.evaluate(()=>scrollTo(0,600))
      const pinned=await page.locator('.feed-controls').boundingBox()
      assert(Math.abs(pinned.y)<1,'filters stay at top when title scrolls away')
      assert(await page.locator('.hd').evaluate(el=>el.getBoundingClientRect().bottom<0))
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width)
      await page.screenshot({path:path.join(output,`sticky-${width}.png`)})
      await page.close()
    }
    console.log('PASS: 320/375/430px strength alignment, sticky filters, no horizontal overflow, reduced-motion; CSS harness only, not native WeChat QA')
  } finally { await browser.close() }
}
main().catch(error=>{console.error(error);process.exitCode=1})
