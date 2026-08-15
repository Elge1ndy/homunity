const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');
const structure = require('../services/structure');

const { genId, money, bedStatus } = structure;

function emitAll(req) {
  emit(req, 'property:updated', {});
  emit(req, 'room:updated', {});
}

async function findProperty(id, res) {
  const property = await db.col('Property').findById(id);
  if (!property) {
    if (res) res.status(404).json({ message: 'العقار غير موجود' });
    return null;
  }
  return property;
}

exports.list = async (req, res, next) => {
  try {
    const properties = await structure.listWithStats();
    res.json({ properties });
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const ctx = await structure.loadContext();
    const tree = structure.buildTree(property, ctx.rooms, ctx.students, ctx.summerCourses);
    res.json({ property, ...tree });
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, code, type, gender, address, notes, floors, apartments } = req.body;
    if (!name) return res.status(400).json({ message: 'اسم العقار مطلوب' });
    const ptype = structure.PROPERTY_TYPES.includes(type) ? type : 'house';
    const pgender = structure.PROPERTY_GENDERS.includes(gender) ? gender : '';
    if (ptype === 'apartment') {
      const property = await db.col('Property').insert({
        name: String(name).trim(),
        code: String(code || '').trim(),
        type: ptype,
        gender: pgender,
        address: address || '',
        notes: notes || '',
        status: 'active',
        floors: [],
        apartments: [
          {
            _id: genId(),
            name: String(name).trim(),
            code: String(code || '').trim(),
            status: 'active',
            monthlyRent: money(apartments && apartments[0] ? apartments[0].monthlyRent : 0),
            floorId: null,
          },
        ],
        roomLinks: [],
      });
      await log(req, { action: `تمت إضافة شقة مستقلة ${property.name}`, category: 'properties', targetType: 'property', targetId: property._id });
      emit(req, 'property:updated', {});
      res.json({ property });
    } else {
      const floorDocs = (floors || []).map((f) => ({ _id: genId(), name: String(f.name || '').trim(), code: String(f.code || '').trim(), status: f.status === 'inactive' ? 'inactive' : 'active', sort: Number(f.sort) || 0 }));
      const property = await db.col('Property').insert({
        name: String(name).trim(),
        code: String(code || '').trim(),
        type: ptype,
        gender: pgender,
        address: address || '',
        notes: notes || '',
        status: 'active',
        floors: floorDocs,
        apartments: [],
        roomLinks: [],
      });
      await log(req, { action: `تمت إضافة بيت ${property.name} بأدواره (${floorDocs.length})`, category: 'properties', targetType: 'property', targetId: property._id });
      emit(req, 'property:updated', {});
      res.json({ property });
    }
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const property = await findProperty(id, res);
    if (!property) return;
    const { name, code, type, gender, address, notes } = req.body;
    const ptype = structure.PROPERTY_TYPES.includes(type) ? type : property.type;
    const pgender = structure.PROPERTY_GENDERS.includes(gender) ? gender : property.gender;
    const set = {};
    if (name) set.name = String(name).trim();
    if (code) set.code = String(code).trim();
    if (type) set.type = ptype;
    if (gender) set.gender = pgender;
    if (address) set.address = address || '';
    if (notes !== undefined) set.notes = notes || '';
    const updated = await db.col('Property').findByIdAndUpdate(id, { $set: set }, { new: true });
    await structure.ensureDefaults();
    await log(req, { action: `تم تعديل بيانات العقار ${updated.name}`, category: 'properties', targetType: 'property', targetId: id });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    const property = await findProperty(id, res);
    if (!property) return;
    const rooms = await db.col('Room').find({ propertyId: String(property._id) });
    for (const r of rooms) {
      await db.col('Room').findByIdAndUpdate(r._id, { $set: { propertyId: '', apartmentId: '', floorId: '' } });
    }
    await db.col('Property').deleteById(id);
    await log(req, { action: `تم حذف العقار ${property.name}`, category: 'properties', targetType: 'property', targetId: id });
    emit(req, 'property:updated', {});
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (e) {
    next(e);
  }
};

