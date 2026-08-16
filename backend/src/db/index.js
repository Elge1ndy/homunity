const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const paths = require('../utils/paths');
const { latestFor } = require('../utils/backups');

const DATA_DIR = process.env.DATA_DIR || path.join(paths.dir('data'), '..', '.store');
const BACKUPS_DIR = path.join(paths.dir('data'), '..', 'data-backups');

function hideStore() {
  try {
    require('child_process').execFileSync('attrib', ['+h', DATA_DIR]);
  } catch {}
}

let driver = 'json';
const MONGO_URI = process.env.MONGO_URI || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const DB_DRIVER = (process.env.DB_DRIVER || 'auto').toLowerCase();
if (DB_DRIVER === 'json') driver = 'json';
else if (DB_DRIVER === 'supabase') driver = SUPABASE_URL && SUPABASE_KEY ? 'supabase' : 'json';
else if (DB_DRIVER === 'mongo') driver = 'mongo';
else if (MONGO_URI) driver = 'mongo';
else if (SUPABASE_URL && SUPABASE_KEY) driver = 'supabase';
else driver = 'json';

const genId = () => crypto.randomBytes(12).toString('hex');
const now = () => new Date().toISOString();
const toId = (v) => (v && typeof v === 'object' && v._id ? v._id : v);

function load(name) {
  const f = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(f)) return [];
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    console.error('[db] file corrupt: ' + name + '.json — attempting restore from backups');
    const restored = latestFor(DATA_DIR, BACKUPS_DIR, name);
    if (restored) {
      console.error('[db] restored "' + name + '" from data-backups');
      return restored;
    }
    console.error('[db] no backup found for "' + name + '" — using empty');
    return [];
  }
}

let changeListener = null;

function notifyChange() {
  if (changeListener) {
    try {
      changeListener();
    } catch {}
  }
}

function save(name, docs) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    hideStore();
  }
  const file = path.join(DATA_DIR, name + '.json');
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(docs, null, 2));
  fs.renameSync(tmp, file);
  notifyChange();
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
    async deleteMany(filter) {
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
      notifyChange();
      return { ...m.toObject(), _id: String(m._id) };
    },
    async insertMany(docs) {
      const created = await Model.insertMany(docs);
      notifyChange();
      return created.map((x) => ({ ...x.toObject(), _id: String(x._id) }));
    },
    async updateOne(filter, update) {
      await Model.updateOne(filter, update);
      notifyChange();
      return this.findOne(filter);
    },
    async findOneAndUpdate(filter, update) {
      const x = await Model.findOneAndUpdate(filter, update, { new: true }).lean();
      notifyChange();
      return x ? { ...x, _id: String(x._id) } : null;
    },
    async findByIdAndUpdate(id, update) {
      const x = await Model.findByIdAndUpdate(id, update, { new: true }).lean();
      notifyChange();
      return x ? { ...x, _id: String(x._id) } : null;
    },
    async deleteOne(filter) {
      await Model.deleteOne(filter);
      notifyChange();
    },
    async deleteMany(filter) {
      await Model.deleteMany(filter);
      notifyChange();
    },
    async deleteById(id) {
      await Model.findByIdAndDelete(id);
      notifyChange();
    },
    async count(filter) {
      return Model.countDocuments(filter || {});
    },
  };
}

let models = null;
let API_BASE = '';
let API_HEADERS = null;

