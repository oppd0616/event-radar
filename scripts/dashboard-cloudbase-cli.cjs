const fs = require('fs');
const path = require('path');

// The dashboard owns this runtime; pnpm's disposable cache is not a dependency.
function resolveCli() {
  const file = path.resolve(__dirname, '../tools/event-dashboard/runtime/cloudbase/bin/tcb');
  if (!fs.existsSync(file)) {
    throw Object.assign(new Error('Dashboard CloudBase runtime is missing'), { code: 'MODULE_NOT_FOUND' });
  }
  return file;
}
module.exports = { resolveCli };
