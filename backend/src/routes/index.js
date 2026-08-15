const express = require('express');
const auth = require('../middleware/auth');
const can = require('../middleware/permission');
const { uploadProof, uploadImage, uploadExcel, saveUploaded } = require('../middleware/upload');

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
const backupCtrl = require('../controllers/backup');
const whatsappCtrl = require('../controllers/whatsapp');
const depositCtrl = require('../controllers/deposit');
const propertiesCtrl = require('../controllers/properties');
const financeCtrl = require('../controllers/finance');
const transfersCtrl = require('../controllers/transfers');
const summerCtrl = require('../controllers/summerCourses');

const router = express.Router();

router.post('/auth/login', authCtrl.login);
router.get('/auth/me', auth, authCtrl.me);

router.get('/public/housing', housingCtrl.public);
router.get('/housing', auth, housingCtrl.get);
router.put('/housing', auth, can('settings'), housingCtrl.update);
router.post('/housing/images', auth, can('settings'), uploadImage.array('images', 10), housingCtrl.uploadImages);
router.post('/housing/logo', auth, can('settings'), uploadImage.single('logo'), housingCtrl.uploadLogo);
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
router.put('/rooms/:rid/bed-status', auth, can('beds'), propertiesCtrl.setBedStatus);
router.put('/rooms/:rid/beds/:bn', auth, can('rooms'), propertiesCtrl.setBedPrice);
router.delete('/rooms/:rid/beds/:bn', auth, can('rooms'), propertiesCtrl.removeBed);

router.get('/properties', auth, propertiesCtrl.list);
router.get('/properties/:id/finance', auth, can('rooms'), propertiesCtrl.finance);
router.get('/properties/:id', auth, propertiesCtrl.get);
router.get('/finance/overview', auth, can('rooms'), propertiesCtrl.overview);
router.get('/finance/dashboard', auth, financeCtrl.dashboard);
router.post('/properties/:id/maintenance', auth, can('rooms'), propertiesCtrl.addMaintenance);
router.delete('/properties/:id/maintenance/:mid', auth, can('rooms'), propertiesCtrl.removeMaintenance);
router.post('/properties/:id/expenses', auth, can('rooms'), propertiesCtrl.addExpense);
router.delete('/properties/:id/expenses/:eid', auth, can('rooms'), propertiesCtrl.removeExpense);
router.post('/properties', auth, can('rooms'), propertiesCtrl.create);
router.put('/properties/:id', auth, can('rooms'), propertiesCtrl.update);
router.delete('/properties/:id', auth, can('rooms'), propertiesCtrl.remove);
router.post('/properties/:id/floors', auth, can('rooms'), propertiesCtrl.addFloor);
router.put('/properties/:id/floors/:fid', auth, can('rooms'), propertiesCtrl.updateFloor);
router.delete('/properties/:id/floors/:fid', auth, can('rooms'), propertiesCtrl.removeFloor);
router.post('/properties/:id/apartments', auth, can('rooms'), propertiesCtrl.addApartment);
router.put('/properties/:id/apartments/:aid', auth, can('rooms'), propertiesCtrl.updateApartment);
router.delete('/properties/:id/apartments/:aid', auth, can('rooms'), propertiesCtrl.removeApartment);
router.post('/properties/:id/rooms', auth, can('rooms'), propertiesCtrl.addRoom);
router.delete('/properties/:id/rooms/:rid', auth, can('rooms'), propertiesCtrl.removeRoom);

router.get('/transfers', auth, can('students'), transfersCtrl.list);
router.post('/students/:id/transfer', auth, can('students'), transfersCtrl.transfer);

router.get('/summer-courses', auth, can('students'), summerCtrl.list);
router.post('/summer-courses', auth, can('students'), summerCtrl.create);
router.post('/summer-courses/:id/pay', auth, can('payments'), summerCtrl.pay);
router.post('/summer-courses/:id/end', auth, can('students'), summerCtrl.end);
router.delete('/summer-courses/:id', auth, can('students'), summerCtrl.remove);

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
router.get('/students/:id/deposit/receipt', auth, depositCtrl.receipt);
router.post('/students/:id/deposit/pay', auth, can('payments'), depositCtrl.pay);
router.put('/students/:id/deposit', auth, can('payments'), depositCtrl.edit);
router.post('/students/:id/deposit/deduct', auth, can('payments'), depositCtrl.deduct);
router.post('/students/:id/deposit/refund', auth, can('payments'), depositCtrl.refund);
router.get('/deposits/export', auth, can('export'), depositCtrl.exportExcel);
router.get('/deposits', auth, can('reports'), depositCtrl.list);

router.get('/payments/student/:sid', auth, paymentsCtrl.byStudent);
router.get('/whatsapp/remind/:id', auth, whatsappCtrl.remind);
router.get('/payments/revenue', auth, paymentsCtrl.revenue);
router.get('/payments/year', auth, paymentsCtrl.year);
router.get('/payments/current', auth, paymentsCtrl.currentMonth);
router.get('/payments/calendar', auth, paymentsCtrl.calendar);
router.get('/payments', auth, paymentsCtrl.list);
router.post('/payments/:id/paid', auth, can('payments'), paymentsCtrl.markPaid);
router.post('/payments/:id/pay', auth, can('payments'), paymentsCtrl.pay);
router.post('/payments/:id/unpaid', auth, can('payments'), paymentsCtrl.markUnpaid);
router.put('/payments/:id', auth, can('payments'), paymentsCtrl.update);
router.get('/payments/:id/receipt', auth, paymentsCtrl.receipt);

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

router.get('/backup', auth, can('settings'), backupCtrl.export);
router.post('/restore', auth, can('settings'), uploadExcel.single('file'), backupCtrl.restore);

router.post('/upload/proof', auth, uploadProof.single('proof'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });
    const p = await saveUploaded(req.file, 'proofs', 'proof');
    res.json({ path: p });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
