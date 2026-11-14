// Product suitability is separate from access-deadline audience classification.
// Examine this event's normalized fields only, never unrelated page/footer text.
const VERSION = '2026-10-30.1'
function assessProductAudience(event = {}) {
  const title = String(event.title || '')
  const guide = event.participationGuide || {}
  const restrictions = [guide.eligibility, guide.entryRules].filter(Boolean).join('；')
  const evidence = []
  const result = (decision, audience, reason) => ({ version: VERSION, decision, audience, reason, evidence })
  const restricted = /(?:仅限|只限|只接受|必须为|须为)(?:\s*)(?:亲子家庭|幼儿|学龄前儿童|小学生|老年人|退休人员)|(?:必须|须|需)(?:由)?(?:家长|父母|监护人)(?:陪同儿童|与儿童共同|携带儿童)|(?:儿童|幼儿)(?:必须|须|需)(?:由)?(?:家长|监护人)陪同/
  const match = restrictions.split(/[；;。\n]/).filter(text => !/并非|并不|不要求|无需|不必|不限于|不仅限|不只限/.test(text)).join('；').match(restricted)
  // Mixed groups cannot be decided from one group's restriction.
  const mixed = /个人组|个人参赛|成人组|大众组|公开组|亲子组|成人可独立|不限年龄/.test([restrictions, guide.price].join('；'))
  if (match && !mixed) {
    evidence.push({ field: 'participationGuide', quote: match[0] })
    return result('exclude', 'other_primary_audience', 'explicit_audience_restriction')
  }
  if (/亲子|幼儿|儿童专场|少儿|银发|老年|退休人员/.test(title)) {
    evidence.push({ field: 'title', quote: title })
    return result('review', 'family_or_other_audience', mixed ? 'mixed_groups_need_review' : 'primary_audience_needs_review')
  }
  return result('allow', 'general_or_unspecified', 'no_explicit_audience_mismatch')
}
module.exports = { VERSION, assessProductAudience }
