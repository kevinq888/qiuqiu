// Read-only catalogue stays in the package; mutable files belong to userData.
const path = require('node:path');
const dataDir = process.env.QIUQIU_DATA_DIR || path.join(__dirname, '..', 'data');
module.exports = { dataDir };
