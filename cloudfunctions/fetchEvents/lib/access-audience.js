// A registration date needs a locally supported audience, not merely a page date.
const roles = {
  exhibitor: /参展商|展商|展位申请|参展报名|参展申请|游戏开发商|exhibitor/i,
  speaker: /讲者|演讲者|嘉宾招募|call for speakers/i,
  submitter: /投稿|征稿|提交作品|call for papers/i,
  participant: /参赛者|选手|考生|跑者|参赛报名|考试报名|马拉松报名|考级报名/i,
  visitor: /观众|游客|玩家|参观预约|观展预约|购票|售票|开票|预售票|参会报名|听众/i
}
const compact = s => String(s || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase()
function allowedRoles(event) {
  // Do not trust the generated participation note to define the audience.
  const title=String(event.title || '')
  if (roles.exhibitor.test(title)) return ['exhibitor']
  if (roles.speaker.test(title)) return ['speaker']
  if (roles.submitter.test(title)) return ['submitter']
  if (event.domain==='sports'||/考试|四六级|教资|马拉松|越野赛|黑客松|hackathon|竞赛|挑战赛/i.test(title)) return ['participant', 'submitter', 'visitor']
  return ['visitor']
}
function assessAccessAudience(event, evidence, dateTokens) {
  if (!evidence) return { status:'unknown', reason:'access_audience_missing_evidence' }
  const tokens=(dateTokens || []).map(compact).filter(Boolean)
  // The registration platform labels this exact race's participant deadline explicitly.
  // Restrict to its primary header; recommendation/footer dates cannot establish scope.
  let racePlatform=false;try{const u=new URL(evidence.link);racePlatform=u.protocol==='https:'&&u.hostname==='reg.zuicool.com'&&/^\/\d+$/.test(u.pathname)}catch{}
  const header=String(evidence.description||'').split(/更多信息|赛事介绍|赛事详情|报名项目/)[0].slice(0,700)
  const deadline=(header.match(/报名截止时间[：:]\s*20\d\d年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/)||[])[0]||''
  if(event.domain==='sports'&&racePlatform&&compact(evidence.title).includes(compact(event.title))&&/赛事日期[：:]/.test(header)&&/赛事地点[：:]/.test(header)&&tokens.some(t=>compact(deadline).includes(t))&&!Object.entries(roles).some(([role,p])=>role!=='participant'&&p.test(header)))return {status:'verified',audience:'participant',quote:header.slice(0,header.indexOf(deadline)+deadline.length),reason:''}

  // Split paragraphs/sentences: a distant exhibitor or visitor section is not evidence.
  const blocks=String(evidence.description || '').split(/[\r\n。；;]+/).map(s=>s.trim()).filter(Boolean)
  const dated=blocks.filter(s=>s.length<=600 && tokens.some(t=>compact(s).includes(t)))
  if (!dated.length) {
    const title=String(evidence.title || '')
    if(tokens.some(t=>compact(title).includes(t))) dated.push(title)
  }
  const candidates=dated.map(quote=>({quote, audiences:Object.keys(roles).filter(role=>roles[role].test(quote))}))
  const audiences=[...new Set(candidates.flatMap(x=>x.audiences))]
  if(audiences.length!==1) return {status:'unknown',reason:audiences.length?'access_audience_ambiguous':'access_audience_unknown',quote:dated[0]||''}
  const audience=audiences[0],quote=candidates.find(x=>x.audiences.includes(audience)).quote
  return {status:allowedRoles(event).includes(audience)?'verified':'mismatch',audience,quote,
    reason:allowedRoles(event).includes(audience)?'':'access_audience_mismatch'}
}
module.exports={assessAccessAudience,allowedRoles}
