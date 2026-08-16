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
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const student = await db.col('Student').findById(payment.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const phone = normalizePhone(student.phone);
    if (!phone) return res.status(400).json({ message: 'Invalid student phone number' });

    const housing = await db.col('Housing').findOne({});
    const housingName = housing?.name || 'Housing';

    const amount = payment.amount.toLocaleString('ar-EG');
    const msg =
      `Hello ${student.name} 👋\n` +
      `Reminder from ${housingName}: 📌\n` +
      `Payment due for month ${monthLabel(payment)} — ${amount} EGP\n` +
      `Due date: ${payment.dueDate}\n` +
      `Please pay as soon as possible. Thank you for your cooperation 🌟`;

    res.json({
      phone: '20' + phone.slice(2),
      message: msg,
      url: `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    });
  } catch (e) {
    next(e);
  }
};