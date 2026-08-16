const crypto = require('crypto');
const db = require('../db');

const PROPERTY_TYPES = ['house', 'apartment'];
const PROPERTY_GENDERS = ['', 'male', 'female'];
const BED_STATUSES = ['available', 'reserved', 'maintenance'];
const LEVEL_STATUSES = ['active', 'inactive'];

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

function money(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function bedStatus(bed) {
  if (bed.studentId) return 'occupied';
  return BED_STATUSES.includes(bed.status) ? bed.status : 'available';
}

function bedRent(bed, room) {
  return Number(bed && bed.monthlyRent) > 0 ? Number(bed.monthlyRent) : Number(room && room.monthlyRent) || 0;
}

function floorLabel(floor) {
  return floor ? (floor.name || floor.code || 'Unnamed Floor') : '';
}

function apartmentLabel(ap) {
  return ap ? (ap.name || ap.code || 'Unnamed Apartment') : '';
}

function roomLabel(room) {
  return room ? (room.number || 'Room') : '';
}

async function loadContext() {
  const [properties, rooms, students, summerCourses] = await Promise.all([
    db.col('Property').find({}),
    db.col('Room').find({}),
    db.col('Student').find({}),
    db.col('SummerCourse').find({}),
  ]);
  return { properties, rooms, students, summerCourses };
}

function overlap(a1, a2, b1, b2) {
  if (!a1 || !b1) return false;
  const ae = a2 || '9999-12-31';
  const be = b2 || '9999-12-31';
  return String(a1) <= String(be) && String(b1) <= String(ae);
}

function summerActive(sc, today) {
  return sc.status !== 'ended' && String(sc.fromDate) <= today && (!sc.toDate || String(sc.toDate) >= today);
}

async function checkBedAvailability(roomId, bedNumber, from, to, opts = {}) {
  const { excludeStudentId, excludeCourseId } = opts;
  if (!roomId || !bedNumber) return { ok: true };
  const summerCourses = await db.col('SummerCourse').find({ roomId: String(roomId), bedNumber: Number(bedNumber) });
  for (const sc of summerCourses) {
    if (excludeCourseId && String(sc._id) === String(excludeCourseId)) continue;
    if (overlap(from, to, sc.fromDate, sc.toDate)) {
      return { ok: false, reason: `Bed ${bedNumber} is booked for a summer course (${sc.studentName || ''}) from ${sc.fromDate} to ${sc.toDate}` };
    }
  }
  const students = await db.col('Student').find({ roomId: String(roomId), bedNumber: Number(bedNumber), status: 'active' });
  for (const s of students) {
    if (excludeStudentId && String(s._id) === String(excludeStudentId)) continue;
    if (overlap(from, to, s.checkInDate, s.checkOutDate)) {
      return { ok: false, reason: `Bed ${bedNumber} is occupied by student (${s.name}) from ${s.checkInDate || '?'}${s.checkOutDate ? ' to ' + s.checkOutDate : ''}` };
    }
  }
  return { ok: true };
}

function buildTree(property, rooms, students, summerCourses) {
  const sMap = {};
  students.forEach((s) => {
    sMap[String(s._id)] = s;
  });
  const today = new Date().toISOString().slice(0, 10);
  const scForBed = {};
  (summerCourses || []).forEach((sc) => {
    if (!summerActive(sc, today)) return;
    const key = String(sc.roomId) + '|' + Number(sc.bedNumber);
    scForBed[key] = sc;
  });
  const roomMap = {};
  const linkMap = {};
  (property.roomLinks || []).forEach((lk) => {
    linkMap[String(lk.roomId)] = lk;
  });
  const roomsById = {};
  rooms.forEach((r) => {
    roomsById[String(r._id)] = r;
  });
  (property.roomLinks || []).forEach((lk) => {
    const r = roomsById[String(lk.roomId)];
    if (r) roomMap[String(lk.roomId)] = r;
  });

  const decorateRoom = (r) => {
    const link = linkMap[String(r._id)];
    const beds = (r.beds || []).map((b) => {
      const sc = scForBed[String(r._id) + '|' + Number(b.bedNumber)];
      const occupied = !!b.studentId || !!sc;
      const student = b.studentId
        ? (() => {
            const s = sMap[String(b.studentId)];
            return s
              ? { _id: String(s._id), name: s.name, studentId: s.studentId, status: s.status, monthlyRent: s.monthlyRent || 0, propertyName: property.name || '' }
              : { _id: String(b.studentId), name: 'Deleted Student', studentId: '', monthlyRent: 0, propertyName: property.name || '' };
          })()
        : null;
      return {
        bedNumber: b.bedNumber,
        status: occupied ? 'occupied' : bedStatus(b),
        studentId: b.studentId || null,
        monthlyRent: Number(b.monthlyRent) > 0 ? Number(b.monthlyRent) : null,
        price: bedRent(b, r),
        roomId: String(r._id),
        roomNumber: r.number,
        roomMonthlyRent: r.monthlyRent || 0,
        student,
        summer: sc
          ? {
              _id: String(sc._id),
              studentId: String(sc.studentId),
              studentName: sc.studentName || '',
              fromDate: sc.fromDate || '',
              toDate: sc.toDate || '',
              rent: sc.rent || 0,
              deposit: sc.deposit || 0,
            }
          : null,
      };
    });
    return {
      _id: String(r._id),
      number: r.number,
      type: r.type || 'shared',
      capacity: r.capacity || 0,
      monthlyRent: r.monthlyRent || 0,
      status: r.status || 'active',
      notes: r.notes || '',
      floorId: link ? link.floorId || null : r.floorId || null,
      apartmentId: link ? link.apartmentId || null : r.apartmentId || null,
      beds,
    };
  };

  const stats = { floors: 0, apartments: 0, rooms: 0, beds: 0, available: 0, reserved: 0, occupied: 0, maintenance: 0 };
  const countBeds = (roomsArr) => {
    roomsArr.forEach((r) => {
      r.beds.forEach((b) => {
        stats.beds++;
        if (b.status === 'occupied') stats.occupied++;
        else if (b.status === 'reserved') stats.reserved++;
        else if (b.status === 'maintenance') stats.maintenance++;
        else stats.available++;
      });
    });
  };

  let floors = [];
  let apartments = [];
  let unlinkedRooms = [];
  let unlinkedApartments = [];

  if (property.type === 'apartment') {
    const ap = (property.apartments || [])[0];
    const apRooms = [];
    (property.roomLinks || []).forEach((lk) => {
      const r = roomsById[String(lk.roomId)];
      if (r) apRooms.push(decorateRoom(r));
    });
    countBeds(apRooms);
    stats.rooms = apRooms.length;
    stats.apartments = property.apartments.length;
    stats.floors = 0;
    apartments = [
      {
        _id: ap ? ap._id : 'ap',
        name: ap ? ap.name : property.name,
        code: ap ? ap.code || '' : '',
        status: ap ? ap.status || 'active' : 'active',
        monthlyRent: ap ? ap.monthlyRent || 0 : 0,
        rooms: apRooms,
      },
    ];
  } else {
    const floorById = {};
    (property.floors || []).forEach((f) => {
      floorById[f._id] = f;
    });
    const apById = {};
    (property.apartments || []).forEach((a) => {
      apById[a._id] = a;
    });

    floors = (property.floors || [])
      .slice()
      .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'ar'))
      .map((f) => ({ _id: f._id, name: f.name || '', code: f.code || '', status: f.status || 'active' }));

    apartments = (property.apartments || []).map((a) => {
      const apRooms = [];
      (property.roomLinks || []).forEach((lk) => {
        if (String(lk.apartmentId) === String(a._id)) {
          const r = roomsById[String(lk.roomId)];
          if (r) apRooms.push(decorateRoom(r));
        }
      });
      stats.rooms += apRooms.length;
      countBeds(apRooms);
      return {
        _id: a._id,
        name: a.name || '',
        code: a.code || '',
        status: a.status || 'active',
        monthlyRent: a.monthlyRent || 0,
        floorId: a.floorId || null,
        rooms: apRooms,
      };
    });

    unlinkedApartments = apartments.filter((a) => !a.floorId || !floorById[a.floorId]);
    const linkedAps = apartments.filter((a) => a.floorId && floorById[a.floorId]);

    (property.roomLinks || []).forEach((lk) => {
      if (!lk.apartmentId || !apById[lk.apartmentId]) {
        const r = roomsById[String(lk.roomId)];
        if (r) unlinkedRooms.push(decorateRoom(r));
      }
    });
    stats.rooms += unlinkedRooms.length;
    countBeds(unlinkedRooms);

    floors = floors.map((f) => ({ ...f, apartments: linkedAps.filter((a) => String(a.floorId) === String(f._id)) }));
    stats.floors = floors.length;
    stats.apartments = apartments.length;
  }

  stats.occupancy = stats.beds ? Math.round((stats.occupied / stats.beds) * 100) : 0;
  return { stats, floors, apartments, unlinkedApartments, unlinkedRooms };
}

