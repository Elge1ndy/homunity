const crypto = require('crypto');

// Generate unique watermark for each buyer
function generateWatermark(buyerName, email) {
  const hash = crypto.createHash('md5')
    .update(`${buyerName}:${email}:${Date.now()}`)
    .digest('hex')
    .slice(0, 12);
  
  return {
    id: hash,
    buyer: buyerName,
    email,
    createdAt: new Date().toISOString()
  };
}

// Embed watermark in code (for tracing leaked copies)
function embedWatermark(code, watermark) {
  // Add hidden comment with watermark
  const watermarkComment = `/* LICENSE:${watermark.id}:${watermark.buyer}:${watermark.email} */`;
  return `${watermarkComment}\n${code}`;
}

// Extract watermark from code
function extractWatermark(code) {
  const match = code.match(/\/\* LICENSE:([^:]+):([^:]+):([^ ]+) \*\//);
  if (!match) return null;
  
  return {
    id: match[1],
    buyer: match[2],
    email: match[3]
  };
}

module.exports = { generateWatermark, embedWatermark, extractWatermark };
