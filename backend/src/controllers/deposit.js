const crypto = require('crypto');
const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const notifications = require('../services/notifications');
const { depositReceiptPdf, depositRefundPdf } = require('../utils/pdf');
const depositService = require('../services/deposit');

const PAYMENT_STATUS = { unpaid: 'غير مدفوع', paid: 'مدفوع' };
const REFUND_STATUS = { none: 'لا يوجد', pending: 'بانتظار الاسترداد', partial: 'مسترد جزئيًا', full: 'مسترد بالكامل' };
const DEDUCT_REASONS = ['إيجار غير مدفوع', 'تلف أثاث', 'تلف الغرفة', 'أدوات ناقصة', 'تكاليف إصلاح', 'تكاليف تنظيف', 'أخرى'];

function money(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

const { normalize, compute, emptyDeposit } = depositService;

let receiptLock = false;
async function nextReceiptNo() {
  while (receiptLock) await new Promise((r) => setTimeout(r, 10));
  receiptLock = true;
  try {
    const year = new Date().getFullYear();
    const students = await db.col('Student').find({});
    let max = 0;
    for (const s of students) {
      const d = normalize(s);
      for (const r of d.receipts) {
        const m = new RegExp(`^DEP-${year}-(\\d+)$`).exec(r.receiptNo || '');
        if (m) max = Math.max(max, Number(m[1]));
      }
    }
    return `DEP-${year}-${String(max + 1).padStart(5, '0')}`;
  } finally {
    receiptLock = false;
  }
}

async function getStudent(id, res) {
  const student = await db.col('Student').findById(id);
  if (!student) {
    res.status(404).json({ message: 'الطالب غير موجود' });
    return null;
  }
  return student;
}

async function saveDeposit(student, deposit) {
  return db.col('Student').findByIdAndUpdate(String(student._id), { $set: { deposit } });
}

/* ---------------- APIs ---------------- */

exports.pay = async (req, res, next) => {
  try {
    const student = await getStudent(req.params.id, res);
    if (!student) return;
    let d = normalize(student);
    if (d.paymentStatus === 'paid') return res.status(400).json({ message: 'التأمين مسجل كمدفوع بالفعل — يمكنك تعديل البيانات' });
    const amount = money(req.body.amount);
    if (d.originalAmount <= 0 && amount > 0) d.originalAmount = amount;
    if (d.originalAmount <= 0) return res.status(400).json({ message: 'لا يوجد مبلغ تأمين محدد لهذا الطالب' });
    const date = String(req.body.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const method = ['cash', 'transfer', 'other'].includes(req.body.method) ? req.body.method : 'other';
    const receipt = { _id: newId(), type: 'pay', receiptNo: await nextReceiptNo(), createdAt: new Date().toISOString() };
    d = {
      ...d,
      paymentStatus: 'paid',
      paymentDate: date,
      paymentMethod: method,
      paymentProof: String(req.body.proof || ''),
      notes: String(req.body.note || '').trim(),
      receipts: (d.receipts || []).concat([receipt]),
    };
    const updated = await saveDeposit(student, d);
    await log(req, {
      action: `سجل ${req.user.name} دفع تأمين ${student.name} (${student.studentId}) — ${d.originalAmount} ج.م (وصل ${receipt.receiptNo})`,
      category: 'students',
      targetType: 'student',
      targetId: String(student._id),
      details: JSON.stringify({ amount: d.originalAmount, receiptNo: receipt.receiptNo, housingId: student.housingId || '', recordId: receipt._id }),
    });
    await notifications.create({ type: 'deposit_paid', title: 'تم دفع التأمين', message: `سُجل دفع تأمين ${student.name} بقيمة ${d.originalAmount} ج.م (${receipt.receiptNo})`, data: { studentId: String(student._id) } });
    emit(req, 'deposit:updated', {});
    emit(req, 'student:updated', {});
    res.json({ student: updated, deposit: compute(updated), receipt });
  } catch (e) {
    next(e);
  }
};

exports.edit = async (req, res, next) => {
  try {
    const student = await getStudent(req.params.id, res);
    if (!student) return;
    const d = normalize(student);
    const newAmount = money(req.body.originalAmount);
    if (newAmount < 0) return res.status(400).json({ message: 'القيمة غير صالحة' });
    const totalDeductions = money(d.deductions.reduce((a, x) => a + x.amount, 0));
    if (newAmount < totalDeductions) return res.status(400).json({ message: 'مبلغ التأمين لا يمكن أن يقل عن الخصومات المسجلة' });
    const audit = (d.audit || []).concat([{ _id: newId(), action: 'تعديل بيانات التأمين', note: `تغيير المبلغ من ${d.originalAmount} إلى ${newAmount}${req.body.note ? ' — ' + req.body.note : ''}`, amount: newAmount, adminId: String(req.user._id || ''), adminName: req.user.name, createdAt: new Date().toISOString() }]);
    const updatedD = { ...d, originalAmount: newAmount, paymentDate: req.body.paymentDate !== undefined ? String(req.body.paymentDate).slice(0, 10) : d.paymentDate, paymentMethod: ['cash', 'transfer', 'other'].includes(req.body.paymentMethod) ? req.body.paymentMethod : d.paymentMethod, notes: req.body.notes !== undefined ? String(req.body.notes).trim() : d.notes, audit };
    const updated = await saveDeposit(student, updatedD);
    await log(req, {
      action: `عدّل ${req.user.name} بيانات تأمين ${student.name} (${student.studentId}) — المبلغ الجديد ${newAmount} ج.م`,
      category: 'students',
      targetType: 'student',
      targetId: String(student._id),
      details: JSON.stringify({ newAmount, housingId: student.housingId || '' }),
    });
    emit(req, 'deposit:updated', {});
    emit(req, 'student:updated', {});
    res.json({ student: updated, deposit: compute(updated) });
  } catch (e) {
    next(e);
  }
};

exports.deduct = async (req, res, next) => {
  try {
    const student = await getStudent(req.params.id, res);
    if (!student) return;
    const d = normalize(student);
    if (d.paymentStatus !== 'paid') return res.status(400).json({ message: 'لا يمكن خصم التأمين قبل تسجيل الدفع' });
    const amount = money(req.body.amount);
    if (amount <= 0) return res.status(400).json({ message: 'المبلغ غير صالح' });
    const totalDeductions = money(d.deductions.reduce((a, x) => a + x.amount, 0));
    if (amount > money(d.originalAmount - totalDeductions)) return res.status(400).json({ message: 'الخصم أكبر من رصيد التأمين المتاح' });
    const deduction = {
      _id: newId(),
      amount,
      reason: String(req.body.reason || 'أخرى'),
      description: String(req.body.description || '').trim(),
      date: String(req.body.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      adminId: String(req.user._id || ''),
      adminName: req.user.name,
      attachment: String(req.body.attachment || ''),
      createdAt: new Date().toISOString(),
    };
    const updatedD = { ...d, deductions: (d.deductions || []).concat([deduction]) };
    const updated = await saveDeposit(student, updatedD);
    await log(req, {
      action: `أضاف ${req.user.name} خصم ${amount} ج.م من تأمين ${student.name} (${student.studentId}) — ${deduction.reason}`,
      category: 'students',
      targetType: 'student',
      targetId: String(student._id),
      details: JSON.stringify({ amount, reason: deduction.reason, housingId: student.housingId || '', recordId: deduction._id }),
    });
    await notifications.create({ type: 'deposit_deducted', title: 'خصم من التأمين', message: `خصم ${amount} ج.م من تأمين ${student.name} (${deduction.reason})`, data: { studentId: String(student._id) } });
    emit(req, 'deposit:updated', {});
    emit(req, 'student:updated', {});
    res.json({ student: updated, deposit: compute(updated), deduction });
  } catch (e) {
    next(e);
  }
};

exports.refund = async (req, res, next) => {
  try {
    const student = await getStudent(req.params.id, res);
    if (!student) return;
    const d = normalize(student);
    if (d.paymentStatus !== 'paid') return res.status(400).json({ message: 'لا يمكن الاسترداد قبل تسجيل الدفع' });
    const amount = money(req.body.amount);
    if (amount <= 0) return res.status(400).json({ message: 'المبلغ غير صالح' });
    const remainingAmount = compute(student).remainingAmount;
    if (amount > remainingAmount) return res.status(400).json({ message: `المبلغ أكبر من رصيد التأمين المتبقي (${remainingAmount} ج.م)` });
    const date = String(req.body.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const method = ['cash', 'transfer', 'other'].includes(req.body.method) ? req.body.method : 'other';
    const refund = {
      _id: newId(),
      amount,
      date,
      method,
      proof: String(req.body.proof || ''),
      notes: String(req.body.notes || '').trim(),
      adminId: String(req.user._id || ''),
      adminName: req.user.name,
      createdAt: new Date().toISOString(),
    };
    const receipt = { _id: newId(), type: 'refund', receiptNo: await nextReceiptNo(), createdAt: new Date().toISOString() };
    const updatedD = {
      ...d,
      refunds: (d.refunds || []).concat([refund]),
      refundStatus: 'partial',
      refundDate: date,
      receipts: (d.receipts || []).concat([receipt]),
    };
    const updated = await saveDeposit(student, updatedD);
    await log(req, {
      action: `استرد ${req.user.name} ${amount} ج.م من تأمين ${student.name} (${student.studentId}) — (وصل ${receipt.receiptNo})`,
      category: 'students',
      targetType: 'student',
      targetId: String(student._id),
      details: JSON.stringify({ amount, method, housingId: student.housingId || '', recordId: refund._id, receiptNo: receipt.receiptNo }),
    });
    await notifications.create({ type: 'deposit_refunded', title: 'استرداد تأمين', message: `استرداد ${amount} ج.م من تأمين ${student.name} (${receipt.receiptNo})`, data: { studentId: String(student._id) } });
    emit(req, 'deposit:updated', {});
    emit(req, 'student:updated', {});
    res.json({ student: updated, deposit: compute(updated), refund, receipt });
  } catch (e) {
    next(e);
  }
};

exports.receipt = async (req, res, next) => {
  try {
    const student = await getStudent(req.params.id, res);
    if (!student) return;
    const d = compute(student);
    const type = ['pay', 'refund'].includes(req.query.type) ? req.query.type : 'pay';
    let record = null;
    let receiptNo = '';
    if (type === 'pay') {
      receiptNo = (d.receipts.find((r) => r.type === 'pay') || {}).receiptNo || '';
    } else {
      const id = String(req.query.id || '');
      const refund = id ? d.refunds.find((r) => r._id === id) : d.refunds[d.refunds.length - 1];
      if (!refund) return res.status(404).json({ message: 'الاسترداد غير موجود' });
      record = refund;
      receiptNo = (d.receipts.find((r) => r.type === 'refund') || {}).receiptNo || '';
    }
    if (type === 'pay' && !d.paymentDate) return res.status(400).json({ message: 'لم يُسجل دفع التأمين بعد' });
    const housing = (await db.col('Housing').findOne({ _id: student.housingId })) || (await db.col('Housing').findOne({}));
    const room = student.roomId ? await db.col('Room').findById(student.roomId) : null;
    const doc = {
      student: { ...student, roomNumber: room ? room.number : '' },
      housing,
      deposit: d,
      record,
      receiptNo,
      adminName: record ? record.adminName : '',
    };
    const buf = type === 'pay' ? await depositReceiptPdf(doc) : await depositRefundPdf(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-${receiptNo || 'deposit'}.pdf`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
};

/* ---------------- Settlement (used by checkout) ---------------- */

exports.settle = async ({ student, actions, byName, byId }) => {
  const d = normalize(student);
  if (d.paymentStatus !== 'paid') return { deposit: compute(student), deductions: [], refunds: [], receipts: [] };
  const created = { deductions: [], refunds: [], receipts: [] };
  const deductAmount = money(actions.deductAmount);
  const refundAmount = money(actions.refundAmount);
  const remainingBefore = compute(student).remainingAmount;
  if (refundAmount + deductAmount > remainingBefore) {
    const err = new Error(`مجموع الاسترداد والخصم أكبر من الرصيد المتبقي (${remainingBefore} ج.م)`);
    err.status = 400;
    throw err;
  }
  let totalDeductions = money(d.deductions.reduce((a, x) => a + x.amount, 0));
  if (deductAmount > 0) {
    if (deductAmount > money(d.originalAmount - totalDeductions)) {
      const err = new Error('الخصم أكبر من رصيد التأمين المتاح');
      err.status = 400;
      throw err;
    }
    const deduction = {
      _id: newId(),
      amount: deductAmount,
      reason: String(actions.deductReason || 'أخرى'),
      description: String(actions.deductDescription || '').trim(),
      date: String(actions.deductDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      adminId: String(byId || ''),
      adminName: byName,
      attachment: '',
      createdAt: new Date().toISOString(),
    };
    d.deductions = d.deductions.concat([deduction]);
    totalDeductions = money(totalDeductions + deductAmount);
    created.deductions.push(deduction);
  }
  if (refundAmount > 0) {
    const refund = {
      _id: newId(),
      amount: refundAmount,
      date: String(actions.refundDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      method: ['cash', 'transfer', 'other'].includes(actions.refundMethod) ? actions.refundMethod : 'other',
      proof: '',
      notes: String(actions.refundNotes || '').trim(),
      adminId: String(byId || ''),
      adminName: byName,
      createdAt: new Date().toISOString(),
    };
    d.refunds = d.refunds.concat([refund]);
    d.refundStatus = 'partial';
    d.refundDate = refund.date;
    created.refunds.push(refund);
  }
  if (refundAmount > 0 || deductAmount > 0) {
    const receipt = { _id: newId(), type: 'refund', receiptNo: await nextReceiptNo(), createdAt: new Date().toISOString() };
    d.receipts = d.receipts.concat([receipt]);
    created.receipts.push(receipt);
  }
  await saveDeposit(student, d);
  return { deposit: compute({ ...student, deposit: d, status: 'ended' }), ...created };
};

/* ---------------- Aggregation / Report ---------------- */

function makeTotals(rows) {
  let required = 0;
  let paid = 0;
  let deductions = 0;
  let refunded = 0;
  rows.forEach((x) => {
    const d = x.deposit;
    required += d.originalAmount;
    if (d.paymentStatus === 'paid') paid += d.originalAmount;
    deductions += d.totalDeductions;
    refunded += d.refundedAmount;
  });
  return {
    required: money(required),
    paid: money(paid),
    unpaid: money(required - paid),
    deductions: money(deductions),
    refunded: money(refunded),
    held: money(paid - deductions - refunded),
  };
}

async function collect(students, req) {
  const rooms = await db.col('Room').find({});
  const roomMap = {};
  rooms.forEach((r) => {
    roomMap[String(r._id)] = r;
  });
  const housings = await db.col('Housing').find({});
  const housingMap = {};
  housings.forEach((h) => {
    housingMap[String(h._id)] = h;
  });
  const q = String(req.query.q || '').trim().toLowerCase();
  const housingId = req.query.housing || '';
  const roomId = req.query.room || '';
  const payStatus = req.query.payStatus || '';
  const refundStatus = req.query.refundStatus || '';
  const month = req.query.month || '';
  const year = req.query.year || '';
  const date = req.query.date || '';

  const rows = students.filter((s) => {
    const d = compute(s);
    if (q && !(String(s.name || '').toLowerCase().includes(q) || String(s.phone || '').toLowerCase().includes(q) || String(s.studentId || '').toLowerCase().includes(q))) return false;
    if (housingId && String(s.housingId || '') !== String(housingId)) return false;
    if (roomId && String(s.roomId || '') !== String(roomId)) return false;
    if (payStatus && d.paymentStatus !== payStatus) return false;
    if (refundStatus && d.refundStatus !== refundStatus) return false;
    if (month && d.paymentDate && d.paymentDate.slice(0, 7) !== month) return false;
    if (year && d.paymentDate && d.paymentDate.slice(0, 4) !== year) return false;
    if (date && d.paymentDate !== date) return false;
    return true;
  });

  let totals = makeTotals(rows.map((s) => ({ deposit: compute(s) })));
  const perHousing = {};
  students.forEach((s) => {
    const hid = String(s.housingId || '');
    if (!perHousing[hid]) perHousing[hid] = { housingId: hid, housingName: housingMap[hid] ? housingMap[hid].name : (hid ? 'سكن ' + hid : 'سكن افتراضي') };
  });
  Object.keys(perHousing).forEach((hid) => {
    const subset = students.filter((s) => String(s.housingId || '') === hid);
    perHousing[hid] = { ...perHousing[hid], ...makeTotals(subset.map((s) => ({ deposit: compute(s) }))) };
  });

  const out = rows.map((s) => {
    const d = compute(s);
    const room = roomMap[String(s.roomId || '')];
    return {
      _id: String(s._id),
      studentId: s.studentId,
      name: s.name,
      phone: s.phone,
      monthlyRent: s.monthlyRent || 0,
      housingId: String(s.housingId || ''),
      housingName: housingMap[String(s.housingId || '')] ? housingMap[String(s.housingId || '')].name : '',
      roomId: String(s.roomId || ''),
      roomNumber: room ? room.number : '',
      status: s.status,
      ...d,
    };
  });
  return { rows: out, totals, perHousing: Object.values(perHousing) };
}

exports.list = async (req, res, next) => {
  try {
    const students = await db.col('Student').find({});
    const data = await collect(students, req);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.exportExcel = async (req, res, next) => {
  try {
    const xlsx = require('xlsx-js-style');
    const excel = require('../utils/excel');
    const students = await db.col('Student').find({});
    const data = await collect(students, req);
    const statusAr = {
      unpaid: 'غير مدفوع',
      paid: 'مدفوع',
      pending: 'بانتظار الاسترداد',
      partial: 'مسترد جزئيًا',
      full: 'مسترد بالكامل',
      none: 'لا يوجد',
    };
    const rows = data.rows.map((r) => ({
      'اسم الطالب': r.name,
      'رقم التليفون': r.phone,
      'السكن': r.housingName,
      'الغرفة': r.roomNumber,
      'الإيجار الشهري': r.monthlyRent,
      'التأمين': r.originalAmount,
      'حالة الدفع': statusAr[r.paymentStatus] || r.paymentStatus,
      'تاريخ دفع التأمين': r.paymentDate,
      'إجمالي الخصومات': r.totalDeductions,
      'المسترد': r.refundedAmount,
      'المتبقي': r.remainingAmount,
      'حالة الاسترداد': statusAr[r.refundStatus] || r.refundStatus,
      'تاريخ الاسترداد': r.refundDate,
    }));
    rows.push({
      'اسم الطالب': 'الإجمالي',
      'التأمين': data.totals.required,
      'حالة الدفع': '',
      'تاريخ دفع التأمين': '',
      'إجمالي الخصومات': data.totals.deductions,
      'المسترد': data.totals.refunded,
      'المتبقي': data.totals.held,
    });
    const ws = excel.jsonToSheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'التأمين');
    const buf = excel.writeBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=deposits-${Date.now()}.xlsx`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
};

exports.compute = compute;
exports.normalize = normalize;
exports.PAYMENT_STATUS = PAYMENT_STATUS;
exports.REFUND_STATUS = REFUND_STATUS;
exports.DEDUCT_REASONS = DEDUCT_REASONS;
exports.makeTotals = makeTotals;