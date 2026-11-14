"""AI experience edition: actual screenshots, auditable tests, no invented metrics."""
from pathlib import Path
from html import escape
import json, shutil
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/追踪事件簿-产品介绍-AI体验升级版.pdf'
ASSETS=ROOT/'output/competition/ai-edition-assets'
ASSETS.mkdir(parents=True,exist_ok=True)
INPUTS={
 'game':Path('C:/Users/oppd_/AppData/Local/Temp/codex-clipboard-620d8a56-bc77-4046-8deb-f654896a58b2.png'),
 'participation':Path('C:/Users/oppd_/AppData/Local/Temp/codex-clipboard-8ddf2189-3f5a-4099-b10e-7a0f510cdd4a.png'),
 'search':ROOT/'output/promo/20261016-live/hackathon-search.png',
 'home':ROOT/'output/promo/20261016-live/current.png',
 'detail':ROOT/'output/promo/20261016-live/hackathon-detail.png',
 'follow':ROOT/'output/competition/screenshots/follows.png',
}
for key,src in INPUTS.items():
 dst=ASSETS/(key+'.png')
 if src.exists():shutil.copy2(src,dst)
 assert dst.exists(),str(dst)
for name,file in [('CN','msyh.ttc'),('B','msyhbd.ttc')]:
 pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
W,H=A4;M=42;CW=W-2*M
C=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1)
C.setTitle('追踪事件簿 | 真实痛点与 AI 体验升级');C.setAuthor('宿炜')
C.setSubject('2026 微信小程序开发大赛作品介绍；2026-10-16 修订')
INK='#171C25';BLUE='#2856EB';MUTED='#606A79';LINE='#DDE2E9';PAPER='#FAFAF7';PALE='#ECF1FD';WHITE='#FFFFFF';DARK='#171F30';SOFT='#B7C5DE';TEAL='#BFE1D4'
N=0;DARK_PAGE=False

def box(x,y,w,h,color=WHITE,r=0):
 C.setFillColor(HexColor(color))
 if r:C.roundRect(x,H-y-h,w,h,r,stroke=0,fill=1)
 else:C.rect(x,H-y-h,w,h,stroke=0,fill=1)
def ln(x,y,x2,y2,color=LINE,width=.7):
 C.setStrokeColor(HexColor(color));C.setLineWidth(width);C.line(x,H-y,x2,H-y2)
def txt(x,y,s,size=11,font='CN',color=INK):
 assert x+pdfmetrics.stringWidth(s,font,size)<=W-25,(N,'width',s)
 assert 0<=y<H-18,(N,'height',s)
 C.setFillColor(HexColor(color));C.setFont(font,size);C.drawString(x,H-y-size*.88,s)
def p(x,y,s,w=CW,size=11,leading=18,color=INK,font='CN',bottom=796):
 q=Paragraph(escape(s).replace('\n','<br/>'),ParagraphStyle('body',fontName=font,fontSize=size,leading=leading,textColor=HexColor(color),wordWrap='CJK'))
 _,h=q.wrap(w,1000);assert y+h<=bottom,(N,s[:30],y+h)
 q.drawOn(C,x,H-y-h);return y+h
def dot(x,y,r=3,color=BLUE):
 C.setFillColor(HexColor(color));C.circle(x,H-y,r,fill=1,stroke=0)
def bookmark(x,y,color=BLUE):
 C.setFillColor(HexColor(color));q=C.beginPath();q.moveTo(x,H-y);q.lineTo(x+11,H-y);q.lineTo(x+11,H-y-18);q.lineTo(x+5.5,H-y-13);q.lineTo(x,H-y-18);q.close();C.drawPath(q,fill=1,stroke=0)
def page(name,dark=False):
 global N,DARK_PAGE
 N+=1;DARK_PAGE=dark;box(0,0,W,H,DARK if dark else PAPER)
 C.bookmarkPage(str(N));C.addOutlineEntry(name,str(N),0)
def end():
 txt(534,809,f'{N:02}',8,'Helvetica',SOFT if DARK_PAGE else MUTED);C.showPage()
