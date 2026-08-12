const bcrypt = require('bcryptjs');
const db = require('../db');

async function seed() {
  const housingCount = await db.col('Housing').count({});
  if (housingCount === 0) {
    await db.col('Housing').insert({
      name: 'سكن هومونيتي',
      address: '',
      phone: '',
      description: '',
      images: [],
      services: ['Wi-Fi', 'كهرباء', 'مياه'],
      rules: ['الالتزام بالهدوء بعد الساعة 11 مساءً', 'منع الزيارات غير المسجلة'],
      dueDay: 1,
      currency: 'EGP',
    });
    console.log('[seed] Housing created');
  }

  const userCount = await db.col('User').count({});
  if (userCount === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await db.col('User').insert({
      name: 'مدير السكن',
      username: 'admin',
      phone: '',
      password: hash,
      role: 'admin',
      active: true,
      permissions: {
        students: true,
        rooms: true,
        beds: true,
        payments: true,
        invoices: true,
        reports: true,
        notifications: true,
        activity: true,
        settings: true,
        export: true,
      },
    });
    console.log('[seed] Default admin created: admin / admin123');
  }
}

module.exports = { seed };
