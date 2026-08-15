const db = require('../db');

function inMonth(datestr, month) {
  if (!datestr) return false;
  const d = new Date(datestr);
  if (isNaN(d)) return false;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return key === month;
}

async function monthRevenue(month) {
  const payments = await db.col('Payment').find({ month });
  const students = await db.col('Student').find({});
  const sMap = {};
  const depositsCollected = { sum: 0, count: 0 };
  const depositsRefunded = { sum: 0, count: 0 };
  const depositsDeducted = { sum: 0, count: 0 };
  students.forEach((s) => {
    sMap[String(s._id)] = s;
    const d = (s.deposit && typeof s.deposit === 'object' ? s.deposit : null) || {};
    if (d.paymentStatus === 'paid' && inMonth(d.paymentDate, month)) {
      depositsCollected.sum += Number(d.originalAmount) || 0;
      depositsCollected.count++;
    }
    (d.refunds || []).forEach((t) => {
      if (inMonth(t.date, month)) {
        depositsRefunded.sum += Number(t.amount) || 0;
        depositsRefunded.count++;
      }
    });
    (d.deductions || []).forEach((t) => {
      if (inMonth(t.date, month)) {
        depositsDeducted.sum += Number(t.amount) || 0;
        depositsDeducted.count++;
      }
    });
  });
  let expected = 0;
  let collected = 0;
  const paidSet = new Set();
  const unpaidSet = new Set();
  const rows = payments.map((p) => {
    const s = sMap[String(p.studentId)] || { name: '—', studentId: '—', _id: null };
    expected += Number(p.amount) || 0;
    if (p.status === 'paid') {
      collected += Number(p.amount) || 0;
      paidSet.add(String(p.studentId));
    } else {
      unpaidSet.add(String(p.studentId));
    }
    return {
      ...p,
      _id: String(p._id),
      studentId: String(p.studentId),
      student: {
        _id: s._id ? String(s._id) : '',
        name: s.name,
        studentId: s.studentId,
        phone: s.phone,
        roomId: s.roomId,
        bedNumber: s.bedNumber,
        status: s.status,
      },
    };
  });
  rows.sort((a, b) => String(a.student.name).localeCompare(String(b.student.name), 'ar'));
  return {
    month,
    expected,
    collected,
    remaining: expected - collected,
    paidStudents: paidSet.size,
    unpaidStudents: unpaidSet.size,
    totalStudents: paidSet.size + unpaidSet.size,
    depositsCollected,
    depositsRefunded,
    depositsDeducted,
    rows,
  };
}

async function yearRevenue(year) {
  const payments = await db.col('Payment').find({});
  const students = await db.col('Student').find({});
  
  const sMap = {};
  students.forEach((s) => { sMap[String(s._id)] = s; });

  const months = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    months[key] = { month: key, expected: 0, collected: 0, paidSet: new Set(), unpaidSet: new Set() };
  }

  payments.forEach((p) => {
    const monthStr = String(p.month);
    if (!months[monthStr]) return;
    months[monthStr].expected += Number(p.amount) || 0;
    if (p.status === 'paid') {
      months[monthStr].collected += Number(p.amount) || 0;
      months[monthStr].paidSet.add(String(p.studentId));
    } else {
      months[monthStr].unpaidSet.add(String(p.studentId));
    }
  });

  const result = [];
  let totalExpected = 0;
  let totalCollected = 0;
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    const r = months[key];
    const expected = r.expected;
    const collected = r.collected;
    result.push({
      month: key,
      expected,
      collected,
      remaining: expected - collected,
      paidStudents: r.paidSet.size,
      unpaidStudents: r.unpaidSet.size,
    });
    totalExpected += expected;
    totalCollected += collected;
  }
  return { year, months: result, totalExpected, totalCollected, totalRemaining: totalExpected - totalCollected };
}

module.exports = { monthRevenue, yearRevenue };