def title(k,a,b=None,sub=None):
 fg=WHITE if DARK_PAGE else INK
 txt(M,54,k,9,'CN',TEAL if DARK_PAGE else BLUE)
 txt(M,88,a,30,'B',fg)
 if b:txt(M,130,b,30,'B',fg)
 if sub:p(M,185 if b else 144,sub,CW,11,19,SOFT if DARK_PAGE else MUTED)
def note(s,y=769):p(M,y,s,CW-4,8,12,SOFT if DARK_PAGE else MUTED,bottom=803)
def shot(key,x,y,w,crop,r=10):
 im=ImageReader(str(ASSETS/(key+'.png')));iw,ih=im.getSize();left,top,cw,ch=crop;s=w/cw;hh=ch*s
 assert left>=0 and top>=0 and left+cw<=iw+1 and top+ch<=ih+1,(key,im.getSize(),crop)
 assert y+hh<=803,(N,key,y+hh)
 box(x-1,y-1,w+2,hh+2,LINE,r)
 C.saveState();q=C.beginPath();q.roundRect(x,H-y-hh,w,hh,r);C.clipPath(q,stroke=0)
 C.drawImage(im,x-left*s,H-y-(ih-top)*s,iw*s,ih*s,mask='auto');C.restoreState();return hh
def label(x,y,s,w=90):
 box(x,y,w,24,PALE,5);txt(x+10,y+6,s,8.7,'CN',BLUE)
def source_link(x,y,label,url):
 txt(x,y,label,8,'CN',BLUE);C.linkURL(url,(x,H-y-12,x+pdfmetrics.stringWidth(label,'CN',8),H-y+1),relative=0)

ranking=json.loads((ROOT/'docs/recommendation-ranking-comparison-20260930.json').read_text(encoding='utf-8-sig'))
before={x['name']:x for x in ranking['before']['profiles']};after={x['name']:x for x in ranking['after']['profiles']}
usage=json.loads((ROOT/'docs/user-activity-20261013.json').read_text(encoding='utf-8-sig'))

# 01 — the product, not a generic AI poster.
page('追踪事件簿 / AI 体验升级')
bookmark(M,53);txt(63,52,'追踪事件簿',17,'B')
txt(M,118,'从喜欢，',48,'B');txt(M,181,'走向参与。',48,'B',BLUE)
p(M,262,'AI 驱动的个性化活动发现与追踪工具',CW,16,25)
p(M,305,'从分散的消息中发现机会，\n把时间、地点与参与条件整理清楚。',CW,12,21,MUTED)
shot('game',42,379,285,(52,482,500,324))
shot('search',253,592,300,(18,727,508,241))
txt(42,356,'同一兴趣 · 不同参与方式',9,'CN',BLUE)
txt(253,571,'成长机会 · 技术实践',9,'CN',BLUE)
txt(M,754,'2026 微信小程序开发大赛 · 与 AI 共生',10,'CN',MUTED)
note('2026.10.16 修订 · 图为真实界面局部；具体活动状态以截图时刻为准。',783)
end()

# 02 — pain -> benefit -> mechanism, not a feature inventory.
page('选题 / 真实痛点')
title('从真实生活出发','活动并不少。','难的是及时找到，判断清楚。', '年轻人既寻找成长机会，也希望保留自己的爱好。消息分散、发现滞后和参与门槛不清，让一次心动停在了信息流里。')
rows=[('不知道该搜什么','只知道自己喜欢某个游戏或技术方向，却不知道近期有什么活动。','从兴趣发现机会','开放搜索寻找新线索，推荐机制连接相关活动。'),('找到了，还要反复确认','报名截止、比赛日期、城市与不同阶段混在长公告里。','把消息整理成条件','模型抽取关键字段，规则检查范围与冲突。'),('当时想去，后来又错过','收藏分散在不同平台，活动进程和入口难以再次找到。','让关注有后续','统一详情、阶段与关注列表；这是产品流程与更新机制。')]
txt(M,256,'用户受阻的地方',10,'B',MUTED);txt(318,256,'体验应当如何改变',10,'B',BLUE)
for i,(a,b,c,d) in enumerate(rows):
 y=291+i*139;ln(M,y,553,y);txt(M,y+19,a,17,'B');p(M,y+52,b,226,10.5,18,MUTED)
 txt(318,y+19,c,17,'B',BLUE);p(318,y+52,d,233,10.5,18,MUTED)
