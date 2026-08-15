require('dotenv').config();
const path = require('path');
const fs = require('fs');
const db = require('../src/db');

(async () => {
  const driver = await db.connect();
  if (driver !== 'supabase') {
    console.error('DB_DRIVER مش مضبوط على supabase — راجع backend/.env (SUPABASE_URL و SUPABASE_KEY و DB_DRIVER=supabase)');
    process.exit(1);
  }

  const DATA_DIR = path.join(__dirname, '..', 'data');
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  let total = 0;

  for (const f of files) {
    const collection = f.replace(/\.json$/, '');
    const docs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    if (!Array.isArray(docs) || docs.length === 0) continue;
    await db.col(collection).insertMany(docs);
    total += docs.length;
    console.log(`  ✓ ${collection}: ${docs.length} سجل`);
  }

  console.log(`\nتم ترحيل ${total} سجل إلى Supabase بنجاح`);
  process.exit(0);
})().catch((e) => {
  console.error('خطأ:', e.message);
  process.exit(1);
});