exports.setBedStatus = async (req, res, next) => {
  try {
    const room = await db.col('Room').findById(req.params.rid);
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' });
    const { bedNumber, status: bedstat } = req.body;
    const beds = (room.beds || []).map((b) => (Number(b.bedNumber) === Number(bedNumber) ? { ...b, status: bedStatus(bedstat) } : b));
    const updated = await db.col('Room').findByIdAndUpdate(room._id, { $set: { beds } }, { new: true });
    await log(req, { action: `تغيير حالة السرير ${bedNumber} في غرفة ${room.number}`, category: 'properties', targetType: 'room', targetId: String(room._id) });
    emitAll(req);
    res.json({ room: updated });
  } catch (e) {
    next(e);
  }
};

exports.setBedPrice = async (req, res, next) => {
  try {
    const room = await db.col('Room').findById(req.params.rid);
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' });
    const bn = Number(req.params.bn);
    const price = money(req.body.price === undefined ? 0 : req.body.price);
    const beds = (room.beds || []).map((b) => (Number(b.bedNumber) === bn ? { ...b, monthlyRent: price } : b));
    const updated = await db.col('Room').findByIdAndUpdate(room._id, { $set: { beds } }, { new: true });
    await log(req, { action: `تعديل سعر السرير ${bn} في غرفة ${room.number} إلى ${price}`, category: 'properties', targetType: 'room', targetId: String(room._id) });
    emitAll(req);
    res.json({ room: updated });
  } catch (e) {
    next(e);
  }
};

exports.removeBed = async (req, res, next) => {
  try {
    const room = await db.col('Room').findById(req.params.rid);
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' });
    const bn = Number(req.params.bn);
    const bed = (room.beds || []).find((b) => Number(b.bedNumber) === bn);
    if (bed && bed.studentId) {
      // prevent deletion of occupied bed; clear it instead
      const students = await db.col('Student').find({});
      const s = students.find((x) => String(x._id) === String(bed.studentId));
      if (s) return res.status(400).json({ message: `السرير ${bn} مشغول بالطالب ${s.name} — لا يمكن حذفه` });
    }
    const beds = (room.beds || []).filter((b) => Number(b.bedNumber) !== bn);
    const updated = await db.col('Room').findByIdAndUpdate(room._id, { $set: { beds } }, { new: true });
    await log(req, { action: `حذف السرير ${bn} من غرفة ${room.number}`, category: 'properties', targetType: 'room', targetId: String(room._id) });
    emitAll(req);
    res.json({ room: updated });
  } catch (e) {
    next(e);
  }
};

