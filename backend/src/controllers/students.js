const db = require('../db');
const xlsx = require('xlsx-js-style');
const excel = require('../utils/excel');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const paymentsService = require('../services/payments');
const notifications = require('../services/notifications');
const depositService = require('./deposit');
const structure = require('../services/structure');

async function nextStudentId() {
  const students = await db.col('Student').find({});
  let max = 0;
  for (const s of students) {
    const m = /ST-(\d+)/.exec(s.studentId || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `ST-${String(max + 1).padStart(4, '0')}`;
}

async function setBed(room, bedNumber, studentId) {
  if (!room) return;
  const beds = (room.beds || []).map((b) => (b.bedNumber === Number(bedNumber) ? { ...b, studentId } : b));
  await db.col('Room').findByIdAndUpdate(room._id, { $set: { beds } });
}

async function freeBed(roomId, bedNumber) {
  if (!roomId) return;
  const room = await db.col('Room').findById(roomId);
  if (!room) return;
  await setBed(room, bedNumber, null);
}

async function getHousing() {
  return db.col('Housing').findOne({});
}

exports.list = async (req, res, next) => {
  try {
    const { status, q, roomId, bed } = req.query;
    const filter = {};
    if (status && status !== 'all' && status !== 'paid' && status !== 'unpaid') filter.status = status;
    if (roomId) filter.roomId = roomId;
    if (bed) filter.bedNumber = Number(bed);
    let students = await db.col('Student').find(filter, { studentId: 1 });
    if (status === 'paid' || status === 'unpaid') {
      const curMonth = paymentsService.monthKey(new Date());
      const payments = await db.col('Payment').find({ month: curMonth });
      const map = {};
      payments.forEach((p) => {
        map[String(p.studentId)] = p;
      });
      students = students.filter((s) => {
        const p = map[String(s._id)];
        if (status === 'paid') return p && p.status === 'paid';
        return !p || p.status !== 'paid';
      });
    }
    if (q) {
      const term = String(q).trim().toLowerCase();
      students = students.filter(
        (s) =>
          String(s.name || '').toLowerCase().includes(term) ||
          String(s.phone || '').toLowerCase().includes(term) ||
          String(s.studentId || '').toLowerCase().includes(term)
      );
    }
    const roomIds = [...new Set(students.map((s) => s.roomId).filter(Boolean))];
    const rooms = await db.col('Room').find({ _id: { $in: roomIds } });
    const roomMap = {};
    rooms.forEach((r) => {
      roomMap[String(r._id)] = r;
    });
    const out = students.map((s) => ({
      ...s,
      _id: String(s._id),
      room: roomMap[s.roomId] ? { _id: String(roomMap[s.roomId]._id), number: roomMap[s.roomId].number } : null,
    }));
    res.json({ students: out, total: out.length });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const id = req.params.id;
    const student = await db.col('Student').findById(id);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    const room = student.roomId ? await db.col('Room').findById(student.roomId) : null;
    const payments = await db.col('Payment').find({ studentId: String(id) }, { month: 1 });
    const invoices = await db.col('Invoice').find({ studentId: String(id) }, { createdAt: -1 });
    const activity = await db.col('ActivityLog').find({ targetId: String(id) }, { createdAt: -1 });
    const fin = await paymentsService.studentFinancial(student);
    const ledger = await paymentsService.studentLedger(student);
    const housing = await getHousing();
    res.json({
      student: {
        ...student,
        _id: String(student._id),
        room: room ? { _id: String(room._id), number: room.number, type: room.type, capacity: room.capacity, propertyId: room.propertyId } : null,
        transfers: student.transfers || [],
        rentHistory: student.rentHistory || [],
      },
      housing,
      payments,
      invoices,
      activity,
      deposit: depositService.compute(student),
      financial: {
        totalExpected: fin.totalExpected,
        totalPaid: fin.totalPaid,
        totalRemaining: fin.totalRemaining,
        totalOverdue: fin.totalOverdue,
        totalUpcoming: fin.totalUpcoming,
        totalDue: fin.totalDue,
        monthsPaid: fin.monthsPaid,
        monthsUnpaid: fin.monthsUnpaid,
        monthsPartial: fin.monthsPartial,
        monthsOverdue: fin.monthsOverdue,
        monthsUpcoming: fin.monthsUpcoming,
      },
      ledger,
    });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, phone, university, email, roomId, bedNumber, monthlyRent, checkInDate, checkOutDate, notes, depositAmount } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'الاسم ورقم الهاتف مطلوبان' });
    const housing = await getHousing();
    const dueDay = housing ? housing.dueDay : 1;
    const dup = await db.col('Student').findOne({ phone: String(phone).trim() });
    if (dup) return res.status(400).json({ message: `رقم الهاتف مستخدم بالفعل للطالب ${dup.name}` });

    let room = null;
    let bed = null;
    if (roomId) {
      room = await db.col('Room').findById(roomId);
      if (!room) return res.status(400).json({ message: 'الغرفة غير موجودة' });
      if (bedNumber) {
        const b = (room.beds || []).find((x) => x.bedNumber === Number(bedNumber));
        if (!b) return res.status(400).json({ message: `السرير ${bedNumber} غير موجود في الغرفة` });
        if (b.studentId) return res.status(400).json({ message: `السرير ${bedNumber} مشغول` });
        bed = Number(bedNumber);
      }
    }
    const checkIn = checkInDate || new Date().toISOString().slice(0, 10);
    if (room && bed) {
      const av = await structure.checkBedAvailability(String(room._id), bed, checkIn, checkOutDate);
      if (!av.ok) return res.status(400).json({ message: av.reason });
    }

    const studentId = await nextStudentId();
    const bedRent = bed && room ? (room.beds || []).find((x) => x.bedNumber === bed) : null;
    const rent = Number(monthlyRent) || (bedRent && Number(bedRent.monthlyRent) > 0 ? Number(bedRent.monthlyRent) : room ? room.monthlyRent : 0);
const student = await db.col('Student').insert({
      studentId,
      name: String(name).trim(),
      phone: String(phone).trim(),
      university: university || '',
      email: email || '',
      roomId: room ? String(room._id) : '',
      bedNumber: bed,
      propertyId: room && room.propertyId ? String(room.propertyId) : '',
      monthlyRent: rent,
      checkInDate: checkIn,
      checkOutDate: checkOutDate || '',
      status: 'active',
      privateNotes: [],
      notes: notes || '',
      transfers: [],
      rentHistory: [],
    });
    const depAmount = Number(depositAmount) || 0;
    if (depAmount > 0) {
      await db.col('Student').findByIdAndUpdate(student._id, {
        $set: {
          deposit: {
            ...depositService.normalize({}),
            originalAmount: depAmount,
            paymentStatus: 'unpaid',
            notes: 'تأمين عند الدخول',
          },
          housingId: housing ? String(housing._id || '') : '',
        },
      });
    } else {
      await db.col('Student').findByIdAndUpdate(student._id, { $set: { housingId: housing ? String(housing._id || '') : '' } });
    }
    if (room && bed) await setBed(room, bed, String(student._id));
    await paymentsService.generateForStudent(student, dueDay);
    await log(req, { action: `تمت إضافة طالب ${student.name} (${student.studentId})`, category: 'students', targetType: 'student', targetId: student._id });
    await notifications.create({
      type: 'student_added',
      title: 'طالب جديد',
      message: `تمت إضافة ${student.name} (${student.studentId})`,
      data: { studentId: String(student._id) },
    });
    emit(req, 'student:added', {});
    emit(req, 'room:updated', {});
    res.json({ student });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const student = await db.col('Student').findById(id);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    const { name, phone, university, email, monthlyRent, checkInDate, checkOutDate, notes, roomId, bedNumber } = req.body;
    const set = {};
    if (name !== undefined) set.name = String(name).trim();
    if (phone !== undefined) {
      const trim = String(phone).trim();
      const dup = await db.col('Student').findOne({ phone: trim });
      if (dup && String(dup._id) !== String(id)) return res.status(400).json({ message: `رقم الهاتف مستخدم بالفعل للطالب ${dup.name}` });
      set.phone = trim;
    }
    if (university !== undefined) set.university = university;
    if (email !== undefined) set.email = email;
    if (notes !== undefined) set.notes = notes;
    if (checkInDate !== undefined) set.checkInDate = checkInDate;
    if (checkOutDate !== undefined) set.checkOutDate = checkOutDate;

    const housing = await getHousing();
    const dueDay = housing ? housing.dueDay : 1;

    const newRoomId = roomId !== undefined ? roomId : student.roomId;
    const newBed = bedNumber !== undefined ? Number(bedNumber) : student.bedNumber;

    if (newRoomId !== student.roomId || newBed !== student.bedNumber) {
      let room = null;
      let bedEntry = null;
      if (newRoomId) {
        room = await db.col('Room').findById(newRoomId);
        if (!room) return res.status(400).json({ message: 'الغرفة غير موجودة' });
        if (newBed) {
          const b = (room.beds || []).find((x) => x.bedNumber === newBed);
          if (!b) return res.status(400).json({ message: `السرير ${newBed} غير موجود` });
          if (b.studentId && String(b.studentId) !== String(id)) return res.status(400).json({ message: `السرير ${newBed} مشغول` });
          bedEntry = b;
        }
      }
      if (room && newBed) {
        const from = checkInDate !== undefined ? checkInDate : student.checkInDate;
        const to = checkOutDate !== undefined ? checkOutDate : student.checkOutDate;
        const av = await structure.checkBedAvailability(String(room._id), newBed, from, to, { excludeStudentId: id });
        if (!av.ok) return res.status(400).json({ message: av.reason });
      }
      if (student.roomId) {
        const oldRoom = await db.col('Room').findById(student.roomId);
        if (oldRoom && student.bedNumber) await setBed(oldRoom, student.bedNumber, null);
      }
      if (room && newBed) await setBed(room, newBed, String(id));
      set.roomId = room ? String(room._id) : '';
      set.bedNumber = room && newBed ? newBed : null;
      if (room && room.propertyId) set.propertyId = String(room.propertyId);
      if (room && newBed && monthlyRent === undefined) {
        const auto = bedEntry && Number(bedEntry.monthlyRent) > 0 ? Number(bedEntry.monthlyRent) : Number(room.monthlyRent) || 0;
        if (Number(auto) !== Number(student.monthlyRent)) set.monthlyRent = Number(auto);
      }
    }

    if (monthlyRent !== undefined && Number(monthlyRent) !== Number(student.monthlyRent)) {
      set.monthlyRent = Number(monthlyRent);
    }

    const updated = await db.col('Student').findByIdAndUpdate(id, { $set: set });
    if (set.monthlyRent !== undefined) await paymentsService.updateRentFor(updated, updated.monthlyRent);
    if (set.checkInDate !== undefined || set.checkOutDate !== undefined) await paymentsService.generateForStudent(updated, dueDay);

    await log(req, { action: `تم تعديل بيانات الطالب ${updated.name} (${updated.studentId})`, category: 'students', targetType: 'student', targetId: id });
    emit(req, 'student:updated', {});
    emit(req, 'room:updated', {});
    res.json({ student: updated });
  } catch (e) {
    next(e);
  }
};

