const fs = require('fs');
const path = require('path');
const paths = require('../utils/paths');

module.exports = function errorHandler(err, req, res, next) {
  console.error('[error]', err);
  try {
    const logDir = paths.dir('logs');
    const line =
      '[' + new Date().toISOString() + '] ' + (req && req.method + ' ' + (req.originalUrl || req.url)) + '\n' +
      (err && (err.stack || err.message || String(err))) + '\n\n';
    fs.appendFileSync(path.join(logDir, 'errors.log'), line);
  } catch {}
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'حجم الملف أكبر من المسموح' });
  }
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ message: err.message });
  }
  if (err && err.name === 'EntityTooLarge') {
    return res.status(400).json({ message: 'البيانات أكبر من المسموح' });
  }
  if (err && err.code === 11000) {
    return res.status(400).json({ message: 'بيانات مكررة (الرقم مستخدم بالفعل)' });
  }
  if (err && err.status === 400 && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'البيانات المرسلة غير صالحة' });
  }
  if (err && err.status && typeof err.status === 'number') {
    return res.status(err.status).json({ message: err.message || 'خطأ' });
  }
  res.status(500).json({ message: 'حدث خطأ في الخادم' });
};
