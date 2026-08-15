const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const isPkg = !!process.pkg;
const rootDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

process.env.HOMUNITY_ROOT = rootDir;
process.env.DB_DRIVER = 'json';
process.chdir(rootDir);

function ensure(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function lockPath() {
  return path.join(rootDir, '.homeunity.lock');
}

function pidAlive(pid) {
  try {
    const r = spawnSync('tasklist', ['/FI', 'PID eq ' + pid, '/NH'], { encoding: 'utf8', windowsHide: true });
    return r.status === 0 && r.stdout.includes(pid);
  } catch {
    return false;
  }
}

function acquireLock() {
  const lock = lockPath();
  try {
    const fd = fs.openSync(lock, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch {
    try {
      const prev = parseInt(fs.readFileSync(lock, 'utf8').trim(), 10);
      if (prev && pidAlive(prev)) {
        console.log('Homeunity already running (PID ' + prev + ')');
        return false;
      }
    } catch {}
    try {
      fs.writeFileSync(lock, String(process.pid));
      return true;
    } catch {
      return false;
    }
  }
}

function releaseLock() {
  try {
    if (fs.readFileSync(lockPath(), 'utf8').trim() === String(process.pid)) fs.unlinkSync(lockPath());
  } catch {}
}

function autoBackup() {
  const { snapshot } = require('../backend/src/utils/backups');
  const dataDir = path.join(rootDir, 'data');
  const backupsRoot = path.join(rootDir, 'data-backups');
  const dest = snapshot(dataDir, backupsRoot, 7);
  if (dest) console.log('[backup] data backed up ->', path.basename(dest));
}

function ensureFonts() {
  const fontsDir = ensure(path.join(rootDir, 'fonts'));
  process.env.HOMUNITY_FONTS = fontsDir;
  if (fs.readdirSync(fontsDir).length === 0) {
    try {
      const bundledFonts = path.join(__dirname, '..', 'backend', 'fonts');
      for (const f of fs.readdirSync(bundledFonts)) {
        fs.copyFileSync(path.join(bundledFonts, f), path.join(fontsDir, f));
      }
    } catch (e) {
      console.log('[fonts] bundled copy failed:', e.message);
    }
  }
}

function hideConsole() {
  if (!isPkg || process.platform !== 'win32') return;
  const pid = process.pid;
  const tries = [];
  for (let i = 0; i < 40; i++) tries.push(Math.max(500 + i * 500, i * 500));
  const attempt = (wait) =>
    new Promise((resolve) => {
      setTimeout(() => {
        if (!process.pid) return resolve();
        spawn(
          'powershell',
          [
            '-NoProfile',
            '-NonInteractive',
            '-WindowStyle',
            'Hidden',
            '-Command',
            'Add-Type -TypeDefinition \'public class HW{[System.Runtime.InteropServices.DllImport("user32.dll")]public static extern bool ShowWindow(System.IntPtr h,int n);}\'; $p=(Get-Process -Id ' + pid + ' -ErrorAction SilentlyContinue).MainWindowHandle; if($p -ne 0){[HW]::ShowWindow($p,0); [HW]::ShowWindow($p,0)}',
          ],
          { windowsHide: true, detached: true, stdio: 'ignore' }
        ).unref();
        resolve();
      }, wait);
    });
  let chain = Promise.resolve();
  for (const w of tries.slice(0, 30)) chain = chain.then(() => attempt(w));
  chain.catch(() => {});
}

async function openBrowser(port) {
  if (process.platform !== 'win32') return;
  if (!port) return;
  spawn('cmd', ['/c', 'start', '', 'http://localhost:' + port], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
}

async function resolvePort() {
  if (global.HOMUNITY_PORT) return global.HOMUNITY_PORT;
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    if (global.HOMUNITY_PORT) return global.HOMUNITY_PORT;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function main() {
  if (!acquireLock()) return;
  process.on('exit', releaseLock);
  try {
    autoBackup();
    ensureFonts();
  } catch (e) {
    console.log('[setup]', e.message);
  }
  require('../backend/server.js');
  const port = await resolvePort();
  hideConsole();
  openBrowser(port);
  if (port) console.log('Homeunity ready at http://localhost:' + port);
}

main();