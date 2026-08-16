const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const notifications = require('../services/notifications');
const paymentsService = require('../services/payments');
const revenue = require('../services/revenue');

async function attachStudent(rows) {
  const students = await db.col('Student').find({});
  const sMap = {};
  students.forEach((s) => {
    sMap[String(s._id)] = s;
  });
  return rows.map((p) => ({
    ...p,
    _id: String(p._id),
    studentId: String(p.studentId),
    student: sMap[String(p.studentId)]
      ? { _id: String(sMap[String(p.studentId)]._id), name: sMap[String(p.studentId)].name, studentId: sMap[String(p.studentId)].studentId, phone: sMap[String(p.studentId)].phone }
      : null,
  }));
}

let lastRefresh = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000;

exports.list = async (req, res, next) => {
  try {
    const now = Date.now();
    if (now - lastRefresh > REFRESH_INTERVAL) {
      const housing = await db.col('Housing').findOne({});
      await paymentsService.refreshOverdue(housing ? housing.dueDay : 1);
      lastRefresh = now;
    }
    const filter = {};
    if (req.query.month) filter.month = req.query.month;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    let rows = await db.col('Payment').find(filter, { month: -1, createdAt: -1 });
    rows = await attachStudent(rows);
    if (req.query.q) {
      const term = String(req.query.q).trim().toLowerCase();
      rows = rows.filter((r) => r.student && (String(r.student.name).toLowerCase().includes(term) || String(r.student.studentId).toLowerCase().includes(term)));
    }
    res.json({ payments: rows, total: rows.length });
  } catch (e) {
    next(e);
  }
};

exports.byStudent = async (req, res, next) => {
  try {
    const rows = await db.col('Payment').find({ studentId: String(req.params.sid) }, { month: 1 });
    res.json({ payments: rows });
  } catch (e) {
    next(e);
  }
};

exports.pay = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { amount: tranAmount, date: tranDate, method = 'cash', note = '', proof } = req.body || {};
    if (tranAmount === undefined || Number(tranAmount) <= 0) return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    const payment = await db.col('Payment').findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const newData = paymentsService.applyTransaction(payment, { amount: tranAmount, date: tranDate, method, note });
    const set = {
      paidAmount: newData.paidAmount,
      status: newData.status,
      transactions: newData.transactions,
    };
    if (proof !== undefined) set.proof = proof || payment.proof || '';
    const updated = await db.col('Payment').findByIdAndUpdate(id, { $set: set });
    await log(req, {
      action: `Recorded payment ${updated.month} for student ${updated.student?.name || ''} for ${tranAmount}`,
      category: 'payments',
      targetType: 'payment',
      targetId: String(updated._id),
    });
    emit(req, 'payment:updated', {});
    emit(req, 'student:updated', {});
    res.json({ payment: updated });
  } catch (e) {
    next(e);
  }
};

exports.receipt = async (req, res, next) => {
  try {
    const id = req.params.id;
    const payment = await db.col('Payment').findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const student = await db.col('Student').findById(payment.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const housing = await db.col('Housing').findOne({}) || {};
    const receiptNo = `RCP-${String(payment.month).replace('-', '')}-${String(payment._id).slice(-6).toUpperCase()}`;
    const pdfService = require('../utils/pdf');
    const pdfBuffer = await pdfService.paymentReceiptPdf({ payment, student, housing, receiptNo, adminName: req.user ? req.user.name : '' });
    res.type('application/pdf').send(pdfBuffer);
  } catch (e) {
    next(e);
  }
};

exports.markPaid = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { paidAt, proof } = req.body;
    const payment = await db.col('Payment').findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const student = await db.col('Student').findById(payment.studentId);
    const history = (payment.history || []).concat([{ at: new Date().toISOString(), by: req.user.name, action: `Marked as paid on ${paidAt || new Date().toISOString().slice(0, 10)}` }]);
    const updated = await db.col('Payment').findByIdAndUpdate(id, {
      $set: {
        status: 'paid',
        paidAt: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
        proof: proof || payment.proof || '',
        recordedBy: String(req.user._id),
        recordedByName: req.user.name,
        history,
      },
    });
    await log(req, {
      action: `Recorded payment ${payment.month} for student ${student ? student.name : ''} for ${payment.amount}`,
      category: 'payments',
      targetType: 'payment',
      targetId: String(updated._id),
    });
    await notifications.create({
      type: 'payment_recorded',
      title: 'Payment recorded',
      message: `Recorded payment ${payment.month} for student ${student ? student.name : ''} for ${payment.amount}`,
      data: { paymentId: String(updated._id), studentId: payment.studentId },
    });
    emit(req, 'payment:updated', {});
    emit(req, 'student:updated', {});
    res.json({ payment: updated });
  } catch (e) {
    next(e);
  }
};

