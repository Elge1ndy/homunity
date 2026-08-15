const fs = require('fs');
const path = require('path');
const paths = require('../utils/paths');
const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const { invoicePdf } = require('../utils/pdf');

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const invoices = await db.col('Invoice').find({});
  let seq = 0;
  for (const inv of invoices) {
    const m = new RegExp(`INV-${year}-(\\d+)$`).exec(inv.invoiceNumber || '');
    if (m) seq = Math.max(seq, Number(m[1]));
  }
  return `INV-${year}-${String(seq + 1).padStart(5, '0')}`;
}

exports.list = async (req, res, next) => {
  try {
    const invoices = await db.col('Invoice').find({}, { createdAt: -1 });
    const students = await db.col('Student').find({});
    const sMap = {};
    students.forEach((s) => {
      sMap[String(s._id)] = s;
    });
    const out = invoices.map((inv) => {
      const s = sMap[String(inv.studentId)];
      return {
        ...inv,
        _id: String(inv._id),
        student: s ? { _id: String(s._id), name: s.name, studentId: s.studentId, phone: s.phone } : null,
      };
    });
    res.json({ invoices: out });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const invoice = await db.col('Invoice').findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    const student = await db.col('Student').findById(invoice.studentId);
    const room = student && student.roomId ? await db.col('Room').findById(student.roomId) : null;
    const housing = await db.col('Housing').findOne({});
    res.json({
      invoice,
      student: student ? { ...student, roomNumber: room ? room.number : '' } : null,
      housing,
    });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { studentId, months } = req.body;
    if (!studentId || !months || !months.length) return res.status(400).json({ message: 'اختر الطالب والشهور' });
    const student = await db.col('Student').findById(studentId);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });
    const payments = await db.col('Payment').find({ studentId: String(studentId) });
    const pMap = {};
    payments.forEach((p) => {
      pMap[p.month] = p;
    });
    const items = [];
    for (const month of months) {
      const p = pMap[month];
      if (!p) return res.status(400).json({ message: `لا توجد دفعة لشهر ${month}` });
      items.push({ month, amount: Number(p.amount) || 0, status: p.status });
    }
    const total = items.reduce((a, it) => a + it.amount, 0);
    const allPaid = items.every((it) => it.status === 'paid');
    const anyPaid = items.some((it) => it.status === 'paid');
    const invoiceNumber = await nextInvoiceNumber();
    const invoice = await db.col('Invoice').insert({
      invoiceNumber,
      studentId: String(studentId),
      months,
      items,
      total,
      status: allPaid ? 'paid' : anyPaid ? 'partial' : 'unpaid',
      createdBy: String(req.user._id),
      createdByName: req.user.name,
      pdfPath: '',
    });

    const housing = await db.col('Housing').findOne({});
    const room = student.roomId ? await db.col('Room').findById(student.roomId) : null;
    const pdfBuf = await invoicePdf(invoice, { ...student, roomNumber: room ? room.number : '' }, housing);
    const pdfDir = paths.dir('uploads', 'invoices');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const pdfName = `${invoice.invoiceNumber}.pdf`;
    fs.writeFileSync(path.join(pdfDir, pdfName), pdfBuf);
    const updated = await db.col('Invoice').findByIdAndUpdate(invoice._id, { $set: { pdfPath: `/uploads/invoices/${pdfName}` } });

    await log(req, { action: `إنشاء فاتورة ${invoiceNumber} للطالب ${student.name}`, category: 'invoices', targetType: 'invoice', targetId: invoice._id });
    emit(req, 'invoice:created', {});
    res.json({ invoice: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const invoice = await db.col('Invoice').findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    if (invoice.pdfPath) {
      const p = paths.bundled(invoice.pdfPath.replace(/^\//, ''));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await db.col('Invoice').deleteById(req.params.id);
    await log(req, { action: `حذف فاتورة ${invoice.invoiceNumber}`, category: 'invoices', targetType: 'invoice', targetId: req.params.id });
    emit(req, 'invoice:created', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.pdf = async (req, res, next) => {
  try {
    const invoice = await db.col('Invoice').findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    if (invoice.pdfPath) {
      const p = path.join(paths.container(), invoice.pdfPath.replace(/^\//, ''));
      if (fs.existsSync(p)) {
        return res.download(p);
      }
    }
    const student = await db.col('Student').findById(invoice.studentId);
    const room = student && student.roomId ? await db.col('Room').findById(student.roomId) : null;
    const housing = await db.col('Housing').findOne({});
    const pdfBuf = await invoicePdf(invoice, { ...student, roomNumber: room ? room.number : '' }, housing);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuf);
  } catch (e) {
    next(e);
  }
};
