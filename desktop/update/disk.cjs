// Electron's fs treats app.asar as a virtual directory. Application backups
// and recursive deletion must operate on the physical archive file instead.
try { module.exports = require('original-fs'); }
catch { module.exports = require('node:fs'); }
