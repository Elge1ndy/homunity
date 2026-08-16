const bcrypt = require('bcryptjs');
const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');

const defaultPerms = {
  students: true,
  rooms: true,
  beds: true,
  payments: true,
  invoices: true,
  reports: true,
  notifications: true,
  activity: true,
  settings: true,
  export: true,
};

function safe(u) {
  const { password, ...rest } = u;
  return { ...rest, _id: String(u._id) };
}

exports.list = async (req, res, next) => {
  try {
    const admins = await db.col('User').find({});
    res.json({ admins: admins.map(safe) });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, username, phone, password, permissions } = req.body;
    if (!name || !username || !password) return res.status(400).json({ message: 'Name, username, and password are required' });
    const exists = await db.col('User').findOne({ $or: [{ username: String(username).trim() }, { phone: String(phone || '').trim() }] });
    if (exists) return res.status(400).json({ message: 'Username or phone number already in use' });
    const hash = await bcrypt.hash(String(password), 10);
    const user = await db.col('User').insert({
      name: String(name).trim(),
      username: String(username).trim(),
      phone: String(phone || '').trim(),
      password: hash,
      role: 'admin',
      permissions: permissions || { ...defaultPerms },
      active: true,
    });
    await log(req, { action: `Added admin: ${user.name}`, category: 'admins', targetType: 'admin', targetId: user._id });
    emit(req, 'admin:updated', {});
    res.json({ admin: safe(user) });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, username, phone, password, permissions, active } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (username !== undefined) set.username = username;
    if (phone !== undefined) set.phone = phone;
    if (password) set.password = await bcrypt.hash(String(password), 10);
    if (permissions) set.permissions = permissions;
    if (active !== undefined) set.active = active;
    const admin = await db.col('User').findByIdAndUpdate(id, { $set: set });
    if (!admin) return res.status(404).json({ message: 'Not found' });
    await log(req, { action: `Updated admin: ${admin.name}`, category: 'admins', targetType: 'admin', targetId: admin._id });
    emit(req, 'admin:updated', {});
    res.json({ admin: safe(admin) });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const count = await db.col('User').count({});
    if (count <= 1) return res.status(400).json({ message: 'Cannot delete the last admin' });
    const admin = await db.col('User').findById(id);
    if (!admin) return res.status(404).json({ message: 'Not found' });
    if (String(admin._id) === String(req.user._id)) return res.status(400).json({ message: 'Cannot delete your own account' });
    await db.col('User').deleteById(id);
    await log(req, { action: `Deleted admin: ${admin.name}`, category: 'admins', targetType: 'admin', targetId: id });
    emit(req, 'admin:updated', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
