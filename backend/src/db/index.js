const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

let driver = 'json';
const MONGO_URI = process.env.MONGO_URI || '';
const DB_DRIVER = (process.env.DB_DRIVER || 'auto').toLowerCase();
if (DB_DRIVER === 'json') driver = 'json';
else if (DB_DRIVER === 'mongo') driver = 'mongo';
else if (MONGO_URI) driver = 'mongo';

const genId = () => crypto.randomBytes(12).toString('hex');
const now = () => new Date().toISOString();
const toId = (v) => (v && typeof v === 'object' && v._id ? v._id : v);

function load(name) {
  const f = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(f)) return [];
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return [];
  }
}

function save(name, docs) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name + '.json'), JSON.stringify(docs, null, 2));
}

function matches(doc, filter) {
  for (const [key, val] of Object.entries(filter || {})) {
    if (key === '$or') {
      if (!val.some((cond) => matches(doc, cond))) return false;
      continue;
    }
    if (key === '$and') {
      if (!val.every((cond) => matches(doc, cond))) return false;
      continue;
    }
    const actual = doc[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const [op, operand] of Object.entries(val)) {
        if (op === '$in') {
          if (!operand.some((v) => String(v) === String(actual))) return false;
        } else if (op === '$nin') {
          if (operand.some((v) => String(v) === String(actual))) return false;
        } else if (op === '$ne') {
          if (String(actual) === String(operand)) return false;
        } else if (op === '$gt') {
          if (!(actual > operand)) return false;
        } else if (op === '$gte') {
          if (!(actual >= operand)) return false;
        } else if (op === '$lt') {
          if (!(actual < operand)) return false;
        } else if (op === '$lte') {
          if (!(actual <= operand)) return false;
        } else if (op === '$exists') {
          if (operand ? actual === undefined : actual !== undefined) return false;
        } else if (op === '$regex') {
          const re = new RegExp(operand, 'i');
          if (!re.test(String(actual ?? ''))) return false;
        }
      }
    } else if (actual === undefined || String(actual) !== String(val)) {
      return false;
    }
  }
  return true;
}

function applyUpdate(doc, update) {
  for (const [op, val] of Object.entries(update || {})) {
    if (op === '$set') {
      Object.assign(doc, val);
    } else if (op === '$inc') {
      for (const [k, v] of Object.entries(val)) doc[k] = (Number(doc[k]) || 0) + v;
    } else if (op === '$unset') {
      for (const k of Object.keys(val)) delete doc[k];
    } else if (op === '$push') {
      for (const [k, v] of Object.entries(val)) {
        if (!Array.isArray(doc[k])) doc[k] = [];
        doc[k].push(v);
      }
    } else if (op === '$addToSet') {
      for (const [k, v] of Object.entries(val)) {
        if (!Array.isArray(doc[k])) doc[k] = [];
        if (!doc[k].some((e) => JSON.stringify(e) === JSON.stringify(v))) doc[k].push(v);
      }
    } else if (op === '$pull') {
      for (const [k, v] of Object.entries(val)) {
        if (!Array.isArray(doc[k])) continue;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const vId = v._id;
          doc[k] = doc[k].filter((e) => !(vId && e && e._id && String(e._id) === String(vId)));
        } else {
          doc[k] = doc[k].filter((e) => e !== v);
        }
      }
    }
  }
  doc.updatedAt = now();
}

function sortDocs(docs, sort) {
  const keys = Object.entries(sort || {});
  return docs.slice().sort((a, b) => {
    for (const [k, dir] of keys) {
      const av = a[k];
      const bv = b[k];
      if (av === bv) continue;
      const cmp = av === undefined || av === null || av === '' ? -1 : bv === undefined || bv === null || bv === '' ? 1 : av < bv ? -1 : 1;
      return cmp * dir;
    }
    return 0;
  });
}

function jsonCol(name) {
  return {
    async find(filter, sort) {
      return sortDocs(load(name).filter((d) => matches(d, filter)), sort);
    },
    async findOne(filter) {
      return load(name).find((d) => matches(d, filter)) || null;
    },
    async findById(id) {
      return load(name).find((d) => String(d._id) === String(id)) || null;
    },
    async insert(doc) {
      const d = { _id: genId(), createdAt: now(), updatedAt: now(), ...doc };
      const arr = load(name);
      arr.push(d);
      save(name, arr);
      return d;
    },
    async insertMany(docs) {
      const arr = load(name);
      const created = docs.map((d) => ({ _id: genId(), createdAt: now(), updatedAt: now(), ...d }));
      arr.push(...created);
      save(name, arr);
      return created;
    },
    async updateOne(filter, update) {
      const arr = load(name);
      let updated = null;
      const out = arr.map((d) => {
        if (matches(d, filter)) {
          applyUpdate(d, update);
          if (!updated) updated = d;
        }
        return d;
      });
      if (updated) save(name, out);
      return updated;
    },
    async findOneAndUpdate(filter, update) {
      return this.updateOne(filter, update);
    },
    async findByIdAndUpdate(id, update) {
      return this.updateOne({ _id: id }, update);
    },
    async deleteOne(filter) {
      const arr = load(name);
      const out = arr.filter((d) => !matches(d, filter));
      if (out.length !== arr.length) save(name, out);
    },
    async deleteById(id) {
      await this.deleteOne({ _id: id });
    },
    async count(filter) {
      return load(name).filter((d) => matches(d, filter)).length;
    },
  };
}

function mongoCol(name, Model) {
  return {
    async find(filter, sort) {
      let q = Model.find(filter || {});
      if (sort) q = q.sort(sort);
      return (await q.lean()).map((x) => ({ ...x, _id: String(x._id) }));
    },
    async findOne(filter) {
      const x = await Model.findOne(filter || {}).lean();
      return x ? { ...x, _id: String(x._id) } : null;
    },
    async findById(id) {
      const x = await Model.findById(id).lean();
      return x ? { ...x, _id: String(x._id) } : null;
    },
    async insert(doc) {
      const m = new Model(doc);
      await m.save();
      return { ...m.toObject(), _id: String(m._id) };
    },
    async insertMany(docs) {
      const created = await Model.insertMany(docs);
      return created.map((x) => ({ ...x.toObject(), _id: String(x._id) }));
    },
    async updateOne(filter, update) {
      await Model.updateOne(filter, update);
      return this.findOne(filter);
    },
    async findOneAndUpdate(filter, update) {
      const x = await Model.findOneAndUpdate(filter, update, { new: true }).lean();
      return x ? { ...x, _id: String(x._id) } : null;
    },
    async findByIdAndUpdate(id, update) {
      const x = await Model.findByIdAndUpdate(id, update, { new: true }).lean();
      return x ? { ...x, _id: String(x._id) } : null;
    },
    async deleteOne(filter) {
      await Model.deleteOne(filter);
    },
    async deleteById(id) {
      await Model.findByIdAndDelete(id);
    },
    async count(filter) {
      return Model.countDocuments(filter || {});
    },
  };
}

let models = null;

async function connect() {
  if (driver === 'mongo') {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    models = require('../models');
    console.log('[db] MongoDB connected');
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[db] Using JSON file store (' + DATA_DIR + ')');
  }
  return driver;
}

function col(name) {
  if (driver === 'mongo') return mongoCol(name, models[name]);
  return jsonCol(name);
}

module.exports = { connect, col, driver, genId, now, toId };
