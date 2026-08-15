const db = require('../src/db');

function maybeParse(v) {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (/^[{\[]/.test(t)) {
    try {
      return JSON.parse(t);
    } catch (_) {}
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  return v;
}

async function main() {
  const collections = ['User', 'Housing', 'Student', 'Room', 'Payment', 'Invoice', 'Notification', 'ActivityLog'];
  for (const name of collections) {
    const docs = await db.col(name).find({});
    let fixed = 0;
    for (const d of docs) {
      const set = {};
      for (const [k, v] of Object.entries(d)) {
        const nv = maybeParse(v);
        if (nv !== v) {
          set[k] = nv;
          fixed++;
        }
      }
      if (Object.keys(set).length) {
        try {
          await db.col(name).findByIdAndUpdate(d._id, { $set: set });
        } catch (e) {
          console.log(name + ' ' + d._id + ' FAILED:', e.message);
        }
      }
    }
    console.log(name + ': fixed ' + fixed + '/' + docs.length);
  }
  console.log('DONE');
  process.exit(0);
}

main();