exports.addFloor = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const { name, code, sort } = req.body;
    if (!name) return res.status(400).json({ message: 'اسم الدور مطلوب' });
    const floors = (property.floors || []).concat([{ _id: genId(), name: String(name).trim(), code: String(code || '').trim(), status: 'active', sort: Number(sort) || 0 }]);
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { floors } }, { new: true });
    await log(req, { action: `إضافة دور ${name} إلى ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

exports.updateFloor = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const { name, code, sort } = req.body;
    const floors = (property.floors || []).map((f) => (String(f._id) === String(req.params.fid) ? { ...f, name: name !== undefined ? String(name).trim() : f.name, code: code !== undefined ? String(code).trim() : f.code, sort: sort !== undefined ? Number(sort) : f.sort } : f));
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { floors } }, { new: true });
    await log(req, { action: `تعديل دور في ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

exports.removeFloor = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const fid = String(req.params.fid);
    const floors = (property.floors || []).filter((f) => String(f._id) !== fid);
    const apartments = (property.apartments || []).filter((a) => String(a.floorId) !== fid);
    const roomLinks = (property.roomLinks || []).filter((lk) => String(lk.floorId) !== fid);
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { floors, apartments, roomLinks } }, { new: true });
    await log(req, { action: `حذف دور من ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

exports.addApartment = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const { name, code, monthlyRent, floorId } = req.body;
    if (!name) return res.status(400).json({ message: 'اسم الشقة مطلوب' });
    const apartments = (property.apartments || []).concat([{ _id: genId(), name: String(name).trim(), code: String(code || '').trim(), status: 'active', monthlyRent: money(monthlyRent || 0), floorId: floorId || null }]);
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { apartments } }, { new: true });
    await log(req, { action: `إضافة شقة ${name} إلى ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

exports.updateApartment = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const { name, code, monthlyRent, floorId } = req.body;
    const apartments = (property.apartments || []).map((a) => (String(a._id) === String(req.params.aid) ? { ...a, name: name !== undefined ? String(name).trim() : a.name, code: code !== undefined ? String(code).trim() : a.code, monthlyRent: monthlyRent !== undefined ? money(monthlyRent) : a.monthlyRent, floorId: floorId !== undefined ? floorId : a.floorId } : a));
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { apartments } }, { new: true });
    await log(req, { action: `تعديل شقة في ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

exports.removeApartment = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const aid = String(req.params.aid);
    const apartments = (property.apartments || []).filter((a) => String(a._id) !== aid);
    const roomLinks = (property.roomLinks || []).map((lk) => (String(lk.apartmentId) === aid ? { ...lk, apartmentId: null, floorId: null } : lk));
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { apartments, roomLinks } }, { new: true });
    await log(req, { action: `حذف شقة من ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

exports.addRoom = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const { roomId, apartmentId, floorId } = req.body;
    if (!roomId) return res.status(400).json({ message: 'الغرفة مطلوبة' });
    const room = await db.col('Room').findById(roomId);
    if (!room) return res.status(404).json({ message: 'الغرفة غير موجودة' });
    const ok = await structure.linkRoom(String(property._id), String(room._id), apartmentId || null, floorId || null);
    if (!ok) return res.status(400).json({ message: 'تعذر ربط الغرفة' });
    await log(req, { action: `ربط غرفة ${room.number} بالعقار ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ message: 'تم الربط بنجاح' });
  } catch (e) {
    next(e);
  }
};

exports.removeRoom = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const rid = String(req.params.rid);
    await structure.unlinkRoom(String(property._id), rid);
    const room = await db.col('Room').findById(rid);
    if (room) {
      await db.col('Room').findByIdAndUpdate(rid, { $set: { propertyId: '', apartmentId: '', floorId: '' } });
    }
    await log(req, { action: `فصل غرفة عن العقار ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ message: 'تم الفصل بنجاح' });
  } catch (e) {
    next(e);
  }
};

