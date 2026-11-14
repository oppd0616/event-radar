const { isFollowed } = require('../../utils/follows')
Component({
  data: { following: false },
  observers: {
    'event, followRecords': function(event, records) { this.setData({ following: isFollowed(event || {}, records) }) }
  },
  properties: {
    followPulse: { type: Boolean, value: false },
    showMore: { type: Boolean, value: true },
    followBusy: { type: Boolean, value: false },
    followDisabled: { type: Boolean, value: false },
    followRecords: { type: Array, value: [] },
    event: {
      type: Object,
      value: {}
    },
    meta: {
      type: Object,
      value: {}
    },
    countdownText: {
      type: String,
      value: ''
    },
    timeText: {
      type: String,
      value: ''
    },
    ctaText: {
      type: String,
      value: '查看详情'
    }
  },

  methods: {
    onFollowTap() {
      if (this.data.followBusy || this.data.followDisabled) return
      this.triggerEvent('follow', { event: this.data.event, following: !this.data.following })
    },
    onTap() {
      this.triggerEvent('tap', { id: this.data.event._id, event: this.data.event })
    },

    onCtaTap() {
      this.triggerEvent('cta', { id: this.data.event._id, event: this.data.event })
    },

    onMoreTap() {
      this.triggerEvent('more', { id: this.data.event._id, event: this.data.event })
    }
  }
})
