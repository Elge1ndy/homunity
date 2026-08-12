const path = require('path');
const PDFDocument = require('pdfkit');
const { convertArabic } = require('arabic-reshaper');
const bidiFactory = require('bidi-js');

const bidi = bidiFactory();

const FONT_DIR = path.join(__dirname, '..', '..', 'fonts');

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

function header(doc, housing, title) {
  doc.rect(0, 0, doc.page.width, 72).fill('#0f766e');
  doc.font('TB').fillColor('#ffffff').fontSize(20).text('HOMUNITY', 48, 16, { align: 'left' });
  doc.font('T').fontSize(9).text(ar(title), 48, 44, { align: 'left', characterSpacing: 0.5 });
  doc.fillColor('#e2e8f0').fontSize(8).text(ar(housing ? `${housing.name || ''}  |  ${housing.address || ''}  |  ${housing.phone || ''}` : ''), 48, 56, { align: 'left' });
  doc.y = 92;
}

function cell(doc, text, x, y, width) {
  if (isAr(text)) {
    doc.text(ar(text), x, y, { width, align: 'right' });
  } else {
    doc.text(String(text ?? ''), x, y, { width, align: 'left' });
  }
}

function table(doc, headers, rows, widths, opts = {}) {
  const left = opts.left || 48;
  let y = opts.y || doc.y;
  const rowH = opts.rowH || 20;
  doc.font('TB').fontSize(8);
  headers.forEach((h, i) => {
    const x = left + widths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.fillColor('#e2e8f0').rect(x, y, widths[i], rowH).fill();
    doc.fillColor('#0f172a').text(ar(h), x + 6, y + 6, { width: widths[i] - 12, align: isAr(h) ? 'right' : 'left' });
  });
  y += rowH;
  doc.font('T');
  rows.forEach((r) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 48;
    }
    headers.forEach((_, i) => {
      const x = left + widths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(x, y, widths[i], rowH).stroke();
      doc.fillColor('#0f172a');
      cell(doc, r[i], x + 6, y + 6, widths[i] - 12);
    });
    y += rowH;
  });
  return y + 12;
}

function footer(doc, extra) {
  doc.font('T').fontSize(8).fillColor('#64748b').text(ar(extra || 'شكرًا لاستخدامك هومونيتي'), 48, doc.page.height - 40, { align: 'center' });
}

function newDoc() {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.registerFont('T', path.join(FONT_DIR, 'tahoma.ttf'));
  doc.registerFont('TB', path.join(FONT_DIR, 'tahomabd.ttf'));
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

const STATUS_AR = { paid: 'مدفوع', partial: 'جزئي', unpaid: 'غير مدفوع', overdue: 'متأخر' };

function invoicePdf(invoice, student, housing) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = newDoc();
      const done = collect(doc);

      header(doc, housing, 'فاتورة');

      doc.font('T').fontSize(10).fillColor('#0f172a').text(ar(`رقم الفاتورة: ${invoice.invoiceNumber || ''}`), 48, 96);
      doc.fontSize(9).fillColor('#475569').text(ar(`التاريخ: ${new Date(invoice.createdAt || Date.now()).toLocaleDateString('en-GB')}`), 48, 112);

      doc.font('TB').fontSize(10).fillColor('#0f172a').text(ar('البيانات'), 48, 134);
      doc.font('T').fontSize(9).fillColor('#334155');
      doc.text(ar(`الطالب: ${student.name || ''}  (${student.studentId || ''})`), 48, 150);
      doc.text(ar(`الهاتف: ${student.phone || ''}   الجامعة: ${student.university || ''}`), 48, 164);
      doc.text(ar(`الغرفة: ${student.roomNumber || ''}   السرير: ${student.bedNumber || ''}`), 48, 178);
      doc.y = 200;

      const headers = ['الشهر', 'المبلغ', 'الحالة'];
      const widths = [220, 120, 150];
      const rows = (invoice.items || []).map((it) => [String(it.month), String(it.amount), STATUS_AR[it.status] || it.status]);
      const y = table(doc, headers, rows, widths, { y: doc.y });

      doc.font('TB').fontSize(10).fillColor('#0f172a');
      doc.text(ar(`الإجمالي: ${invoice.total || 0} ${housing ? housing.currency || 'EGP' : 'EGP'}`), 48, y, { align: 'right', width: doc.page.width - 96 });
      footer(doc);
      doc.end();
      resolve(await done);
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

      header(doc, housing, `تقرير شهري — ${month}`);

      doc.font('TB').fontSize(10).fillColor('#0f172a').text(ar('الملخص'), 48, 96);
      const lines = [
        `الإيراد المتوقع: ${data.expected}`,
        `الإيراد المحصل: ${data.collected}`,
        `المتبقي: ${data.remaining}`,
        `الطلاب الدافعون: ${data.paidStudents}`,
        `غير الدافعين: ${data.unpaidStudents}`,
      ];
      doc.font('T').fontSize(9).fillColor('#334155');
      lines.forEach((l) => doc.text(ar(l), 48, doc.y + 12));
      doc.moveDown(2);

      const headers = ['الطالب', 'الرقم', 'المبلغ', 'الحالة', 'تاريخ الدفع'];
      const widths = [190, 90, 80, 80, 110];
      const rows = (data.rows || []).map((p) => [
        (p.student && p.student.name) || '',
        (p.student && p.student.studentId) || '',
        String(p.amount),
        STATUS_AR[p.status] || p.status,
        p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB') : '—',
      ]);
      table(doc, headers, rows, widths, { y: doc.y });
      footer(doc);
      doc.end();
      resolve(await done);
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { invoicePdf, reportPdf };
