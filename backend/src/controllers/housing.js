const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const { saveUploaded } = require('../middleware/upload');

exports.get = async (req, res, next) => {
  try {
    const housing = await db.col('Housing').findOne({});
    res.json({ housing });
  } catch (e) {
    next(e);
  }
};

exports.public = async (req, res, next) => {
  try {
    const housing = await db.col('Housing').findOne({});
    res.json({
      housing: housing
        ? { name: housing.name || '', watermark: housing.watermark || '', logo: housing.logo || '', images: housing.images || [] }
        : null,
    });
  } catch (e) {
    next(e);
  }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    const f = req.file;
    if (!f) return res.status(400).json({ message: 'ارفع صورة الشعار أولًا' });
    const logo = await saveUploaded(f, 'images', 'logo');
    let housing = await db.col('Housing').findOne({});
    if (housing) {
      housing = await db.col('Housing').findByIdAndUpdate(housing._id, { $set: { logo } });
    } else {
      housing = await db.col('Housing').insert({ logo, images: [] });
    }
    await log(req, { action: 'تحديث شعار البرنامج', category: 'housing', targetType: 'housing', targetId: housing._id });
    emit(req, 'housing:updated', { housing });
    res.json({ housing });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name, address, phone, description, services, rules, dueDay, currency, watermark, logo } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (address !== undefined) set.address = address;
    if (phone !== undefined) set.phone = phone;
    if (description !== undefined) set.description = description;
    if (services !== undefined) set.services = services;
    if (rules !== undefined) set.rules = rules;
    if (dueDay !== undefined) set.dueDay = Math.min(Math.max(Number(dueDay) || 1, 1), 28);
    if (currency !== undefined) set.currency = currency;
    if (watermark !== undefined) set.watermark = String(watermark).trim();
    if (logo !== undefined) set.logo = logo === '' ? '' : String(logo);
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
    const urls = [];
    for (const f of files) urls.push(await saveUploaded(f, 'images', 'img'));
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
