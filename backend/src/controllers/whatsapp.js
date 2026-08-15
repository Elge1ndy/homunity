const db = require('../db');

function normalizePhone(raw) {
  let p = String(raw || '').replace(/[^\d]/g, '');
  if (!p) return null;
  if (p.startsWith('002')) p = p.slice(3);
  if (p.startsWith('20')) return p;
  if (p.startsWith('0')) p = '20' + p.slice(1);
  return p;
}

function monthLabel(payment) {
  return payment.month;
}

exports.remind = async (req, res, next) => {
  try {
    const payment = await db.col('Payment').findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'الدفعة غير موجودة' });

    const student = await db.col('Student').findById(payment.studentId);
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });

    const phone = normalizePhone(student.phone);
    if (!phone) return res.status(400).json({ message: 'رقم هاتف الطالب غير صالح' });

    const housing = await db.col('Housing').findOne({});
    const housingName = housing?.name || 'السكن';

    const amount = payment.amount.toLocaleString('ar-EG');
    const msg =
      `مرحبًا ${student.name} 👋\n` +
      `تذكير من ${housingName}: 📌\n` +
      `الدفعة المستحقة عن شهر ${monthLabel(payment)} بقيمة ${amount} ج.م\n` +
      `تاريخ الاستحقاق: ${payment.dueDate}\n` +
      `برجاء سدادها في أقرب وقت، وشكرًا لتعاونك 🌟`;

    res.json({
      phone: '20' + phone.slice(2),
      message: msg,
      url: `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    });
  } catch (e) {
    next(e);
  }
};