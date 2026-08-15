const { app, BrowserWindow, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isPkg = !!process.pkg;
const appDataRoot = process.env.APPDATA || (require('os').homedir());
const OLD_ROOT = path.join(appDataRoot, 'Homeunity');

function writable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.w');
    fs.writeFileSync(probe, '1');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

let rootDir;
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  rootDir = process.env.PORTABLE_EXECUTABLE_DIR;
} else if (!app.isPackaged && !isPkg) {
  rootDir = path.join(__dirname, '..');
} else {
  rootDir = path.dirname(process.execPath);
  if (!writable(rootDir)) rootDir = OLD_ROOT;
}

process.env.HOMUNITY_ROOT = rootDir;
process.env.DB_DRIVER = 'json';
process.env.PORT = process.env.PORT || '5010';
process.env.HOMUNITY_APP = 'electron';

const LOG = path.join(rootDir, 'app-debug.log');
function dlog(...a) {
  try {
    const line = '[' + new Date().toISOString().slice(11, 19) + '] ' + a.join(' ') + '\n';
    fs.appendFileSync(LOG, line);
  } catch {}
}

function ensure(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function migrateFrom(oldDir, sub, tag) {
  try {
    if (!fs.existsSync(path.join(rootDir, sub)) && fs.existsSync(path.join(oldDir, sub)) && fs.readdirSync(path.join(oldDir, sub)).length) {
      fs.cpSync(path.join(oldDir, sub), path.join(rootDir, sub), { recursive: true });
      dlog('[migrate]', tag, 'copied from', path.join(oldDir, sub));
    }
  } catch (e) {
    dlog('[migrate]', tag, e.message);
  }
}

const STORE = '.store';

function hide(p) {
  try {
    require('child_process').execFileSync('attrib', ['+h', p]);
  } catch {}
}

function migrateJsonIntoStore(src) {
  try {
    if (!src || !fs.existsSync(src)) return;
    if (fs.existsSync(path.join(rootDir, STORE))) return;
    const files = fs.readdirSync(src).filter((f) => f.endsWith('.json'));
    if (files.length === 0) return;
    const storeDir = ensure(path.join(rootDir, STORE));
    for (const f of files) {
      const s = path.join(src, f);
      const d = path.join(storeDir, f);
      if (!fs.existsSync(d)) fs.copyFileSync(s, d);
    }
    hide(storeDir);
    dlog('[migrate] store seeded from', src);
  } catch (e) {
    dlog('[migrate] store seed ERR', e.message);
  }
}

function bootstrap() {
  ensure(rootDir);
  migrateJsonIntoStore(path.join(OLD_ROOT, 'data'));
  migrateJsonIntoStore(path.join(rootDir, 'data'));
  migrateJsonIntoStore(path.join(path.dirname(process.execPath), 'data'));
  if (rootDir !== OLD_ROOT) {
    migrateFrom(OLD_ROOT, 'data-backups', 'backups');
    try {
      const oldExports = path.join(OLD_ROOT, 'exports');
      if (!fs.existsSync(path.join(rootDir, 'exports')) && fs.existsSync(oldExports)) {
        fs.cpSync(oldExports, path.join(rootDir, 'exports'), { recursive: true });
        dlog('[migrate] exports copied from', oldExports);
      }
    } catch (e) {
      dlog('[migrate] exports', e.message);
    }
  }
  const dataDir = ensure(path.join(rootDir, 'data'));
  const fontsDir = ensure(path.join(rootDir, 'fonts'));
  process.env.HOMUNITY_FONTS = fontsDir;
  if (fs.readdirSync(fontsDir).length === 0) {
    try {
      const bundledFonts = path.join(__dirname, '..', 'backend', 'fonts');
      for (const f of fs.readdirSync(bundledFonts)) {
        fs.copyFileSync(path.join(bundledFonts, f), path.join(fontsDir, f));
      }
    } catch (e) {
      dlog('[fonts]', e.message);
    }
  }
  global.HOMUNITY_ICON = path.join(rootDir, 'Homeunity.ico');
  try {
    const iconSrc = path.join(__dirname, 'icon.ico');
    if (fs.existsSync(iconSrc)) fs.copyFileSync(iconSrc, global.HOMUNITY_ICON);
  } catch {}
  try {
    const { snapshot } = require('../backend/src/utils/backups');
    snapshot(path.join(rootDir, STORE), path.join(rootDir, 'data-backups'), 7);
  } catch (e) {
    dlog('[backup]', e.message);
  }
  try {
    require('child_process').execFileSync('attrib', ['+h', path.join(rootDir, STORE)]);
  } catch {}
}

function waitForPort() {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (global.HOMUNITY_PORT) return resolve(global.HOMUNITY_PORT);
      if (Date.now() - started > 60000) return resolve(null);
      setTimeout(tick, 300);
    };
    tick();
  });
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: 'Homeunity',
    icon: global.HOMUNITY_ICON,
    autoHideMenuBar: true,
    backgroundColor: '#f1f5f9',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler(({ url }) => {
    dlog('[nav] popup ->', url);
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch((e) => dlog('[nav] open ERR', e.message));
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (String(url).startsWith('http://localhost:' + port) || String(url).startsWith('https://localhost:' + port)) return;
    dlog('[nav] block ->', url);
    e.preventDefault();
    shell.openExternal(url).catch((x) => dlog('[nav] ERR', x.message));
  });

  const wc = win.webContents;
  wc.on('console-message', (e, level, message, line, sourceId) => {
    dlog('[renderer]', level, message);
  });
  wc.on('did-finish-load', () => {
    dlog('[window] FINISHED', wc.getURL());
    setTimeout(() => shot(win, 'loaded.png'), 4000);
    setTimeout(() => {
      wc.executeJavaScript(`(async () => {
        await new Promise(r => setTimeout(r, 2500));
        return JSON.stringify({
          title: document.title,
          bodyLen: document.body ? document.body.innerHTML.length : -1,
          rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : -1,
          inputs: document.querySelectorAll('input').length,
          buttons: document.querySelectorAll('button').length,
          text: (document.body ? document.body.innerText : '').slice(0, 400)
        });
      })()`).then((r) => dlog('[dom]', r)).catch((e) => dlog('[dom] ERR', e.message));
      if (process.env.HOMUNITY_TEST_DL === '1') {
        wc.executeJavaScript(`(async () => {
          const l = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'admin', password: 'admin123' }) }).then(r => r.json());
          const r = await fetch('/api/backup', { headers: { Authorization: 'Bearer ' + l.token } });
          const b = await r.blob();
          const u = URL.createObjectURL(b);
          const a = document.createElement('a');
          a.href = u; a.download = 'e2e-backup-test.xlsx';
          document.body.appendChild(a); a.click();
          return 'export-clicked';
        })()`).then((r) => dlog('[e2e-dl]', r)).catch((e) => dlog('[e2e-dl] ERR', e.message));
      }
    }, 8000);
  });
  wc.on('did-fail-load', (e, code, desc, url) => {
    dlog('[window] FAILED', code, desc, url);
    if (String(url).startsWith('http://localhost') && failCount < 8) {
      failCount++;
      setTimeout(() => wc.loadURL(url), 1500);
    }
  });
  wc.on('render-process-gone', (e, details) => {
    dlog('[window] RENDERER GONE', JSON.stringify(details));
  });

  win.loadURL('http://localhost:' + port);
  win.on('closed', () => app.quit());
  return win;
}

