# HOMUNITY — نظام إدارة السكن الطلابي

نظام متكامل لإدارة السكن الطلابي: الطلاب، الغرف، الأسرة، المدفوعات الشهرية، الفواتير، التقارير، والإشعارات — بواجهة عربية RTL ودعم مباشر للوقت الفعلي (Socket.IO).

## المتطلبات

- Node.js 18+
- اختياري: MongoDB (للتخزين السحابي) — بدونها يعمل النظام تلقائيًا بملفات JSON

## التشغيل

### 1) الخادم (Backend) — المنفذ 5000

```bash
cd backend
npm install
npm start
```

- عند أول تشغيل يُنشئ الحساب الافتراضي: **admin / admin123** وبيانات السكن الأساسية.
- البيانات تُحفظ في `backend/data/*.json` (افتراضي). لتغيير قاعدة البيانات:

```bash
# backend/.env

# الخيار 1: MongoDB
MONGO_URI=mongodb+srv://user:pass@cluster/dbname
DB_DRIVER=auto   # auto | mongo | json

# الخيار 2: Supabase (PostgreSQL السحابية)
# 1) أنشئ جدول homunity_docs من SQL Editor في لوحة Supabase:
#    create table if not exists public.homunity_docs (
#      collection text not null, id text primary key, doc jsonb not null);
#    create index if not exists idx_homunity_docs_collection on public.homunity_docs (collection);
#    grant all on table public.homunity_docs to anon, authenticated;
# 2) ضع الرابط والمفتاح الناشر (anon/publishable) في .env:
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=sb_publishable_xxxx
DB_DRIVER=auto   # auto | mongo | supabase | json

# ترحيل بيانات JSON الحالية إلى Supabase:
node scripts/migrate-supabase.js
```

## التخزين المزدوج (السحابة + الجهاز)

- الافتراضي `MIRROR=auto`: النظام يكتب كل عملية **في السحابة وفي ملفات الجهاز معًا** — لو وحدة وقعت التانية تشتغل تلقائيًا (قراءة بديلة عند انقطاع الإنترنت).
- `MIRROR=none` لإيقاف النسخ المزدوج (هيشتغل على المصدر الأساسي بس).
- لتفريغ نسخة السحابة كاملة في ملفات `backend/data` في أي وقت:

```bash
node scripts/resync-local-from-cloud.js   # السحابة ← الجهاز (النسخة الاحتياطية)
```

## الصور

- الصور (إثباتات الدفع وصور السكن) تُحفظ **في الاتنين معًا**: نسخة محلية في `backend/uploads` + نسخة في **Supabase Storage** (حاوية `homunity`) عند التشغيل على Supabase.
- الواجهة تعرض من رابط السحابة (شغال من أي جهاز)، والنسخة المحلية نسخة احتياطية فورية.
- بدون Supabase: تُحفظ محليًا في `backend/uploads` فقط.
- فواتير PDF تتولّد على الخادم وتبقى محلية في `backend/uploads/invoices`.

- الخادم يقدّم أيضًا نسخة الواجهة الجاهزة من `frontend/dist` عند وجودها (زيّارة http://localhost:5000 مباشرة).

### 2) الواجهة (Frontend) — للتطوير فقط

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173 (Proxy إلى الخادم 5000)
npm run build   # بناء نسخة الإنتاج إلى dist
```

## الميزات

- **صلاحيات متعددة**: مديرون بصلاحيات قابلة للتخصيص (طلاب، غرف، مدفوعات، فواتير، تقارير، إعدادات...)
- **الطلاب**: تسجيل تلقائي لرقم الطالب (ST-XXXX)، منع تكرار رقم الهاتف، بحث/فلترة/ترحيل، استيراد/تصدير Excel، ملاحظات خاصة، أرشفة/استعادة/حذف نهائي، إنهاء الإقامة
- **الغرف والأسرّة**: إدارة الغرف (سعة، إيجار، نوع)، توزيع الطلاب على الأسرة، منع حذف غرفة بها طلاب
- **المدفوعات**: توليد تلقائي شهريًا من تاريخ الدخول إلى الخروج، مدة القيمة عند تغيير الإيجار، حالات (مدفوع/متأخر/غير مدفوع)، إثبات دفع (سكرين شوت)، تاريخ دفع مخصص، رجوع عن الدفع، **تقويم الدفعات** الشهري
- **الفواتير**: توليد لشهر واحد أو عدة أشهر، رقم تسلسلي، تحميل PDF، حالة (مدفوع/جزئي/غير مدفوع)
- **التقارير**: شهري (مع PDF)، سنوي، تصدير Excel (طلاب/مدفوعات/غرف)
- **لوحة التحكم**: إحصائيات فورية (إشغال الأسرة، متأخرات، منتهية الإقامة...)
- **إشعارات**: منتهي الإقامة قريبًا، متأخرات — مع جرس إشعارات فوري
- **سجل النشاط**: كل عمليات النظام مع اسم المنفذ
- **وقت فعلي**: تحديث فوري عبر Socket.IO عند أي تغيير

## هيكل المشروع

```
backend/
  server.js              # نقطة الدخول + Socket.IO + مهام دورية (كل ساعة)
  src/db/index.js        # طبقة بيانات مزدوجة: JSON أو MongoDB
  src/models/index.js    # نماذج البيانات (User, Student, Room, Payment...)
  src/controllers/       # منطق الواجهات (auth, students, rooms, payments, invoices, reports...)
  src/services/          # المدفوعات، الإيرادات، الإشعارات، السجل، التهيئة
  src/middleware/        # auth (JWT)، الصلاحيات، رفع الملفات، معالجة الأخطاء
  uploads/               # صور الإثباتات والكشوفات
  data/                  # بيانات JSON (تُحذف عند التحويل إلى MongoDB)
frontend/
  src/pages/             # لوحة التحكم، الطلاب، الغرف، الأسرّة، المدفوعات، التقويم، الفواتير، التقارير، السكن، الأرشيف، الإشعارات، سجل النشاط، الإعدادات
  src/components/        # نوافذ الإضافة/التعديل، التخطيط، الشارات
  src/context/           # AuthContext + ToastContext
  src/socket.js          # الاتصال اللحظي
```

## بيانات تجريبية

يوجد حاليًا غرفة B-101 (4 أسرّة، إيجار 2500) وطالب أحمد سمير (ST-0001) مع 13 دفعة مولّدة تلقائيًا (الدفعة الحالية مدفوعة). لبدء قاعدة بيانات نظيفة: أوقف الخادم واحذف ملفات `backend/data/*.json` ثم أعد تشغيله.