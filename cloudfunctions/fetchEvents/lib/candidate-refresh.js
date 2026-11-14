const { refreshPlan } = require('./recurring-refresh')
const DAY = 86400000
// An extraction failure is not evidence that an activity is invalid.
function candidateRefresh({ candidate, now, completed, obsolete, retryCount }) {
  if (completed || obsolete) return { terminal: true, nextCheckAt: 0 }
  const start = Date.parse(candidate.suggestedStartTime || '')
  const urgent = Number.isFinite(start) && start >= now && start - now <= 14 * DAY
  const recurring = refreshPlan(candidate, now)
  const interval = recurring.policy ? (urgent ? DAY : recurring.interval)
    : retryCount < 3 ? (retryCount === 1 ? DAY : 2 * DAY) : urgent ? 2 * DAY : 7 * DAY
  return { terminal: false, nextCheckAt: now + interval }
}
module.exports = { candidateRefresh }
