const express = require('express');
const router = express.Router();
const { validateLicense, getLicenseKey, saveLicenseKey } = require('../middleware/license');

// Check license status
router.get('/status', (req, res) => {
  const key = getLicenseKey();
  const valid = key ? validateLicense(key) : false;
  
  res.json({ 
    licensed: valid,
    key: key ? key.slice(0, 20) + '...' : null
  });
});

// Activate license
router.post('/activate', (req, res) => {
  const { key } = req.body;
  
  if (!key) {
    return res.status(400).json({ message: 'License key is required' });
  }

  if (!validateLicense(key)) {
    return res.status(400).json({ message: 'Invalid license key' });
  }

  saveLicenseKey(key);
  res.json({ success: true, message: 'License activated successfully' });
});

module.exports = router;
