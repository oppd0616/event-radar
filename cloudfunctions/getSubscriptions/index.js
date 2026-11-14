const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { error: 'login required' }
  const [res, userRes] = await Promise.all([
    db.collection('subscriptions')
      .where({ _openid: OPENID })
      .limit(50)
      .get(),
    db.collection('users').where({ _openid: OPENID }).limit(1).get()
  ])
  const user = userRes.data[0] || {}
  return {
    list: res.data,
    personalizationEnabled: user.personalizationEnabled !== false
  }
}
