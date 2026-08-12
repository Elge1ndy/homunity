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

exports.list = async (req, res, next) => {
  try {
    const housing = await db.col('Housing').findOne({});
    await paymentsService.refreshOverdue(housing ? housing.dueDay : 1);
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

exports.markPaid = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { paidAt, proof } = req.body;
    const payment = await db.col('Payment').findById(id);
    if (!payment) return res.status(404).json({ message: 'الدفعة غير موجودة' });
    const student = await db.col('Student').findById(payment.studentId);
    const history = (payment.history || []).concat([{ at: new Date().toISOString(), by: req.user.name, action: `تم التسجيل كمدفوع في ${paidAt || new Date().toISOString().slice(0, 10)}` }]);
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
      action: `تسجيل دفع ${payment.month} للطالب ${student ? student.name : ''} بقيمة ${payment.amount}`,
      category: 'payments',
      targetType: 'payment',
      targetId: id,
    });
    await notifications.create({
      type: 'payment_recorded',
      title: 'دفعة مسجلة',
      message: `تم تسجيل دفع ${payment.month} للطالب ${student ? student.name : ''} بقيمة ${payment.amount}`,
      data: { paymentId: String(id), studentId: payment.studentId },
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
    if (!payment) return res.status(404).json({ message: 'الدفعة غير موجودة' });
    if (payment.status !== 'paid') return res.status(400).json({ message: 'الدفعة ليست مدفوعة' });
    const history = (payment.history || []).concat([{ at: new Date().toISOString(), by: req.user.name, action: 'تم التراجع عن الدفع' }]);
    const updated = await db.col('Payment').findByIdAndUpdate(id, { $set: { status: 'unpaid', paidAt: null, history } });
    await log(req, { action: `التراجع عن دفع ${payment.month} للطالب`, category: 'payments', targetType: 'payment', targetId: id });
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
    if (!payment) return res.status(404).json({ message: 'الدفعة غير موجودة' });
    if (payment.status === 'paid') return res.status(400).json({ message: 'لا يمكن تعديل دفعة مدفوعة' });
    const { amount } = req.body;
    const set = {};
    if (amount !== undefined) set.amount = Number(amount);
    const updated = await db.col('Payment').findByIdAndUpdate(id, { $set: set });
    await log(req, { action: `تعديل مبلغ دفعة ${payment.month} إلى ${updated.amount}`, category: 'payments', targetType: 'payment', targetId: id });
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
