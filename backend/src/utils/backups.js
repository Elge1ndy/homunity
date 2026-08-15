const fs = require('fs');
const path = require('path');

const RECOVERY = '.recovery';

function snapshot(dataDir, backupsRoot, keep = 7) {
  if (!fs.existsSync(dataDir)) return null;
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(backupsRoot, RECOVERY, 'backup-' + stamp);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of files) {
    try {
      fs.copyFileSync(path.join(dataDir, f), path.join(dest, f));
    } catch {}
  }
  const root = path.join(backupsRoot, RECOVERY);
  const olds = fs
    .readdirSync(root)
    .filter((d) => d.startsWith('backup-'))
    .sort()
    .reverse();
  while (olds.length > keep) {
    const rm = olds.pop();
    try {
      fs.rmSync(path.join(root, rm), { recursive: true, force: true });
    } catch {}
  }
  return dest;
}

function latestFor(dataDir, backupsRoot, name) {
  const root = path.join(backupsRoot, RECOVERY);
  if (!fs.existsSync(root)) return null;
  const dirs = fs
    .readdirSync(root)
    .filter((d) => d.startsWith('backup-'))
    .sort()
    .reverse();
  for (const d of dirs) {
    const f = path.join(root, d, name + '.json');
    if (!fs.existsSync(f)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (Array.isArray(parsed)) {
        fs.copyFileSync(f, path.join(dataDir, name + '.json'));
        return parsed;
      }
    } catch {}
  }
  return null;
}

module.exports = { snapshot, latestFor };