const {
  DOMAINS,
  INTEREST_TAXONOMY,
  FORMAT_OPTIONS,
  CITY_OPTIONS,
  GROWTH_GOALS,
  STORAGE_KEYS
} = require('../../utils/constants')
const api = require('../../utils/api')
const CULTURE_TOPIC_KEYS = ['art_exhibition', 'immersive_event', 'brand_popup', 'dessert_cafe', 'design_market', 'nightlife']
const LEGACY_ANIME_TOPIC_KEYS = ['anime_show']

function readStorage(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined || value === null ? fallback : value
  } catch (e) {
    return fallback
  }
}

Page({
  data: {
    step: 1,
    editing: false,
    domains: [],
    activeDomain: '',
    topics: [],
    academicMajorTopics: [],
    academicOpportunityTopics: [],
    selectedTopics: [],
    formats: [],
    cities: [],
    growthGoals: [],
    academicSelected: false,
    selectedDomainCount: 0,
    selectedTopicCount: 0,
    personalizationEnabled: true,
    saving: false
  },

  onLoad(options) {
    const editing = !!(options && options.edit)
    const oldDomains = editing ? readStorage(STORAGE_KEYS.preferredDomains, []).slice() : []
    const oldTopics = editing ? readStorage(STORAGE_KEYS.preferredTopics, []).map((topic) => {
      if (topic && topic.domain === 'ent' && CULTURE_TOPIC_KEYS.indexOf(topic.key) >= 0) {
        return { ...topic, domain: 'culture' }
      }
      if (topic && topic.domain === 'ent' && LEGACY_ANIME_TOPIC_KEYS.indexOf(topic.key) >= 0) {
        return { ...topic, domain: 'anime', key: 'anime_music', label: '动漫音乐会' }
      }
      return topic
    }) : []
    if (oldTopics.some((topic) => topic.domain === 'culture') && !oldDomains.some((item) => item.domain === 'culture')) {
      oldDomains.push({ domain: 'culture', weight: 3 })
    }
    if (oldTopics.some((topic) => topic.domain === 'anime') && !oldDomains.some((item) => item.domain === 'anime')) {
      oldDomains.push({ domain: 'anime', weight: 3 })
    }
    const oldFormats = editing ? readStorage(STORAGE_KEYS.preferredFormats, []) : []
    const oldCities = editing ? readStorage(STORAGE_KEYS.preferredCities, []) : []
    const oldGrowthGoals = editing ? readStorage(STORAGE_KEYS.growthGoals, []) : []
    const personalizationEnabled = readStorage(STORAGE_KEYS.personalizationEnabled, true) !== false
    const domainMap = oldDomains.reduce((acc, item) => {
      acc[item.domain] = item.weight || 3
      return acc
    }, {})
    const selectedTopicKeys = oldTopics.map((item) => item.key)
    const domains = DOMAINS.map((item, index) => ({
      ...item,
      selected: !!domainMap[item.key],
      delay: index * 55
    }))
    const selected = domains.filter((item) => item.selected)
    const activeDomain = selected.length ? selected[0].key : ''
    this.setData({
      editing,
      domains,
      activeDomain,
      selectedTopics: oldTopics,
      formats: FORMAT_OPTIONS.map((item) => ({ ...item, selected: oldFormats.indexOf(item.key) >= 0 })),
      cities: CITY_OPTIONS.map((label) => ({ label, selected: oldCities.indexOf(label) >= 0 })),
      growthGoals: GROWTH_GOALS.map((item) => ({ ...item, selected: oldGrowthGoals.indexOf(item.key) >= 0 })),
      academicSelected: selected.some((item) => item.key === 'academic'),
      selectedDomainCount: selected.length,
      selectedTopicCount: oldTopics.length,
      personalizationEnabled
    })
    if (activeDomain) this.buildTopics(activeDomain, selectedTopicKeys)
  },

  buildTopics(domain, selectedKeys) {
    const selectedMap = (selectedKeys || this.data.selectedTopics.map((item) => item.key))
      .reduce((acc, key) => {
        acc[key] = true
        return acc
      }, {})
    const topics = (INTEREST_TAXONOMY[domain] || []).map((item, index) => ({
      ...item,
      domain,
      selected: !!selectedMap[item.key],
      delay: index * 45
    }))
    this.setData({
      activeDomain: domain,
      topics,
      academicMajorTopics: domain === 'academic' ? topics.filter((item) => item.group === 'major') : [],
      academicOpportunityTopics: domain === 'academic' ? topics.filter((item) => item.group !== 'major') : []
    })
  },

  onDomainTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const domains = this.data.domains.slice()
    const item = domains[index]
    if (!item.selected && this.data.selectedDomainCount >= 3) {
      wx.showToast({ title: '最多选择 3 个主要领域', icon: 'none' })
      return
    }
    item.selected = !item.selected
    const selected = domains.filter((domain) => domain.selected)
    let activeDomain = this.data.activeDomain
    if (!item.selected && activeDomain === item.key) activeDomain = selected.length ? selected[0].key : ''
    if (item.selected) activeDomain = item.key
    const selectedDomainKeys = selected.reduce((acc, domain) => {
      acc[domain.key] = true
      return acc
    }, {})
    const selectedTopics = this.data.selectedTopics.filter((topic) => selectedDomainKeys[topic.domain])
    this.setData({
      domains,
      activeDomain,
      selectedTopics,
      selectedDomainCount: selected.length,
      selectedTopicCount: selectedTopics.length,
      academicSelected: selected.some((domain) => domain.key === 'academic')
    })
    if (activeDomain) this.buildTopics(activeDomain)
  },

  onDomainTabTap(e) {
    this.buildTopics(e.currentTarget.dataset.domain)
  },

  onTopicTap(e) {
    const requestedKey = e.currentTarget.dataset.key
    const topics = this.data.topics.slice()
    const index = requestedKey
      ? topics.findIndex((topic) => topic.key === requestedKey)
      : Number(e.currentTarget.dataset.index)
    if (index < 0) return
    const item = topics[index]
    item.selected = !item.selected
    let selectedTopics = this.data.selectedTopics.filter((topic) => topic.key !== item.key)
    if (item.selected) {
      selectedTopics.push({
        key: item.key,
        label: item.label,
        domain: item.domain,
        weight: item.tier === 'core' ? 3 : 2,
        tier: item.tier,
        score: item.score,
        group: item.group || 'interest'
      })
    }
    this.setData({
      topics,
      academicMajorTopics: this.data.activeDomain === 'academic' ? topics.filter((topic) => topic.group === 'major') : [],
      academicOpportunityTopics: this.data.activeDomain === 'academic' ? topics.filter((topic) => topic.group !== 'major') : [],
      selectedTopics,
      selectedTopicCount: selectedTopics.length
    })
  },

  onFormatTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const formats = this.data.formats.slice()
    formats[index].selected = !formats[index].selected
    this.setData({ formats })
  },

  onCityTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const cities = this.data.cities.slice()
    cities[index].selected = !cities[index].selected
    this.setData({ cities })
  },

  onGrowthGoalTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const growthGoals = this.data.growthGoals.slice()
    growthGoals[index].selected = !growthGoals[index].selected
    this.setData({ growthGoals })
  },

  onPersonalizationChange(e) {
    this.setData({ personalizationEnabled: !!e.detail.value })
  },

  onNext() {
    if (this.data.step === 1 && this.data.selectedDomainCount === 0) return
    if (this.data.step === 2 && this.data.selectedTopicCount === 0) {
      wx.showToast({ title: '至少选择 1 个具体兴趣', icon: 'none' })
      return
    }
    if (this.data.step === 2 && this.data.academicSelected &&
      !this.data.selectedTopics.some((topic) => topic.domain === 'academic' && topic.group === 'major')) {
      wx.showToast({ title: '请选择至少 1 个专业方向', icon: 'none' })
      return
    }
    if (this.data.step < 3) this.setData({ step: this.data.step + 1 })
  },

  onBack() {
    if (this.data.step > 1) this.setData({ step: this.data.step - 1 })
  },

  buildPreferences() {
    const existingWeights = this.data.editing
      ? readStorage(STORAGE_KEYS.preferredDomains, []).reduce((result,item) => {result[item.domain]=item.weight;return result}, {})
      : {}
    return {
      preferredDomains: this.data.domains
        .filter((item) => item.selected)
        .map((item) => ({ domain: item.key, weight: Math.max(1,Math.min(3,Number(existingWeights[item.key]) || 3)) })),
      preferredTopics: this.data.selectedTopics,
      preferredFormats: this.data.formats.filter((item) => item.selected).map((item) => item.key),
      preferredCities: this.data.cities.filter((item) => item.selected).map((item) => item.label),
      growthGoals: this.data.growthGoals.filter((item) => item.selected).map((item) => item.key),
      personalizationEnabled: this.data.personalizationEnabled
    }
  },

  saveLocal(preferences) {
    wx.setStorageSync(STORAGE_KEYS.preferredDomains, preferences.preferredDomains)
    wx.setStorageSync(STORAGE_KEYS.preferredTopics, preferences.preferredTopics)
    wx.setStorageSync(STORAGE_KEYS.preferredFormats, preferences.preferredFormats)
    wx.setStorageSync(STORAGE_KEYS.preferredCities, preferences.preferredCities)
    wx.setStorageSync(STORAGE_KEYS.growthGoals, preferences.growthGoals || [])
    wx.setStorageSync(STORAGE_KEYS.personalizationEnabled, preferences.personalizationEnabled !== false)
    wx.setStorageSync(STORAGE_KEYS.onboardingDone, true)
  },

  async onFinish() {
    const preferences = this.buildPreferences()
    this.setData({ saving: true })
    this.saveLocal(preferences)
    try {
      await api.updatePreference(preferences)
    } catch (err) {
      console.warn('[onboarding] updatePreference failed, saved locally', err)
    }
    this.setData({ saving: false })
    if (this.data.editing) wx.navigateBack()
    else wx.switchTab({ url: '/pages/home/home' })
  },

  async onSkip() {
    if (this.data.saving) return
    const preferences = {
      preferredDomains: [],
      preferredTopics: [],
      preferredFormats: [],
      preferredCities: [],
      growthGoals: [],
      personalizationEnabled: false
    }
    this.setData({ saving: true })
    this.saveLocal(preferences)
    try {
      await api.updatePreference(preferences)
    } catch (e) {
      console.warn('[onboarding] skip preference saved locally', e)
    } finally {
      this.setData({ saving: false })
      if (this.data.editing) wx.navigateBack()
      else wx.switchTab({ url: '/pages/home/home' })
    }
  }
})
