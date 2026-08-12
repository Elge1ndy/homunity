const db = require('../db');
const emit = require('../utils/realtime');

exports.list = async (req, res, next) => {
  try {
    const notifications = await db.col('Notification').find({}, { createdAt: -1 });
    const out = notifications.map((n) => {
      const read = (n.readBy || []).includes(String(req.user._id));
      return { ...n, _id: String(n._id), read };
    });
    res.json({ notifications: out });
  } catch (e) {
    next(e);
  }
};

exports.unreadCount = async (req, res, next) => {
  try {
    const notifications = await db.col('Notification').find({});
    const count = notifications.filter((n) => !(n.readBy || []).includes(String(req.user._id))).length;
    res.json({ count });
  } catch (e) {
    next(e);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const n = await db.col('Notification').findById(id);
    if (n) {
      const readBy = (n.readBy || []).filter((x) => x !== String(req.user._id)).concat(String(req.user._id));
      await db.col('Notification').findByIdAndUpdate(id, { $set: { readBy } });
    }
    emit(req, 'notification:read', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const notifications = await db.col('Notification').find({});
    for (const n of notifications) {
      const readBy = (n.readBy || []).filter((x) => x !== String(req.user._id)).concat(String(req.user._id));
      await db.col('Notification').findByIdAndUpdate(n._id, { $set: { readBy } });
    }
    emit(req, 'notification:read', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
