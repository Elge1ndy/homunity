const db = require('../db');

async function log(req, { action, category, targetType, targetId, details }) {
  const user = req.user || {};
  return db.col('ActivityLog').insert({
    adminId: String(user._id || ''),
    adminName: user.name || '',
    action: action || '',
    category: category || 'general',
    targetType: targetType || '',
    targetId: targetId ? String(targetId) : '',
    details: details || '',
  });
}

module.exports = { log };