box(M,724,CW,31,PALE,5);txt(54,733,'AI 的价值：减少搜集与整理，把判断与选择留给用户。',11,'B',BLUE)
note('情境归纳与产品设计目标，不作为真实用户访谈原话或已验证的用户收益。')
end()

# 03 — a meaningful cross-format example.
page('体验升级 / 一个兴趣的不同参与方式')
title('体验升级 01 · 从已知兴趣到新机会','喜欢一个游戏，','不只是在屏幕里见面。')
p(M,184,'赛事、概念网吧、主题餐厅，可以属于同一个人的兴趣。系统尝试连接这些活动，而不是只重复推荐同一种形式。',CW,11.5,20,MUTED)
shot('game',M,257,264,(52,143,500,975))
for y,num,a,b in [(281,'01','留下兴趣信号','用户表达偏好、关注活动，形成相关主题信号。'),(426,'02','扩展发现范围','按 IP 与活动形式组织开放检索，寻找名单之外的线索。'),(571,'03','先核验，再呈现','核对身份与参与信息；主题相关不等于一定适合参加。')]:
 txt(339,y,num,10,'Helvetica',BLUE);txt(339,y+24,a,15,'B');p(339,y+57,b,211,10.5,18,MUTED)
note('左侧为用户提供的历史真实截图，展示三类活动共存，并非完整的个性化因果验证。跨形式排序与真实检索的验证口径见第 10 页。',783)
end()

# 04 — active search remains in the user's hands.
page('实际功能 / 黑客松搜索')
title('体验升级 02 · 成长机会也能被看见','从一项技术兴趣，','到一次实践的可能。')
p(M,184,'推荐帮助发现未知机会；有明确目标时，也可以直接搜索。搜索已有活动库，不等于每次输入都实时检索全网。',CW,11.5,20,MUTED)
shot('search',M,260,287,(18,139,508,829))
label(359,286,'真实搜索结果',134)
txt(359,336,'黑客松',25,'B',BLUE)
p(359,385,'输入关键词\n浏览活动与当前状态\n进入详情核对参与条件',190,12,25)
ln(359,491,550,491)
p(359,515,'技术、竞赛与开发者活动，提供实践入口；不是只有演出和快闪值得关注。',190,11,20,MUTED)
box(359,632,191,80,PALE,9);p(373,646,'结果中可能包含报名已截止的活动，需分别查看活动状态与报名条件。',163,9.5,16,MUTED)
note('2026-10-16 开发者工具自动化真实截图；搜索“黑客松”返回 5 条相关记录。记录数不是可报名活动数。')
end()

# 05 — where the model changes a concrete user task.
page('实际功能 / 结构化参与信息')
title('体验升级 03 · 从读公告到判断能否参加','AI 整理信息，','不替你做决定。')
p(M,184,'一段长公告，需要回答的往往只有几件事：我能参加吗？在哪里报名？需要付费吗？有哪些限制？',CW,11.5,20,MUTED)
shot('participation',M,257,280,(40,175,500,807))
for y,a,b in [(281,'入口','把报名渠道与相关来源放在一起，减少再次搜索。'),(399,'条件','整理费用、组队要求、参与资格与重要规则。'),(536,'边界','模型抽取之后仍需核验；缺失或冲突不能靠生成补成确定事实。')]:
 txt(355,y,a,18,'B',BLUE);p(355,y+34,b,195,11,19,MUTED)
ln(M,735,553,735);p(M,748,'从“帮我总结一下”走向“帮我判断下一步需要核实什么”。',CW,13,22,INK,'B')
note('真实数维杯详情局部，用户提供的历史截图。展示信息组织方式，不代表本次已重新核实活动规则。',784)
end()

