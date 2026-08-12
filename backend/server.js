require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const db = require('./src/db');
const { seed } = require('./src/services/seed');
const errorHandler = require('./src/middleware/error');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', require('./src/routes'));

const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
app.set('io', io);

io.on('connection', (socket) => {
  console.log('[socket] connected:', socket.id);
  socket.on('disconnect', () => console.log('[socket] disconnected:', socket.id));
});

const PORT = process.env.PORT || 5000;

(async () => {
  await db.connect();
  await seed();
  server.listen(PORT, () => {
    console.log(`HOMUNITY backend running on http://localhost:${PORT}`);
  });

  const paymentsService = require('./src/services/payments');
  const runTasks = async () => {
    try {
      const housing = await db.col('Housing').findOne({});
      const overdue = await paymentsService.refreshOverdue(housing ? housing.dueDay : 1);
      if (overdue > 0) io.emit('payment:updated', {});
      await paymentsService.notifyExpiring();
    } catch (e) {
      console.error('[tasks]', e.message);
    }
  };
  runTasks();
  setInterval(runTasks, 60 * 60 * 1000);
})();
