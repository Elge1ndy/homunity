import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, TrendingUp, AlertTriangle, Check, Image, Undo2, MessageCircle, FileText } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import PaymentModal from '../components/PaymentModal.jsx'
import { paymentStatus, fmtMoney, fmtDate, monthLabel, currentMonthKey, downloadBlob } from '../utils/format.js'

const STATUS_FILTERS = [
  ['all', 'الكل'],
  ['unpaid', 'غير مدفوع'],
  ['partial', 'جزئي'],
  ['paid', 'مدفوع'],
  ['overdue', 'متأخر'],
  ['upcoming', 'قادم'],
]

export default function Payments() {
  const { toast } = useToast()
  const [month, setMonth] = useState(currentMonthKey())
  const [status, setStatus] = useState('all')
  const [payTarget, setPayTarget] = useState(null)

  const revenueData = useApi(`/payments/revenue?month=${month}`)
  const paymentsData = useApi(`/payments?month=${month}&status=${status}`)
  const allPayments = useApi(`/payments?month=${month}`)

  useRealtime(() => {
    revenueData.refetch()
    paymentsData.refetch()
    allPayments.refetch()
  }, ['payment:updated', 'student:added', 'student:updated'])

  const data = revenueData.data

  const undoPaid = async (p) => {
    if (!window.confirm('التراجع عن تسجيل هذا الدفع؟')) return
    try {
      await api.post(`/payments/${p._id}/unpaid`)
      toast('تم التراجع')
      revenueData.refetch()
      paymentsData.refetch()
      allPayments.refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const sendReminder = async (p) => {
    try {
      const r = await api.get(`/whatsapp/remind/${p._id}`)
      window.open(r.url, '_blank')
      toast(`فتح واتساب لتذكير ${p.student?.name || 'الطالب'}`)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const exportExcel = async () => {
    try {
      await downloadBlob(`/api/reports/export/payments?month=${month}`, `payments-${month}.xlsx`)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" className="input !w-auto" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} />
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setStatus(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${status === v ? 'bg-primary-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button className="btn-outline ms-auto" onClick={exportExcel}>
          تصدير Excel
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
            <Wallet size={14} /> المتوقع
          </div>
          <p className="text-xl font-extrabold text-slate-800">{fmtMoney(data?.expected)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 mb-1">
            <TrendingUp size={14} /> المحصل
          </div>
          <p className="text-xl font-extrabold text-emerald-700">{fmtMoney(data?.collected)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-red-600 mb-1">
            <AlertTriangle size={14} /> المتبقي
          </div>
          <p className="text-xl font-extrabold text-red-700">{fmtMoney(data?.remaining)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">الطلاب</div>
          <p className="text-xl font-extrabold text-slate-800">
            {data?.paidStudents} <span className="text-sm text-emerald-600 font-bold">مدفوع</span> / {data?.unpaidStudents}{' '}
            <span className="text-sm text-red-600 font-bold">غير مدفوع</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">إجمالي {data?.totalStudents}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {paymentsData.loading || revenueData.loading ? (
          <Spinner full />
        ) : !paymentsData.data?.payments?.length ? (
          <EmptyState message={`لا توجد دفعات لشهر ${monthLabel(month)}`} />
        ) : (
          <div className="overflow-x-auto">
<table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">الطالب</th>
                    <th className="th">المتوقع</th>
                    <th className="th">المدفوع</th>
                    <th className="th">المتبقي</th>
                    <th className="th">الاستحقاق</th>
                    <th className="th">الحالة</th>
                    <th className="th">تاريخ الدفع</th>
                    <th className="th">الإثبات</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.data.payments.map((p) => {
                    const paidAmount = Number(p.paidAmount) || 0
                    const remaining = Math.max(0, (Number(p.amount) || 0) - paidAmount)
                    return (
                      <tr key={p._id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="td">
                          <Link to={`/students/${p.student?._id}`} className="font-semibold text-slate-800 hover:text-primary-700">
                            {p.student?.name || '—'}
                          </Link>
                          <p className="text-xs text-slate-400 font-mono" dir="ltr">{p.student?.studentId || ''}</p>
                        </td>
                        <td className="td font-bold">{fmtMoney(p.amount)} ج.م</td>
                        <td className="td font-bold text-emerald-700">{fmtMoney(paidAmount)} ج.م</td>
                        <td className="td font-bold text-red-600">{fmtMoney(remaining)} ج.م</td>
                        <td className="td" dir="ltr">{p.dueDate}</td>
                        <td className="td">
                          <Badge {...(paymentStatus[p.status] || paymentStatus.unpaid)} />
                        </td>
                        <td className="td">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                        <td className="td">
                          {p.proof ? (
                            <a href={p.proof} target="_blank" rel="noreferrer" className="text-primary-700 inline-flex items-center gap-1 text-xs font-bold">
                              <Image size={14} /> عرض
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-1 justify-end">
                            {p.status !== 'paid' && remaining > 0 ? (
                              <>
                                <button className="btn-primary !py-1.5 text-xs" onClick={() => setPayTarget(p)}>
                                  <Check size={14} /> {paidAmount > 0 ? 'دفعة إضافية' : 'تسجيل دفع'}
                                </button>
                                <button
                                  className="btn-ghost text-emerald-600"
                                  title="تذكير عبر واتساب"
                                  onClick={() => sendReminder(p)}
                                >
                                  <MessageCircle size={14} />
                                </button>
                              </>
                            ) : null}
                            {paidAmount > 0 && (
                              <button className="btn-ghost text-primary-700" title="وصل الاستلام" onClick={() => downloadBlob(`/api/payments/${p._id}/receipt`, `receipt-${p.month}.pdf`)}>
                                <FileText size={14} />
                              </button>
                            )}
                            {p.status === 'paid' && (
                              <button className="btn-ghost text-red-600" onClick={() => undoPaid(p)}>
                                <Undo2 size={14} /> تراجع
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          </div>
        )}
      </div>

      <PaymentModal open={!!payTarget} onClose={() => setPayTarget(null)} onSaved={() => { revenueData.refetch(); paymentsData.refetch(); allPayments.refetch() }} payment={payTarget} />
    </div>
  )
}
