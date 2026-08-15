const financeService = require('../services/finance');

exports.dashboard = async (req, res, next) => {
  try {
    const { studentId, propertyId, apartmentId, roomId } = req.query;
    const data = await financeService.aggregate({
      studentId: studentId ? String(studentId) : undefined,
      propertyId: propertyId ? String(propertyId) : undefined,
      apartmentId: apartmentId ? String(apartmentId) : undefined,
      roomId: roomId ? String(roomId) : undefined,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};