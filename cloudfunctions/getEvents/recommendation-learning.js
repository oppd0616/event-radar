// Shared source: distribute with scripts/sync-recommendation-learning.cjs.
const VERSION = 2
const STRONG_ACTIONS = new Set(['follow', 'remind', 'official_click', 'share', 'dislike'])
const FEEDBACK_ACTIONS = new Set(['hide', 'dislike', 'location_mismatch'])
const ACTION_WEIGHTS = { view: 0.15, dwell: 0.4, official_click: 3, follow: 5, remind: 5, share: 2, dislike: -4, hide: 0, location_mismatch: 0, undo_feedback: 0, impression: 0 }
const clamp = n => Math.max(-6, Math.min(12, n))
function signalWeight(signal) {
  if (signal.action === 'dwell') return Number(signal.durationMs) >= 30000 ? 0.6 : Number(signal.durationMs) >= 10000 ? 0.3 : 0
  return ACTION_WEIGHTS[signal.action] || 0
}
function decay(weights, at, now) {
  const factor = Math.pow(0.5, Math.max(0, now - (Number(at) || now)) / (30 * 86400000))
  return Object.fromEntries(Object.entries(weights || {}).map(([k,v]) => [k, Number(((Number(v) || 0) * factor).toFixed(3))]).filter(([,v]) => Math.abs(v) >= 0.05))
}
function applyStrong(state, signal, weight) {
  // Negative topic feedback does not imply dislike of the whole domain.
  if (signal.domain && signal.action !== 'dislike') state.learnedDomainWeights[signal.domain] = clamp((state.learnedDomainWeights[signal.domain] || 0) + weight * 0.12)
  for (const tag of signal.tags || []) state.learnedTopicWeights[tag] = clamp((state.learnedTopicWeights[tag] || 0) + weight * 0.5)
  for (const key of signal.topicKeys || []) state.learnedTopicKeyWeights[key] = clamp((state.learnedTopicKeyWeights[key] || 0) + weight)
}
function learningState(user, now) {
  const state = { learnedTopicWeights: {}, learnedTopicKeyWeights: {}, learnedDomainWeights: {} }
  if (Number(user.learningVersion) >= VERSION) {
    for (const key of Object.keys(state)) state[key] = decay(user[key], user.learningUpdatedAt, now)
    return state
  }
  // Old weights included every browse. Reconstruct only strong evidence;
  // explicit preferences and follow records remain untouched.
  const seen = new Set()
  for (const signal of user.recentSignals || []) {
    if (!STRONG_ACTIONS.has(signal.action) || !signal.at || now - signal.at > 90 * 86400000) continue
    const key = signal.eventId + '|' + signal.action + '|' + Math.floor(signal.at / 86400000)
    if (seen.has(key)) continue
    seen.add(key)
    applyStrong(state, signal, signalWeight(signal) * Math.pow(0.5, Math.max(0,now-signal.at)/(30*86400000)))
  }
  return state
}
function updateLearning(user, signal, now, expectedFeedbackAt) {
  const recent = Array.isArray(user.recentSignals) ? user.recentSignals : []
  const state = learningState(user, now)
  if (signal.action === 'undo_feedback') {
    const hit = recent.find(s => s.eventId === signal.eventId && FEEDBACK_ACTIONS.has(s.action) && now-s.at <= 60000 && Number(s.at) === Number(expectedFeedbackAt))
    if (!hit) return { duplicated: true }
    if (hit.action === 'dislike') {
      const factor = Math.pow(0.5,(now-hit.at)/(30*86400000))
      if (hit.learningDeltas) {
        for (const [map,deltas] of Object.entries(hit.learningDeltas)) for (const [key,delta] of Object.entries(deltas)) state[map][key] = clamp((state[map][key] || 0) - delta*factor)
      } else applyStrong(state, hit, -signalWeight(hit)*factor)
    }
    return { duplicated: false, weight: 0, data: {...state, recentSignals: recent.filter(s => s !== hit), learningVersion: VERSION, learningUpdatedAt: now, lastActiveAt: now, updatedAt: now} }
  }
  const duplicateWindow = signal.action === 'view' ? 10*60000 : 30*60000
  if (recent.some(s => s.eventId === signal.eventId && s.action === signal.action && now-s.at < duplicateWindow)) return { duplicated: true }
  const weight = signalWeight(signal)
  const before = signal.action === 'dislike' ? JSON.parse(JSON.stringify(state)) : null
  if (STRONG_ACTIONS.has(signal.action)) applyStrong(state, signal, weight)
  if (before) signal = {...signal, learningDeltas:Object.fromEntries(Object.keys(state).map(map=>[map,Object.fromEntries(Object.keys(state[map]).map(key=>[key,(state[map][key] || 0)-(before[map][key] || 0)]).filter(([,delta])=>delta))]))}
  return { duplicated: false, weight, data: {...state, recentSignals: [{...signal, at: now, learningVersion: VERSION}].concat(recent).slice(0,60), learningVersion: VERSION, learningUpdatedAt: now, lastActiveAt: now, updatedAt: now} }
}
module.exports = { VERSION, ACTION_WEIGHTS, STRONG_ACTIONS, FEEDBACK_ACTIONS, signalWeight, learningState, updateLearning }
