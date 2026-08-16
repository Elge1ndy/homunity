const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { log } = require('../services/activity');
const JWT_SECRET = require('../utils/jwt');

function safeUser(u) {
  const { password, ...rest } = u;
  return { ...rest, _id: String(u._id) };
}

exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ message: 'Username and password are required' });
    const user = await db.col('User').findOne({ $or: [{ username: String(identifier).trim() }, { phone: String(identifier).trim() }] });
    if (!user || user.active === false) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: String(user._id) }, JWT_SECRET, { expiresIn: '30d' });
    await log(req, { action: `Login: ${user.name}`, category: 'auth' });
    res.json({ token, user: safeUser(user) });
  } catch (e) {
    next(e);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await db.col('User').findById(req.user._id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    res.json({ user: safeUser(user) });
  } catch (e) {
    next(e);
  }
};
