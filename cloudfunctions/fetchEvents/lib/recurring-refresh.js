// These are search attention windows, NEVER inferred dates for an occurrence.
// Only explicitly recognised recurring series opt in; generic exams/contests
// retain normal discovery so new or irregular activities aren't suppressed.
const DAY = 86400000
const POLICIES = [
  { key: 'cet', pattern: /英语.*四.*六级|四六级|大学英语四级|大学英语六级|\bCET[ -]?[46]\b/i, months: [3, 5, 6, 9, 11, 12] },
  { key: 'ntce', pattern: /中小学教师资格考试|教师资格考试|教资考试/, months: [1, 3, 4, 5, 7, 9, 11, 12] },
  { key: 'postgraduate', pattern: /全国硕士研究生招生考试/, months: [9, 10, 11, 12] }
]
function refreshPlan(record, now, error) {
  if (error) return { interval: DAY / 24, reason: 'error_retry' }
  const policy = record && record.domain === 'academic' && POLICIES.find(p => p.pattern.test(String(record.name || record.title || '')))
  if (!policy) return { interval: DAY, reason: 'normal' }
  const month = new Date(now + 8 * 3600000).getUTCMonth() + 1
  // A weekly check is enough to discover announcements; detailed deadlines
  // remain handled by the existing candidate/event refresh pipeline.
  const active = policy.months.includes(month)
  let next = now + (active ? 7 : 30) * DAY
  // Don't let a monthly cooldown skip the next attention window.
  for (let days = 1; days <= 30; days++) {
    const t = now + days * DAY
    if (!active && policy.months.includes(new Date(t + 8 * 3600000).getUTCMonth() + 1)) { next = Math.min(next, t); break }
  }
  return { interval: next - now, reason: active ? 'recurring_announcement_window' : 'recurring_quiet_window', policy: policy.key }
}
module.exports = { refreshPlan }
