// Projection happens AFTER recall, dedupe, lifecycle and personalized ranking.
// The full event remains available via the detail endpoint.
function feedCard(event) {
  const keys = ['_id', 'canonicalEventId', 'canonicalKey', 'identityMembers', 'title', 'displayTitle',
    'domain', 'city', 'sessionKey', 'startTime', 'endTime', 'timePrecision', 'endTimePrecision',
    'scheduleWindowLabel', 'confidence', 'isHot', 'recommendReason', 'currentStageKey',
    'currentStageName', 'currentStageState', 'openingState']
  const card = { _cardOnly: true }
  for (const key of keys) if (event[key] !== undefined) card[key] = event[key]
  card.participation = { type: event.participation && event.participation.type, note: event.participation && event.participation.note || '' }
  card.participationOptions = (event.participationOptions || []).filter(option => option && option.type === 'livestream').map(() => ({ type: 'livestream' }))
  card.source = { name: event.source && event.source.name || '', url: event.source && event.source.url || '' }
  return card
}
module.exports = { feedCard }
