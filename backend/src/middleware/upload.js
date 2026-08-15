const multer = require('multer');
const path = require('path');
const fs = require('fs');
const paths = require('../utils/paths');
const { cloudMode, uploadToStorage } = require('../services/storage');

const uploadDir = paths.dir(process.env.UPLOAD_DIR || 'uploads');

async function saveUploaded(file, folder, prefix) {
  const ext = path.extname(file.originalname);
  const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const dir = path.join(uploadDir, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  if (cloudMode()) {
    const url = await uploadToStorage(folder, filename, file.buffer, file.mimetype);
    console.log('[uploads] local + cloud: ' + folder + '/' + filename);
    return url;
  }
  return `/uploads/${folder}/${filename}`;
}

module.exports = {
  saveUploaded,
  uploadProof: multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  uploadImage: multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }),
  uploadExcel: multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }),
};