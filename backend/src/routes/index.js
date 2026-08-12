const express = require('express');
const auth = require('../middleware/auth');
const can = require('../middleware/permission');
const { uploadProof, uploadImage, uploadExcel } = require('../middleware/upload');

const authCtrl = require('../controllers/auth');
const housingCtrl = require('../controllers/housing');
const adminsCtrl = require('../controllers/admins');
const roomsCtrl = require('../controllers/rooms');
const studentsCtrl = require('../controllers/students');
const paymentsCtrl = require('../controllers/payments');
const invoicesCtrl = require('../controllers/invoices');
const reportsCtrl = require('../controllers/reports');
const statsCtrl = require('../controllers/stats');
const notificationsCtrl = require('../controllers/notifications');
const activityCtrl = require('../controllers/activity');

const router = express.Router();

router.post('/auth/login', authCtrl.login);
router.get('/auth/me', auth, authCtrl.me);

router.get('/housing', auth, housingCtrl.get);
router.put('/housing', auth, can('settings'), housingCtrl.update);
router.post('/housing/images', auth, can('settings'), uploadImage.array('images', 10), housingCtrl.uploadImages);
router.post('/housing/images/remove', auth, can('settings'), housingCtrl.removeImage);

router.get('/admins', auth, adminsCtrl.list);
router.post('/admins', auth, can('settings'), adminsCtrl.create);
router.put('/admins/:id', auth, can('settings'), adminsCtrl.update);
router.delete('/admins/:id', auth, can('settings'), adminsCtrl.remove);

router.get('/rooms', auth, roomsCtrl.list);
router.get('/rooms/:id', auth, roomsCtrl.get);
router.post('/rooms', auth, can('rooms'), roomsCtrl.create);
router.put('/rooms/:id', auth, can('rooms'), roomsCtrl.update);
router.delete('/rooms/:id', auth, can('rooms'), roomsCtrl.remove);

router.get('/students/expiring', auth, studentsCtrl.expiring);
router.get('/students/export', auth, can('export'), studentsCtrl.exportExcel);
router.post('/students/import', auth, can('export'), uploadExcel.single('file'), studentsCtrl.import);
router.get('/students', auth, studentsCtrl.list);
router.post('/students', auth, can('students'), studentsCtrl.create);
router.get('/students/:id', auth, studentsCtrl.get);
router.put('/students/:id', auth, can('students'), studentsCtrl.update);
router.delete('/students/:id', auth, can('students'), studentsCtrl.remove);
router.post('/students/:id/checkout', auth, can('students'), studentsCtrl.checkout);
router.post('/students/:id/archive', auth, can('students'), studentsCtrl.archive);
router.post('/students/:id/restore', auth, can('students'), studentsCtrl.restore);
router.post('/students/:id/notes', auth, can('students'), studentsCtrl.addNote);

router.get('/payments/student/:sid', auth, paymentsCtrl.byStudent);
router.get('/payments/revenue', auth, paymentsCtrl.revenue);
router.get('/payments/year', auth, paymentsCtrl.year);
router.get('/payments/current', auth, paymentsCtrl.currentMonth);
router.get('/payments', auth, paymentsCtrl.list);
router.post('/payments/:id/paid', auth, can('payments'), paymentsCtrl.markPaid);
router.post('/payments/:id/unpaid', auth, can('payments'), paymentsCtrl.markUnpaid);
router.put('/payments/:id', auth, can('payments'), paymentsCtrl.update);

router.get('/invoices', auth, invoicesCtrl.list);
router.get('/invoices/:id', auth, invoicesCtrl.get);
router.post('/invoices', auth, can('invoices'), invoicesCtrl.create);
router.delete('/invoices/:id', auth, can('invoices'), invoicesCtrl.remove);
router.get('/invoices/:id/pdf', auth, invoicesCtrl.pdf);

router.get('/reports/monthly', auth, reportsCtrl.monthly);
router.get('/reports/monthly/pdf', auth, reportsCtrl.monthlyPdf);
router.get('/reports/yearly', auth, reportsCtrl.yearly);
router.get('/reports/export/students', auth, can('export'), reportsCtrl.exportStudents);
router.get('/reports/export/payments', auth, can('export'), reportsCtrl.exportPayments);
router.get('/reports/export/rooms', auth, can('export'), reportsCtrl.exportRooms);

router.get('/stats', auth, statsCtrl.stats);

router.get('/notifications', auth, notificationsCtrl.list);
router.get('/notifications/unread', auth, notificationsCtrl.unreadCount);
router.post('/notifications/read/:id', auth, notificationsCtrl.markRead);
router.post('/notifications/read-all', auth, notificationsCtrl.markAllRead);

router.get('/activity', auth, activityCtrl.list);

router.post('/upload/proof', auth, uploadProof.single('proof'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });
  res.json({ path: `/uploads/proofs/${req.file.filename}` });
});

module.exports = router;
