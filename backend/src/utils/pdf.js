const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { convertArabic } = require('arabic-reshaper');
const bidiFactory = require('bidi-js');
const paths = require('./paths');

const bidi = bidiFactory();

const FONT_DIR = process.env.HOMUNITY_FONTS || path.join(__dirname, '..', '..', 'fonts');

const C_TEAL = '#0f766e';
const C_TEAL_LT = '#14b8a6';
const C_SLATE = '#0f172a';
const C_MUTED = '#64748b';
const C_FAINT = '#94a3b8';
const C_LINE = '#cbd5e1';
const C_GRID = '#e2e8f0';
const C_BG = '#f8fafc';

const STATUS_COLOR = { paid: '#15803d', partial: '#b45309', unpaid: '#be123c', overdue: '#b91c1c' };
const STATUS_AR = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', overdue: 'Overdue' };
const AR_TO_COLOR = { 'Paid': STATUS_COLOR.paid, 'Partial': STATUS_COLOR.partial, 'Unpaid': STATUS_COLOR.unpaid, 'Overdue': STATUS_COLOR.overdue };

function ar(text) {
  const s = String(text ?? '');
  if (!/[\u0600-\u06FF]/.test(s)) return s;
  const shaped = convertArabic(s);
  const levels = bidi.getEmbeddingLevels(shaped, { direction: 'rtl' });
  return bidi.getReorderedString(shaped, levels);
}

function isAr(text) {
  return /[\u0600-\u06FF]/.test(String(text ?? ''));
}

async function logoBuffer(housing) {
  const logo = housing && housing.logo;
  if (!logo) return null;
  try {
    if (logo.startsWith('/uploads/')) {
      const p = path.join(paths.container(), logo.replace(/^\//, ''));
      if (fs.existsSync(p)) return fs.readFileSync(p);
      return null;
    }
    if (logo.startsWith('http')) {
      const r = await fetch(logo);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    }
  } catch (e) {}
  return null;
}

function header(doc, housing, title, logo) {
  doc.rect(0, 0, doc.page.width, 86).fill(C_TEAL);
  doc.rect(0, 86, doc.page.width, 4).fill(C_TEAL_LT);
  doc.font('TB').fillColor('#ffffff').fontSize(22).text(ar('Homeunity'), 0, 14, { align: 'right', width: doc.page.width - 64 });
  doc.font('T').fontSize(10).text(ar(title), 0, 46, { align: 'right', width: doc.page.width - 64, characterSpacing: 0.4 });
  if (housing && (housing.name || housing.address || housing.phone)) {
    const info = [housing.name, housing.address, housing.phone, housing.currency].filter(Boolean).join('   |   ');
    doc.fillColor('#ccfbf1').fontSize(8.5).text(ar(info), 0, 64, { align: 'right', width: doc.page.width - 64 });
  }
  if (logo) {
    try {
      doc.image(logo, 48, 21, { width: 44, height: 44 });
    } catch (e) {}
  }
  doc.y = 104;
}

function label(doc, text, x, y, width) {
  doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(text), x, y, { width, align: 'right' });
}

function value(doc, text, x, y, width) {
  doc.font('TB').fontSize(9.5).fillColor(C_SLATE).text(ar(String(text ?? '')), x, y, { width, align: 'right' });
}

function card(doc, entries, y, left, width) {
  const h = entries.length * 20 + 16;
  doc.roundedRect(left, y, width, h, 6).lineWidth(0.8).strokeColor(C_LINE).fill(C_BG).fillAndStroke();
  entries.forEach((e, i) => {
    label(doc, (e[0] || '') + ': ', left + 12, y + 10 + i * 20, 90);
    value(doc, e[1], left + 108, y + 9 + i * 20, width - 126);
  });
  return y + h + 14;
}

function table(doc, headers, rows, widths, opts = {}) {
  const left = opts.left || 48;
  const right = doc.page.width - 48;
  let y = opts.y || doc.y;
  const rowH = opts.rowH || 22;
  const cellOf = opts.cellOf;

  doc.roundedRect(left, y, right - left, rowH, 4).fill(C_TEAL);
  headers.forEach((h, i) => {
    const x = left + widths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.font('TB').fontSize(8.5).fillColor('#ffffff').text(ar(h), x + 5, y + 7, { width: widths[i] - 10, align: 'center' });
  });
  y += rowH + 3;

  rows.forEach((r, ri) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 60;
    }
    if (ri % 2 === 0) doc.fillColor(C_BG).rect(left, y, right - left, rowH).fill();
    headers.forEach((_, i) => {
      const x = left + widths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.strokeColor(C_GRID).lineWidth(0.6).rect(x, y, widths[i], rowH).stroke();
      const st = cellOf ? cellOf(r[i], ri, i) : null;
      doc.font('T').fontSize(8.5).fillColor(st || C_SLATE);
      const t = String(r[i] ?? '');
      if (isAr(t)) doc.text(ar(t), x + 5, y + 6.5, { width: widths[i] - 10, align: 'right' });
      else doc.text(t, x + 5, y + 6.5, { width: widths[i] - 10, align: 'center' });
    });
    y += rowH;
  });
  return y + 16;
}

