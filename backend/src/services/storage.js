function base() {
  return (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
}

function key() {
  return process.env.SUPABASE_KEY || '';
}

function cloudMode() {
  const d = (process.env.DB_DRIVER || 'auto').toLowerCase();
  return !!(base() && key() && (d === 'supabase' || d === 'auto'));
}

function h() {
  return { Authorization: 'Bearer ' + key(), apikey: key(), Accept: 'application/json', 'Content-Type': 'application/json' };
}

const BUCKET = 'homunity';

async function ensureBucket() {
  if (!cloudMode()) return false;
  const r = await fetch(base() + '/storage/v1/bucket', { headers: h() });
  if (r.ok) {
    const buckets = await r.json();
    if (buckets.some((b) => b.name === BUCKET)) return true;
  }
  const c = await fetch(base() + '/storage/v1/bucket', {
    method: 'POST',
    headers: h(),
    body: JSON.stringify({ name: BUCKET, public: true }),
  });
  if (!c.ok) throw new Error('فشل إنشاء حاوية التخزين (' + c.status + ')');
  return true;
}

async function uploadToStorage(folder, filename, buffer, mime) {
  const r = await fetch(`${base()}/storage/v1/object/${BUCKET}/${folder}/${filename}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key(), apikey: key(), 'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' },
    body: buffer,
  });
  if (!r.ok) throw new Error('فشل رفع الملف للسحابة (' + r.status + ')');
  return `${base()}/storage/v1/object/public/${BUCKET}/${folder}/${filename}`;
}

module.exports = { cloudMode, ensureBucket, uploadToStorage, BUCKET };