exports.markUnpaid = async (req, res, next) => {
  try {
    const id = req.params.id;
    const payment = await db.col('Payment').findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status !== 'paid') return res.status(400).json({ message: 'Payment is not paid' });
    const history = (payment.history || []).concat([{ at: new Date().toISOString(), by: req.user.name, action: 'Reverted payment' }]);
    const updated = await db.col('Payment').findByIdAndUpdate(id, { $set: { status: 'unpaid', paidAt: null, history } });
    await log(req, { action: `Reverted payment ${payment.month} for student`, category: 'payments', targetType: 'payment', targetId: String(updated._id) });
    emit(req, 'payment:updated', {});
    emit(req, 'student:updated', {});
    res.json({ payment: updated });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const payment = await db.col('Payment').findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'paid') return res.status(400).json({ message: 'Cannot edit a paid payment' });
    const { amount } = req.body;
    const set = {};
    if (amount !== undefined) set.amount = Number(amount);
    const updated = await db.col('Payment').findByIdAndUpdate(id, { $set: set });
    await log(req, { action: `Updated payment ${payment.month} amount to ${updated.amount}`, category: 'payments', targetType: 'payment', targetId: String(updated._id) });
    emit(req, 'payment:updated', {});
    res.json({ payment: updated });
  } catch (e) {
    next(e);
  }
};

exports.revenue = async (req, res, next) => {
  try {
    const month = req.query.month || paymentsService.monthKey(new Date());
    const data = await revenue.monthRevenue(month);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.year = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const data = await revenue.yearRevenue(year);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.currentMonth = async (req, res, next) => {
  try {
    const month = paymentsService.monthKey(new Date());
    const data = await revenue.monthRevenue(month);
    res.json({ month, ...data });
  } catch (e) {
    next(e);
  }
};

exports.calendar = async (req, res, next) => {
  try {
    const month = req.query.month || paymentsService.monthKey(new Date());
    const payments = await db.col('Payment').find({ month });
    const students = await db.col('Student').find({});
    const sMap = {};
    students.forEach((s) => {
      sMap[String(s._id)] = s;
    });
    const days = {};
    for (const p of payments) {
      const item = {
        _id: String(p._id),
        studentId: String(p.studentId),
        student: sMap[String(p.studentId)]
          ? { _id: String(sMap[String(p.studentId)]._id), name: sMap[String(p.studentId)].name, studentId: sMap[String(p.studentId)].studentId, phone: sMap[String(p.studentId)].phone }
          : null,
        amount: p.amount,
        status: p.status,
        dueDate: p.dueDate,
        paidAt: p.paidAt,
        proof: p.proof,
      };
      if (!days[p.dueDate]) days[p.dueDate] = [];
      days[p.dueDate].push(item);
      if (p.status === 'paid' && p.paidAt) {
        const paidDay = new Date(p.paidAt).toISOString().slice(0, 10);
        if (!days[paidDay]) days[paidDay] = [];
        if (!days[paidDay].some((x) => x._id === item._id)) days[paidDay].push(item);
      }
    }
    res.json({ month, days });
  } catch (e) {
    next(e);
  }
};