# 06 — the event entity is the unit, not a pile of announcements.
page('实际功能 / 阶段与持续关注')
title('把参与过程接起来','不是多个相似标题，','而是一个活动的连续进程。')
p(M,184,'同一届赛事保留一个活动主体，各阶段关联自己的日期与参与方式；独立快闪、城市站点与不同届次不应被随意合并。',CW,11.5,20,MUTED)
box(M,261,CW,61,DARK,9);txt(62,280,'一个活动主体',19,'B',WHITE);txt(390,286,'保留阶段差异',10,'CN',SOFT)
ln(297,322,297,351,BLUE);ln(123,351,471,351,BLUE)
for x,t in [(42,'小组赛'),(216,'淘汰赛'),(390,'总决赛')]:
 ln(x+81,351,x+81,365,BLUE);box(x,365,163,99,PALE,9);txt(x+18,385,t,17,'B');p(x+18,418,'日期 · 地点 · 参与入口',132,9,16,MUTED)
shot('follow',M,510,288,(22,578,501,235))
txt(360,517,'关注 ≠ 报名 ≠ 提醒',13,'B',BLUE)
p(360,557,'关注保存兴趣；报名在官方渠道完成；提醒需要另行授权。',192,11,20,MUTED)
box(M,683,CW,61,WHITE,8);p(58,699,'报名截止、活动开始和当前阶段，是不同的时间概念。\n按已确认的信息精度展示，不以“进行中”代替所有状态。',477,11,19)
note('上方为结构示意，不含实际赛程。下方为 2026-10-01 真实关注记录，活动状态对应截图时刻。')
end()

# 07 — make the division of responsibility explicit.
page('技术开发方案 / 模型与规则协作',True)
title('AI 信息处理链路','模型负责理解，','规则约束结果。', '微信原生小程序承载交互；Node.js 云函数与定时任务承担发现、抽取、校验和更新。搜索服务、语言模型、程序规则各有明确职责。')
nodes=[('01','发现与材料收集','Exa / Tavily / WSA SearchPro','Exa 优先发现，Tavily 在无结果或失败时补位；WSA 主要检索详情证据。'),('02','结构化信息抽取','DeepSeek','从非结构化内容整理活动字段，并关联来源证据。'),('03','核验与身份治理','程序规则 + 证据检查','检查届次、时间、阶段、重复与冲突；必要时补搜或保留待核实。'),('04','存储、推荐与呈现','CloudBase + 微信小程序','活动库、偏好与关注关系；按兴趣信号排序，前端按需读取。')]
for i,(num,a,b,d) in enumerate(nodes):
 y=269+i*110
 if i:ln(57,y-20,57,y-2,'#476083',1)
 dot(57,y+18,13,BLUE);txt(50,y+12,num,10,'Helvetica',WHITE)
 txt(86,y,a,16,'B',WHITE);txt(86,y+27,b,10,'B',TEAL);p(86,y+49,d,450,10.5,17,SOFT)
box(M,725,CW,31,'#29374E',5);txt(55,734,'不是让模型自由生成活动，而是围绕可追溯材料组织候选事实。',10,'CN',WHITE)
note('技术职责概览。来源与字段关联支持追溯；规则检查仍不能保证事实绝对准确，需要随主办方公告持续复核。')
end()

# 08 — distinctive interaction, with realistic technical limits.
page('创新点 / 兴趣驱动的开放发现')
title('与 AI 共生 · 以兴趣和证据组织活动','让兴趣影响发现，','让证据约束推荐。')
features=[('01','名单之外，也能被发现','具名目标承担持续追踪，开放发现寻找新的候选。活动不必先存在于名单中，才有机会进入核验流程。','开放发现 ≠ 直接发布'),('02','同一兴趣，不止一种形式','游戏兴趣关联赛事与线下体验；技术兴趣关联黑客松等实践机会。相邻兴趣只作较弱信号，不替用户修改明确偏好。','相关活动 ≠ 所有热门活动'),('03','确定性不足，不制造确定性','抽取结果经过身份、范围和冲突检查。来源可追溯；未核实的时间和条件保留不确定性，用户仍可回到官方来源确认。','有来源 ≠ 永远正确')]
for i,(num,a,b,c) in enumerate(features):
 y=245+i*161;ln(M,y,553,y);txt(M,y+21,num,17,'Helvetica',BLUE);txt(88,y+20,a,19,'B');p(88,y+57,b,453,11,19,MUTED);txt(88,y+119,c,9,'B',BLUE)
