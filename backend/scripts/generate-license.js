const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LICENSE_FILE = path.join(__dirname, '..', 'data', 'licenses.json');

function generateLicenseKey(buyerName, email) {
  const id = crypto.randomBytes(8).toString('hex').toUpperCase();
  const key = `HOMEUNITY-${id.slice(0,4)}-${id.slice(4,8)}-${id.slice(8,12)}-${id.slice(12,16)}`;
  
  const license = {
    key,
    buyer: buyerName,
    email,
    watermarkId: id,
    createdAt: new Date().toISOString(),
    active: true
  };

  // Load existing licenses
  let licenses = [];
  if (fs.existsSync(LICENSE_FILE)) {
    licenses = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
  }
  
  licenses.push(license);
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenses, null, 2));
  
  console.log(`\n========================================`);
  console.log(`License Key: ${key}`);
  console.log(`Buyer: ${buyerName}`);
  console.log(`Email: ${email}`);
  console.log(`Watermark ID: ${id}`);
  console.log(`========================================\n`);
  
  return license;
}

function validateLicenseKey(key) {
  if (!fs.existsSync(LICENSE_FILE)) return false;
  
  const licenses = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
  const license = licenses.find(l => l.key === key && l.active);
  
  return !!license;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node generate-license.js <buyer-name> <email>');
    process.exit(1);
  }
  generateLicenseKey(args[0], args[1]);
}

module.exports = { generateLicenseKey, validateLicenseKey };