exports.addMaintenance = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const { name, amount, apartmentId } = req.body;
    if (!name || amount === undefined) return res.status(400).json({ message: 'اسم ومبلغ الصيانة مطلوبان' });
    const maintenance = { _id: genId(), apartmentId: apartmentId || '', name, amount: money(amount), date: new Date().toISOString().slice(0, 10), notes: '', by: '', createdAt: new Date() };
    const maintenanceList = (property.maintenance || []).concat([maintenance]);
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { maintenance: maintenanceList } }, { new: true });
    await log(req, { action: `إضافة صيانة ${name} بمبلغ ${maintenance.amount} إلى ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ maintenance, property: updated });
  } catch (e) {
    next(e);
  }
};

exports.removeMaintenance = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const maintenance = (property.maintenance || []).filter((m) => String(m._id) !== String(req.params.mid));
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { maintenance } }, { new: true });
    await log(req, { action: `حذف صيانة من ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

exports.addExpense = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const { name, amount, apartmentId } = req.body;
    if (!name || amount === undefined) return res.status(400).json({ message: 'اسم ومبلغ المصروف مطلوبان' });
    const expense = { _id: genId(), apartmentId: apartmentId || '', name, amount: money(amount), date: new Date().toISOString().slice(0, 10), notes: '', by: '', createdAt: new Date() };
    const expenses = (property.expenses || []).concat([expense]);
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { expenses } }, { new: true });
    await log(req, { action: `إضافة مصروف ${name} بمبلغ ${expense.amount} إلى ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ expense, property: updated });
  } catch (e) {
    next(e);
  }
};

exports.removeExpense = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const expenses = (property.expenses || []).filter((e) => String(e._id) !== String(req.params.eid));
    const updated = await db.col('Property').findByIdAndUpdate(property._id, { $set: { expenses } }, { new: true });
    await log(req, { action: `حذف مصروف من ${property.name}`, category: 'properties', targetType: 'property', targetId: String(property._id) });
    emit(req, 'property:updated', {});
    res.json({ property: updated });
  } catch (e) {
    next(e);
  }
};

function monthFinanceHelpers() {
  return {
    expensesOf: (property, apId) =>
      (property.expenses || []).reduce((s, e) => s + (!apId || String(e.apartmentId) === String(apId) ? Number(e.amount) || 0 : 0), 0),
    maintenanceOf: (property, apId) =>
      (property.maintenance || []).reduce((s, m) => s + (!apId || String(m.apartmentId) === String(apId) ? Number(m.amount) || 0 : 0), 0),
  };
}

exports.finance = async (req, res, next) => {
  try {
    const property = await findProperty(req.params.id, res);
    if (!property) return;
    const ctx = await structure.loadContext();
    const tree = structure.buildTree(property, ctx.rooms, ctx.students, ctx.summerCourses);
    const paymentsService = require('../services/payments');
    const curMonth = paymentsService.monthKey(new Date());
    const todayStr = paymentsService.toYMD(new Date());
    const payments = await db.col('Payment').find({ month: curMonth });
    const payMap = {};
    payments.forEach((p) => {
      payMap[String(p.studentId)] = p;
    });
    const sMap = {};
    ctx.students.forEach((s) => {
      sMap[String(s._id)] = s;
    });

    const money = structure.money;
    const { expensesOf, maintenanceOf } = monthFinanceHelpers();

    const apFinance = (rooms, apId) => {
      let occupied = 0;
      let expected = 0;
      let paid = 0;
      let remaining = 0;
      let overdue = 0;
      let deposits = 0;
      const expenses = expensesOf(property, apId);
      const maintenance = maintenanceOf(property, apId);
      rooms.forEach((r) => {
        (r.beds || []).forEach((b) => {
          if (!b.studentId) return;
          occupied++;
          expected += Number(b.price) || 0;
          const pay = payMap[b.studentId];
          const amt = pay ? Number(pay.amount) || 0 : 0;
          const paidAmt = pay ? Number(pay.paidAmount) || 0 : 0;
          const collected = pay && (pay.status === 'paid' || paidAmt >= amt) ? amt : Math.min(paidAmt, amt);
          paid += collected;
          remaining += amt - collected;
          if (pay && pay.dueDate && pay.dueDate < todayStr && collected < amt) {
            overdue += amt - collected;
          }
          const s = sMap[b.studentId];
          if (s && s.deposit) deposits += Number(s.deposit.originalAmount) || 0;
        });
      });
      const gross = money(expected);
      return {
        occupied,
        expected: money(expected),
        paid: money(paid),
        remaining: money(remaining),
        overdue: money(overdue),
        deposits: money(deposits),
        maintenance: money(maintenance),
        expenses: money(expenses),
        gross,
        net: money(expected - maintenance - expenses),
      };
    };

    const totals = { occupied: 0, expected: 0, paid: 0, remaining: 0, overdue: 0, deposits: 0, maintenance: 0, expenses: 0, gross: 0, net: 0 };
    const add = (f) => {
      Object.keys(totals).forEach((k) => {
        totals[k] = money(totals[k] + (f[k] || 0));
      });
      return f;
    };
    const rows = [];
    const pushAp = (ap, floor) => {
      const f = apFinance(ap.rooms || [], ap._id);
      if (f.occupied > 0 || (ap.rooms || []).length > 0) {
        rows.push({ apartmentId: String(ap._id), name: ap.name || '', floorId: floor ? floor._id : null, floorName: floor ? floor.name : '', rooms: (ap.rooms || []).length, finance: add(f) });
      }
    };
    if (property.type === 'apartment') {
      tree.apartments.forEach((ap) => pushAp(ap, null));
    } else {
      tree.floors.forEach((f) => {
        (f.apartments || []).forEach((ap) => pushAp(ap, f));
      });
      (tree.unlinkedApartments || []).forEach((ap) => pushAp(ap, null));
    }
    add(apFinance(tree.unlinkedRooms || [], '__none__'));
    totals.maintenance = money(maintenanceOf(property, null));
    totals.expenses = money(expensesOf(property, null));
    totals.gross = money(totals.expected);
    totals.net = money(totals.expected - totals.maintenance - totals.expenses);
    res.json({ rows, totals, month: curMonth });
  } catch (e) {
    next(e);
  }
};

exports.overview = async (req, res, next) => {
  try {
    const ctx = await structure.loadContext();
    const paymentsService = require('../services/payments');
    const curMonth = paymentsService.monthKey(new Date());
    const todayStr = paymentsService.toYMD(new Date());
    const payments = await db.col('Payment').find({ month: curMonth });
    const payMap = {};
    payments.forEach((p) => {
      payMap[String(p.studentId)] = p;
    });
    const sMap = {};
    ctx.students.forEach((s) => {
      sMap[String(s._id)] = s;
    });
    const money = structure.money;
    const { expensesOf, maintenanceOf } = monthFinanceHelpers();

    const grand = { properties: 0, rooms: 0, occupied: 0, expected: 0, paid: 0, remaining: 0, overdue: 0, deposits: 0, maintenance: 0, expenses: 0, gross: 0, net: 0 };
    const props = [];
    for (const p of ctx.properties) {
      const tree = structure.buildTree(p, ctx.rooms, ctx.students, ctx.summerCourses);
      const maintenance = maintenanceOf(p, null);
      const expenses = expensesOf(p, null);
      let occupied = 0;
      let expected = 0;
      let paid = 0;
      let remaining = 0;
      let overdue = 0;
      let deposits = 0;
      const walk = (rooms) => {
        rooms.forEach((r) => {
          (r.beds || []).forEach((b) => {
            if (!b.studentId) return;
            occupied++;
            expected += Number(b.price) || 0;
            const pay = payMap[b.studentId];
            const amt = pay ? Number(pay.amount) || 0 : 0;
            const paidAmt = pay ? Number(pay.paidAmount) || 0 : 0;
            const collected = pay && (pay.status === 'paid' || paidAmt >= amt) ? amt : Math.min(paidAmt, amt);
            paid += collected;
            remaining += amt - collected;
            if (pay && pay.dueDate && pay.dueDate < todayStr && collected < amt) {
              overdue += amt - collected;
            }
            const s = sMap[b.studentId];
            if (s && s.deposit) deposits += Number(s.deposit.originalAmount) || 0;
          });
        });
      };
      const allRooms = [];
      if (p.type === 'apartment') {
        tree.apartments.forEach((ap) => allRooms.push(...ap.rooms));
      } else {
        tree.floors.forEach((f) => (f.apartments || []).forEach((ap) => allRooms.push(...ap.rooms)));
        (tree.unlinkedApartments || []).forEach((ap) => allRooms.push(...ap.rooms));
        allRooms.push(...(tree.unlinkedRooms || []));
      }
      walk(allRooms);
      const fin = {
        expected: money(expected),
        paid: money(paid),
        remaining: money(remaining),
        overdue: money(overdue),
        deposits: money(deposits),
        maintenance: money(maintenance),
        expenses: money(expenses),
        gross: money(expected),
        net: money(expected - maintenance - expenses),
        occupied,
        rooms: allRooms.length,
      };
      props.push({ _id: String(p._id), name: p.name, type: p.type, gender: p.gender || '', status: p.status || 'active', stats: tree.stats, finance: fin });
      grand.properties++;
      Object.keys(fin).forEach((k) => {
        grand[k] = money(grand[k] + (fin[k] || 0));
      });
    }
    res.json({ properties: props, grand });
  } catch (e) {
    next(e);
  }
};