function computeStats(property, rooms, students, summerCourses) {
  return buildTree(property, rooms, students, summerCourses).stats;
}

async function listWithStats() {
  const ctx = await loadContext();
  return ctx.properties.map((p) => ({
    ...p,
    stats: computeStats(p, ctx.rooms, ctx.students, ctx.summerCourses),
  }));
}

async function ensureDefaults() {
  const count = await db.col('Property').count({});
  if (count > 0) {
    const students = await db.col('Student').find({});
    let changed = false;
    for (const s of students) {
      const set = {};
      if (!Array.isArray(s.transfers)) {
        set.transfers = [];
        changed = true;
      }
      if (!Array.isArray(s.rentHistory)) {
        set.rentHistory = [];
        changed = true;
      }
      if (changed) await db.col('Student').findByIdAndUpdate(s._id, { $set: set });
    }
    return null;
  }
  const housing = await db.col('Housing').findOne({});
  const rooms = await db.col('Room').find({});
  const property = await db.col('Property').insert({
    name: (housing && housing.name) || 'Primary Housing',
    code: '',
    type: 'house',
    gender: '',
    address: (housing && housing.address) || '',
    notes: '',
    status: 'active',
    floors: [],
    apartments: [],
    roomLinks: rooms.map((r) => ({ _id: genId(), roomId: String(r._id), apartmentId: null, floorId: null })),
  });
  for (const r of rooms) {
    await db.col('Room').findByIdAndUpdate(r._id, { $set: { propertyId: String(property._id), apartmentId: null, floorId: null } });
  }
  const students = await db.col('Student').find({});
  for (const s of students) {
    await db.col('Student').findByIdAndUpdate(s._id, { $set: { propertyId: String(property._id), transfers: Array.isArray(s.transfers) ? s.transfers : [], rentHistory: Array.isArray(s.rentHistory) ? s.rentHistory : [] } });
  }
  console.log('[structure] Property migrated from existing data: ' + property.name + ' (' + rooms.length + ' rooms)');
  return property;
}