function totalBox(doc, labelText, valueText, y, left, width) {
  const h = 30;
  doc.roundedRect(left, y, width, h, 6).fill(C_TEAL);
  doc.font('T').fontSize(9).fillColor('#ccfbf1').text(ar(labelText), left + 12, y + 9, { width: 120, align: 'right' });
  doc.font('TB').fontSize(12).fillColor('#ffffff').text(ar(valueText), left + width - 170, y + 7, { width: 150, align: 'left' });
  return y + h + 14;
}

function pageFooter(doc, housing) {
  const wm = housing && housing.watermark;
  doc.font('T').fontSize(8).fillColor(C_FAINT).text(ar(wm ? wm : 'Thank you for using Homeunity'), 48, doc.page.maxY() - 20, { align: 'center', width: doc.page.width - 96 });
}

function pageNumbers(doc) {
  let n = 0;
  doc.on('pageAdded', () => {
    n++;
    doc.font('T').fontSize(7.5).fillColor(C_FAINT).text(ar('Page ' + n), 48, doc.page.maxY() - 20, { align: 'left', width: 90 });
  });
  return () => n;
}

function newDoc() {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.registerFont('T', path.join(FONT_DIR, 'tahoma.ttf'));
  doc.registerFont('TB', path.join(FONT_DIR, 'tahomabd.ttf'));
  const origFont = doc.font.bind(doc);
  doc.font = (name, size) => {
    const res = origFont(name, size);
    const f = doc._font;
    if (f && !f.__arPatched) {
      f.__arPatched = true;
      const origLayoutRun = f.layoutRun.bind(f);
      f.layoutRun = (text, features) => {
        const run = f.font.layout(String(text ?? ''), features, undefined, undefined, 'ltr');
        for (let i = 0; i < run.positions.length; i++) {
          const position = run.positions[i];
          for (let key in position) position[key] *= f.scale;
          position.advanceWidth = run.glyphs[i].advanceWidth * f.scale;
        }
        return run;
      };
    }
    return res;
  };
  const origText = doc.text.bind(doc);
  doc.text = (text, x, y, options) => origText(text, x, y, { ...(options || {}), features: [] });
  return doc;
}

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

