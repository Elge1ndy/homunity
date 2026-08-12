const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');

exports.get = async (req, res, next) => {
  try {
    const housing = await db.col('Housing').findOne({});
    res.json({ housing });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name, address, phone, description, services, rules, dueDay, currency } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (address !== undefined) set.address = address;
    if (phone !== undefined) set.phone = phone;
    if (description !== undefined) set.description = description;
    if (services !== undefined) set.services = services;
    if (rules !== undefined) set.rules = rules;
    if (dueDay !== undefined) set.dueDay = Math.min(Math.max(Number(dueDay) || 1, 1), 28);
    if (currency !== undefined) set.currency = currency;
    let housing = await db.col('Housing').findOne({});
    if (housing) {
      housing = await db.col('Housing').findByIdAndUpdate(housing._id, { $set: set });
    } else {
      housing = await db.col('Housing').insert({ ...set, images: [] });
    }
    await log(req, { action: 'تم تعديل بيانات السكن', category: 'housing', targetType: 'housing', targetId: housing._id });
    emit(req, 'housing:updated', { housing });
    res.json({ housing });
  } catch (e) {
    next(e);
  }
};

exports.uploadImages = async (req, res, next) => {
  try {
    const files = req.files || [];
    const urls = files.map((f) => `/uploads/images/${f.filename}`);
    let housing = await db.col('Housing').findOne({});
    if (housing) {
      const images = (housing.images || []).concat(urls);
      housing = await db.col('Housing').findByIdAndUpdate(housing._id, { $set: { images } });
    }
    res.json({ urls, housing });
  } catch (e) {
    next(e);
  }
};

exports.removeImage = async (req, res, next) => {
  try {
    const { url } = req.body;
    let housing = await db.col('Housing').findOne({});
    if (housing) {
      const images = (housing.images || []).filter((i) => i !== url);
      housing = await db.col('Housing').findByIdAndUpdate(housing._id, { $set: { images } });
    }
    res.json({ housing });
  } catch (e) {
    next(e);
  }
};
