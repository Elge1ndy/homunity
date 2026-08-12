const db = require('../db');

async function create({ type, title, message, data }) {
  return db.col('Notification').insert({
    type: type || 'general',
    title: title || '',
    message: message || '',
    data: data || {},
    readBy: [],
  });
}

module.exports = { create };
