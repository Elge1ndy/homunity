const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET_FILE = path.join(__dirname, '..', '..', '.jwt-secret');

function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  
  try {
    if (fs.existsSync(SECRET_FILE)) {
      return fs.readFileSync(SECRET_FILE, 'utf-8').trim();
    }
  } catch {}
  
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, secret, 'utf-8');
  } catch {}
  
  return secret;
}

module.exports = getSecret();