const MONTHS_AR = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function invoicePdf(invoice, student, housing) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = newDoc();
      const done = collect(doc);
      const pages = pageNumbers(doc);
      const W = doc.page.width - 96;

      header(doc, housing, 'Housing Invoice', await logoBuffer(housing));

      doc.roundedRect(48, doc.y, 250, 26, 5).lineWidth(0.8).strokeColor(C_TEAL);
      doc.font('TB').fontSize(10).fillColor(C_TEAL).text(ar(`Invoice Number: ${invoice.invoiceNumber || ''}`), 60, doc.y + 6, { width: 226, align: 'left' });
      doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Date: ${new Date(invoice.createdAt || Date.now()).toLocaleDateString('en-GB')}`), 60, doc.y + 34, { width: 226, align: 'left' });
      doc.y += 52;

      doc.y = card(doc, [
        ['Student', `${student.name || ''}  (${student.studentId || ''})`],
        ['Phone', student.phone || '—'],
        ['University', student.university || '—'],
        ['Room / Bed', `${student.roomNumber || '—'} / ${student.bedNumber || '—'}`],
      ], doc.y, 48, W);

      const headers = ['Status', 'Amount', 'Month'];
      const widths = [140, 130, W - 270];
      const rows = (invoice.items || []).map((it) => [STATUS_AR[it.status] || it.status, String(it.amount), String(it.month)]);
      const y = table(doc, headers, rows, widths, { y: doc.y + 6, cellOf: (v) => AR_TO_COLOR[v] });

      totalBox(doc, 'Total', `${invoice.total || 0} ${housing && housing.currency || 'EGP'}`, y, 48, W);

      pageFooter(doc, housing);
      doc.end();
      resolve(await done);
      pages();
    } catch (e) {
      reject(e);
    }
  });
}

function reportPdf(month, data, housing) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = newDoc();
      const done = collect(doc);
      const W = doc.page.width - 96;
      const pageN = pageNumbers(doc);

      const [yy, mm] = String(month || '').split('-');
      const title = `Monthly Report — ${MONTHS_AR[Number(mm) - 1] || mm} ${yy || ''}`;
      header(doc, housing, title, await logoBuffer(housing));

      const stats = [
        ['Expected', data.expected || 0],
        ['Collected', data.collected || 0],
        ['Remaining', data.remaining || 0],
        ['Paying', data.paidStudents || 0],
        ['Non-paying', data.unpaidStudents || 0],
        ['Deposits Collected', (data.depositsCollected && data.depositsCollected.sum) || 0],
      ];
      const bw = Math.floor((W - 50) / 6);
      let sx = 48;
      stats.forEach((s, i) => {
        doc.roundedRect(sx, doc.y, bw, 52, 6).lineWidth(0.7).strokeColor(C_LINE).fill(C_BG).fillAndStroke();
        doc.font('TB').fontSize(13).fillColor(C_TEAL).text(String(s[1]), sx + 4, doc.y + 10, { width: bw - 8, align: 'center' });
        doc.font('T').fontSize(7.5).fillColor(C_MUTED).text(ar(s[0]), sx + 4, doc.y + 32, { width: bw - 8, align: 'center' });
        sx += bw + 10;
      });
      doc.y += 72;

      const headers = ['Payment Date', 'Status', 'Amount', 'ID', 'Student'];
      const widths = [110, 90, 90, 90, W - 380];
      const rows = (data.rows || []).map((p) => [
        p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB') : '—',
        STATUS_AR[p.status] || p.status,
        String(p.amount),
        (p.student && p.student.studentId) || '',
        (p.student && p.student.name) || '',
      ]);
      table(doc, headers, rows, widths, { y: doc.y, cellOf: (v) => STATUS_COLOR[v] });

      pageFooter(doc, housing);
      doc.end();
      resolve(await done);
      pageN();
    } catch (e) {
      reject(e);
    }
  });
}

const CURRENCY = (h) => (h && h.currency) || 'EGP';

function depositReceiptPdf({ student, housing, deposit, receiptNo, adminName }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = newDoc();
      const done = collect(doc);
      const W = doc.page.width - 96;

      header(doc, housing, 'Deposit Receipt', await logoBuffer(housing));

      doc.roundedRect(48, doc.y, 250, 26, 5).lineWidth(0.8).strokeColor(C_TEAL);
      doc.font('TB').fontSize(10).fillColor(C_TEAL).text(ar(`Receipt Number: ${receiptNo || ''}`), 60, doc.y + 6, { width: 226, align: 'left' });
      doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Date: ${new Date(deposit.paymentDate || Date.now()).toLocaleDateString('en-GB')}`), 60, doc.y + 34, { width: 226, align: 'left' });
      doc.y += 52;

      doc.y = card(doc, [
        ['Student', `${student.name || ''}  (${student.studentId || ''})`],
        ['Phone', student.phone || '—'],
        ['Room / Bed', `${student.roomNumber || '—'} / ${student.bedNumber || '—'}`],
      ], doc.y, 48, W);

      totalBox(doc, 'Deposit Amount', `${deposit.originalAmount || 0} ${CURRENCY(housing)}`, doc.y + 6, 48, W);

      doc.font('T').fontSize(9).fillColor(C_SLATE).text(ar(`Payment Status: Paid  |  Payment Method: ${deposit.paymentMethod === 'cash' ? 'Cash' : deposit.paymentMethod === 'transfer' ? 'Bank Transfer' : 'Other'}`), 48, doc.y + 4, { width: W, align: 'right' });
      doc.y += 18;
      if (deposit.notes) {
        doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Notes: ${deposit.notes}`), 48, doc.y, { width: W, align: 'right' });
        doc.y += 16;
      }
      doc.y += 6;
      doc.font('T').fontSize(9).fillColor(C_MUTED).text(ar('I, the undersigned, have received the above deposit amount for reserving a housing spot, and agree to the terms. Any damages may be deducted from this amount upon checkout.'), 48, doc.y, { width: W, align: 'right' });
      doc.y += 34;
      doc.font('T').fontSize(9).fillColor(C_MUTED).text(ar('Recipient / Manager Signature: ____________________'), 48, doc.y, { width: W, align: 'right' });
      doc.text(ar(`Recorded by: ${adminName || '—'}`), 48, doc.y + 20, { width: W, align: 'right' });

      pageFooter(doc, housing);
      doc.end();
      resolve(await done);
    } catch (e) {
      reject(e);
    }
  });
}

function depositRefundPdf({ student, housing, deposit, record, receiptNo, adminName }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = newDoc();
      const done = collect(doc);
      const W = doc.page.width - 96;

      header(doc, housing, 'Deposit Refund / Settlement Receipt', await logoBuffer(housing));

      doc.roundedRect(48, doc.y, 250, 26, 5).lineWidth(0.8).strokeColor(C_TEAL);
      doc.font('TB').fontSize(10).fillColor(C_TEAL).text(ar(`Receipt Number: ${receiptNo || ''}`), 60, doc.y + 6, { width: 226, align: 'left' });
      doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Date: ${new Date(record.date || Date.now()).toLocaleDateString('en-GB')}`), 60, doc.y + 34, { width: 226, align: 'left' });
      doc.y += 52;

      doc.y = card(doc, [
        ['Student', `${student.name || ''}  (${student.studentId || ''})`],
        ['Phone', student.phone || '—'],
        ['Room / Bed', `${student.roomNumber || '—'} / ${student.bedNumber || '—'}`],
      ], doc.y, 48, W);

      const headers = ['Amount', 'Reason', 'Description'];
      const widths = [100, 150, W - 250];
      const rows = (deposit.deductions || []).map((x) => [String(x.amount), String(x.reason || '—'), String(x.description || '—')]);
      table(doc, headers, rows, widths, { y: doc.y, rowH: 20 });
      doc.y += 6;
      doc.y = totalBox(doc, 'Total Deductions', `${deposit.totalDeductions || 0} ${CURRENCY(housing)}`, doc.y, 48, W);
      doc.y = totalBox(doc, 'Refunded Amount', `${record.amount || 0} ${CURRENCY(housing)}`, doc.y, 48, W);
      doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Refund Method: ${record.method === 'cash' ? 'Cash' : record.method === 'transfer' ? 'Bank Transfer' : 'Other'}  |  Refund Status: ${deposit.refundStatus === 'full' ? 'Fully Refunded' : deposit.refundStatus === 'partial' ? 'Partially Refunded' : 'Pending Refund'}`), 48, doc.y + 4, { width: W, align: 'right' });
      if (record.notes) {
        doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Notes: ${record.notes}`), 48, doc.y + 18, { width: W, align: 'right' });
      }
      doc.font('T').fontSize(9).fillColor(C_MUTED).text(ar(`Recorded by: ${adminName || record.adminName || '—'}`), 48, doc.page.height - 70, { width: W, align: 'right' });

      pageFooter(doc, housing);
      doc.end();
      resolve(await done);
    } catch (e) {
      reject(e);
    }
  });
}



