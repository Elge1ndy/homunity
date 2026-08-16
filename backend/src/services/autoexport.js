const fs = require('fs');
const path = require('path');
const db = require('../db');
const excel = require('../utils/excel');
const { buildWorkbook } = require('../utils/workbook');

let timer = null;
let ready = false;

const FILE_NAME = 'Data.xlsx';
const BACKUP_KEEP = 7;

function exportsDir() {
  return path.join(db.DATA_DIR, '..', 'exports');
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function pruneBackups(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^backup-.+\.xlsx$/.test(f))
    .sort();
  while (files.length > BACKUP_KEEP) {
    const rm = files.shift();
    try {
      fs.rmSync(path.join(dir, rm), { force: true });
    } catch {}
  }
}

async function generate() {
  try {
    const wb = await buildWorkbook();
    const buf = excel.writeBuffer(wb);
    const dir = exportsDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, FILE_NAME);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, file);
    const dataDir = path.join(db.DATA_DIR, '..', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    const dataFile = path.join(dataDir, FILE_NAME);
    const dtmp = dataFile + '.tmp';
    fs.writeFileSync(dtmp, buf);
    fs.renameSync(dtmp, dataFile);
    const backups = db.BACKUPS_DIR;
    fs.mkdirSync(backups, { recursive: true });
    const snap = path.join(backups, 'backup-' + stamp() + '.xlsx');
    const stmp = snap + '.tmp';
    fs.writeFileSync(stmp, buf);
    fs.renameSync(stmp, snap);
    pruneBackups(backups);
    return file;
  } catch (e) {
    console.error('[autoexport]', e.message);
    return null;
  }
}

function schedule() {
  if (!ready) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    generate();
  }, 2500);
}

function init() {
  if (ready) return;
  ready = true;
  db.setChangeListener(schedule);
  setTimeout(() => generate(), 3000);
  console.log('[autoexport] enabled — Excel data + Excel backups written inside program files');
}

module.exports = { init, generate, schedule, FILE_NAME };