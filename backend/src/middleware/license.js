const fs = require('fs');
const path = require('path');

const LICENSE_FILE = path.join(__dirname, '..', '..', 'data', 'licenses.json');
const LICENSE_KEY_FILE = path.join(__dirname, '..', '..', '.license-key');

function getLicenseKey() {
  if (fs.existsSync(LICENSE_KEY_FILE)) {
    return fs.readFileSync(LICENSE_KEY_FILE, 'utf8').trim();
  }
  return null;
}

function saveLicenseKey(key) {
  fs.writeFileSync(LICENSE_KEY_FILE, key);
}

function validateLicense(key) {
  if (!key || typeof key !== 'string') return false;
  
  // Check format: HOMEUNITY-XXXX-XXXX-XXXX-XXXX
  if (!/^HOMEUNITY-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key)) {
    return false;
  }

  // Check if license file exists (for production)
  if (fs.existsSync(LICENSE_FILE)) {
    const licenses = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    const license = licenses.find(l => l.key === key && l.active);
    return !!license;
  }

  // If no license file, accept any valid format (development mode)
  return true;
}

function licenseMiddleware(req, res, next) {
  // Skip license check for license endpoints
  if (req.path.startsWith('/api/license')) {
    return next();
  }

  const key = getLicenseKey();
  
  if (!key || !validateLicense(key)) {
    return res.status(403).json({ 
      message: 'Invalid or missing license key',
      requiresLicense: true 
    });
  }
  
  next();
}

module.exports = { licenseMiddleware, validateLicense, getLicenseKey, saveLicenseKey };
