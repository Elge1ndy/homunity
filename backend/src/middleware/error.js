module.exports = function errorHandler(err, req, res, next) {
  console.error('[error]', err);
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
  res.status(500).json({ message: 'حدث خطأ في الخادم' });
};
