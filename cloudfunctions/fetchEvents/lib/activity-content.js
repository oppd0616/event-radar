// Remove explicitly marked recommendation/footer sections for classification.
// Original evidence stays untouched for date/source validation.
function activityContent(item) {
  const text = String(item && item.description || '')
  const marker = /(?:^|\n)\s*(?:相关推荐|推荐阅读|相关阅读|猜你喜欢|热门推荐|related articles|recommended reading)\s*[:：]?|推荐阅读[:：]/i
  const match = marker.exec(text)
  return match ? text.slice(0, match.index) : text
}
module.exports = { activityContent }
