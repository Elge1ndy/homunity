import { Link } from 'react-router-dom'
import {
  Users,
  BedDouble,
  CircleCheck,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Clock,
  UserPlus,
  DoorOpen,
  FileText,
  BarChart3,
  Archive,
} from 'lucide-react'
import { useApi } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import StatCard from '../components/StatCard.jsx'
import Badge from '../components/Badge.jsx'
import { fmtMoney, monthLabel, timeAgo, paymentStatus, fmtDate } from '../utils/format.js'

export default function Dashboard() {
  const { data, loading, refetch } = useApi('/stats')
  useRealtime(refetch, ['student:added', 'student:updated', 'room:updated', 'payment:updated', 'invoice:created', 'housing:updated'])

  if (loading || !data) return <Spinner full />

  const s = data.students
  const b = data.beds
  const cm = data.currentMonth

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="الطلاب النشطون" value={s.active} sub={`الإجمالي ${s.total} (مؤرشف ${s.archived})`} accent="teal" />
        <StatCard icon={BedDouble} label="الأسرة المشغولة" value={`${b.occupied} / ${b.total}`} sub={`نسبة الإشغال ${data.occupancy}%`} accent="blue" />
        <StatCard icon={CircleCheck} label="الأسرة المتاحة" value={b.free} sub={`${data.roomsCount} غرفة`} accent="amber" />
        <StatCard icon={Wallet} label="إجمالي الأسرة" value={b.total} sub="بكل الغرف" accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-primary-700" />
            <h3 className="font-extrabold text-slate-800">إيرادات {monthLabel(cm.month)}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">المتوقع</span>
              <span className="font-bold text-slate-800">{fmtMoney(cm.expected)} EGP</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">المحصل</span>
              <span className="font-bold text-emerald-600">{fmtMoney(cm.collected)} EGP</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">المتبقي</span>
              <span className="font-bold text-red-600">{fmtMoney(cm.remaining)} EGP</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
              <span className="text-slate-500">الطلاب الدافعون</span>
              <span className="font-bold text-slate-700">{cm.paidStudents}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">غير الدافعين</span>
              <span className="font-bold text-red-600">{cm.unpaidStudents}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-red-500" />
            <h3 className="font-extrabold text-slate-800">غير المدفوعين — {monthLabel(cm.month)}</h3>
          </div>
          {data.unpaidList.length === 0 ? (
            <EmptyState message="الكل دفعات الشهر مسجلة!" />
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {data.unpaidList.map((p) => (
                <Link key={p._id} to={`/students/${p.studentId}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-primary-50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{p.student.name}</p>
                    <p className="text-xs text-slate-400">
                      {p.student.studentId} • {p.room ? `غرفة ${p.room}` : 'بدون غرفة'}
                    </p>
                  </div>
                  <Badge {...paymentStatus[p.status]} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-amber-500" />
            <h3 className="font-extrabold text-slate-800">اقترب انتهاء الإقامة</h3>
          </div>
          {data.expiring.length === 0 ? (
            <EmptyState message="لا توجد إقامات قريبة من الانتهاء" />
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {data.expiring.map((s) => (
                <Link key={s._id} to={`/students/${s._id}`} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{s.name}</p>
                    <p className="text-xs text-slate-400">تنتهي في {fmtDate(s.checkOutDate)}</p>
                  </div>
                  <Badge label={`${s.daysLeft} يوم`} cls="bg-amber-200 text-amber-800" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-extrabold text-slate-800 mb-4">أحدث النشاطات</h3>
          {data.recentActivity.length === 0 ? (
            <EmptyState message="لا يوجد نشاط بعد" />
          ) : (
            <div className="space-y-3">
              {data.recentActivity.map((a) => (
                <div key={a._id} className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary-50 text-primary-700 text-sm font-bold mt-0.5">{a.adminName?.slice(0, 1)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{a.action}</p>
                    <p className="text-xs text-slate-400">
                      {a.adminName} • {timeAgo(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-extrabold text-slate-800 mb-4">إجراءات سريعة</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/students" className="flex items-center gap-2 p-3 rounded-xl bg-primary-50 text-primary-800 text-sm font-bold hover:bg-primary-100">
              <UserPlus size={16} /> إضافة طالب
            </Link>
            <Link to="/rooms" className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 text-blue-800 text-sm font-bold hover:bg-blue-100">
              <DoorOpen size={16} /> إدارة الغرف
            </Link>
            <Link to="/payments" className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-bold hover:bg-emerald-100">
              <Wallet size={16} /> تسجيل دفعة
            </Link>
            <Link to="/invoices" className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 text-amber-800 text-sm font-bold hover:bg-amber-100">
              <FileText size={16} /> إنشاء فاتورة
            </Link>
            <Link to="/reports" className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 text-purple-800 text-sm font-bold hover:bg-purple-100">
              <BarChart3 size={16} /> التقارير
            </Link>
            <Link to="/archived" className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200">
              <Archive size={16} /> الأرشيف
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
