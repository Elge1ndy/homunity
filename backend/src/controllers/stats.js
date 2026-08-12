const db = require('../db');
const revenue = require('../services/revenue');
const paymentsService = require('../services/payments');

exports.stats = async (req, res, next) => {
  try {
    const [students, rooms, notifications, activity] = await Promise.all([
      db.col('Student').find({}),
      db.col('Room').find({}),
      db.col('Notification').find({}, { createdAt: -1 }),
      db.col('ActivityLog').find({}, { createdAt: -1 }),
    ]);

    const activeStudents = students.filter((s) => s.status === 'active');
    const archivedCount = students.filter((s) => s.status === 'archived').length;
    const endedCount = students.filter((s) => s.status === 'ended').length;

    const roomMap = {};
    rooms.forEach((r) => {
      roomMap[String(r._id)] = r;
    });

    let occupied = 0;
    let totalBeds = 0;
    rooms.forEach((r) => {
      totalBeds += Number(r.capacity) || 0;
      occupied += (r.beds || []).filter((b) => b.studentId).length;
    });

    const curMonth = paymentsService.monthKey(new Date());
    const monthData = await revenue.monthRevenue(curMonth);

    const unpaidList = monthData.rows
      .filter((r) => r.status !== 'paid')
      .slice(0, 8)
      .map((r) => ({ ...r, room: roomMap[r.student.roomId] ? roomMap[r.student.roomId].number : '' }));

    const expiring = await paymentsService.scanExpiring(30);

    const recentActivity = activity.slice(0, 10).map((a) => ({
      ...a,
      _id: String(a._id),
    }));

    const unreadNotifications = notifications.filter((n) => !(n.readBy || []).includes(String(req.user._id))).length;

    res.json({
      students: {
        total: students.length,
        active: activeStudents.length,
        archived: archivedCount,
        ended: endedCount,
      },
      beds: { occupied, total: totalBeds, free: totalBeds - occupied },
      occupancy: totalBeds ? Math.round((occupied / totalBeds) * 100) : 0,
      roomsCount: rooms.length,
      currentMonth: { month: curMonth, ...monthData },
      unpaidList,
      expiring,
      unreadNotifications,
      recentActivity,
    });
  } catch (e) {
    next(e);
  }
};
