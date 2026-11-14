// Operational documents share the candidate collection, but must never claim
// a candidate's identity (or the unique index's missing/null value).
function usageRecord(month, limit, now) {
  return {
    fingerprint: 'system:api_usage:tencent_wsa:' + month,
    kind: 'api_usage', provider: 'tencent_wsa', status: 'usage', month,
    calls: 1, estimatedUnitPriceCny: 0.046, monthlyLimit: limit,
    createdAt: now, lastCalledAt: now, updatedAt: now
  }
}

function retrievalFailure(wsa, tokenHubResults) {
  if (wsa.provider || tokenHubResults.some(result => result.provider && !result.error)) return null
  const diagnostics = (wsa.errors || []).map(message => ({ provider: 'tencent_wsa', message: String(message).slice(0, 600) }))
    .concat(tokenHubResults.filter(result => result.error).map(result => ({ provider: 'tencent_tokenhub', message: String(result.error).slice(0, 600) })))
  if (!diagnostics.length) return null
  const error = new Error('Detail search unavailable: ' + diagnostics.map(item => item.provider + ': ' + item.message).join(' | '))
  error.code = 'DETAIL_SEARCH_UNAVAILABLE'
  error.diagnostics = diagnostics
  return error
}

function failureState(error, candidate, now) {
  const monthly = error.code === 'WSA_MONTHLY_BUDGET_EXHAUSTED'
  const chinaNow=new Date(now+8*3600000)
  const nextMonth=Date.UTC(chinaNow.getUTCFullYear(),chinaNow.getUTCMonth()+1,1)-8*3600000
  const infrastructure = error.code === 'DETAIL_SEARCH_UNAVAILABLE' || /^WSA_/.test(error.code || '')
  const funding = /http 402|insufficient balance|monthly budget exhausted/i.test(error.message)
  // Retrieval outages are not evidence against the activity and must not use
  // up its retry allowance. Keep it eligible for recovery once service resumes.
  const code = monthly ? 'monthly_search_limit' : infrastructure ? 'detail_search_unavailable' : funding ? 'provider_funding_required' : 'candidate_recheck_failed'
  return {
    status: 'waiting', retryCount: Number(candidate.retryCount || 0) + (infrastructure || funding ? 0 : 1),
    lastErrorCode: code, lastReason: 'recheck_error: ' + String(error.message).slice(0, 1400),
    searchDiagnostics: error.diagnostics || [],
    waitingCategory:monthly?'search_quota':funding?'provider_funding':infrastructure?'search_unavailable':'extraction_failed',
    nextCheckAt: monthly?nextMonth:now + (infrastructure ? 6 : 48) * 3600000, updatedAt: now
  }
}

module.exports = { usageRecord, retrievalFailure, failureState }
