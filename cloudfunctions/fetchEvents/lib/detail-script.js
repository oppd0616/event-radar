const OpenCC = require('opencc-js')

const hkToCn = OpenCC.Converter({ from: 'hk', to: 'cn' })
const twToCn = OpenCC.Converter({ from: 'tw', to: 'cn' })

function detailSearchText(value) {
  return twToCn(hkToCn(String(value == null ? '' : value)))
}

module.exports = { detailSearchText }