let failCount = 0;

function shot(win, name) {
  try {
    win.webContents.capturePage().then((img) => {
      fs.writeFileSync(path.join(rootDir, name), img.toPNG());
      dlog('[shot] saved', name, img.getSize().width + 'x' + img.getSize().height);
    }).catch((e) => dlog('[shot] fail', e.message));
  } catch (e) {
    dlog('[shot]', e.message);
  }
}

process.on('unhandledRejection', (r) => dlog('[main] UNHANDLED', r && r.stack || r));
process.on('uncaughtException', (e) => dlog('[main] EXCEPTION', e.stack || e.message));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(async () => {
    dlog('[boot] whenReady');
    session.defaultSession.on('will-download', (e, item) => {
      const name = (item.getFilename() || '').trim();
      const legit = name && name !== 'download' && path.extname(name);
      if (!legit) {
        e.preventDefault();
        dlog('[download] BLOCKED junk:', name, item.getURL());
        return;
      }
      const dir = ensure(path.join(rootDir, 'exports'));
      const ext = path.extname(name);
      const base = name.slice(0, name.length - ext.length).replace(/[\\/:*?"<>|]/g, '_');
      let final = path.join(dir, base + ext);
      let n = 1;
      while (fs.existsSync(final)) {
        final = path.join(dir, `${base}-${n}${ext}`);
        n++;
      }
      item.setSavePath(final);
      dlog('[download] saved ->', final, item.getURL());
      item.once('done', (e, state) => {
        if (state === 'completed') {
          dlog('[download] completed ->', final);
          try {
            shell.showItemInFolder(final);
          } catch (err) {
            dlog('[download] show ERR', err.message);
          }
        } else {
          dlog('[download] state', state, final);
        }
      });
    });
    bootstrap();
    dlog('[boot] bootstrap done, requiring server');
    try {
      require('../backend/server.js');
      dlog('[boot] server module loaded');
    } catch (e) {
      dlog('[boot] SERVER REQUIRE FAILED', e.stack || e.message);
      throw e;
    }
    const port = await waitForPort();
    dlog('[boot] port =', port);
    try {
      require('../backend/src/services/autoexport').init();
      dlog('[boot] autoexport initialized');
    } catch (e) {
      dlog('[boot] autoexport ERR', e.message);
    }
    createWindow(port);
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}