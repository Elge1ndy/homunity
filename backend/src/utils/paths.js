const path = require('path');
const fs = require('fs');

let rootCache = null;

function label() {
  return process.env.HOMUNITY_NAME || 'Homeunity';
}

function container() {
  if (rootCache) return rootCache;
  if (process.env.HOMUNITY_ROOT) rootCache = process.env.HOMUNITY_ROOT;
  else if (process.pkg) rootCache = path.dirname(process.execPath);
  else rootCache = path.join(__dirname, '..', '..');
  return rootCache;
}

function ensure(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function dir(...parts) {
  return ensure(path.join(container(), ...parts));
}

function bundled(...parts) {
  return path.join(__dirname, '..', '..', '..', ...parts);
}

module.exports = { container, dir, bundled, label };