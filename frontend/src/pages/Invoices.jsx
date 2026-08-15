import { useState } from 'react'
import { Plus, FileText, Trash2, Eye } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import InvoiceModal from '../components/InvoiceModal.jsx'
import { invoiceStatus, fmtMoney, fmtDate, monthLabel, downloadBlob } from '../utils/format.js'

export default function Invoices() {
  const { toast } = useToast()
  const { data, loading, refetch } = useApi('/invoices')
  const studentsData = useApi('/students?status=all')
  const [createOpen, setCreateOpen] = useState(false)
  const [view, setView] = useState(null)

  useRealtime(refetch, ['invoice:created'])

  const remove = async (inv) => {
    if (!window.confirm(`حذف الفاتورة ${inv.invoiceNumber}؟`)) return
    try {
      await api.delete(`/invoices/${inv._id}`)
      toast('تم حذف الفاتورة')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{data?.invoices?.length || 0} فاتورة</p>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> إنشاء فاتورة
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Spinner full />
        ) : !data?.invoices?.length ? (
          <EmptyState message="لا توجد فواتير" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">رقم الفاتورة</th>
                  <th className="th">الطالب</th>
                  <th className="th">الشهور</th>
                  <th className="th">الإجمالي</th>
                  <th className="th">الحالة</th>
                  <th className="th">التاريخ</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="td font-mono font-bold text-primary-700" dir="ltr">{inv.invoiceNumber}</td>
                    <td className="td">
                      <span className="font-semibold">{inv.student?.name || '—'}</span>
                      <p className="text-xs text-slate-400 font-mono" dir="ltr">{inv.student?.studentId || ''}</p>
                    </td>
                    <td className="td text-xs">{inv.months.map(monthLabel).join('، ')}</td>
                    <td className="td font-bold">{fmtMoney(inv.total)} ج.م</td>
                    <td className="td">
                      <Badge {...invoiceStatus[inv.status]} />
                    </td>
                    <td className="td">{fmtDate(inv.createdAt)}</td>
                    <td className="td">
                      <div className="flex items-center gap-1">
                        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setView(inv)}>
                          <Eye size={15} />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-primary-50 text-primary-700" onClick={() => downloadBlob(`/api/invoices/${inv._id}/pdf`, `${inv.invoiceNumber}.pdf`)}>
                          <FileText size={15} />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => remove(inv)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setView(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-extrabold text-slate-800" dir="ltr">{view.invoiceNumber}</h3>
              <button onClick={() => setView(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6">
              <p className="font-bold text-slate-700">{view.student?.name}</p>
              <p className="text-xs text-slate-400 font-mono" dir="ltr">{view.student?.studentId}</p>
              <table className="w-full mt-4">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">الشهر</th>
                    <th className="th">المبلغ</th>
                    <th className="th">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map((it) => (
                    <tr key={it.month} className="border-b border-slate-100">
                      <td className="td">{monthLabel(it.month)}</td>
                      <td className="td">{fmtMoney(it.amount)}</td>
                      <td className="td">
                        <Badge {...invoiceStatus[it.status === 'paid' ? 'paid' : 'unpaid']} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between mt-4 p-4 rounded-xl bg-primary-50">
                <span className="font-bold text-primary-800">الإجمالي</span>
                <span className="font-extrabold text-primary-900">{fmtMoney(view.total)} ج.م</span>
              </div>
              <button className="btn-primary w-full mt-4" onClick={() => downloadBlob(`/api/invoices/${view._id}/pdf`, `${view.invoiceNumber}.pdf`)}>
                <FileText size={16} /> تحميل PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <InvoiceModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} students={studentsData.data?.students || []} />
    </div>
  )
}
