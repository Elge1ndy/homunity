const xlsx = require('xlsx-js-style');
const db = require('../db');
const depositService = require('../controllers/deposit');

const COLLECTIONS = ['User', 'Housing', 'Student', 'Room', 'Payment', 'Invoice', 'ActivityLog'];

const SHEET_TITLES = {
  User: 'Users',
  Housing: 'Housing',
  Student: 'Students',
  Room: 'Rooms',
  Payment: 'Payments',
  Invoice: 'Invoices',
  ActivityLog: 'Activity Log',
};

const RAW_TITLES = {
  User: 'Users-Raw',
  Housing: 'Housing-Raw',
  Student: 'Students-Raw',
  Room: 'Rooms-Raw',
  Payment: 'Payments-Raw',
  Invoice: 'Invoices-Raw',
  ActivityLog: 'Activity Log-Raw',
};

function colNames(docs) {
  const names = new Set(['_id']);
  for (const d of docs) for (const k of Object.keys(d || {})) names.add(k);
  return [...names];
}

function cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleString('en-US');
}

function payStatusAr(s) {
  return { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', overdue: 'Overdue' }[s] || 'Unpaid';
}

function toSheet(rows, names) {
  return rows.length ? xlsx.utils.json_to_sheet(rows, { header: names }) : xlsx.utils.aoa_to_sheet([names]);
}

async function buildWorkbook() {
  const wb = xlsx.utils.book_new();

  const students = await db.col('Student').find({}, { studentId: 1 });
  const rooms = await db.col('Room').find({}, { number: 1 });
  const payments = await db.col('Payment').find({}, { studentId: 1 });
  const invoices = await db.col('Invoice').find({}, { createdAt: -1 });
  const users = await db.col('User').find({});
  const housing = await db.col('Housing').find({});
  const logs = await db.col('ActivityLog').find({}, { createdAt: -1 });

  const sMap = new Map(students.map((s) => [String(s._id), s]));
  const rMap = new Map(rooms.map((r) => [String(r._id), r]));

  xlsx.utils.book_append_sheet(
    wb,
    toSheet(
      [
        { 'Label': 'File Type', 'Value': 'System Data — Homeunity (Student Housing Management)' },
        { 'Label': 'Last Updated', 'Value': new Date().toLocaleString('en-US') },
        { 'Label': 'Student Count', 'Value': students.length },
        { 'Label': 'Room Count', 'Value': rooms.length },
        { 'Label': 'Payment Count', 'Value': payments.length },
        { 'Label': 'Invoice Count', 'Value': invoices.length },
      ],
      ['Label', 'Value']
    ),
    'Summary'
  );

  const studentRows = students.map((s) => {
    const d = depositService.compute(s);
    return {
      'Name': s.name,
      'Phone': s.phone,
      'University': s.university || '',
      'Room': rMap.get(String(s.roomId))?.number || '',
      'Bed': s.bedNumber || '',
      'Monthly Rent': s.monthlyRent,
      'Deposit': d.originalAmount,
      'Deposit Payment Status': depositService.PAYMENT_STATUS[d.paymentStatus] || d.paymentStatus,
      'Deposit Payment Date': d.paymentDate || '',
      'Total Deductions': d.totalDeductions,
      'Refunded': d.refundedAmount,
      'Remaining': d.remainingAmount,
      'Refund Status': depositService.REFUND_STATUS[d.refundStatus] || d.refundStatus,
      'Check-in Date': s.checkInDate || '',
      'Check-out Date': s.checkOutDate || '',
      'Status': { active: 'Active', ended: 'Ended', archived: 'Archived' }[s.status] || s.status || '',
    };
  });
  const studentKeys = ['Name', 'Phone', 'University', 'Room', 'Bed', 'Monthly Rent', 'Deposit', 'Deposit Payment Status', 'Deposit Payment Date', 'Total Deductions', 'Refunded', 'Remaining', 'Refund Status', 'Check-in Date', 'Check-out Date', 'Status'];
  xlsx.utils.book_append_sheet(wb, toSheet(studentRows, studentKeys), 'Students');

  const depositRows = [];
  const housingMap = {};
  housing.forEach((h) => {
    housingMap[String(h._id)] = h.name;
  });
  const housingNameOf = (s) => housingMap[String(s.housingId || '')] || '';
  students.forEach((s) => {
    const d = depositService.compute(s);
    const room = rMap.get(String(s.roomId));
    (d.deductions || []).forEach((x) => {
      depositRows.push({
        'Type': 'Deduction',
        'Student Name': s.name,
        'Student ID': s.studentId,
        'Housing': housingNameOf(s),
        'Room': room ? room.number : '',
        'Amount': x.amount,
        'Reason': x.reason || '',
        'Description': x.description || '',
        'Date': x.date || '',
        'Admin': x.adminName || '',
      });
    });
    (d.refunds || []).forEach((x) => {
      depositRows.push({
        'Type': 'Refund',
        'Student Name': s.name,
        'Student ID': s.studentId,
        'Housing': housingNameOf(s),
        'Room': room ? room.number : '',
        'Amount': x.amount,
        'Reason': x.method === 'cash' ? 'Cash' : x.method === 'transfer' ? 'Bank Transfer' : 'Other',
        'Description': x.notes || '',
        'Date': x.date || '',
        'Admin': x.adminName || '',
      });
    });
    (d.receipts || []).forEach((r) => {
      depositRows.push({
        'Type': 'Receipt ' + (r.type === 'pay' ? 'Payment' : 'Refund'),
        'Student Name': s.name,
        'Student ID': s.studentId,
        'Housing': housingNameOf(s),
        'Room': room ? room.number : '',
        'Amount': r.type === 'pay' ? d.originalAmount : d.refundedAmount,
        'Reason': r.receiptNo,
        'Description': '',
        'Date': r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
        'Admin': '',
      });
    });
  });
  if (depositRows.length) {
    xlsx.utils.book_append_sheet(wb, toSheet(depositRows, ['Type', 'Student Name', 'Student ID', 'Housing', 'Room', 'Amount', 'Reason', 'Description', 'Date', 'Admin']), 'Deposits');
  }

  const roomRows = rooms.map((r) => {
    const occupied = (r.beds || []).filter((b) => b.studentId).length;
    return {
      'Room Number': r.number,
      'Type': r.type,
      'Capacity': r.capacity,
      'Monthly Rent': r.monthlyRent,
      'Current Students': occupied,
      'Available Beds': r.capacity - occupied,
      'Status': { active: 'Active', maintenance: 'Maintenance' }[r.status] || r.status || '',
    };
  });
  xlsx.utils.book_append_sheet(wb, toSheet(roomRows, Object.keys(roomRows[0] || { 'Room Number': 1, 'Type': 1, 'Capacity': 1, 'Monthly Rent': 1, 'Current Students': 1, 'Available Beds': 1, 'Status': 1 })), 'Rooms');

  const paymentRows = payments.map((p) => {
    const s = sMap.get(String(p.studentId));
    return {
      'Student Name': s?.name || '—',
      'Student ID': s?.studentId || '',
      'Phone': s?.phone || '',
      'Month': p.month,
      'Amount': p.amount,
      'Due Date': p.dueDate,
      'Status': payStatusAr(p.status),
      'Payment Date': p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : '',
    };
  });
  xlsx.utils.book_append_sheet(wb, toSheet(paymentRows, Object.keys(paymentRows[0] || { 'Student Name': 1, 'Student ID': 1, 'Phone': 1, 'Month': 1, 'Amount': 1, 'Due Date': 1, 'Status': 1, 'Payment Date': 1 })), 'Payments');

  const invoiceRows = invoices.map((inv) => {
    const s = sMap.get(String(inv.studentId));
    return {
      'Invoice Number': inv.invoiceNumber,
      'Student': s?.name || '—',
      'Student ID': s?.studentId || '—',
      'Months': (inv.months || []).join(', '),
      'Total (EGP)': inv.total,
      'Status': payStatusAr(inv.status),
      'Date': fmtDate(inv.createdAt),
      'Payment Details': (inv.items || [])
        .map((it) => `${it.month} — ${Number(it.amount).toLocaleString('en-US')} EGP (${payStatusAr(it.status)})`)
        .join('; '),
    };
  });
  xlsx.utils.book_append_sheet(wb, toSheet(invoiceRows, Object.keys(invoiceRows[0] || { 'Invoice Number': 1, 'Student': 1, 'Student ID': 1, 'Months': 1, 'Total (EGP)': 1, 'Status': 1, 'Date': 1, 'Payment Details': 1 })), 'Invoices');

  const userRows = users.map((u) => ({
    'Name': u.name,
    'Username': u.username,
    'Phone': u.phone || '',
    'Role': u.role === 'admin' ? 'Admin' : u.role || '',
    'Status': u.active === false ? 'Suspended' : 'Active',
  }));
  xlsx.utils.book_append_sheet(wb, toSheet(userRows, Object.keys(userRows[0] || { 'Name': 1, 'Username': 1, 'Phone': 1, 'Role': 1, 'Status': 1 })), 'Users');

  const housingRows = housing.map((h) => ({
    'Housing Name': h.name,
    'Address': h.address || '',
    'Phone': h.phone || '',
    'Description': h.description || '',
    'Currency': h.currency || 'EGP',
    'Due Day': h.dueDay || 1,
  }));
  xlsx.utils.book_append_sheet(wb, toSheet(housingRows, Object.keys(housingRows[0] || { 'Housing Name': 1, 'Address': 1, 'Phone': 1, 'Description': 1, 'Currency': 1, 'Due Day': 1 })), 'Housing');

  const logRows = logs.map((l) => ({
    'Action': l.action,
    'Category': l.category || '',
    'Admin': l.adminName || '',
    'Date': fmtDate(l.createdAt),
  }));
  xlsx.utils.book_append_sheet(wb, toSheet(logRows, Object.keys(logRows[0] || { 'Action': 1, 'Category': 1, 'Admin': 1, 'Date': 1 })), 'Activity Log');

  for (const name of COLLECTIONS) {
    const docs = name === 'Invoice' ? invoices : await db.col(name).find({});
    const names = colNames(docs);
    const rows = docs.map((d) => {
      const row = { _id: String(d._id || '') };
      for (const k of names) {
        if (k === '_id') continue;
        row[k] = cell(d[k]);
      }
      return row;
    });
    xlsx.utils.book_append_sheet(wb, toSheet(rows, names), RAW_TITLES[name]);
  }

  return wb;
}

module.exports = { buildWorkbook };