const db = require('../db');
const xlsx = require('xlsx-js-style');
const excel = require('../utils/excel');
const { reportPdf } = require('../utils/pdf');
const revenue = require('../services/revenue');
const paymentsService = require('../services/payments');

exports.monthly = async (req, res, next) => {
  try {
    const month = req.query.month || paymentsService.monthKey(new Date());
    const data = await revenue.monthRevenue(month);
    const housing = await db.col('Housing').findOne({});
    res.json({ ...data, currency: housing ? housing.currency : 'EGP', housing });
  } catch (e) {
    next(e);
  }
};

exports.monthlyPdf = async (req, res, next) => {
  try {
    const month = req.query.month || paymentsService.monthKey(new Date());
    const data = await revenue.monthRevenue(month);
    const housing = await db.col('Housing').findOne({});
    const buf = await reportPdf(month, data, housing);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${month}.pdf`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
};

exports.yearly = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const data = await revenue.yearRevenue(year);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.exportStudents = async (req, res, next) => {
  try {
    const filter = req.query.filter || 'all';
    const roomId = req.query.roomId || '';
    let statusFilter = {};
    if (filter === 'active') statusFilter = { status: 'active' };
    else if (filter === 'archived') statusFilter = { status: 'archived' };
    else if (filter === 'ended') statusFilter = { status: 'ended' };
    if (roomId) statusFilter.roomId = roomId;
    let students = await db.col('Student').find(statusFilter, { studentId: 1 });
    if (filter === 'paid' || filter === 'unpaid') {
      const month = paymentsService.monthKey(new Date());
      const payments = await db.col('Payment').find({ month });
      const map = {};
      payments.forEach((p) => {
        map[String(p.studentId)] = p;
      });
      students = students.filter((s) => {
        const p = map[String(s._id)];
        if (filter === 'paid') return p && p.status === 'paid';
        return !p || p.status !== 'paid';
      });
    }
    const rooms = await db.col('Room').find({});
    const roomMap = {};
    rooms.forEach((r) => {
      roomMap[String(r._id)] = r;
    });
    const statusAr = { active: 'Active', ended: 'Ended', archived: 'Archived' };
    const depositService = require('./deposit');
    const rows = students.map((s) => {
      const d = depositService.compute(s);
      return {
        'Name': s.name,
        'Phone Number': s.phone,
        'University': s.university || '',
        'Room': roomMap[s.roomId] ? roomMap[s.roomId].number : '',
        'Bed': s.bedNumber || '',
        'Monthly Rent': s.monthlyRent,
        'Deposit': d.originalAmount,
        'Deposit Payment Status': { unpaid: 'Unpaid', paid: 'Paid' }[d.paymentStatus] || d.paymentStatus,
        'Deposit Payment Date': d.paymentDate,
        'Total Deductions': d.totalDeductions,
        'Refunded': d.refundedAmount,
        'Remaining': d.remainingAmount,
        'Refund Status': depositService.REFUND_STATUS[d.refundStatus] || d.refundStatus,
        'Check-in Date': s.checkInDate || '',
        'Status': statusAr[s.status] || s.status || '',
      };
    });
    const ws = excel.jsonToSheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    const buf = excel.writeBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=students-${filter}.xlsx`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
};

exports.exportPayments = async (req, res, next) => {
  try {
    const month = req.query.month || paymentsService.monthKey(new Date());
    const data = await revenue.monthRevenue(month);
    const rows = data.rows.map((p) => ({
      'Student Name': p.student.name,
      'Student Number': p.student.studentId,
      'Phone': p.student.phone,
      'Month': p.month,
      'Amount': p.amount,
      'Due Date': p.dueDate,
      'Status': { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', overdue: 'Overdue' }[p.status] || p.status,
      'Payment Date': p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : '',
    }));
    const ws = excel.jsonToSheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Payments');
    const buf = excel.writeBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=payments-${month}.xlsx`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
};

exports.exportRooms = async (req, res, next) => {
  try {
    const rooms = await db.col('Room').find({}, { number: 1 });
    const rows = rooms.map((r) => {
      const occupied = (r.beds || []).filter((b) => b.studentId).length;
      return {
        'Room Number': r.number,
        'Type': r.type,
        'Capacity': r.capacity,
        'Monthly Rent': r.monthlyRent,
        'Current Students': occupied,
        'Available Beds': r.capacity - occupied,
        'Status': { active: 'Active', maintenance: 'Maintenance' }[r.status] || r.status,
      };
    });
    const ws = excel.jsonToSheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Rooms');
    const buf = excel.writeBuffer(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rooms.xlsx`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
};
