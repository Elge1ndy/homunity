const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');

function ensureDir(sub) {
  const d = path.join(uploadDir, sub);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function storage(sub, prefix) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureDir(sub)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
}

module.exports = {
  uploadProof: multer({ storage: storage('proofs', 'proof'), limits: { fileSize: 5 * 1024 * 1024 } }),
  uploadImage: multer({ storage: storage('images', 'img'), limits: { fileSize: 8 * 1024 * 1024 } }),
  uploadExcel: multer({ storage: storage('imports', 'import'), limits: { fileSize: 10 * 1024 * 1024 } }),
};
