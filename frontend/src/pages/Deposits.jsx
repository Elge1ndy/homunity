import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Search, FileSpreadsheet, FileText, Eye } from 'lucide-react'
import { useApi } from '../hooks/useApi.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import { fmtMoney, downloadBlob } from '../utils/format.js'
import api from '../api'
import { errMsg } from '../hooks/useApi.js'
import DeductionModal from '../components/DeductionModal.jsx'
import RefundModal from '../components/RefundModal.jsx'

const STATUS_BADGE = {
  unpaid: { label: 'غير مدفوع', cls: 'bg-red-100 text-red-700' },
  paid: { label: 'مدفوع', cls: 'bg-teal-100 text-teal-700' },
  pending: { label: 'بانتظار الاسترداد', cls: 'bg-amber-100 text-amber-700' },
  partial: { label: 'مسترد جزئيًا', cls: 'bg-amber-100 text-amber-700' },
  full: { label: 'مسترد بالكامل', cls: 'bg-emerald-100 text-emerald-700' },
}

export default function Deposits() {
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [housingId, setHousingId] = useState('')
  const [status, setStatus] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [actionStudent, setActionStudent] = useState(null)
  const [action, setAction] = useState(null)

  const { data, loading, refetch } = useApi(
    `/deposits?q=${encodeURIComponent(q)}&housing=${housingId}&payStatus=${status === 'unpaid' || status === 'paid' ? status : ''}&refundStatus=${status === 'pending' || status === 'partial' || status === 'full' ? status : ''}&month=${month}&year=${year}`
  )

  const housings = data?.perHousing || []
  const tot = data?.totals || {}

  const exportExcel = async () => {
    try {
      await downloadBlob(`/api/deposits/export?q=${encodeURIComponent(q)}&housing=${housingId}&payStatus=${status === 'unpaid' || status === 'paid' ? status : ''}&refundStatus=${status === 'pending' || status === 'partial' || status === 'full' ? status : ''}&month=${month}&year=${year}`, 'security-deposits.xlsx')
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const openAction = async (student, type) => {
    setActionStudent(student)
    setAction(type)
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary-700" />
            <h3 className="font-extrabold text-slate-800">التأمين — ملخص السكنات</h3>
          </div>
          <button className="btn-primary ms-auto !py-1.5 text-xs" onClick={exportExcel} disabled={loading}>
            <FileSpreadsheet size={14} /> تصدير Excel
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-slate-50">
            <p className="text-[11px] font-bold text-slate-500">الإجمالي المطلوب</p>
            <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(tot.required)}</p>
          </div>
          <div className="p-4 rounded-xl bg-teal-50">
            <p className="text-[11px] font-bold text-teal-600">المدفوع</p>
            <p className="text-lg font-extrabold text-teal-700 mt-1">{fmtMoney(tot.paid)}</p>
          </div>
          <div className="p-4 rounded-xl bg-red-50">
            <p className="text-[11px] font-bold text-red-600">غير المدفوع</p>
            <p className="text-lg font-extrabold text-red-700 mt-1">{fmtMoney(tot.unpaid)}</p>
          </div>
          <div className="p-4 rounded-xl bg-red-50">
            <p className="text-[11px] font-bold text-red-600">الخصومات</p>
            <p className="text-lg font-extrabold text-red-700 mt-1">{fmtMoney(tot.deductions)}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50">
            <p className="text-[11px] font-bold text-emerald-600">المسترد</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmtMoney(tot.refunded)}</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-50">
            <p className="text-[11px] font-bold text-blue-600">المحجوز حاليًا</p>
            <p className="text-lg font-extrabold text-blue-700 mt-1">{fmtMoney(tot.held)}</p>
          </div>
        </div>

        {housings.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {housings.map((h) => (
              <div key={h.housingId} className="px-3 py-2 rounded-xl bg-slate-100 text-sm">
                <span className="font-bold text-slate-600">{h.housingName}:</span>
                <span className="font-extrabold text-teal-700 ms-1">{fmtMoney(h.paid)}</span>
                <span className="text-[10px] text-slate-400"> (مطلوب {fmtMoney(h.required)} — محجوز {fmtMoney(h.held)})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <input className="input !ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو رقم الطالب" />
          </div>
          <select className="input !w-auto" value={housingId} onChange={(e) => setHousingId(e.target.value)}>
            <option value="">كل السكنات</option>
            {housings.map((h) => (
              <option key={h.housingId} value={h.housingId}>
                {h.housingName}
              </option>
            ))}
          </select>
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">كل الحالات</option>
            <option value="unpaid">غير مدفوع</option>
            <option value="paid">مدفوع</option>
            <option value="pending">بانتظار الاسترداد</option>
            <option value="partial">مسترد جزئيًا</option>
            <option value="full">مسترد بالكامل</option>
          </select>
          <input type="month" className="input !w-auto" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} />
          <input type="number" className="input !w-auto" dir="ltr" value={year} onChange={(e) => setYear(e.target.value)} placeholder="السنة" />
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading || !data ? (
          <Spinner />
        ) : data.rows.length === 0 ? (
          <EmptyState message="لا توجد تأمينات مطابقة" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">الطالب</th>
                <th className="th">السكن</th>
                <th className="th">الغرفة</th>
                <th className="th">التأمين</th>
                <th className="th">تاريخ الدفع</th>
                <th className="th">الحالة</th>
                <th className="th">الخصومات</th>
                <th className="th">المسترد</th>
                <th className="th">المتبقي</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r._id} className="border-t border-slate-100">
                  <td className="td">
                    <Link to={`/students/${r._id}`} className="font-bold text-primary-700">
                      {r.name}
                    </Link>
                    <p className="text-[10px] text-slate-400" dir="ltr">
                      {r.studentId} — {r.phone}
                    </p>
                  </td>
                  <td className="td text-slate-600">{r.housingName || '—'}</td>
                  <td className="td">{r.roomNumber || '—'}</td>
                  <td className="td font-extrabold">{fmtMoney(r.originalAmount)}</td>
                  <td className="td" dir="ltr">{r.paymentDate || '—'}</td>
                  <td className="td">
                    <Badge {...STATUS_BADGE[r.status]} />
                  </td>
                  <td className="td text-red-600 font-bold">{fmtMoney(r.totalDeductions)}</td>
                  <td className="td text-emerald-600 font-bold">{fmtMoney(r.refundedAmount)}</td>
                  <td className="td font-extrabold">{fmtMoney(r.remainingAmount)}</td>
                  <td className="td">
                    <div className="flex items-center gap-1 justify-end">
                      <Link to={`/students/${r._id}`} className="btn-ghost text-slate-500" title="عرض الطالب">
                        <Eye size={14} />
                      </Link>
                      {r.paymentStatus === 'paid' && r.paymentDate && (
                        <button className="btn-ghost text-primary-700" title="وصل استلام التأمين" onClick={() => downloadBlob(`/api/students/${r._id}/deposit/receipt?type=pay`, `deposit-receipt-${r.studentId}.pdf`)}>
                          <FileText size={14} />
                        </button>
                      )}
                      {r.paymentStatus === 'paid' && r.remainingAmount > 0 && (
                        <button className="btn-ghost text-red-600" title="خصم من التأمين" onClick={() => openAction(r, 'deduct')}>
                          خصم
                        </button>
                      )}
                      {r.paymentStatus === 'paid' && r.remainingAmount > 0 && (
                        <button className="btn-ghost text-emerald-600" title="استرداد" onClick={() => openAction(r, 'refund')}>
                          استرداد
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {actionStudent && (
        <>
          <DeductionModal
            open={action === 'deduct'}
            studentId={actionStudent._id}
            remaining={actionStudent.remainingAmount}
            onClose={() => setActionStudent(null)}
            onSaved={() => {
              refetch()
              setActionStudent(null)
            }}
          />
          <RefundModal
            open={action === 'refund'}
            studentId={actionStudent._id}
            remaining={actionStudent.remainingAmount}
            onClose={() => setActionStudent(null)}
            onSaved={() => {
              refetch()
              setActionStudent(null)
            }}
          />
        </>
      )}
    </div>
  )
}