const apiHeaders = () => ({
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

function ensureApi() {
  if (!API_BASE) {
    API_BASE = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';
    API_HEADERS = apiHeaders();
  }
}

async function supabaseConnect() {
  ensureApi();
  const r = await fetch(`${API_BASE}/homunity_docs?select=id&limit=1`, { headers: API_HEADERS });
  if (r.status === 404 || r.status === 400) {
    throw new Error('Supabase: homunity_docs table not found — run the SQL code in SQL Editor first, then restart the server');
  }
  if (!r.ok) throw new Error('Supabase: connection failed (' + r.status + ') - check the URL and key');
  console.log('[db] Using Supabase (PostgreSQL via REST)');
}

async function loadAll(name) {
  ensureApi();
  const r = await fetch(
    `${API_BASE}/homunity_docs?collection=eq.${encodeURIComponent(name)}&select=doc&limit=10000`,
    { headers: API_HEADERS }
  );
  if (!r.ok) throw new Error('Supabase load ' + name + ': ' + r.status);
  const rows = await r.json();
  return rows.map((x) => x.doc);
}

async function upsertDocs(name, docs) {
  ensureApi();
  const rows = docs.map((d) => ({ collection: name, id: String(d._id), doc: d }));
  const r = await fetch(`${API_BASE}/homunity_docs`, {
    method: 'POST',
    headers: { ...API_HEADERS, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error('Supabase upsert ' + name + ': ' + r.status);
}

async function patchDocs(name, docs) {
  ensureApi();
  for (const d of docs) {
    const r = await fetch(
      `${API_BASE}/homunity_docs?collection=eq.${encodeURIComponent(name)}&id=eq.${encodeURIComponent(String(d._id))}`,
      { method: 'PATCH', headers: API_HEADERS, body: JSON.stringify({ doc: d }) }
    );
    if (!r.ok) throw new Error('Supabase patch ' + name + ': ' + r.status);
  }
}

async function deleteIds(name, ids) {
  ensureApi();
  for (const id of ids) {
    const r = await fetch(
      `${API_BASE}/homunity_docs?collection=eq.${encodeURIComponent(name)}&id=eq.${encodeURIComponent(String(id))}`,
      { method: 'DELETE', headers: API_HEADERS }
    );
    if (!r.ok) throw new Error('Supabase delete ' + name + ': ' + r.status);
  }
}

const supabaseCache = new Map();
const CACHE_TTL = 2000;

function getCachedAll(name) {
  const cached = supabaseCache.get(name);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  return null;
}

function setCachedAll(name, data) {
  supabaseCache.set(name, { data, ts: Date.now() });
}

function invalidateCache(name) {
  supabaseCache.delete(name);
}

function supabaseCol(name) {
  return {
    async find(filter, sort) {
      let all = getCachedAll(name);
      if (!all) { all = await loadAll(name); setCachedAll(name, all); }
      return sortDocs(all.filter((d) => matches(d, filter)), sort);
    },
    async findOne(filter) {
      let all = getCachedAll(name);
      if (!all) { all = await loadAll(name); setCachedAll(name, all); }
      return all.find((d) => matches(d, filter)) || null;
    },
    async findById(id) {
      let all = getCachedAll(name);
      if (!all) { all = await loadAll(name); setCachedAll(name, all); }
      return all.find((d) => String(d._id) === String(id)) || null;
    },
    async insert(doc) {
      const d = { _id: genId(), createdAt: now(), updatedAt: now(), ...doc };
      await upsertDocs(name, [d]);
      invalidateCache(name);
      notifyChange();
      return d;
    },
    async insertMany(docs) {
      const created = docs.map((d) => ({ _id: genId(), createdAt: now(), updatedAt: now(), ...d }));
      await upsertDocs(name, created);
      invalidateCache(name);
      notifyChange();
      return created;
    },
    async updateOne(filter, update) {
      const arr = await loadAll(name);
      let updated = null;
      const changed = [];
      for (const d of arr) {
        if (matches(d, filter)) {
          applyUpdate(d, update);
          if (!updated) updated = d;
          changed.push(d);
        }
      }
      if (changed.length > 0) {
        await patchDocs(name, changed);
        invalidateCache(name);
        notifyChange();
      }
      return updated;
    },
    async findOneAndUpdate(filter, update) {
      return this.updateOne(filter, update);
    },
    async findByIdAndUpdate(id, update) {
      return this.updateOne({ _id: id }, update);
    },
    async deleteOne(filter) {
      const arr = await loadAll(name);
      const ids = arr.filter((d) => matches(d, filter)).map((d) => String(d._id));
      if (ids.length > 0) {
        await deleteIds(name, ids);
        invalidateCache(name);
        notifyChange();
      }
    },
    async deleteMany(filter) {
      const arr = await loadAll(name);
      const ids = arr.filter((d) => matches(d, filter)).map((d) => String(d._id));
      if (ids.length > 0) {
        await deleteIds(name, ids);
        invalidateCache(name);
        notifyChange();
      }
    },
    async deleteById(id) {
      await this.deleteOne({ _id: id });
    },
    async count(filter) {
      let all = getCachedAll(name);
      if (!all) { all = await loadAll(name); setCachedAll(name, all); }
      return all.filter((d) => matches(d, filter)).length;
    },
  };
}

const MIRROR = (process.env.MIRROR || 'auto').toLowerCase();

function secondaryCol(name) {
  if (MIRROR === 'none') return null;
  if (driver === 'supabase' || driver === 'mongo') return jsonCol(name);
  if (driver === 'json' && SUPABASE_URL && SUPABASE_KEY) return supabaseCol(name);
  return null;
}

function mirrorCol(name, primary, secondary) {
  if (!secondary) return primary;
  const mirrorWrite = async (fn, args) => {
    try {
      await secondary[fn](...args);
    } catch (e) {
      console.error('[mirror] ' + fn + ' ' + name + ':', e.message);
    }
  };
  return {
    async find(filter, sort) {
      try {
        return await primary.find(filter, sort);
      } catch (e) {
        return secondary.find(filter, sort);
      }
    },
    async findOne(filter) {
      try {
        return await primary.findOne(filter);
      } catch (e) {
        return secondary.findOne(filter);
      }
    },
    async findById(id) {
      try {
        return await primary.findById(id);
      } catch (e) {
        return secondary.findById(id);
      }
    },
    async insert(doc) {
      try {
        const d = await primary.insert(doc);
        await mirrorWrite('insert', [d]);
        return d;
      } catch (e) {
        return secondary.insert(doc);
      }
    },
    async insertMany(docs) {
      try {
        const created = await primary.insertMany(docs);
        await mirrorWrite('insertMany', [created]);
        return created;
      } catch (e) {
        return secondary.insertMany(docs);
      }
    },
    async updateOne(filter, update) {
      try {
        const r = await primary.updateOne(filter, update);
        await mirrorWrite('updateOne', [filter, update]);
        return r;
      } catch (e) {
        return secondary.updateOne(filter, update);
      }
    },
    async findOneAndUpdate(filter, update) {
      return this.updateOne(filter, update);
    },
    async findByIdAndUpdate(id, update) {
      return this.updateOne({ _id: id }, update);
    },
    async deleteOne(filter) {
      try {
        await primary.deleteOne(filter);
        await mirrorWrite('deleteOne', [filter]);
      } catch (e) {
        await secondary.deleteOne(filter);
      }
    },
    async deleteById(id) {
      await this.deleteOne({ _id: id });
    },
    async count(filter) {
      try {
        return await primary.count(filter);
      } catch (e) {
        return secondary.count(filter);
      }
    },
  };
}

async function connect() {
  if (driver === 'mongo') {
    const mongoose = require('mongoose');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    models = require('../models');
    console.log('[db] MongoDB connected');
  } else if (driver === 'supabase') {
    await supabaseConnect();
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[db] Using JSON file store (' + DATA_DIR + ')');
  }
  return driver;
}

function col(name) {
  if (driver === 'mongo') return mirrorCol(name, mongoCol(name, models[name]), secondaryCol(name));
  const primary = driver === 'supabase' ? supabaseCol(name) : jsonCol(name);
  return mirrorCol(name, primary, secondaryCol(name));
}

module.exports = { connect, col, driver, genId, now, toId, DATA_DIR, BACKUPS_DIR, setChangeListener: (fn) => { changeListener = fn; } };
