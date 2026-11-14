// Keep this policy identical in each independently deployed client/function.
function requiresExactEventTime(event) {
  const ev = event || {}
  const participation = ev.participation || {}
  const title = String(ev.title || '')
  const hasLivestream = participation.type === 'livestream' ||
    (Array.isArray(ev.participationOptions) && ev.participationOptions.some((option) => option && option.type === 'livestream')) ||
    /直播|livestream|live stream|webcast/i.test(title)
  if (hasLivestream) return true
  const onlineCity = /^(?:线上|線上|在线|網上|网络|網絡|virtual|online)$/i.test(String(ev.city || '').trim())
  return onlineCity && /讲座|講座|研讨会|研討會|网络会议|網絡會議|webinar|线上考试|線上考試|在线考试|在線考試/i.test(title)
}

module.exports = { requiresExactEventTime }
