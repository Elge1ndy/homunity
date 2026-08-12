const db = require('../db');

exports.list = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const category = req.query.category || '';
    const filter = category ? { category } : {};
    const activity = await db.col('ActivityLog').find(filter, { createdAt: -1 });
    res.json({ activity: activity.slice(0, limit) });
  } catch (e) {
    next(e);
  }
};