exports.checkout = async (req, res, next) => {
  try {
    const id = req.params.id;
    const student = await db.col('Student').findById(id);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    const checkOut = req.body.checkOutDate || new Date().toISOString().slice(0, 10);

    const settle = await depositService.settle({
      student,
      byName: req.user.name,
      byId: req.user._id,
      actions: {
        deductAmount: req.body.deductAmount,
        deductReason: req.body.deductReason,
        deductDescription: req.body.deductDescription,
        deductDate: req.body.deductDate,
        refundAmount: req.body.refundAmount,
        refundMethod: req.body.refundMethod,
        refundDate: req.body.refundDate,
        refundNotes: req.body.refundNotes,
      },
    });

    const updated = await db.col('Student').findByIdAndUpdate(id, { $set: { status: 'ended', checkOutDate: checkOut } });
    await freeBed(student.roomId, student.bedNumber);
    const notes = [];
    settle.deductions.forEach((x) => notes.push(`خصم ${x.amount} ج.م (${x.reason})`));
    settle.refunds.forEach((x) => notes.push(`استرداد ${x.amount} ج.م`));
    const settleText = notes.length ? ' — تسوية التأمين: ' + notes.join('، ') : '';
    const done = { ...updated, deposit: settle.deposit };
    await log(req, {
      action: `إنهاء إقامة الطالب ${student.name} (${student.studentId})${settleText}`,
      category: 'students',
      targetType: 'student',
      targetId: id,
      details: JSON.stringify({ housingId: student.housingId || '' }),
    });
    if (settle.refunds.length) {
      await notifications.create({
        type: 'deposit_refunded',
        title: 'استرداد تأمين عند الخروج',
        message: `استرداد ${settle.refunds[0].amount} ج.م من تأمين ${student.name}`,
        data: { studentId: String(id) },
      });
    }
    await notifications.create({
      type: 'student_checkout',
      title: 'إنهاء إقامة',
      message: `تم إنهاء إقامة ${student.name} (${student.studentId}) بتاريخ ${checkOut}`,
      data: { studentId: String(id) },
    });
    emit(req, 'student:updated', {});
    emit(req, 'room:updated', {});
    emit(req, 'deposit:updated', {});
    res.json({ student: done });
  } catch (e) {
    next(e);
  }
};