note('目前复用有限兴趣字典；通过共享主题需求与调度执行发现，并非任意 IP 的通用理解，也不是每个用户一关注就立即全网搜索。',773)
end()

# 09 — report exact values; no inflated success claim.
page('验证 / 推荐离线对比')
title('可复核的效果 · 01','推荐更相关，','先从同一批样本检查。')
p(M,184,'在同一批 110 条活动记录上，对 5 组构造兴趣画像进行排序对比。指标是前 10 条中的主题匹配记录数。',CW,11.5,20,MUTED)
txt(42,258,'兴趣画像',10,'B');txt(199,258,'优化前',9,'CN',MUTED);txt(272,258,'优化后',9,'CN',BLUE);txt(445,258,'池内匹配记录',9,'CN',MUTED)
for i,name in enumerate(['无畏契约','AI 与大模型','演唱会','艺术展览','黑客松']):
 y=301+i*72;a=before[name]['matchedTop10'];b=after[name]['matchedTop10'];available=after[name]['availableMatches']
 ln(M,y-10,553,y-10);txt(M,y+8,name,12,'B');box(185,y+6,210,7,LINE,3);box(185,y+6,21*a,7,'#AFBACD',3);box(185,y+22,21*b,7,BLUE,3)
 txt(407,y+7,f'{a} → {b}',12,'B',BLUE);txt(508,y+7,str(available),12,'CN',MUTED)
box(M,685,CW,61,PALE,9);p(58,698,'库存限制：无畏契约仅 2 条匹配记录，优化后仍为 2 条；黑客松仅 6 条。\n该实验检验既有活动的排序，不衡量新增活动的发现能力。',478,11,18)
note('2026-09-30 历史离线回放 [S1]；按既有主题标记计数，非独立人工标注评测。不是点击率、满意度、真实用户转化率或全网发现率。')
end()

# 10 — three layers of evidence, with experimental scope preserved.
page('验证 / 跨形式与早期运行')
title('可复核的效果 · 02','从逻辑测试，','到真实检索与页面展示。')
blocks=[('A','合成样本：检查推荐逻辑','2026-10-13','无畏契约画像下，联名餐厅与概念网吧位于前两名；计算机画像下，黑客松位于第一名。普通餐厅未被判为游戏 IP 匹配。','证明路由与评分行为，不证明真实用户点击或转化。[S2]'),('B','真实搜索：检查能否找到线索','2026-10-13','修正主题丢失问题后，检索返回瓦记冰室、概念网吧、观赛派对等线索；黑客松检索也返回相关结果。','该次为 search-only 测试，未在这次调用中发布新活动。[S3]'),('C','真实界面：检查结果是否可见','2026-10-16','通过开发者工具自动化获取真实截图；“黑客松”搜索页返回 5 条相关活动记录，可进入活动详情。','证明页面可展示；不等于所有结果都仍可报名。')]
for i,(tag,a,date,b,c) in enumerate(blocks):
 y=234+i*154;box(M,y,34,34,BLUE,7);txt(M+10,y+8,tag,17,'Helvetica',WHITE);txt(92,y+2,a,16,'B');txt(92,y+30,date,9,'Helvetica',MUTED);p(92,y+52,b,455,10.5,18);p(92,y+107,c,455,9,15,MUTED)
ln(M,712,553,712);p(M,729,'验证分层呈现：逻辑成立、找到线索、页面可见，是三种不同的证据。',CW,11,19,BLUE,'B')
note('测试范围与边界保留，不将合成样本当作真实活动，不将检索成功等同于准确入库或用户收益。')
end()

