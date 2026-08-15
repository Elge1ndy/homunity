const xlsx = require('xlsx-js-style');

const TEAL = 'FF0F766E';
const BAND = 'FFF1F5F9';
const GRID = 'FFE2E8F0';
const BORDER = 'FFCBD5E1';
const AR = /[\u0600-\u06FF]/;

const thin = {
  top: { style: 'thin', color: { rgb: GRID } },
  bottom: { style: 'thin', color: { rgb: GRID } },
  left: { style: 'thin', color: { rgb: BORDER } },
  right: { style: 'thin', color: { rgb: BORDER } },
};

function dispLen(v) {
  const s = String(v === null || v === undefined ? '' : v);
  let n = 0;
  for (const ch of s) n += AR.test(ch) ? 2.1 : 1.05;
  return n;
}

function applySheet(ws) {
  const ref = ws && ws['!ref'];
  if (!ref) return ws;
  const range = xlsx.utils.decode_range(ref);
  const c0 = range.s.c;
  const cols = range.e.c - c0 + 1;

  ws['!dir'] = 'rtl';
  ws['!rows'] = [];
  for (let r = range.s.r; r <= range.e.r; r++) ws['!rows'][r] = { hpt: r === range.s.r ? 22 : 18 };
  ws['!cols'] = [];
  for (let c = 0; c < cols; c++) {
    let m = 0;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[xlsx.utils.encode_cell({ r, c: c0 + c })];
      if (cell && cell.v !== undefined && cell.v !== null) m = Math.max(m, dispLen(cell.v));
    }
    ws['!cols'][c] = { wch: Math.min(46, Math.max(9, Math.round(m + 2))) };
  }

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = 0; c < cols; c++) {
      const addr = xlsx.utils.encode_cell({ r, c: c0 + c });
      const cell = ws[addr];
      if (!cell) continue;
      if (cell.s && cell.s.border) continue;
      if (r === range.s.r) {
        cell.s = {
          font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11, name: 'Segoe UI' },
          fill: { patternType: 'solid', fgColor: { rgb: TEAL } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thin,
        };
      } else {
        cell.s = {
          font: { color: { rgb: 'FF1E293B' }, sz: 10, name: 'Segoe UI' },
          fill: { patternType: 'solid', fgColor: { rgb: BAND } },
          alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
          border: thin,
        };
      }
    }
  }
  return ws;
}

function jsonToSheet(rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const aoa = headers.length ? [headers, ...rows.map((r) => headers.map((h) => (r[h] === null || r[h] === undefined ? '' : r[h])))] : [['']];
  const ws = xlsx.utils.aoa_to_sheet(aoa);
  return applySheet(ws);
}

function beautifyWorkbook(wb) {
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Views = [{ RTL: true }];
  wb.Workbook.Sheets = wb.Workbook.Sheets || [];
  for (const name of wb.SheetNames || []) applySheet(wb.Sheets[name]);
  return wb;
}

function writeBuffer(wb) {
  beautifyWorkbook(wb);
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
}

module.exports = { jsonToSheet, beautifyWorkbook, writeBuffer };