exports.archive = async (req, res, next) => {
  try {
    const id = req.params.id;
    const student = await db.col('Student').findById(id);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    const updated = await db.col('Student').findByIdAndUpdate(id, { $set: { status: 'archived', archivedAt: new Date().toISOString() } });
    await freeBed(student.roomId, student.bedNumber);
    await log(req, { action: `أرشفة الطالب ${student.name} (${student.studentId})`, category: 'students', targetType: 'student', targetId: id });
    emit(req, 'student:updated', {});
    emit(req, 'room:updated', {});
    res.json({ student: updated });
  } catch (e) {
    next(e);
  }
};

exports.restore = async (req, res, next) => {
  try {
    const id = req.params.id;
    const student = await db.col('Student').findById(id);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    const updated = await db.col('Student').findByIdAndUpdate(id, { $set: { status: 'active', archivedAt: null } });
    await log(req, { action: `استعادة الطالب ${student.name} (${student.studentId})`, category: 'students', targetType: 'student', targetId: id });
    emit(req, 'student:updated', {});
    res.json({ student: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    const student = await db.col('Student').findById(id);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    await freeBed(student.roomId, student.bedNumber);
    await db.col('Student').deleteById(id);
    await db.col('Payment').deleteMany({ studentId: String(id) });
    await db.col('Invoice').deleteMany({ studentId: String(id) });
    await log(req, { action: `حذف الطالب ${student.name} (${student.studentId}) نهائيًا`, category: 'students', targetType: 'student', targetId: id });
    emit(req, 'student:updated', {});
    emit(req, 'room:updated', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.addNote = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'النص مطلوب' });
    const student = await db.col('Student').findById(id);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    const privateNotes = (student.privateNotes || []).concat([{ text: String(text).trim(), by: req.user.name, createdAt: new Date().toISOString() }]);
    const updated = await db.col('Student').findByIdAndUpdate(id, { $set: { privateNotes } });
    await log(req, { action: `إضافة ملاحظة خاصة للطالب ${student.name}`, category: 'students', targetType: 'student', targetId: id });
    emit(req, 'student:updated', {});
    res.json({ student: updated });
  } catch (e) {
    next(e);
  }
};

exports.expiring = async (req, res, next) => {
  try {
    const soon = await paymentsService.scanExpiring(Number(req.query.days) || 30);
    res.json({ students: soon });
  } catch (e) {
    next(e);
  }
};

function pick(row, keys) {
  for (const k of keys) {
    const norm = k.toLowerCase().replace(/\s+/g, '');
    const found = Object.keys(row).find((ck) => ck.trim().toLowerCase().replace(/\s+/g, '') === norm);
    if (found !== undefined && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
}

exports.import = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'يرجى رفع ملف Excel' });
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    const housing = await getHousing();
    const dueDay = housing ? housing.dueDay : 1;
    const report = { total: rows.length, added: 0, errors: [] };
    const rooms = await db.col('Room').find({});
    const mapRoom = {};
    rooms.forEach((r) => {
      mapRoom[String(r.number)] = r;
    });
    const existing = await db.col('Student').find({});
    const seenPhones = new Set(existing.map((s) => String(s.phone).trim()));
    const seenIds = new Set(existing.map((s) => String(s.studentId).trim()));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = i + 2;
      const name = pick(row, ['name', 'الاسم', 'fullname', 'studentname']);
      const phone = pick(row, ['phone', 'الهاتف', 'رقم الهاتف', 'mobile', 'رقم الموبايل']);
      const university = pick(row, ['university', 'الجامعة', 'college']);
      const roomNum = pick(row, ['room', 'الغرفة', 'roomno', 'roomnumber']);
      const bedNum = pick(row, ['bed', 'السرير', 'bedno', 'bednumber']);
      const rent = Number(pick(row, ['rent', 'الايجار', 'الإيجار', 'المبلغ', 'monthlyrent'])) || 0;
      const checkIn = pick(row, ['checkin', 'تاريخ الدخول', 'check-in']);
      const checkOut = pick(row, ['checkout', 'تاريخ الخروج', 'check-out']);
      const studentId = pick(row, ['studentid', 'رقم الطالب', 'id']);

      if (!name || !phone) {
        report.errors.push({ line, message: 'بيانات ناقصة (الاسم أو الهاتف)' });
        continue;
      }
      if (seenPhones.has(phone)) {
        report.errors.push({ line, message: `هاتف مكرر: ${phone}` });
        continue;
      }
      if (studentId && seenIds.has(studentId)) {
        report.errors.push({ line, message: `رقم طالب مكرر: ${studentId}` });
        continue;
      }
      let room = null;
      let bed = null;
      if (roomNum) {
        room = mapRoom[String(roomNum)];
        if (!room) {
          report.errors.push({ line, message: `غرفة غير موجودة: ${roomNum}` });
          continue;
        }
        if (bedNum) {
          const b = (room.beds || []).find((x) => x.bedNumber === Number(bedNum));
          if (!b) {
            report.errors.push({ line, message: `سرير غير موجود: ${roomNum}/${bedNum}` });
            continue;
          }
          if (b.studentId) {
            report.errors.push({ line, message: `سرير مشغول: ${roomNum}/${bedNum}` });
            continue;
          }
          bed = Number(bedNum);
        }
      }
      const sid = await nextStudentId();
      const student = await db.col('Student').insert({
        studentId: sid,
        name,
        phone,
        university,
        email: '',
        roomId: room ? String(room._id) : '',
        bedNumber: bed,
        propertyId: room && room.propertyId ? String(room.propertyId) : '',
        monthlyRent: rent,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        status: 'active',
        privateNotes: [],
        notes: '',
        transfers: [],
        rentHistory: [],
      });
      if (room && bed) await setBed(room, bed, String(student._id));
      await paymentsService.generateForStudent(student, dueDay);
      seenPhones.add(phone);
      if (studentId) seenIds.add(studentId);
      report.added++;
    }
    await log(req, { action: `استيراد طلاب من Excel: تمت إضافة ${report.added} من أصل ${report.total}`, category: 'students' });
    emit(req, 'student:added', {});
    emit(req, 'room:updated', {});
    res.json({ report });
  } catch (e) {
    next(e);
  }
};

