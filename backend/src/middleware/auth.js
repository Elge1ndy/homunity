const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'غير مصرح' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.col('User').findById(payload.id);
    if (!user || user.active === false) return res.status(401).json({ message: 'غير مصرح' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'انتهت الجلسة' });
  }
};
