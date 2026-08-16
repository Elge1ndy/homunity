const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const structure = require('../services/structure');

exports.list = async (req, res, next) => {
  try {
    const rooms = await db.col('Room').find({}, { number: 1 });
    const [properties] = await Promise.all([db.col('Property').find({})]);
    const propertyMap = {};
    properties.forEach((p) => {
      propertyMap[String(p._id)] = p;
    });
    const out = rooms.map((r) => {
      const property = propertyMap[String(r.propertyId || '')];
      const floor = property ? (property.floors || []).find((f) => String(f._id) === String(r.floorId)) : null;
      const ap = property ? (property.apartments || []).find((a) => String(a._id) === String(r.apartmentId)) : null;
      return {
        ...r,
        _id: String(r._id),
        propertyName: property ? property.name : '',
        floorName: floor ? structure.floorLabel(floor) : '',
        apartmentName: ap ? structure.apartmentLabel(ap) : '',
      };
    });
    res.json({ rooms: out });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const room = await db.col('Room').findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ room });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { number, type, capacity, monthlyRent, floor, status, notes, propertyId, apartmentId, floorId } = req.body;
    if (!number) return res.status(400).json({ message: 'Room number is required' });
    if (!capacity || Number(capacity) < 1) return res.status(400).json({ message: 'Invalid capacity' });
    const exists = await db.col('Room').findOne({ number: String(number).trim() });
    if (exists) return res.status(400).json({ message: 'A room with this number already exists' });
    const beds = [];
    const prices = req.body.bedPrices || {};
    for (let i = 1; i <= Number(capacity); i++) beds.push({ bedNumber: i, studentId: null, status: 'available', monthlyRent: prices[i] !== undefined && prices[i] !== null && prices[i] !== '' ? Number(prices[i]) || 0 : null });
    const room = await db.col('Room').insert({
      number: String(number).trim(),
      type: type || 'shared',
      capacity: Number(capacity),
      monthlyRent: Number(monthlyRent) || 0,
      floor: floor || '',
      status: status || 'active',
      beds,
      notes: notes || '',
      propertyId: propertyId || null,
      apartmentId: apartmentId || null,
      floorId: floorId || null,
    });
    if (propertyId) await structure.linkRoom(propertyId, room._id, apartmentId, floorId);
    await log(req, { action: `Added room ${room.number}`, category: 'rooms', targetType: 'room', targetId: room._id });
    emit(req, 'room:updated', {});
    emit(req, 'property:updated', {});
    res.json({ room });
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await db.col('Room').findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    const { number, type, monthlyRent, floor, status, capacity, notes, propertyId, apartmentId, floorId } = req.body;
    const set = {};
    if (number !== undefined) {
      const dup = await db.col('Room').findOne({ number: String(number).trim() });
      if (dup && String(dup._id) !== String(id)) return res.status(400).json({ message: 'A room with this number already exists' });
      set.number = String(number).trim();
    }
    if (type !== undefined) set.type = type;
    if (monthlyRent !== undefined) set.monthlyRent = Number(monthlyRent);
    if (floor !== undefined) set.floor = floor;
    if (status !== undefined) set.status = status;
    if (notes !== undefined) set.notes = notes;
    if (propertyId !== undefined) set.propertyId = propertyId || null;
    if (floorId !== undefined) set.floorId = floorId || null;
    if (apartmentId !== undefined) set.apartmentId = apartmentId || null;
    const relink = propertyId !== undefined || floorId !== undefined || apartmentId !== undefined;
    const newProp = propertyId !== undefined ? propertyId : room.propertyId;
    if (relink && newProp) await structure.linkRoom(newProp, room._id, apartmentId !== undefined ? apartmentId : room.apartmentId, floorId !== undefined ? floorId : room.floorId);
    if (capacity !== undefined && Number(capacity) !== room.capacity) {
      const newCap = Number(capacity);
      const occupied = (room.beds || []).filter((b) => b.studentId).length;
      if (newCap < occupied) return res.status(400).json({ message: `Cannot reduce capacity, room has ${occupied} student(s)` });
      const prices = req.body.bedPrices || {};
      const beds = [];
      for (let i = 1; i <= newCap; i++) {
        const existing = (room.beds || []).find((b) => b.bedNumber === i);
        beds.push(existing ? { ...existing } : { bedNumber: i, studentId: null, status: 'available', monthlyRent: prices[i] !== undefined && prices[i] !== null && prices[i] !== '' ? Number(prices[i]) || 0 : null });
      }
      set.beds = beds;
      set.capacity = newCap;
    } else if (req.body.bedPrices !== undefined) {
      const prices = req.body.bedPrices;
      set.beds = (room.beds || []).map((b) => {
        const v = prices[b.bedNumber];
        return v !== undefined && v !== null && v !== '' ? { ...b, monthlyRent: Number(v) || 0 } : { ...b, monthlyRent: null };
      });
    }
    const updated = await db.col('Room').findByIdAndUpdate(id, { $set: set });
    await log(req, { action: `Updated room ${updated.number}`, category: 'rooms', targetType: 'room', targetId: id });
    emit(req, 'room:updated', {});
    if (relink) emit(req, 'property:updated', {});
    res.json({ room: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await db.col('Room').findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    const occupied = (room.beds || []).filter((b) => b.studentId).length;
    if (occupied > 0) return res.status(400).json({ message: 'Cannot delete a room with students' });
    await db.col('Room').deleteById(id);
    if (room.propertyId) await structure.unlinkRoom(room.propertyId, id);
    await log(req, { action: `Deleted room ${room.number}`, category: 'rooms', targetType: 'room', targetId: id });
    emit(req, 'room:updated', {});
    emit(req, 'property:updated', {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
