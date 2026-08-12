const path = require('path');
const PDFDocument = require('pdfkit');
const { convertArabic } = require('arabic-reshaper');
const bidi = require('bidi-js')();
const fs = require('fs');

function ar(text) {
  const s = String(text ?? '');
  if (!/[\u0600-\u06FF]/.test(s)) return s;
  const shaped = convertArabic(s);
  const levels = bidi.getEmbeddingLevels(shaped, { direction: 'rtl' });
  return bidi.getReorderedString(shaped, levels);
}

const doc = new PDFDocument({ size: 'A4', margin: 48 });
doc.registerFont('T', path.join(__dirname, '..', '..', '..', 'Default Project', 'backend', 'fonts', 'tahoma.ttf'));
const chunks = [];
doc.on('data', (c) => chunks.push(c));
doc.on('end', () => fs.writeFileSync(process.env.TEMP + '\\hom_min.pdf', Buffer.concat(chunks)));

const total = 8000;
const currency = 'EGP';
const visual = ar(`الإجمالي: ${total} ${currency}`);
console.log('VISUAL STRING:', JSON.stringify(visual));

doc.font('T').fontSize(10).fillColor('#0f172a');
doc.text('Total: ' + total + ' ' + currency, 48, 100, { align: 'right', width: 500 });
doc.text(visual, 48, 130, { align: 'right', width: 500 });
doc.text(visual, 48, 160, { align: 'left', width: 500 });
doc.text(visual, 48, 190);
doc.end();
