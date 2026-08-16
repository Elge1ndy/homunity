const xlsx = require('xlsx-js-style');
const excel = require('../utils/excel');
const { buildWorkbook } = require('../utils/workbook');
const fs = require('fs');
const path = require('path');
const paths = require('../utils/paths');
const db = require('../db');
const { log } = require('../services/activity');
const emit = require('../utils/realtime');

const SHEET_TO_COL = {
  'Users-Raw': 'User',
  'Housing-Raw': 'Housing',
  'Students-Raw': 'Student',
  'Rooms-Raw': 'Room',
  'Payments-Raw': 'Payment',
  'Invoices-Raw': 'Invoice',
  'Activity Log-Raw': 'ActivityLog',
};

const LEGACY_SHEET_TO_COL = {
  'Users-Raw': 'Users',
  'Housing-Raw': 'Housing',
  'Students-Raw': 'Students',
  'Rooms-Raw': 'Rooms',
  'Payments-Raw': 'Payments',
  'Activity Log-Raw': 'Activity Log',
};

exports.export = async (req, res, next) => {
  try {
    const wb = await buildWorkbook();
    const buf = excel.writeBuffer(wb);
    const filename = 'sakni-backup-' + new Date().toISOString().slice(0, 10) + '.xlsx';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) {
    next(e);
  }
};

function cleanValue(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return undefined;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (/^[{\[]/.test(t)) {
      try {
        return JSON.parse(t);
      } catch (_) {}
    }
  }
  return v;
}

exports.restore = async (req, res, next) => {
  try {
    const buffer = req.file && req.file.buffer;
    if (!buffer) return res.status(400).json({ message: 'Upload backup file first' });

    let wb;
    try {
      wb = xlsx.read(buffer, { type: 'buffer' });
    } catch (e) {
      return res.status(400).json({ message: 'File is not a valid Excel file' });
    }

    const counts = {};
    let foundSheets = 0;
    const errors = [];

    const preDir = paths.dir('uploads', 'backups');
    if (!fs.existsSync(preDir)) fs.mkdirSync(preDir, { recursive: true });
    const preFile = path.join(preDir, `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`);
    fs.writeFileSync(preFile, excel.writeBuffer(await buildWorkbook()));

    await log(req, {
      action: `Started data restore from backup (safety copy: ${path.basename(preFile)})`,
      category: 'settings',
    });

    for (const [sheetTitle, colName] of Object.entries(SHEET_TO_COL)) {
      const ws = wb.Sheets[sheetTitle] || wb.Sheets[LEGACY_SHEET_TO_COL[sheetTitle]];
      if (!ws) continue;
      foundSheets++;
      try {
        const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
        const docs = rows.map((r) => {
          const doc = {};
          for (const [k, v] of Object.entries(r)) {
            const cv = cleanValue(v);
            if (k === '_id' && cv === undefined) continue;
            if (cv === undefined) continue;
            doc[k] = cv;
          }
          return doc;
        });
        await db.col(colName).deleteOne({});
        if (docs.length) await db.col(colName).insertMany(docs);
        counts[colName] = docs.length;
      } catch (e) {
        counts[colName] = 0;
        errors.push(`${sheetTitle}: ${e.message}`);
      }
    }

    if (!foundSheets) return res.status(400).json({ message: 'File does not contain known sheets (make sure it is a backup file)' });

    emit(req, 'data:refresh', {});
    res.json({ ok: true, counts, errors, preBackup: path.basename(preFile) });
  } catch (e) {
    next(e);
  }
};