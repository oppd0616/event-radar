const { isFollowed, updateFollowRecords } = require('./follows')

// Preview the local state immediately; only a successful write confirms it.
async function toggleListFollow(page, event, api, ui, requestedFollowing) {
  if (page.followBusy || !event || !event._id) return
  // Capture the visible button's intent before any asynchronous status refresh.
  const following = typeof requestedFollowing === 'boolean'
    ? requestedFollowing : !isFollowed(event, page.data.followRecords || [])
  page.followBusy = true
  page.followRequest = (page.followRequest || 0) + 1
  page.setData({ followBusyId: event._id })
  let before
  try {
    if (!page.followReady) {
      const status = await api.getFollows()
      if (page.unloaded) return
      page.setData({ followRecords: status.records || [] })
      page.followReady = true
    }
    if (page.unloaded) return
    before = page.data.followRecords || []
    page.followRequest = (page.followRequest || 0) + 1
    clearTimeout(page.followPulseTimer)
    page.setData({ followRecords: updateFollowRecords(event, before, following), followPulseId: following ? event._id : '' })
    page.followPulseTimer = setTimeout(() => { if (!page.unloaded) page.setData({ followPulseId: '' }) }, 220)
    const result = await api.setFollow(event._id, following)
    if (result.ok === false) throw new Error(result.error || '操作失败')
    page.followRequest = (page.followRequest || 0) + 1
    if (!page.unloaded) page.setData({ followRecords: updateFollowRecords(event, before, following, result.eventId) })
  } catch (error) {
    page.followRequest = (page.followRequest || 0) + 1
    if (!page.unloaded) {
      if (before) page.setData({ followRecords: before, followPulseId: '' })
      ui.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
    }
  } finally {
    page.followBusy = false
    if (!page.unloaded) page.setData({ followBusyId: '' })
  }
}

module.exports = { toggleListFollow }
