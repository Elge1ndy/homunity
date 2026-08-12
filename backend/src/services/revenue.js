const db = require('../db');

async function monthRevenue(month) {
  const payments = await db.col('Payment').find({ month });
  const students = await db.col('Student').find({});
  const sMap = {};
  students.forEach((s) => {
    sMap[String(s._id)] = s;
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
    rows,
  };
}

async function yearRevenue(year) {
  const months = [];
  let totalExpected = 0;
  let totalCollected = 0;
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    const r = await monthRevenue(key);
    months.push({
      month: key,
      expected: r.expected,
      collected: r.collected,
      remaining: r.remaining,
      paidStudents: r.paidStudents,
      unpaidStudents: r.unpaidStudents,
    });
    totalExpected += r.expected;
    totalCollected += r.collected;
  }
  return { year, months, totalExpected, totalCollected, totalRemaining: totalExpected - totalCollected };
}

module.exports = { monthRevenue, yearRevenue };
