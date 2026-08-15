const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const notifications = require('../services/notifications');
const paymentsService = require('../services/payments');
const structure = require('../services/structure');

const { genId, money } = structure;

async function setBed(room, bedNumber, studentId) {
  const beds = (room.beds || []).map((b) => (b.bedNumber === Number(bedNumber) ? { ...b, studentId } : b));
  return db.col('Room').findByIdAndUpdate(room._id, { $set: { beds } });
}

function daysInMonth(month) {
  const [y, m] = String(month).split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function prorateAmount(month, transferDate, oldRent, newRent) {
  const total = daysInMonth(month);
  const day = Math.min(Math.max(Number(String(transferDate).slice(8, 10)) || 1, 1), total);
  const before = day - 1;
  const after = total - before;
  const amount = Math.round((Number(oldRent) / total) * before + (Number(newRent) / total) * after);
  return { amount, before, after, total };
}

exports.transfer = async (req, res, next) => {
  try {
    const id = req.params.id;
    const student = await db.col('Student').findById(id);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    if (student.status !== 'active') return res.status(400).json({ message: 'يمكن نقل الطلاب النشطين فقط' });

    const { toRoomId, toBedNumber, transferDate, reason, prorate, monthlyRent } = req.body;
    if (!toRoomId) return res.status(400).json({ message: 'اختر الغرفة الجديدة' });
    if (!toBedNumber) return res.status(400).json({ message: 'اختر السرير الجديد' });

    const toRoom = await db.col('Room').findById(toRoomId);
    if (!toRoom) return res.status(400).json({ message: 'الغرفة الجديدة غير موجودة' });
    const toBed = (toRoom.beds || []).find((b) => b.bedNumber === Number(toBedNumber));
    if (!toBed) return res.status(400).json({ message: `السرير ${toBedNumber} غير موجود في الغرفة` });
    if (toBed.studentId && String(toBed.studentId) !== String(student._id)) return res.status(400).json({ message: `السرير ${toBedNumber} مشغول` });
    if (toRoom.status === 'inactive') return res.status(400).json({ message: 'الغرفة الجديدة متوقفة' });

    const date = String(transferDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const doProrate = prorate === undefined || prorate === true || prorate === 'true' || prorate === 1;

    const av = await structure.checkBedAvailability(toRoomId, Number(toBedNumber), date, student.checkOutDate, { excludeStudentId: String(student._id) });
    if (!av.ok) return res.status(400).json({ message: av.reason });

    const oldRent = Number(student.monthlyRent) || 0;
    const newRent = monthlyRent !== undefined && monthlyRent !== '' ? money(monthlyRent) : money(Number(toBed.monthlyRent) > 0 ? toBed.monthlyRent : toRoom.monthlyRent || student.monthlyRent || 0);

    const fromLabels = await structure.labelsFor({ roomId: student.roomId, bedNumber: student.bedNumber });
    const toLabels = await structure.labelsFor({ roomId: toRoomId, bedNumber: Number(toBedNumber) });

    // تعويم السرير القديم وتركيب الجديد
    if (student.roomId && String(student.roomId) !== String(toRoomId)) {
      const oldRoom = await db.col('Room').findById(student.roomId);
      if (oldRoom && student.bedNumber) await setBed(oldRoom, student.bedNumber, null);
    } else if (student.roomId && Number(student.bedNumber) !== Number(toBedNumber)) {
      const oldRoom = await db.col('Room').findById(student.roomId);
      if (oldRoom && student.bedNumber) await setBed(oldRoom, student.bedNumber, null);
    }
    const freshToRoom = await db.col('Room').findById(toRoomId);
    await setBed(freshToRoom || toRoom, toBedNumber, String(student._id));

    // سجل النقل
    const transfer = {
      _id: genId(),
      date,
      reason: String(reason || '').trim(),
      prorated: doProrate,
      from: { ...fromLabels, price: oldRent },
      to: { ...toLabels, price: newRent },
      by: String(req.user._id || ''),
      byName: req.user.name || '',
      createdAt: new Date().toISOString(),
    };
    const transfers = (student.transfers || []).concat([transfer]);

    // سجل الأسعار (إغلاق الشريحة الحالية)
    const rentHistory = (student.rentHistory || []).concat([
      {
        _id: genId(),
        fromDate: student.checkInDate || date,
        toDate: date,
        price: oldRent,
        roomId: student.roomId || '',
        bedNumber: student.bedNumber || null,
        byName: req.user.name || '',
        transferId: transfer._id,
      },
    ]);

    // تسعير نسبي لشهر النقل إذا وقع في منتصف الشهر
    const updated = await db.col('Student').findByIdAndUpdate(id, {
      $set: {
        roomId: String(toRoom._id),
        bedNumber: Number(toBedNumber),
        monthlyRent: newRent,
        propertyId: String(toRoom.propertyId || student.propertyId || ''),
        transfers,
        rentHistory,
      },
    });

    if (money(newRent) !== oldRent) await paymentsService.updateRentFor(updated, newRent);

    // تسعير نسبي لشهر النقل (بعد updateRentFor حتى لا يُمسح المبلغ)
    let proration = null;
    const curMonth = paymentsService.monthKey(new Date());
    if (doProrate && money(newRent) !== oldRent && date.startsWith(curMonth)) {
      const pay = await db.col('Payment').findOne({ studentId: String(student._id), month: curMonth });
      if (pay && pay.status !== 'paid') {
        const pr = prorateAmount(curMonth, date, oldRent, newRent);
        if (Number(pr.amount) !== Number(pay.amount)) {
          const history = (pay.history || []).concat([
            { at: new Date().toISOString(), by: req.user.name || '', action: `نقل — تسعير نسبي: ${pr.before} يوم × ${oldRent} + ${pr.after} يوم × ${newRent} = ${pr.amount}` },
          ]);
          await db.col('Payment').findByIdAndUpdate(pay._id, { $set: { amount: pr.amount, history } });
          proration = { month: curMonth, ...pr };
        }
      }
    }

    await log(req, {
      action: `نقل الطالب ${student.name} (${student.studentId}) من ${fromLabels.propertyName} ${fromLabels.floorName} ${fromLabels.apartmentName} غرفة ${fromLabels.roomNumber} سرير ${fromLabels.bedNumber || '—'} إلى ${toLabels.propertyName} ${toLabels.floorName} ${toLabels.apartmentName} غرفة ${toLabels.roomNumber} سرير ${toBedNumber} (السعر ${oldRent} → ${newRent})${proration ? ' — تسعير نسبي' : ''}`,
      category: 'students',
      targetType: 'student',
      targetId: id,
    });
    await notifications.create({
      type: 'student_transferred',
      title: 'نقل طالب',
      message: `نقل ${student.name} إلى غرفة ${toLabels.roomNumber} — سرير ${toBedNumber} (السعر ${oldRent} → ${newRent})`,
      data: { studentId: String(id) },
    });
    emit(req, 'student:updated', {});
    emit(req, 'room:updated', {});
    emit(req, 'property:updated', {});
    res.json({ student: updated, transfer, proration });
  } catch (e) {
    next(e);
  }
};

exports.list = async (req, res, next) => {
  try {
    const students = await db.col('Student').find({});
    const rows = [];
    students.forEach((s) => {
      (s.transfers || []).forEach((t) => {
        rows.push({ ...t, studentId: s.studentId, studentName: s.name, student: { _id: String(s._id), name: s.name, studentId: s.studentId } });
      });
    });
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    res.json({ transfers: rows });
  } catch (e) {
    next(e);
  }
};

module.exports = { transfer: exports.transfer, list: exports.list, prorateAmount };