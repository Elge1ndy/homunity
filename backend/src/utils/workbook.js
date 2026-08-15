const xlsx = require('xlsx-js-style');
const db = require('../db');
const depositService = require('../controllers/deposit');

const COLLECTIONS = ['User', 'Housing', 'Student', 'Room', 'Payment', 'Invoice', 'ActivityLog'];

const SHEET_TITLES = {
  User: 'الحسابات',
  Housing: 'بيانات السكن',
  Student: 'الطلاب',
  Room: 'الغرف',
  Payment: 'المدفوعات',
  Invoice: 'الفواتير',
  ActivityLog: 'سجل النشاط',
};

const RAW_TITLES = {
  User: 'الحسابات-خام',
  Housing: 'بيانات السكن-خام',
  Student: 'الطلاب-خام',
  Room: 'الغرف-خام',
  Payment: 'المدفوعات-خام',
  Invoice: 'الفواتير-خام',
  ActivityLog: 'سجل النشاط-خام',
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
  return d.toLocaleString('ar-EG');
}

function payStatusAr(s) {
  return { paid: 'مدفوع', partial: 'جزئي', unpaid: 'غير مدفوع', overdue: 'متأخر' }[s] || 'غير مدفوع';
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
        { 'البيان': 'نوع الملف', 'القيمة': 'بيانات النظام — سكني (إدارة السكن الطلابي)' },
        { 'البيان': 'تاريخ التحديث', 'القيمة': new Date().toLocaleString('ar-EG') },
        { 'البيان': 'عدد الطلاب', 'القيمة': students.length },
        { 'البيان': 'عدد الغرف', 'القيمة': rooms.length },
        { 'البيان': 'عدد المدفوعات', 'القيمة': payments.length },
        { 'البيان': 'عدد الفواتير', 'القيمة': invoices.length },
      ],
      ['البيان', 'القيمة']
    ),
    'بيان'
  );

  const studentRows = students.map((s) => {
    const d = depositService.compute(s);
    return {
      'الاسم': s.name,
      'رقم التليفون': s.phone,
      'الجامعة': s.university || '',
      'الغرفة': rMap.get(String(s.roomId))?.number || '',
      'السرير': s.bedNumber || '',
      'الإيجار الشهري': s.monthlyRent,
      'التأمين': d.originalAmount,
      'حالة دفع التأمين': depositService.PAYMENT_STATUS[d.paymentStatus] || d.paymentStatus,
      'تاريخ دفع التأمين': d.paymentDate || '',
      'إجمالي الخصومات': d.totalDeductions,
      'المسترد': d.refundedAmount,
      'المتبقي': d.remainingAmount,
      'حالة الاسترداد': depositService.REFUND_STATUS[d.refundStatus] || d.refundStatus,
      'تاريخ الدخول': s.checkInDate || '',
      'تاريخ الخروج': s.checkOutDate || '',
      'الحالة': { active: 'نشط', ended: 'منتهي', archived: ' مؤرشف' }[s.status] || s.status || '',
    };
  });
  const studentKeys = ['الاسم', 'رقم التليفون', 'الجامعة', 'الغرفة', 'السرير', 'الإيجار الشهري', 'التأمين', 'حالة دفع التأمين', 'تاريخ دفع التأمين', 'إجمالي الخصومات', 'المسترد', 'المتبقي', 'حالة الاسترداد', 'تاريخ الدخول', 'تاريخ الخروج', 'الحالة'];
  xlsx.utils.book_append_sheet(wb, toSheet(studentRows, studentKeys), 'الطلاب');

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
        'النوع': 'خصم',
        'اسم الطالب': s.name,
        'رقم الطالب': s.studentId,
        'السكن': housingNameOf(s),
        'الغرفة': room ? room.number : '',
        'المبلغ': x.amount,
        'السبب': x.reason || '',
        'البيان': x.description || '',
        'التاريخ': x.date || '',
        'المسؤول': x.adminName || '',
      });
    });
    (d.refunds || []).forEach((x) => {
      depositRows.push({
        'النوع': 'استرداد',
        'اسم الطالب': s.name,
        'رقم الطالب': s.studentId,
        'السكن': housingNameOf(s),
        'الغرفة': room ? room.number : '',
        'المبلغ': x.amount,
        'السبب': x.method === 'cash' ? 'نقدًا' : x.method === 'transfer' ? 'تحويل بنكي' : 'أخرى',
        'البيان': x.notes || '',
        'التاريخ': x.date || '',
        'المسؤول': x.adminName || '',
      });
    });
    (d.receipts || []).forEach((r) => {
      depositRows.push({
        'النوع': 'وصل ' + (r.type === 'pay' ? 'استلام' : 'استرداد'),
        'اسم الطالب': s.name,
        'رقم الطالب': s.studentId,
        'السكن': housingNameOf(s),
        'الغرفة': room ? room.number : '',
        'المبلغ': r.type === 'pay' ? d.originalAmount : d.refundedAmount,
        'السبب': r.receiptNo,
        'البيان': '',
        'التاريخ': r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
        'المسؤول': '',
      });
    });
  });
  if (depositRows.length) {
    xlsx.utils.book_append_sheet(wb, toSheet(depositRows, ['النوع', 'اسم الطالب', 'رقم الطالب', 'السكن', 'الغرفة', 'المبلغ', 'السبب', 'البيان', 'التاريخ', 'المسؤول']), 'التأمين');
  }

  const roomRows = rooms.map((r) => {
    const occupied = (r.beds || []).filter((b) => b.studentId).length;
    return {
      'رقم الغرفة': r.number,
      'النوع': r.type,
      'السعة': r.capacity,
      'الإيجار الشهري': r.monthlyRent,
      'الطلاب الحاليون': occupied,
      'الأسرة المتاحة': r.capacity - occupied,
      'الحالة': { active: 'نشط', maintenance: 'صيانة' }[r.status] || r.status || '',
    };
  });
  xlsx.utils.book_append_sheet(wb, toSheet(roomRows, Object.keys(roomRows[0] || { 'رقم الغرفة': 1, 'النوع': 1, 'السعة': 1, 'الإيجار الشهري': 1, 'الطلاب الحاليون': 1, 'الأسرة المتاحة': 1, 'الحالة': 1 })), 'الغرف');

  const paymentRows = payments.map((p) => {
    const s = sMap.get(String(p.studentId));
    return {
      'اسم الطالب': s?.name || '—',
      'رقم الطالب': s?.studentId || '',
      'الهاتف': s?.phone || '',
      'الشهر': p.month,
      'المبلغ': p.amount,
      'تاريخ الاستحقاق': p.dueDate,
      'الحالة': payStatusAr(p.status),
      'تاريخ الدفع': p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : '',
    };
  });
  xlsx.utils.book_append_sheet(wb, toSheet(paymentRows, Object.keys(paymentRows[0] || { 'اسم الطالب': 1, 'رقم الطالب': 1, 'الهاتف': 1, 'الشهر': 1, 'المبلغ': 1, 'تاريخ الاستحقاق': 1, 'الحالة': 1, 'تاريخ الدفع': 1 })), 'المدفوعات');

  const invoiceRows = invoices.map((inv) => {
    const s = sMap.get(String(inv.studentId));
    return {
      'رقم الفاتورة': inv.invoiceNumber,
      'الطالب': s?.name || '—',
      'كود الطالب': s?.studentId || '—',
      'الشهور': (inv.months || []).join('، '),
      'الإجمالي (ج.م)': inv.total,
      'الحالة': payStatusAr(inv.status),
      'التاريخ': fmtDate(inv.createdAt),
      'تفاصيل الدفع': (inv.items || [])
        .map((it) => `${it.month} — ${Number(it.amount).toLocaleString('ar-EG')} ج.م (${payStatusAr(it.status)})`)
        .join('؛ '),
    };
  });
  xlsx.utils.book_append_sheet(wb, toSheet(invoiceRows, Object.keys(invoiceRows[0] || { 'رقم الفاتورة': 1, 'الطالب': 1, 'كود الطالب': 1, 'الشهور': 1, 'الإجمالي (ج.م)': 1, 'الحالة': 1, 'التاريخ': 1, 'تفاصيل الدفع': 1 })), 'الفواتير');

  const userRows = users.map((u) => ({
    'الاسم': u.name,
    'اسم المستخدم': u.username,
    'رقم التليفون': u.phone || '',
    'الدور': u.role === 'admin' ? 'مدير' : u.role || '',
    'الحالة': u.active === false ? 'موقوف' : 'نشط',
  }));
  xlsx.utils.book_append_sheet(wb, toSheet(userRows, Object.keys(userRows[0] || { 'الاسم': 1, 'اسم المستخدم': 1, 'رقم التليفون': 1, 'الدور': 1, 'الحالة': 1 })), 'الحسابات');

  const housingRows = housing.map((h) => ({
    'اسم السكن': h.name,
    'العنوان': h.address || '',
    'الهاتف': h.phone || '',
    'الوصف': h.description || '',
    'العملة': h.currency || 'EGP',
    'يوم الاستحقاق': h.dueDay || 1,
  }));
  xlsx.utils.book_append_sheet(wb, toSheet(housingRows, Object.keys(housingRows[0] || { 'اسم السكن': 1, 'العنوان': 1, 'الهاتف': 1, 'الوصف': 1, 'العملة': 1, 'يوم الاستحقاق': 1 })), 'بيانات السكن');

  const logRows = logs.map((l) => ({
    'الإجراء': l.action,
    'التصنيف': l.category || '',
    'المسؤول': l.adminName || '',
    'التاريخ': fmtDate(l.createdAt),
  }));
  xlsx.utils.book_append_sheet(wb, toSheet(logRows, Object.keys(logRows[0] || { 'الإجراء': 1, 'التصنيف': 1, 'المسؤول': 1, 'التاريخ': 1 })), 'سجل النشاط');

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