const { DOMAINS, INTEREST_TAXONOMY, STORAGE_KEYS } = require('../../utils/constants')
const api = require('../../utils/api')
const SYNC_PENDING_KEY = 'preferenceSyncPending'
const MAX_TOPICS = 36

function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined || value === null ? fallback : value
  } catch (e) { return fallback }
}

function identity(topic) { return String(topic.domain || '') + ':' + String(topic.key || '') }

Page({
  data: {
    domainTabs: [],
    activeDomain: '',
    topicOptions: [],
    majorOptions: [],
    otherOptions: [],
    selectedTopics: [],
    selectedViews: [],
    dirty: false,
    syncPending: false,
    saving: false
  },

  onLoad() {
    const preferences = read(STORAGE_KEYS.preferredDomains, [])
    const savedTopics = read(STORAGE_KEYS.preferredTopics, [])
    const domains = Array.isArray(preferences) ? preferences.filter(item => item && Number(item.weight) > 0).map(item => item.domain) : []
    const domainTabs = DOMAINS.filter(item => domains.indexOf(item.key) >= 0)
    const selectedTopics = Array.isArray(savedTopics) ? savedTopics.filter(item => item && item.domain && item.key).map(item => Object.assign({},item)) : []
    this.originalSignature = selectedTopics.map(identity).sort().join('|')
    const activeDomain = domainTabs[0] ? domainTabs[0].key : ''
    this.setData({domainTabs,activeDomain,selectedTopics,syncPending:!!read(SYNC_PENDING_KEY,false)})
    this.refreshSelection()
  },

  refreshSelection() {
    const selectedTopics = this.data.selectedTopics
    const chosen = selectedTopics.reduce((map,item) => {map[identity(item)]=true;return map}, {})
    const activeDomain = this.data.activeDomain
    const topicOptions = (INTEREST_TAXONOMY[activeDomain] || []).map(item => Object.assign({},item,{
      domain:activeDomain,
      selected:!!chosen[activeDomain + ':' + item.key]
    }))
    const labels = DOMAINS.reduce((map,item) => {map[item.key]=item.label;return map}, {})
    const selectedViews = selectedTopics.map(item => ({...item,id:identity(item),label:item.label || ((INTEREST_TAXONOMY[item.domain] || []).find(option => option.key === item.key) || {}).label || item.key,domainLabel:labels[item.domain] || ''}))
    this.setData({topicOptions,majorOptions:topicOptions.filter(item => item.group === 'major'),otherOptions:topicOptions.filter(item => item.group !== 'major'),selectedViews,dirty:selectedTopics.map(identity).sort().join('|') !== this.originalSignature})
  },

  onDomainTap(e) {
    const domain = e.currentTarget.dataset.domain
    if (!this.data.domainTabs.some(item => item.key === domain)) return
    this.setData({activeDomain:domain})
    this.refreshSelection()
  },

  onTopicTap(e) {
    if (this.data.saving) return
    const domain = e.currentTarget.dataset.domain
    const key = e.currentTarget.dataset.key
    const id = domain + ':' + key
    const selectedTopics = this.data.selectedTopics.slice()
    const index = selectedTopics.findIndex(item => identity(item) === id)
    if (index >= 0) selectedTopics.splice(index,1)
    else {
      if (selectedTopics.length >= MAX_TOPICS) {
        wx.showToast({title:'最多选择 36 个主题',icon:'none'})
        return
      }
      const option = (INTEREST_TAXONOMY[domain] || []).find(item => item.key === key)
      if (!option || !this.data.domainTabs.some(item => item.key === domain)) return
      selectedTopics.push({key:option.key,label:option.label,domain,weight:option.tier === 'core' ? 3 : 2,tier:option.tier,score:option.score,group:option.group || 'interest'})
    }
    this.setData({selectedTopics})
    this.refreshSelection()
  },

  async onSave() {
    if (this.data.saving) return
    if (!this.data.dirty && !this.data.syncPending) { wx.navigateBack();return }
    const preferredDomains = read(STORAGE_KEYS.preferredDomains, [])
    const selectedTopics = this.data.selectedTopics
    this.setData({saving:true})
    wx.setStorageSync(STORAGE_KEYS.preferredTopics,selectedTopics)
    wx.setStorageSync(SYNC_PENDING_KEY,true)
    try {
      await api.updatePreference({
        preferredDomains,
        preferredTopics:selectedTopics,
        preferredFormats:read(STORAGE_KEYS.preferredFormats, []),
        preferredCities:read(STORAGE_KEYS.preferredCities, []),
        growthGoals:read(STORAGE_KEYS.growthGoals, [])
      })
      wx.removeStorageSync(SYNC_PENDING_KEY)
      wx.showToast({title:'兴趣已保存',icon:'success'})
    } catch (err) {
      wx.showToast({title:'已保存在本机，请稍后同步',icon:'none'})
    } finally {
      this.setData({saving:false})
      wx.navigateBack()
    }
  }
})
