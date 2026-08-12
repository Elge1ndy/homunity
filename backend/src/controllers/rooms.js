const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');

exports.list = async (req, res, next) => {
  try {
    const rooms = await db.col('Room').find({}, { number: 1 });
    res.json({ rooms });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const room = await db.col('Room').findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' });
    res.json({ room });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { number, type, capacity, monthlyRent, floor, status, notes } = req.body;
    if (!number) return res.status(400).json({ message: 'رقم الغرفة مطلوب' });
    if (!capacity || Number(capacity) < 1) return res.status(400).json({ message: 'سعة غير صحيحة' });
    const exists = await db.col('Room').findOne({ number: String(number).trim() });
    if (exists) return res.status(400).json({ message: 'يوجد غرفة بنفس الرقم' });
    const beds = [];
    for (let i = 1; i <= Number(capacity); i++) beds.push({ bedNumber: i, studentId: null });
    const room = await db.col('Room').insert({
      number: String(number).trim(),
      type: type || 'shared',
      capacity: Number(capacity),
      monthlyRent: Number(monthlyRent) || 0,
      floor: floor || '',
      status: status || 'active',
      beds,
      notes: notes || '',
    });
    await log(req, { action: `تمت إضافة غرفة ${room.number}`, category: 'rooms', targetType: 'room', targetId: room._id });
    emit(req, 'room:updated', {});
    res.json({ room });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await db.col('Room').findById(id);
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' });
    const { number, type, monthlyRent, floor, status, capacity, notes } = req.body;
    const set = {};
    if (number !== undefined) {
      const dup = await db.col('Room').findOne({ number: String(number).trim() });
      if (dup && String(dup._id) !== String(id)) return res.status(400).json({ message: 'يوجد غرفة بنفس الرقم' });
      set.number = String(number).trim();
    }
    if (type !== undefined) set.type = type;
    if (monthlyRent !== undefined) set.monthlyRent = Number(monthlyRent);
    if (floor !== undefined) set.floor = floor;
    if (status !== undefined) set.status = status;
    if (notes !== undefined) set.notes = notes;
    if (capacity !== undefined && Number(capacity) !== room.capacity) {
      const newCap = Number(capacity);
      const occupied = (room.beds || []).filter((b) => b.studentId).length;
      if (newCap < occupied) return res.status(400).json({ message: `لا يمكن تقليل السعة، الغرفة فيها ${occupied} طالب` });
      const beds = [];
      for (let i = 1; i <= newCap; i++) {
        const existing = (room.beds || []).find((b) => b.bedNumber === i);
        beds.push(existing ? { ...existing } : { bedNumber: i, studentId: null });
      }
      set.beds = beds;
      set.capacity = newCap;
    }
    const updated = await db.col('Room').findByIdAndUpdate(id, { $set: set });
    await log(req, { action: `تم تعديل غرفة ${updated.number}`, category: 'rooms', targetType: 'room', targetId: id });
    emit(req, 'room:updated', {});
    res.json({ room: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await db.col('Room').findById(id);
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' });
    const occupied = (room.beds || []).filter((b) => b.studentId).length;
    if (occupied > 0) return res.status(400).json({ message: 'لا يمكن حذف غرفة بها طلاب' });
    await db.col('Room').deleteById(id);
    await log(req, { action: `تم حذف غرفة ${room.number}`, category: 'rooms', targetType: 'room', targetId: id });
    emit(req, 'room:updated', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
