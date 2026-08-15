require('dotenv').config();
const path = require('path');
const fs = require('fs');
const db = require('../src/db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CLOUD = process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';
const H = {
  apikey: process.env.SUPABASE_KEY,
  Authorization: 'Bearer ' + process.env.SUPABASE_KEY,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

(async () => {
  const driver = await db.connect();
  if (driver !== 'supabase') {
    console.error('شغّل السكربت والـ DB_DRIVER=supabase في .env (السحابة هي المصدر)');
    process.exit(1);
  }

  const c = await fetch(`${CLOUD}/homunity_docs?select=collection,id&limit=10000`, { headers: H });
  if (!c.ok) throw new Error('تعذر قراءة السحابة (' + c.status + ')');
  const rows = await c.json();
  const collections = [...new Set(rows.map((r) => r.collection))].sort();

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  let total = 0;
  for (const colName of collections) {
    const r = await fetch(
      `${CLOUD}/homunity_docs?collection=eq.${encodeURIComponent(colName)}&select=doc&limit=10000`,
      { headers: H }
    );
    if (!r.ok) throw new Error('فشل قراءة ' + colName);
    const docs = (await r.json()).map((x) => x.doc);
    fs.writeFileSync(path.join(DATA_DIR, colName + '.json'), JSON.stringify(docs, null, 2));
    total += docs.length;
    console.log(`  ✓ ${colName}: ${docs.length} سجل`);
  }
  console.log(`\nتم تحديث النسخة المحلية من السحابة: ${total} سجل`);
  process.exit(0);
})().catch((e) => {
  console.error('خطأ:', e.message);
  process.exit(1);
});