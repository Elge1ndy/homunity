import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { fmtMoney } from '../utils/format.js'
import Spinner from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'

function Stat({ label, value, cls }) {
  return (
    <div className={`p-4 rounded-xl ${cls}`}>
      <p className="text-[10px] font-bold">{label}</p>
      <p className="text-lg font-extrabold mt-1">{fmtMoney(value)} ج.م</p>
    </div>
  )
}

export default function FinanceDashboard() {
  const [propertyId, setPropertyId] = useState('')
  const [apartmentId, setApartmentId] = useState('')
  const [studentId, setStudentId] = useState('')

  const query = new URLSearchParams()
  if (propertyId) query.set('propertyId', propertyId)
  if (apartmentId) query.set('apartmentId', apartmentId)
  if (studentId) query.set('studentId', studentId)
  const qs = query.toString() ? `?${query.toString()}` : ''

  const data = useApi(`/finance/dashboard${qs}`)
  const propsData = useApi('/properties')

  useRealtime(() => data.refetch(), ['payment:updated', 'student:updated', 'student:added', 'property:updated', 'deposit:updated'])

  if (!data.data) return <Spinner full />

  const { totals, students = [], properties = [], apartments = [] } = data.data
  const propertiesList = propsData.data?.properties || []
  const cur = propertiesList.find((p) => String(p._id) === String(propertyId))
  const apts = cur ? cur.apartments || [] : apartments
  const studentOptions = students

  const showProps = !propertyId
  const showApts = !apartmentId
  const showStudents = !studentId

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="page-title">اللوحة المالية</h1>
          <p className="page-sub">إجمالي الإيرادات والمدفوعات لكل العقارات والشقق والطلاب</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !w-auto" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setApartmentId(''); setStudentId('') }}>
            <option value="">كل العقارات</option>
            {propertiesList.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
          <select className="input !w-auto" value={apartmentId} onChange={(e) => { setApartmentId(e.target.value); setStudentId('') }} disabled={!propertyId || apts.length === 0}>
            <option value="">كل الشقق</option>
            {apts.map((a) => (
              <option key={a._id} value={a._id}>{a.name}</option>
            ))}
          </select>
          <select className="input !w-auto" value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!apartmentId || studentOptions.length === 0}>
            <option value="">كل الطلاب</option>
            {studentOptions.map((s) => (
              <option key={s._id} value={s._id}>{s.name} ({s.studentId})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Stat label="Expected Revenue" value={totals.expected} cls="bg-slate-50 text-slate-800" />
          <Stat label="Collected Revenue" value={totals.collected} cls="bg-emerald-50 text-emerald-700" />
          <Stat label="Remaining" value={totals.remaining} cls="bg-red-50 text-red-700" />
          <Stat label="Overdue" value={totals.overdue} cls="bg-orange-50 text-orange-700" />
          <Stat label="Upcoming" value={totals.upcoming} cls="bg-indigo-50 text-indigo-700" />
          <Stat label="Total Due" value={totals.due} cls="bg-violet-50 text-violet-700" />
          <Stat label="Deposits Held" value={totals.depositsHeld} cls="bg-cyan-50 text-cyan-700" />
          <Stat label="Deposits Refunded" value={totals.depositsRefunded} cls="bg-slate-50 text-slate-600" />
          <Stat label="Deposits Deducted" value={totals.depositsDeducted} cls="bg-rose-50 text-rose-700" />
          <Stat label="Deposits Remaining" value={totals.depositsRemaining} cls="bg-cyan-50 text-cyan-800" />
          <Stat label="Expenses" value={totals.expenses} cls="bg-amber-50 text-amber-700" />
          <Stat label="Maintenance" value={totals.maintenance} cls="bg-yellow-50 text-yellow-700" />
          <Stat label="Gross Revenue" value={totals.gross} cls="bg-teal-50 text-teal-700" />
          <Stat label="Net Income" value={totals.net} cls="bg-blue-50 text-blue-700" />
        </div>
      </div>

      {showProps && properties.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-4 py-3"><h3 className="font-extrabold text-slate-800">حسب العقار / البيت</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">العقار</th><th className="th">متوقع</th><th className="th">محصّل</th><th className="th">متبقي</th>
                  <th className="th">متأخر</th><th className="th">قادم</th><th className="th">تأمين</th>
                  <th className="th">صيانة</th><th className="th">مصروفات</th><th className="th">Gross</th><th className="th">Net</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="td font-bold">{p.name}</td>
                    <td className="td">{fmtMoney(p.expected)} ج.م</td>
                    <td className="td text-emerald-700 font-semibold">{fmtMoney(p.collected)} ج.م</td>
                    <td className="td text-red-600 font-semibold">{fmtMoney(p.remaining)} ج.م</td>
                    <td className="td text-orange-600 font-semibold">{fmtMoney(p.overdue)} ج.م</td>
                    <td className="td">{fmtMoney(p.upcoming)} ج.م</td>
                    <td className="td">{fmtMoney(p.depositsHeld)} ج.م</td>
                    <td className="td">{fmtMoney(p.maintenance)} ج.م</td>
                    <td className="td">{fmtMoney(p.expenses)} ج.م</td>
                    <td className="td">{fmtMoney(p.gross)} ج.م</td>
                    <td className="td text-blue-700 font-bold">{fmtMoney(p.net)} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showApts && apartments.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-4 py-3"><h3 className="font-extrabold text-slate-800">حسب الشقة</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">الشقة</th><th className="th">العقار</th><th className="th">متوقع</th><th className="th">محصّل</th>
                  <th className="th">متبقي</th><th className="th">متأخر</th><th className="th">تأمين</th>
                  <th className="th">صيانة</th><th className="th">مصروفات</th><th className="th">Net</th>
                </tr>
              </thead>
              <tbody>
                {apartments.map((a) => (
                  <tr key={a._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="td font-bold">شقة {a.name}</td>
                    <td className="td text-slate-500">{a.propertyName}</td>
                    <td className="td">{fmtMoney(a.expected)} ج.م</td>
                    <td className="td text-emerald-700 font-semibold">{fmtMoney(a.collected)} ج.م</td>
                    <td className="td text-red-600 font-semibold">{fmtMoney(a.remaining)} ج.م</td>
                    <td className="td text-orange-600 font-semibold">{fmtMoney(a.overdue)} ج.م</td>
                    <td className="td">{fmtMoney(a.depositsHeld)} ج.م</td>
                    <td className="td">{fmtMoney(a.maintenance)} ج.م</td>
                    <td className="td">{fmtMoney(a.expenses)} ج.م</td>
                    <td className="td text-blue-700 font-bold">{fmtMoney(a.net)} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showStudents && students.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-4 py-3"><h3 className="font-extrabold text-slate-800">حسب الطالب</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">الطالب</th><th className="th">العقار</th><th className="th">الشقة</th><th className="th">الحالة</th>
                  <th className="th">متوقع</th><th className="th">محصّل</th><th className="th">متبقي</th>
                  <th className="th">متأخر</th><th className="th">قادم</th><th className="th">Due</th><th className="th">تأمين</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="td">
                      <Link to={`/students/${s._id}`} className="font-bold text-primary-700 hover:underline">{s.name}</Link>
                      <span className="text-slate-400 text-xs block" dir="ltr">{s.studentId}</span>
                    </td>
                    <td className="td text-slate-500">{s.propertyName || '—'}</td>
                    <td className="td text-slate-500">{s.apartmentName || '—'}</td>
                    <td className="td">
                      <Badge label={s.status === 'active' ? 'نشط' : s.status === 'ended' ? 'منتهي' : 'مؤرشف'} cls={s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'} />
                    </td>
                    <td className="td">{fmtMoney(s.expected)} ج.م</td>
                    <td className="td text-emerald-700 font-semibold">{fmtMoney(s.collected)} ج.م</td>
                    <td className="td text-red-600 font-semibold">{fmtMoney(s.remaining)} ج.م</td>
                    <td className="td text-orange-600 font-semibold">{fmtMoney(s.overdue)} ج.م</td>
                    <td className="td">{fmtMoney(s.upcoming)} ج.م</td>
                    <td className="td">{fmtMoney(s.due)} ج.م</td>
                    <td className="td">{fmtMoney(s.deposit)} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}