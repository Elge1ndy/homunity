require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');

const paths = require('./src/utils/paths');
const db = require('./src/db');
const { seed } = require('./src/services/seed');
const errorHandler = require('./src/middleware/error');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./src/utils/jwt');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(paths.dir('uploads')));

app.use('/api', require('./src/routes'));

function loadDist() {
  const dist = paths.bundled('frontend', 'dist');
  const files = {};
  if (!fs.existsSync(dist)) return null;
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const s = fs.statSync(p);
      if (s.isDirectory()) walk(p);
      else files[p.replace(/\\/g, '/')] = fs.readFileSync(p);
    }
  };
  walk(dist);
  return files;
}

const distFiles = loadDist();
if (distFiles) {
  const indexKey = paths.bundled('frontend', 'dist', 'index.html').replace(/\\/g, '/');
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };
  app.use((req, res, next) => {
    const rel = decodeURIComponent(req.path).replace(/\\/g, '/');
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) return next();
    const key = paths.bundled('frontend', 'dist', rel.slice(1)).replace(/\\/g, '/');
    const file = rel === '/' || rel === '/index.html' ? distFiles[indexKey] : distFiles[key];
    if (file) {
      const chosen = rel === '/' || rel === '/index.html' ? indexKey : key;
      const ext = path.extname(chosen);
      res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
      return res.send(file);
    }
    res.type('html').send(distFiles[indexKey]);
  });
}

app.use(errorHandler);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: true, credentials: true },
});
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('unauthorized'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});
app.set('io', io);

const BASE_PORT = Number(process.env.PORT || 5000);

function listen(port, maxPort) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < maxPort) {
      listen(port + 1, maxPort);
    } else {
      console.error('PORT ERROR:', e.message);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log(`HOMUNITY backend running on http://localhost:${port}`);
    global.HOMUNITY_PORT = port;
    io.emit('data:refresh', {});
    if (process.send) process.send({ event: 'ready', port });
  });
}

(async () => {
  await db.connect();
  await seed();
  const { ensureDefaults } = require('./src/services/structure');
  try {
    await ensureDefaults();
  } catch (e) {
    console.error('[structure]', e.message);
  }
  const { ensureBucket } = require('./src/services/storage');
  if (db.driver === 'supabase') {
    try {
      await ensureBucket();
      console.log('[storage] Supabase bucket ready');
    } catch (e) {
      console.error('[storage]', e.message);
    }
  }
  listen(BASE_PORT, BASE_PORT + 10);

  const paymentsService = require('./src/services/payments');
  const { snapshot } = require('./src/utils/backups');
  const runTasks = async () => {
    try {
      snapshot(db.DATA_DIR, db.BACKUPS_DIR);
    } catch (e) {
      console.error('[tasks] backup failed:', e.message);
    }
    try {
      const housing = await db.col('Housing').findOne({});
      const overdue = await paymentsService.refreshOverdue(housing ? housing.dueDay : 1);
      if (overdue > 0) console.log('[tasks] overdue updated:', overdue);
      await paymentsService.notifyExpiring();
      const { autoEndExpired } = require('./src/controllers/summerCourses');
      const ended = await autoEndExpired();
      if (ended > 0) {
        console.log('[tasks] summer courses ended:', ended);
        io.emit('data:refresh', {});
      }
    } catch (e) {
      console.error('[tasks]', e.message);
    }
  };
  runTasks();
  setInterval(runTasks, 60 * 60 * 1000);
})();