function paymentReceiptPdf({ payment, student, housing, receiptNo, adminName }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = newDoc();
      const done = collect(doc);
      const W = doc.page.width - 96;

      header(doc, housing, 'Rent Payment Receipt', await logoBuffer(housing));

      const lastTx = (payment.transactions || []).slice(-1)[0] || {};
      const paidAt = lastTx.date || payment.paidAt || Date.now();

      doc.roundedRect(48, doc.y, 250, 26, 5).lineWidth(0.8).strokeColor(C_TEAL);
      doc.font('TB').fontSize(10).fillColor(C_TEAL).text(ar(`Receipt Number: ${receiptNo || ''}`), 60, doc.y + 6, { width: 226, align: 'left' });
      doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Date: ${new Date(paidAt).toLocaleDateString('en-GB')}`), 60, doc.y + 34, { width: 226, align: 'left' });
      doc.y += 52;

      doc.y = card(doc, [
        ['Student', `${student.name || ''}  (${student.studentId || ''})`],
        ['Phone', student.phone || '—'],
        ['University', student.university || '—'],
        ['Room / Bed', `${student.roomNumber || '—'} / ${student.bedNumber || '—'}`],
      ], doc.y, 48, W);

      doc.font('T').fontSize(10).fillColor(C_SLATE).text(ar(`Month: ${String(payment.month || '—').replace('-', ' / ')}`), 48, doc.y, { width: W, align: 'right' });
      doc.y += 16;
      doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Due: ${payment.dueDate || '—'}  |  Transactions: ${(payment.transactions || []).length}`), 48, doc.y, { width: W, align: 'right' });
      doc.y += 26;

      const headers = ['Description', 'Amount'];
      const widths = [W - 160, 160];
      const rows = [
        ['Monthly Amount', String(payment.amount || 0)],
        ['Paid So Far', String(payment.paidAmount || 0)],
        ['Remaining', String((Number(payment.amount) || 0) - (Number(payment.paidAmount) || 0))],
      ];
      const y = table(doc, headers, rows, widths, { y: doc.y, rowH: 20 });

      const methodAr = lastTx.method === 'cash' ? 'Cash' : lastTx.method === 'transfer' ? 'Bank Transfer' : 'Other';
      doc.font('T').fontSize(9).fillColor(C_SLATE).text(ar(`Payment Method: ${methodAr}`), 48, y, { width: W, align: 'right' });
      doc.y = y + 14;
      if (lastTx.note) {
        doc.font('T').fontSize(8.5).fillColor(C_MUTED).text(ar(`Notes: ${lastTx.note}`), 48, doc.y, { width: W, align: 'right' });
        doc.y += 16;
      }
      doc.y += 6;
      doc.font('T').fontSize(9).fillColor(C_MUTED).text(ar('I, the undersigned, have received the above amount for the rent of the specified month, and agree to the terms.'), 48, doc.y, { width: W, align: 'right' });
      doc.y += 34;
      doc.font('T').fontSize(9).fillColor(C_MUTED).text(ar('Recipient / Manager Signature: ____________________'), 48, doc.y, { width: W, align: 'right' });
      doc.text(ar(`Recorded by: ${adminName || ''}`), 48, doc.y + 20, { width: W, align: 'right' });

      pageFooter(doc, housing);
      doc.end();
      resolve(await done);
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { invoicePdf, reportPdf, depositReceiptPdf, depositRefundPdf, paymentReceiptPdf };