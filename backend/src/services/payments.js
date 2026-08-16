const db = require('../db');

function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromYMD(str) {
  if (!str) return null;
  const parts = String(str).split('-').map(Number);
  if (!parts[0] || !parts[1]) return null;
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(startDate, endDate, max = 60) {
  const out = [];
  const s = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const e = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  let d = new Date(s);
  while (d <= e) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
    if (out.length >= max) break;
  }
  return out;
}

function dueDateFor(month, dueDay) {
  const [y, m] = String(month).split('-');
  const day = Math.min(Math.max(Number(dueDay) || 1, 1), 28);
  return `${y}-${m}-${String(day).padStart(2, '0')}`;
}

function deriveStatus(payment) {
  const now = new Date();
  const currentMonthKey = monthKey(now);
  const amount = Number(payment.amount) || 0;
  const paid = Number(payment.paidAmount) || 0;
  const month = String(payment.month);
  const due = String(payment.dueDate);

  const isCurrentOrFuture = month >= currentMonthKey;
  const dueDatePassed = due && due < currentMonthKey;

  if (paid >= amount) return 'paid';
  if (paid > 0) return 'partial';
  if (dueDatePassed) return 'overdue';
  if (!isCurrentOrFuture) return 'overdue';
  return 'unpaid';
}

function applyTransaction(payment, { amount: tranAmount, date: tranDate, method = 'cash', note = '' }) {
  const paid = Number(payment.paidAmount) || 0;
  const newPaid = Math.min(paid + Number(tranAmount), Number(payment.amount));
  const transactions = [...(payment.transactions || []), {
    amount: Number(tranAmount),
    date: tranDate ? new Date(tranDate).toISOString() : new Date(),
    method,
    note,
  }];
  return {
    ...payment,
    paidAmount: newPaid,
    transactions,
    status: deriveStatus({ ...payment, paidAmount: newPaid }),
  };
}

function resetPayment(payment) {
  return {
    ...payment,
    paidAmount: 0,
    transactions: [],
    status: 'unpaid',
  };
}

async function generateForStudent(student, dueDay) {
  const checkIn = dateFromYMD(student.checkInDate);
  if (!checkIn) return [];
  const checkOut = dateFromYMD(student.checkOutDate) || new Date(checkIn.getFullYear() + 1, checkIn.getMonth(), checkIn.getDate());
  const months = monthsBetween(checkIn, checkOut);
  const created = [];
  for (const month of months) {
    const existing = await db.col('Payment').findOne({ studentId: String(student._id), month });
    if (existing) continue;
    const p = await db.col('Payment').insert({
      studentId: String(student._id),
      month,
      amount: Number(student.monthlyRent) || 0,
      dueDate: dueDateFor(month, dueDay),
      status: 'unpaid',
      paidAt: null,
      proof: '',
      history: [],
      paidAmount: 0,
      transactions: [],
    });
    created.push(p);
  }
  return created;
}

async function updateRentFor(student, newRent) {
  const curMonth = monthKey(new Date());
  const payments = await db.col('Payment').find({ studentId: String(student._id) });
  for (const p of payments) {
    if (p.month >= curMonth && Number(p.amount) !== Number(newRent)) {
      await db.col('Payment').findByIdAndUpdate(p._id, { $set: { amount: Number(newRent) } });
    }
  }
}

async function refreshOverdue(dueDay) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const students = await db.col('Student').find({ status: 'active' });
  const sMap = {};
  students.forEach((s) => { sMap[String(s._id)] = s; });
  let changed = 0;
  const payments = await db.col('Payment').find({});
  for (const p of payments) {
    const s = sMap[String(p.studentId)];
    const status = deriveStatus(p);
    if (p.status !== status) {
      const history = (p.history || []).concat([{ at: new Date().toISOString(), by: s ? s.name || '' : '', action: `Status set to: ${status}` }]);
      await db.col('Payment').findByIdAndUpdate(p._id, { $set: { status, history } });
      changed++;
    }
  }
  return changed;
}

async function studentFinancial(student) {
  const payments = await db.col('Payment').find({ studentId: String(student._id) });
  const totalExpected = payments.reduce((s, p) => s + Number(p.amount) || 0, 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.paidAmount) || 0, 0);
  const totalRemaining = totalExpected - totalPaid;

  // overdue = months past due with not fully paid, upcoming = future months
  const now = new Date();
  const currentMonthKey = monthKey(now);
  let totalOverdue = 0;
  let totalUpcoming = 0;
  let monthsPaid = 0;
  let monthsUnpaid = 0;
  let monthsPartial = 0;
  let monthsOverdue = 0;
  let monthsUpcoming = 0;

  for (const p of payments) {
    const status = deriveStatus(p);
    const mKey = String(p.month);
    if (status === 'paid') monthsPaid++;
    else if (status === 'partial') monthsPartial++;
    else if (status === 'overdue') {
      monthsOverdue++;
      totalOverdue += Number(p.amount) - Number(p.paidAmount) || 0;
    } else if (status === 'upcoming') {
      monthsUpcoming++;
      totalUpcoming += Number(p.amount) || 0;
    } else {
      monthsUnpaid++;
    }
  }

  const totalDue = totalRemaining - totalUpcoming; // outstanding up to current month

  return {
    totalExpected,
    totalPaid,
    totalRemaining,
    totalOverdue,
    totalUpcoming,
    totalDue,
    monthsPaid,
    monthsUnpaid,
    monthsPartial,
    monthsOverdue,
    monthsUpcoming,
  };
}

async function studentLedger(student) {
  const payments = await db.col('Payment').find({ studentId: String(student._id) }, { month: 1 });
  const result = [];
  for (const p of payments) {
    const status = deriveStatus(p);
    result.push({
      month: p.month,
      amount: Number(p.amount) || 0,
      dueDate: p.dueDate,
      paidAmount: Number(p.paidAmount) || 0,
      remaining: (Number(p.amount) || 0) - (Number(p.paidAmount) || 0),
      status,
      paidAt: p.paidAt,
      transactions: (p.transactions || []).map((t) => ({ amount: Number(t.amount) || 0, date: t.date, method: t.method || 'cash', note: t.note || '', by: t.by || '' })),
    });
  }
  return result;
}

async function scanExpiring(days = 30) {
  const students = await db.col('Student').find({ status: 'active' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = [];
  for (const s of students) {
    const out = dateFromYMD(s.checkOutDate);
    if (!out) continue;
    const diff = Math.ceil((out - today) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= days) soon.push({ ...s, daysLeft: diff });
  }
  return soon.sort((a, b) => a.daysLeft - b.daysLeft);
}

async function notifyExpiring() {
  const soon = await scanExpiring(30);
  const notifications = require('./notifications');
  let count = 0;
  for (const s of soon) {
    if (!s.expiringNotified) {
      await notifications.create({
        type: 'student_expiring',
        title: 'Stay expiring soon',
        message: `Stay of ${s.name} (${s.studentId}) expires in ${s.daysLeft} days.`,
        data: { studentId: String(s._id) },
      });
      await db.col('Student').findByIdAndUpdate(s._id, { $set: { expiringNotified: true } });
      count++;
    }
  }
  return count;
}

module.exports = {
  toYMD,
  dateFromYMD,
  monthKey,
  monthsBetween,
  dueDateFor,
  generateForStudent,
  updateRentFor,
  refreshOverdue,
  deriveStatus,
  applyTransaction,
  resetPayment,
  studentFinancial,
  studentLedger,
  scanExpiring,
  notifyExpiring,
};