# 11 — early operational evidence, transparently bounded.
page('运行观察 / 选择权与下一步')
title('早期观察与持续改进','从早期验证，','走向持续改进。')
p(M,184,'现有运行记录说明产品已产生交互，但不足以证明真实用户增长或长期留存。早期数据与开发测试需要进一步区分。',CW,11.5,20,MUTED)
for x,num,label_,desc in [(42,str(usage['observedActiveUsers']),'观察到的活跃身份','依据已记录行为，不是完整访客统计'),(307,str(usage['totalLogs']),'记录的交互日志','包含曝光、查看、停留等，不是人数')]:
 box(x,253,246,153,WHITE,10);txt(x+18,271,num,48,'B',BLUE);txt(x+18,333,label_,13,'B');p(x+18,362,desc,210,9.5,16,MUTED)
p(M,428,'统计区间：2026-10-12 00:00 至 10-13 21:47，北京时间。\n可能包含开发测试，存在漏记；不能标作真实 DAU、MAU 或获客成绩。[S4]',CW,10,17,MUTED)
ln(M,491,553,491)
txt(M,519,'用户可以控制',17,'B');p(M,554,'调整偏好或关闭个性化推荐；清除推荐记录、删除个人数据；关注与订阅提醒分别选择。',236,11,20,MUTED)
txt(317,519,'下一步需要验证',17,'B');p(317,554,'区分测试与正式用户，建立一致统计口径；抽样核对字段准确性；验证发现、关注与实际参与之间的体验。',236,11,20,MUTED)
box(M,670,CW,70,DARK,9);p(59,687,'AI 帮助减少信息整理成本。\n是否参与、如何参与，仍由用户自己判断。',477,14,23,WHITE,'B')
note('数据来自项目已有聚合审计，未包含身份明细。隐私控制依据现有界面与代码说明，不构成安全审计结论。')
end()

# 12 — author and dependencies at the end, not throughout the story.
page('作品说明 / 来源与开发边界')
bookmark(M,53);txt(63,52,'追踪事件簿',17,'B')
txt(M,111,'把注意力，',34,'B');txt(M,160,'留给真正喜欢的事。',34,'B',BLUE)
p(M,222,'体验路径：选择兴趣 → 搜索活动 → 查看参与方式 → 关注回看',CW,11,19)
ln(M,269,553,269)
txt(M,289,'个人作品与 AI 使用',12,'B')
p(M,317,'宿炜 · 山东大学 · 2026 年 9-10 月。个人完成产品设计、开发集成与测试。使用 AI 辅助代码编写、问题排查、测试与文档整理；需求取舍、集成、核验和最终提交由本人负责。未引用其他团队的完整作品。',CW,10,17)
txt(M,393,'第三方组件与服务',12,'B')
p(M,420,'微信小程序 / CloudBase：运行平台、云函数与数据服务。\nExa / Tavily：开放发现的优先搜索与备用搜索通道。\nWSA / DeepSeek：详情证据检索与结构化信息处理服务。\nTDesign、Day.js、iconv-lite、wx-server-sdk：界面、日期、编码和云开发 SDK（MIT）。\nopencc-js：繁简转换（MIT AND Apache-2.0，依包内声明）。',CW,9.5,16)
p(M,516,'这些平台能力、开源组件及公开活动内容不是个人原创成果；使用应遵循对应服务条款与许可。真实截图仅裁切、缩放，未重绘活动字段。',CW,9,15,MUTED)
txt(M,564,'证据与素材说明',12,'B')
sources=[
 '[S1] recommendation-ranking-comparison-20260930.json：110 条历史记录、5 组构造画像的离线排序对比。',
 '[S2] interest-expansion-test-20261013.json：合成样本的跨形式路由与评分测试。',
 '[S3] interest-expansion-live-20261013.json 及同日说明：真实检索线索与限制。',
 '[S4] user-activity-20261013.json：早期聚合运行观察，可能包含开发测试。',
 '截图：2026-10-16 自动化真实截图、用户提供的历史截图、2026-10-01 关注页。示意图均另作说明；上述测试记录保留于项目 docs/。'
]
y=592
for s in sources:y=p(M,y,s,CW,8.5,13,MUTED)+7
ln(M,745,553,745);p(M,761,'功能与效果按证据范围表述；正式上线证明、小程序码及报名附件另行核对提交。活动安排仍以主办方最新公告为准。',CW,8.5,14,MUTED,bottom=803)
end()
C.save()
print(str(OUT))
print('PAGES',N)