exports.exportExcel = async (req, res, next) => {
  try {
    const filter = req.query.filter || 'all';
    const roomId = req.query.roomId || '';
    let statusFilter = {};
    if (filter === 'active') statusFilter = { status: 'active' };
    else if (filter === 'archived') statusFilter = { status: 'archived' };
    else if (filter === 'ended') statusFilter = { status: 'ended' };
    if (roomId) statusFilter.roomId = roomId;
    let students = await db.col('Student').find(statusFilter, { studentId: 1 });

    if (filter === 'paid' || filter === 'unpaid') {
      const curMonth = paymentsService.monthKey(new Date());
      const payments = await db.col('Payment').find({ month: curMonth });
      const map = {};
      payments.forEach((p) => {
        map[String(p.studentId)] = p;
      });
      students = students.filter((s) => {
        const p = map[String(s._id)];
        if (filter === 'paid') return p && p.status === 'paid';
        return !p || p.status !== 'paid';
      });
    }

    const rooms = await db.col('Room').find({});
    const roomMap = {};
    rooms.forEach((r) => {
      roomMap[String(r._id)] = r;
    });
    const rows = students.map((s) => {
      const d = depositService.compute(s);
      return {
        'رقم الطالب': s.studentId,
        'الاسم': s.name,
        'الهاتف': s.phone,
        'الجامعة': s.university,
        'الغرفة': roomMap[s.roomId] ? roomMap[s.roomId].number : '',
        'السرير': s.bedNumber || '',
        'الإيجار الشهري': s.monthlyRent,
        'التأمين': d.originalAmount,
        'حالة دفع التأمين': { unpaid: 'غير مدفوع', paid: 'مدفوع' }[d.paymentStatus] || d.paymentStatus,
        'تاريخ دفع التأمين': d.paymentDate,
        'إجمالي الخصومات': d.totalDeductions,
        'المسترد': d.refundedAmount,
        'المتبقي': d.remainingAmount,
        'حالة الاسترداد': depositService.REFUND_STATUS[d.refundStatus] || d.refundStatus,
        'تاريخ الدخول': s.checkInDate,
        'تاريخ الخروج': s.checkOutDate,
        'الحالة': s.status,
      };
    });
    const ws = excel.jsonToSheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    const buf = excel.writeBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=students-${filter}.xlsx`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
};
