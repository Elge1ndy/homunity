const crypto = require('crypto');
const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const notifications = require('../services/notifications');
const { depositReceiptPdf, depositRefundPdf } = require('../utils/pdf');
const depositService = require('../services/deposit');

const PAYMENT_STATUS = { unpaid: 'Unpaid', paid: 'Paid' };
const REFUND_STATUS = { none: 'None', pending: 'Pending Refund', partial: 'Partially Refunded', full: 'Fully Refunded' };
const DEDUCT_REASONS = ['Unpaid rent', 'Furniture damage', 'Room damage', 'Missing items', 'Repair costs', 'Cleaning costs', 'Other'];

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
    res.status(404).json({ message: 'Student not found' });
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
    if (d.paymentStatus === 'paid') return res.status(400).json({ message: 'Deposit is already recorded as paid — you can edit the data' });
    const amount = money(req.body.amount);
    if (d.originalAmount <= 0 && amount > 0) d.originalAmount = amount;
    if (d.originalAmount <= 0) return res.status(400).json({ message: 'No deposit amount set for this student' });
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
      action: `${req.user.name} recorded deposit payment for ${student.name} (${student.studentId}) — ${d.originalAmount} EGP (receipt ${receipt.receiptNo})`,
      category: 'students',
      targetType: 'student',
      targetId: String(student._id),
      details: JSON.stringify({ amount: d.originalAmount, receiptNo: receipt.receiptNo, housingId: student.housingId || '', recordId: receipt._id }),
    });
    await notifications.create({ type: 'deposit_paid', title: 'Deposit Paid', message: `Deposit payment recorded for ${student.name} — ${d.originalAmount} EGP (${receipt.receiptNo})`, data: { studentId: String(student._id) } });
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
    if (newAmount < 0) return res.status(400).json({ message: 'Invalid value' });
    const totalDeductions = money(d.deductions.reduce((a, x) => a + x.amount, 0));
    if (newAmount < totalDeductions) return res.status(400).json({ message: 'Deposit amount cannot be less than recorded deductions' });
    const audit = (d.audit || []).concat([{ _id: newId(), action: 'Edited deposit data', note: `Changed amount from ${d.originalAmount} to ${newAmount}${req.body.note ? ' — ' + req.body.note : ''}`, amount: newAmount, adminId: String(req.user._id || ''), adminName: req.user.name, createdAt: new Date().toISOString() }]);
    const updatedD = { ...d, originalAmount: newAmount, paymentDate: req.body.paymentDate !== undefined ? String(req.body.paymentDate).slice(0, 10) : d.paymentDate, paymentMethod: ['cash', 'transfer', 'other'].includes(req.body.paymentMethod) ? req.body.paymentMethod : d.paymentMethod, notes: req.body.notes !== undefined ? String(req.body.notes).trim() : d.notes, audit };
    const updated = await saveDeposit(student, updatedD);
    await log(req, {
      action: `${req.user.name} edited deposit data for ${student.name} (${student.studentId}) — new amount ${newAmount} EGP`,
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
    if (d.paymentStatus !== 'paid') return res.status(400).json({ message: 'Cannot deduct from deposit before payment is recorded' });
    const amount = money(req.body.amount);
    if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    const totalDeductions = money(d.deductions.reduce((a, x) => a + x.amount, 0));
    if (amount > money(d.originalAmount - totalDeductions)) return res.status(400).json({ message: 'Deduction exceeds available deposit balance' });
    const deduction = {
      _id: newId(),
      amount,
      reason: String(req.body.reason || 'Other'),
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
      action: `${req.user.name} added deduction of ${amount} EGP from ${student.name}'s deposit (${student.studentId}) — ${deduction.reason}`,
      category: 'students',
      targetType: 'student',
      targetId: String(student._id),
      details: JSON.stringify({ amount, reason: deduction.reason, housingId: student.housingId || '', recordId: deduction._id }),
    });
    await notifications.create({ type: 'deposit_deducted', title: 'Deposit Deduction', message: `Deducted ${amount} EGP from ${student.name}'s deposit (${deduction.reason})`, data: { studentId: String(student._id) } });
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
    if (d.paymentStatus !== 'paid') return res.status(400).json({ message: 'Cannot refund before payment is recorded' });
    const amount = money(req.body.amount);
    if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    const remainingAmount = compute(student).remainingAmount;
    if (amount > remainingAmount) return res.status(400).json({ message: `Amount exceeds remaining deposit balance (${remainingAmount} EGP)` });
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
      action: `${req.user.name} refunded ${amount} EGP from ${student.name}'s deposit (${student.studentId}) — (receipt ${receipt.receiptNo})`,
      category: 'students',
      targetType: 'student',
      targetId: String(student._id),
      details: JSON.stringify({ amount, method, housingId: student.housingId || '', recordId: refund._id, receiptNo: receipt.receiptNo }),
    });
    await notifications.create({ type: 'deposit_refunded', title: 'Deposit Refund', message: `Refunded ${amount} EGP from ${student.name}'s deposit (${receipt.receiptNo})`, data: { studentId: String(student._id) } });
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
      if (!refund) return res.status(404).json({ message: 'Refund not found' });
      record = refund;
      receiptNo = (d.receipts.find((r) => r.type === 'refund') || {}).receiptNo || '';
    }
    if (type === 'pay' && !d.paymentDate) return res.status(400).json({ message: 'Deposit payment has not been recorded yet' });
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
    const err = new Error(`Total refund and deduction exceeds remaining balance (${remainingBefore} EGP)`);
    err.status = 400;
    throw err;
  }
  let totalDeductions = money(d.deductions.reduce((a, x) => a + x.amount, 0));
  if (deductAmount > 0) {
    if (deductAmount > money(d.originalAmount - totalDeductions)) {
      const err = new Error('Deduction exceeds available deposit balance');
      err.status = 400;
      throw err;
    }
    const deduction = {
      _id: newId(),
      amount: deductAmount,
      reason: String(actions.deductReason || 'Other'),
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
      if (!perHousing[hid]) perHousing[hid] = { housingId: hid, housingName: housingMap[hid] ? housingMap[hid].name : (hid ? 'Housing ' + hid : 'Default Housing') };
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
      unpaid: 'Unpaid',
      paid: 'Paid',
      pending: 'Pending Refund',
      partial: 'Partially Refunded',
      full: 'Fully Refunded',
      none: 'None',
    };
    const rows = data.rows.map((r) => ({
      'Student Name': r.name,
      'Phone Number': r.phone,
      'Housing': r.housingName,
      'Room': r.roomNumber,
      'Monthly Rent': r.monthlyRent,
      'Deposit': r.originalAmount,
      'Payment Status': statusAr[r.paymentStatus] || r.paymentStatus,
      'Deposit Payment Date': r.paymentDate,
      'Total Deductions': r.totalDeductions,
      'Refunded': r.refundedAmount,
      'Remaining': r.remainingAmount,
      'Refund Status': statusAr[r.refundStatus] || r.refundStatus,
      'Refund Date': r.refundDate,
    }));
    rows.push({
      'Student Name': 'Total',
      'Deposit': data.totals.required,
      'Payment Status': '',
      'Deposit Payment Date': '',
      'Total Deductions': data.totals.deductions,
      'Refunded': data.totals.refunded,
      'Remaining': data.totals.held,
    });
    const ws = excel.jsonToSheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Deposit');
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