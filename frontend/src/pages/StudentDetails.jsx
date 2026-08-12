import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Archive,
  Ban,
  Check,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
  History,
  Wallet,
  Image,
} from 'lucide-react'
import api from '../api'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import PaymentModal from '../components/PaymentModal.jsx'
import StudentFormModal from '../components/StudentFormModal.jsx'
import InvoiceModal from '../components/InvoiceModal.jsx'
import { studentStatus, paymentStatus, invoiceStatus, fmtMoney, fmtDate, fmtDateTime, monthLabel, timeAgo, downloadBlob } from '../utils/format.js'

export default function StudentDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payTarget, setPayTarget] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [invOpen, setInvOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [rooms, setRooms] = useState([])

  const load = () => {
    setLoading(true)
    api
      .get(`/students/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => toast(errMsg(e), 'error'))
      .finally(() => setLoading(false))
    api.get('/rooms').then((r) => setRooms(r.data.rooms)).catch(() => {})
  }

  useEffect(load, [id])

  const doAction = async (url, okMsg) => {
    try {
      await api.post(`/students/${id}${url}`)
      toast(okMsg)
      load()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    try {
      await api.post(`/students/${id}/notes`, { text: noteText })
      setNoteText('')
      toast('تمت إضافة الملاحظة')
      load()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const remove = async () => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطالب نهائيًا؟ لا يمكن التراجع.')) return
    try {
      await api.delete(`/students/${id}`)
      toast('تم حذف الطالب')
      navigate('/archived')
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  if (loading || !data) return <Spinner full />

  const { student, housing, payments, invoices, activity, financial } = data

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary-700">
        <ArrowRight size={16} /> رجوع
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-primary-50 text-primary-700 text-2xl font-extrabold">{student.name?.slice(0, 1)}</div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                {student.name} <Badge {...studentStatus[student.status]} />
              </h2>
              <p className="font-mono text-sm text-primary-700 font-bold" dir="ltr">{student.studentId}</p>
              <p className="text-sm text-slate-500 mt-1">
                {student.room ? `غرفة ${student.room.number} — سرير ${student.bedNumber || '—'}` : 'بدون غرفة'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {student.status === 'active' && (
              <>
                <button className="btn-outline" onClick={() => setEditOpen(true)}>
                  <Pencil size={15} /> تعديل
                </button>
                <button
                  className="btn-outline text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => window.confirm('إنهاء إقامة الطالب؟') && doAction('/checkout', 'تم إنهاء الإقامة')}
                >
                  <Ban size={15} /> إنهاء الإقامة
                </button>
                <button
                  className="btn-outline text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => window.confirm('أرشفة الطالب؟ ستبقى كل بياناته محفوظة.') && doAction('/archive', 'تمت أرشفة الطالب')}
                >
                  <Archive size={15} /> أرشفة
                </button>
              </>
            )}
            {student.status === 'archived' && (
              <button className="btn-outline" onClick={() => doAction('/restore', 'تمت استعادة الطالب')}>
                <RotateCcw size={15} /> استعادة
              </button>
            )}
            {student.status === 'archived' && (
              <button className="btn-danger" onClick={remove}>
                <Trash2 size={15} /> حذف نهائي
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone size={15} className="text-slate-400" /> <span dir="ltr">{student.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <GraduationCap size={15} className="text-slate-400" /> {student.university || '—'}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail size={15} className="text-slate-400" /> {student.email || '—'}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin size={15} className="text-slate-400" /> {housing?.name || ''}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet size={20} className="text-primary-700" />
              <h3 className="font-extrabold text-slate-800">الملخص المالي</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-xs font-bold text-slate-500">المتوقع</p>
                <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(financial.totalExpected)}</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50">
                <p className="text-xs font-bold text-emerald-600">المدفوع</p>
                <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmtMoney(financial.totalPaid)}</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50">
                <p className="text-xs font-bold text-red-600">المتبقي</p>
                <p className="text-lg font-extrabold text-red-700 mt-1">{fmtMoney(financial.totalRemaining)}</p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="font-extrabold text-slate-800">سجل المدفوعات الشهرية</h3>
              <span className="text-xs text-slate-400">مدفوع {financial.monthsPaid} / {financial.monthsPaid + financial.monthsUnpaid}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">الشهر</th>
                    <th className="th">المبلغ</th>
                    <th className="th">الاستحقاق</th>
                    <th className="th">الحالة</th>
                    <th className="th">تاريخ الدفع</th>
                    <th className="th">الإثبات</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id} className="border-t border-slate-100">
                      <td className="td font-semibold">{monthLabel(p.month)}</td>
                      <td className="td">{fmtMoney(p.amount)} EGP</td>
                      <td className="td" dir="ltr">{p.dueDate}</td>
                      <td className="td">
                        <Badge {...paymentStatus[p.status]} />
                      </td>
                      <td className="td">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                      <td className="td">
                        {p.proof ? (
                          <a href={p.proof} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-700 text-xs font-bold">
                            <Image size={14} /> عرض
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="td">
                        {p.status !== 'paid' ? (
                          <button className="btn-primary !py-1.5 text-xs" onClick={() => setPayTarget(p)}>
                            <Check size={14} /> تسجيل دفع
                          </button>
                        ) : (
                          <button
                            className="btn-ghost text-red-600"
                            onClick={() => window.confirm('التراجع عن هذا الدفع؟') && api.post(`/payments/${p._id}/unpaid`).then(() => { toast('تم التراجع'); load() }).catch((e) => toast(errMsg(e), 'error'))}
                          >
                            تراجع
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-primary-700" />
                <h3 className="font-extrabold text-slate-800">الفواتير</h3>
              </div>
              <button className="btn-primary !py-1.5 text-xs" onClick={() => setInvOpen(true)}>
                <Plus size={14} /> إنشاء فاتورة
              </button>
            </div>
            {invoices.length === 0 ? (
              <EmptyState message="لا توجد فواتير" />
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv._id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50">
                    <div>
                      <p className="font-mono text-sm font-bold text-primary-700" dir="ltr">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">
                        {inv.months.map(monthLabel).join('، ')} — {fmtMoney(inv.total)} EGP
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge {...invoiceStatus[inv.status]} />
                      <button
                        className="btn-ghost text-primary-700"
                        onClick={() => downloadBlob(`/api/invoices/${inv._id}/pdf`, `${inv.invoiceNumber}.pdf`)}
                      >
                        <FileText size={14} /> PDF
                      </button>
                      <button
                        className="btn-ghost text-red-600"
                        onClick={() => window.confirm('حذف الفاتورة؟') && api.delete(`/invoices/${inv._id}`).then(() => { toast('تم الحذف'); load() }).catch((e) => toast(errMsg(e), 'error'))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <StickyNote size={20} className="text-amber-500" />
              <h3 className="font-extrabold text-slate-800">ملاحظات خاصة</h3>
            </div>
            <div className="flex gap-2 mb-4">
              <input className="input" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="أضف ملاحظة..." />
              <button className="btn-primary !px-3" onClick={addNote}>
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {student.privateNotes?.length === 0 && <p className="text-sm text-slate-400 text-center py-2">لا توجد ملاحظات</p>}
              {student.privateNotes?.map((n, i) => (
                <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-sm text-slate-700">{n.text}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {n.by} • {fmtDateTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <History size={20} className="text-slate-400" />
              <h3 className="font-extrabold text-slate-800">سجل النشاط</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activity.length === 0 && <p className="text-sm text-slate-400 text-center py-2">لا يوجد نشاط</p>}
              {activity.map((a) => (
                <div key={a._id} className="flex items-start gap-2">
                  <div className="p-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold mt-0.5">{a.adminName?.slice(0, 1)}</div>
                  <div>
                    <p className="text-sm text-slate-700">{a.action}</p>
                    <p className="text-xs text-slate-400">{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PaymentModal open={!!payTarget} onClose={() => setPayTarget(null)} onSaved={load} payment={payTarget} />
      <StudentFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} student={student} rooms={rooms} />
      <InvoiceModal open={invOpen} onClose={() => setInvOpen(false)} onCreated={load} students={[student]} />
    </div>
  )
}
