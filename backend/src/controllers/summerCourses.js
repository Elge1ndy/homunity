const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const notifications = require('../services/notifications');
const structure = require('../services/structure');

const { genId, money, overlap } = structure;

function fmt(d) {
  return String(d || '').slice(0, 10);
}

function monthsBetween(from, to) {
  if (!from || !to) return 0;
  const a = new Date(fmt(from) + 'T00:00:00');
  const b = new Date(fmt(to) + 'T00:00:00');
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  const dayFrac = (b.getDate() - a.getDate()) / 30;
  return Math.round(Math.max(0.03, months + dayFrac) * 100) / 100;
}

async function getCourse(id) {
  return db.col('SummerCourse').findById(id);
}

function compute(sc) {
  const months = monthsBetween(sc.fromDate, sc.toDate);
  const totalRent = Math.round((Number(sc.rent) || 0) * months);
  const total = totalRent + (Number(sc.deposit) || 0);
  const paid = (sc.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return { months, totalRent, total, paid, remaining: Math.max(0, total - paid) };
}

exports.list = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status === 'active' || status === 'ended') filter.status = status;
    const courses = await db.col('SummerCourse').find(filter, { fromDate: -1 });
    const out = courses.map((c) => ({ ...c, _id: String(c._id), ...compute(c) }));
    res.json({ courses: out });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { studentId, roomId, bedNumber, fromDate, toDate, rent, deposit, paidAmount, paidDate, paidMethod } = req.body;
    if (!studentId || !roomId || !bedNumber) return res.status(400).json({ message: 'Select student and accommodation' });
    if (!fromDate || !toDate) return res.status(400).json({ message: 'Set start and end dates' });
    if (fmt(toDate) < fmt(fromDate)) return res.status(400).json({ message: 'End date is before start date' });

    const student = await db.col('Student').findById(studentId);
    if (!student) return res.status(400).json({ message: 'Student not found' });
    const room = await db.col('Room').findById(roomId);
    if (!room) return res.status(400).json({ message: 'Room not found' });
    const bed = (room.beds || []).find((b) => b.bedNumber === Number(bedNumber));
    if (!bed) return res.status(400).json({ message: `Bed ${bedNumber} not found in room` });

    const check = await structure.checkBedAvailability(roomId, Number(bedNumber), fmt(fromDate), fmt(toDate));
    if (!check.ok) return res.status(400).json({ message: check.reason });

    const property = await db.col('Property').findById(room.propertyId);
    const floor = property ? (property.floors || []).find((f) => String(f._id) === String(room.floorId)) : null;
    const ap = property ? (property.apartments || []).find((a) => String(a._id) === String(room.apartmentId)) : null;

    const payments = [];
    const paid = Number(paidAmount) || 0;
    if (paid > 0) {
      payments.push({ _id: genId(), amount: money(paid), date: fmt(paidDate || fromDate), method: paidMethod || 'cash', note: 'Payment at registration', by: req.user.name || '', createdAt: new Date().toISOString() });
    }

    const course = await db.col('SummerCourse').insert({
      studentId: String(student._id),
      studentName: student.name,
      studentCode: student.studentId,
      roomId: String(room._id),
      bedNumber: Number(bedNumber),
      propertyId: String(room.propertyId || ''),
      propertyName: property ? property.name : '',
      apartmentId: String(room.apartmentId || ''),
      apartmentName: ap ? structure.apartmentLabel(ap) : '',
      floorId: String(room.floorId || ''),
      floorName: floor ? structure.floorLabel(floor) : '',
      fromDate: fmt(fromDate),
      toDate: fmt(toDate),
      rent: money(rent),
      deposit: money(deposit),
      payments,
      status: 'active',
    });

    await log(req, { action: `Added summer course for ${student.name}: ${course.fromDate} → ${course.toDate} (room ${room.number} bed ${bedNumber}) at ${course.rent}`, category: 'students', targetType: 'student', targetId: String(student._id) });
    await notifications.create({
      type: 'summer_course',
      title: 'Summer Course',
      message: `Summer course for ${student.name} (${course.fromDate} → ${course.toDate})`,
      data: { studentId: String(student._id), courseId: String(course._id) },
    });
    emit(req, 'property:updated', {});
    emit(req, 'room:updated', {});
    emit(req, 'summer:updated', {});
    res.json({ course: { ...course, _id: String(course._id), ...compute(course) } });
  } catch (e) {
    next(e);
  }
};

exports.pay = async (req, res, next) => {
  try {
    const course = await getCourse(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const { amount, date, method, note } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Amount is required' });
    const payments = (course.payments || []).concat([{ _id: genId(), amount: money(amount), date: fmt(date || new Date().toISOString()), method: method || 'cash', note: note || '', by: req.user.name || '', createdAt: new Date().toISOString() }]);
    const updated = await db.col('SummerCourse').findByIdAndUpdate(req.params.id, { $set: { payments } });
    await log(req, { action: `Paid ${money(amount)} for summer course of ${course.studentName}`, category: 'students', targetType: 'student', targetId: course.studentId });
    emit(req, 'summer:updated', {});
    res.json({ course: { ...updated, _id: String(updated._id), ...compute(updated) } });
  } catch (e) {
    next(e);
  }
};

exports.end = async (req, res, next) => {
  try {
    const course = await getCourse(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const updated = await db.col('SummerCourse').findByIdAndUpdate(req.params.id, { $set: { status: 'ended', endedAt: new Date().toISOString() } });
    await log(req, { action: `Ended summer course for ${course.studentName}`, category: 'students', targetType: 'student', targetId: course.studentId });
    emit(req, 'summer:updated', {});
    emit(req, 'property:updated', {});
    emit(req, 'room:updated', {});
    res.json({ course: { ...updated, _id: String(updated._id), ...compute(updated) } });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const course = await getCourse(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    await db.col('SummerCourse').deleteById(req.params.id);
    await log(req, { action: `Deleted summer course for ${course.studentName}`, category: 'students', targetType: 'student', targetId: course.studentId });
    emit(req, 'summer:updated', {});
    emit(req, 'property:updated', {});
    emit(req, 'room:updated', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.autoEndExpired = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const courses = await db.col('SummerCourse').find({ status: 'active' });
  let changed = 0;
  for (const c of courses) {
    if (c.toDate && fmt(c.toDate) < today) {
      await db.col('SummerCourse').findByIdAndUpdate(c._id, { $set: { status: 'ended', endedAt: new Date().toISOString() } });
      changed++;
    }
  }
  return changed;
};
