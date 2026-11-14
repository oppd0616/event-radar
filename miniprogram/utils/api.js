const { STORAGE_KEYS } = require('./constants')
const feedCache = require('./feed-cache')

const CLOUD_ONLY = ['fetchEvents', 'seedEvents', 'sendSubscribeMessages']
let behaviorLogWarningShown = false
let mockApi = null
let homePrefetch = null

function reportBehaviorLogFailure(result) {
  if (result && result.logged === false && !behaviorLogWarningShown) {
    behaviorLogWarningShown = true
    console.error('[活动雷达] 行为日志写入失败，请检查 behaviorLogs 集合。', result.logError || '')
  }
  return result
}

function callCloud(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data: data || {},
      success: (res) => {
        const result = res.result || {}
        if (result.error) {
          reject(new Error(result.error))
        } else {
          resolve(result)
        }
      },
      fail: reject
    })
  })
}

function call(name, data) {
  const app = getApp()
  const useMock = !app || app.globalData.useMock
  if (useMock && CLOUD_ONLY.indexOf(name) < 0) {
    // 正式环境不解析整套模拟数据；只有明确开启调试模式时才加载
    mockApi = mockApi || require('./mock')
    return mockApi.route(name, data)
  }
  return callCloud(name, data)
}

function getEvents(params) {
  const prefetched = homePrefetch
  if (prefetched && prefetched.version === feedCache.version() && Date.now() - prefetched.at < 10000 &&
      JSON.stringify(params) === prefetched.key) {
    homePrefetch = null
    return prefetched.promise
  }
  return call('getEvents', params)
}

function prefetchHome() {
  const saved = wx.getStorageSync('eventSortMode')
  const sortMode = ['comprehensive', 'time', 'popularity'].includes(saved) ? saved : 'comprehensive'
  const params = { domain:'all', cursor:0, pageSize:20, cardOnly:true, sortMode }
  const entry = {key:JSON.stringify(params), at:Date.now(), version:feedCache.version()}
  entry.promise = callCloud('getEvents', params)
  homePrefetch = entry
  entry.promise.catch(() => { if(homePrefetch === entry) homePrefetch=null })
}

function getEventDetail(id) {
  return call('getEvents', { id })
}

function updatePreference(preferences) {
  feedCache.invalidate()
  const data = Array.isArray(preferences)
    ? { preferredDomains: preferences }
    : (preferences || {})
  return call('updatePreference', data)
}

function updatePrivacy(action, enabled) {
  feedCache.invalidate()
  return call('updatePreference', { privacyAction: action, enabled })
}

function getSubscriptions() {
  return call('getSubscriptions')
}

function addSubscriptionQuota(target) {
  const data = typeof target === 'string' ? { domain: target } : (target || {})
  return call('addSubscriptionQuota', data)
}

function recordSignal(eventId, action, extra) {
  if (['hide', 'dislike', 'location_mismatch', 'undo_feedback', 'follow'].indexOf(action) >= 0) feedCache.invalidate()
  if (wx.getStorageSync(STORAGE_KEYS.personalizationEnabled) === false) {
    return Promise.resolve({ ok: true, skipped: 'personalization_disabled' })
  }
  return call('recordSignal', Object.assign({ eventId, action }, extra || {}))
    .then(reportBehaviorLogFailure)
}

function recordImpressions(eventIds, scene) {
  if (wx.getStorageSync(STORAGE_KEYS.personalizationEnabled) === false) {
    return Promise.resolve({ ok: true, skipped: 'personalization_disabled' })
  }
  return call('recordSignal', { eventIds, action: 'impression', scene: scene || 'home' })
    .then(reportBehaviorLogFailure)
}

module.exports = {
  getFollows: (params) => call('manageFollows', Object.assign({ action: 'status' }, params || {})),
  setFollow: async (eventId, following) => {
    feedCache.invalidate()
    const result = await call('manageFollows', { action: 'set', eventId, following })
    if (following && result.ok) {
      // Saving the follow is complete; recommendation feedback must not block UI.
      recordSignal(result.eventId || eventId, 'follow').catch(error => console.warn('[follow] recommendation feedback unavailable', error.message))
    }
    return result
  },
  markFollowSeen: (eventId, snapshot) => call('manageFollows', { action: 'seen', eventId, snapshot }),
  call,
  prefetchHome,
  getEvents,
  searchEvents: params => call('getEvents', Object.assign({}, params, { search: true })),
  getEventDetail,
  updatePreference,
  updatePrivacy,
  getSubscriptions,
  addSubscriptionQuota,
  recordSignal,
  recordImpressions
}