async function linkRoom(propertyId, roomId, apartmentId, floorId) {
  const property = await db.col('Property').findById(propertyId);
  if (!property) return null;
  const roomLinks = (property.roomLinks || []).filter((lk) => String(lk.roomId) !== String(roomId)).concat([{ _id: genId(), roomId: String(roomId), apartmentId: apartmentId || null, floorId: floorId || null }]);
  await db.col('Property').findByIdAndUpdate(propertyId, { $set: { roomLinks } });
  await db.col('Room').findByIdAndUpdate(roomId, { $set: { propertyId: String(propertyId), apartmentId: apartmentId || null, floorId: floorId || null } });
  return true;
}

async function unlinkRoom(propertyId, roomId) {
  const property = await db.col('Property').findById(propertyId);
  if (!property) return false;
  const roomLinks = (property.roomLinks || []).filter((lk) => String(lk.roomId) !== String(roomId));
  await db.col('Property').findByIdAndUpdate(propertyId, { $set: { roomLinks } });
  return true;
}

async function labelsFor({ roomId, bedNumber }) {
  const ctx = await loadContext();
  const room = roomId ? ctx.rooms.find((r) => String(r._id) === String(roomId)) : null;
  if (!room) return { propertyName: '', floorName: '', apartmentName: '', roomNumber: '', bedNumber: bedNumber || null };
  const property = ctx.properties.find((p) => String(p._id) === String(room.propertyId)) || ctx.properties[0];
  const floor = property ? (property.floors || []).find((f) => String(f._id) === String(room.floorId)) : null;
  const ap = property ? (property.apartments || []).find((a) => String(a._id) === String(room.apartmentId)) : null;
  return {
    propertyId: property ? String(property._id) : '',
    propertyName: property ? property.name : '',
    floorName: floorLabel(floor),
    apartmentName: apartmentLabel(ap),
    roomNumber: roomLabel(room),
    bedNumber: bedNumber || null,
  };
}

async function allLabels() {
  const ctx = await loadContext();
  const out = [];
  for (const p of ctx.properties) {
    const tree = buildTree(p, ctx.rooms, ctx.students);
    const walk = (ap, floor) => {
      ap.rooms.forEach((room) => {
        room.beds.forEach((b) => {
          out.push({
            propertyId: String(p._id),
            propertyName: p.name,
            propertyType: p.type,
            gender: p.gender || '',
            floorId: floor ? floor._id : room.floorId || null,
            floorName: floor ? floor.name : '',
            apartmentId: ap._id,
            apartmentName: ap.name,
            roomId: room._id,
            roomNumber: room.number,
            bedNumber: b.bedNumber,
            status: b.status,
            studentId: b.studentId,
            monthlyRent: room.monthlyRent || ap.monthlyRent || 0,
          });
        });
      });
    };
    if (p.type === 'apartment') {
      tree.apartments.forEach((ap) => walk(ap, null));
    } else {
      tree.floors.forEach((f) => {
        f.apartments.forEach((ap) => walk(ap, f));
      });
      tree.unlinkedApartments.forEach((ap) => walk(ap, null));
    }
    tree.unlinkedRooms.forEach((room) => {
      room.beds.forEach((b) => {
        out.push({
          propertyId: String(p._id),
          propertyName: p.name,
          propertyType: p.type,
          gender: p.gender || '',
          floorId: null,
          floorName: '',
          apartmentId: null,
          apartmentName: '',
          roomId: room._id,
          roomNumber: room.number,
          bedNumber: b.bedNumber,
          status: b.status,
          studentId: b.studentId,
          monthlyRent: room.monthlyRent || 0,
        });
      });
    });
  }
  return out;
}

module.exports = {
  PROPERTY_TYPES,
  PROPERTY_GENDERS,
  BED_STATUSES,
  LEVEL_STATUSES,
  genId,
  money,
  bedStatus,
  bedRent,
  floorLabel,
  apartmentLabel,
  roomLabel,
  loadContext,
  buildTree,
  computeStats,
  listWithStats,
  ensureDefaults,
  linkRoom,
  unlinkRoom,
  labelsFor,
  allLabels,
  overlap,
  summerActive,
  checkBedAvailability,
};
