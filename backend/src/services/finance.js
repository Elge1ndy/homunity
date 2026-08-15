const db = require('../db');
const structure = require('./structure');
const paymentsService = require('./payments');
const depositService = require('./deposit');

const { money } = structure;

const zero = () => ({ expected: 0, collected: 0, remaining: 0, overdue: 0, upcoming: 0, due: 0, depositsHeld: 0, depositsRefunded: 0, depositsDeducted: 0, depositsRemaining: 0 });

function sumCosts(list, apartmentId) {
  let total = 0;
  (list || []).forEach((x) => {
    if (!apartmentId || String(x.apartmentId) === String(apartmentId)) total += Number(x.amount) || 0;
  });
  return total;
}

function addInto(dest, t) {
  if (!t) return dest;
  Object.keys(zero()).forEach((k) => {
    dest[k] = (dest[k] || 0) + (t[k] || 0);
  });
  return dest;
}

async function aggregate({ studentId, propertyId, apartmentId, roomId } = {}) {
  const ctx = await structure.loadContext();
  const students = ctx.students || [];
  const rooms = ctx.rooms || [];
  const properties = ctx.properties || [];

  const roomApartment = {};
  const roomFloor = {};
  const roomProperty = {};
  rooms.forEach((r) => {
    roomApartment[String(r._id)] = r.apartmentId || null;
    roomFloor[String(r._id)] = r.floorId || null;
    roomProperty[String(r._id)] = r.propertyId || null;
  });

  let scopedStudents = students;
  if (studentId) scopedStudents = students.filter((s) => String(s._id) === String(studentId));
  else if (roomId) scopedStudents = students.filter((s) => String(s.roomId) === String(roomId));
  else if (apartmentId) {
    scopedStudents = students.filter((s) => {
      const aid = roomApartment[String(s.roomId)];
      return aid && String(aid) === String(apartmentId) && (!propertyId || String(roomProperty[String(s.roomId)]) === String(propertyId));
    });
  } else if (propertyId) scopedStudents = students.filter((s) => String(roomProperty[String(s.roomId)] || s.propertyId || '') === String(propertyId));

  let scopedProperties = properties;
  if (propertyId) scopedProperties = properties.filter((p) => String(p._id) === String(propertyId));

  // property / apartment name maps
  const pMap = {};
  properties.forEach((p) => {
    pMap[String(p._id)] = p;
    (p.apartments || []).forEach((a) => {
      pMap[String(a._id)] = { ...a, propertyName: p.name, propertyId: String(p._id), propertyType: p.type };
    });
  });

  const payments = await db.col('Payment').find({});
  const payGroup = {};
  payments.forEach((p) => {
    const k = String(p.studentId);
    if (!payGroup[k]) payGroup[k] = [];
    payGroup[k].push(p);
  });

  const totals = { students: 0, expected: 0, collected: 0, remaining: 0, overdue: 0, upcoming: 0, due: 0, depositsHeld: 0, depositsRefunded: 0, depositsDeducted: 0, depositsRemaining: 0, maintenance: 0, expenses: 0, gross: 0, net: 0 };
  const studentRows = [];
  const propBuckets = {}; // propertyId -> totals
  const apBuckets = {};   // apartmentId -> totals

  for (const s of scopedStudents) {
    const ps = payGroup[String(s._id)] || [];
    const expected = ps.reduce((a, p) => a + (Number(p.amount) || 0), 0);
    const collected = ps.reduce((a, p) => a + (Number(p.paidAmount) || 0), 0);
    let overdue = 0;
    let upcoming = 0;
    for (const p of ps) {
      const st = paymentsService.deriveStatus(p);
      if (st === 'overdue') overdue += (Number(p.amount) || 0) - (Number(p.paidAmount) || 0);
      else if (st === 'upcoming') upcoming += Number(p.amount) || 0;
    }
    const remaining = expected - collected;
    const dep = depositService.compute(s);
    const rec = {
      expected, collected, remaining, overdue, upcoming,
      due: remaining - upcoming,
      depositsHeld: dep.paymentStatus === 'paid' ? Number(dep.originalAmount) || 0 : 0,
      depositsRefunded: Number(dep.refundedAmount) || 0,
      depositsDeducted: Number(dep.totalDeductions) || 0,
      depositsRemaining: Number(dep.remainingAmount) || 0,
    };

    totals.students++;
    addInto(totals, rec);

    const roomRec = { apId: roomApartment[String(s.roomId)] || null, propId: roomProperty[String(s.roomId)] || s.propertyId || '' };
    const pRec = propBuckets[roomRec.propId] || (propBuckets[roomRec.propId] = zero());
    addInto(pRec, rec);
    const aRec = apBuckets[roomRec.apId] || (apBuckets[roomRec.apId] = { ...zero(), propId: roomRec.propId });
    addInto(aRec, rec);

    const apInfo = roomRec.apId ? pMap[roomRec.apId] : null;
    studentRows.push({
      _id: String(s._id),
      name: s.name,
      studentId: s.studentId,
      phone: s.phone,
      roomNumber: s.roomNumber || '',
      bedNumber: s.bedNumber || '',
      propertyId: roomRec.propId,
      propertyName: (roomRec.propId && pMap[roomRec.propId] && pMap[roomRec.propId].name) || '',
      apartmentId: roomRec.apId || '',
      apartmentName: (apInfo && apInfo.name) || '',
      status: s.status || 'active',
      expected: money(expected),
      collected: money(collected),
      remaining: money(remaining),
      overdue: money(overdue),
      upcoming: money(upcoming),
      due: money(remaining - upcoming),
      deposit: money(Number(dep.originalAmount) || 0),
    });
  }

  totals.maintenance = money(scopedProperties.reduce((s, p) => s + sumCosts(p.maintenance, apartmentId || undefined), 0));
  totals.expenses = money(scopedProperties.reduce((s, p) => s + sumCosts(p.expenses, apartmentId || undefined), 0));
  totals.gross = money(totals.expected);
  totals.net = money(totals.expected - totals.maintenance - totals.expenses);

  const propertyRows = scopedProperties.map((p) => {
    const t = propBuckets[String(p._id)] || zero();
    const maintenance = money(sumCosts(p.maintenance, apartmentId || undefined));
    const expenses = money(sumCosts(p.expenses, apartmentId || undefined));
    return {
      _id: String(p._id),
      name: p.name,
      type: p.type,
      ...t,
      occupied: studentRows.filter((r) => String(r.propertyId) === String(p._id)).length,
      maintenance,
      expenses,
      gross: money(t.expected),
      net: money(t.expected - maintenance - expenses),
    };
  });

  const apartmentRows = [];
  Object.keys(apBuckets).forEach((aid) => {
    if (!aid) return;
    const t = apBuckets[aid];
    const info = pMap[aid] || {};
    const prop = pMap[info.propertyId] || {};
    const maintenance = money(sumCosts(prop.maintenance || [], aid));
    const expenses = money(sumCosts(prop.expenses || [], aid));
    apartmentRows.push({
      _id: aid,
      name: info.name || aid,
      propertyId: info.propertyId || '',
      propertyName: (info.propertyName || prop.name || ''),
      ...t,
      maintenance,
      expenses,
      gross: money(t.expected),
      net: money(t.expected - maintenance - expenses),
    });
  });

  const finalTotals = {};
  Object.keys(totals).forEach((k) => {
    finalTotals[k] = typeof totals[k] === 'number' ? money(totals[k]) : totals[k];
  });

  return { totals: finalTotals, students: studentRows, properties: propertyRows, apartments: apartmentRows };
}

module.exports = { aggregate };