const { money, genId } = require('./structure');

function emptyDeposit() {
  return {
    originalAmount: 0,
    paymentStatus: 'unpaid',
    paymentDate: '',
    paymentMethod: '',
    paymentProof: '',
    notes: '',
    totalDeductions: 0,
    deductions: [],
    refundedAmount: 0,
    refunds: [],
    remainingAmount: 0,
    refundStatus: 'none',
    refundDate: '',
    receipts: [],
    audit: [],
  };
}

function newId() { return genId(); }

function normalize(student) {
  let d = student.deposit;
  if (!d || typeof d !== 'object') {
    const legacy = student.depositTxns || [];
    d = emptyDeposit();
    if (Array.isArray(legacy) && legacy.length) {
      const paid = legacy.filter((t) => t.type === 'paid');
      const refunds = legacy.filter((t) => t.type === 'refund');
      const deductions = legacy.filter((t) => t.type === 'deduct');
      if (paid.length) {
        d.originalAmount = money(paid.reduce((a, t) => a + money(t.amount), 0));
        d.paymentStatus = 'paid';
        d.paymentDate = (paid[0].date || '').slice(0, 10);
        d.receipts = paid.map((t) => ({ _id: t._id, type: 'pay', receiptNo: t.receiptNo, createdAt: t.date }));
      }
      d.refunds = refunds.map((t) => ({ _id: t._id, amount: money(t.amount), date: (t.date || '').slice(0, 10), method: 'cash', proof: '', notes: t.note, adminId: '', adminName: t.by, createdAt: t.date }));
      d.deductions = deductions.map((t) => ({ _id: t._id, amount: money(t.amount), reason: '', description: t.note, date: (t.date || '').slice(0, 10), adminId: '', adminName: t.by, attachment: '', createdAt: t.date }));
    }
  }
  return {
    ...emptyDeposit(),
    ...d,
    originalAmount: money(d.originalAmount),
    deductions: (d.deductions || []).map((x) => ({ _id: x._id || newId(), amount: money(x.amount), reason: x.reason || '', description: x.description || '', date: x.date || '', adminId: x.adminId || '', adminName: x.adminName || '', attachment: x.attachment || '', createdAt: x.createdAt || x.date || '' })),
    refunds: (d.refunds || []).map((x) => ({ _id: x._id || newId(), amount: money(x.amount), date: x.date || '', method: x.method || '', proof: x.proof || '', notes: x.notes || '', adminId: x.adminId || '', adminName: x.adminName || '', createdAt: x.createdAt || x.date || '' })),
    receipts: (d.receipts || []).map((x) => ({ _id: x._id || newId(), type: x.type || 'pay', receiptNo: x.receiptNo || '', createdAt: x.createdAt || '' })),
    audit: (d.audit || []).map((x) => ({ _id: x._id || newId(), action: x.action || '', note: x.note || '', amount: money(x.amount), adminId: x.adminId || '', adminName: x.adminName || '', createdAt: x.createdAt || '' })),
  };
}

function compute(student) {
  const d = normalize(student);
  const totalDeductions = money(d.deductions.reduce((a, x) => a + x.amount, 0));
  const refundedAmount = money(d.refunds.reduce((a, x) => a + x.amount, 0));
  const remainingAmount = Math.max(0, money(d.originalAmount - totalDeductions - refundedAmount));
  const paymentStatus = d.paymentStatus === 'paid' ? 'paid' : 'unpaid';
  let refundStatus = d.refundStatus === 'none' ? 'none' : d.refundStatus;
  if (d.originalAmount > 0) {
    if (refundedAmount > 0 && remainingAmount <= 0 && refundedAmount >= money(d.originalAmount - totalDeductions)) refundStatus = 'full';
    else if (refundedAmount > 0) refundStatus = 'partial';
    else if (paymentStatus === 'paid' && (student.status || '') === 'ended' && remainingAmount > 0) refundStatus = 'pending';
  }
  let status = 'unpaid';
  if (paymentStatus === 'paid') {
    if (refundStatus === 'full') status = 'full';
    else if (refundStatus === 'partial') status = 'partial';
    else if (refundStatus === 'pending') status = 'pending';
    else status = 'paid';
  }
  return {
    originalAmount: d.originalAmount,
    paymentStatus,
    paymentDate: d.paymentDate,
    paymentMethod: d.paymentMethod,
    paymentProof: d.paymentProof,
    notes: d.notes,
    totalDeductions,
    deductions: d.deductions,
    refundedAmount,
    refunds: d.refunds,
    remainingAmount,
    refundStatus,
    refundDate: d.refundDate,
    receipts: d.receipts,
    audit: d.audit,
    status,
  };
}

module.exports = { normalize, compute, emptyDeposit };
