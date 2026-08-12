import { useState } from 'react'
import { FileDown, FileText, Download, Wallet, BarChart3, FileSpreadsheet, DoorOpen } from 'lucide-react'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner from '../components/Spinner.jsx'
import { fmtMoney, monthLabel, currentMonthKey, downloadBlob } from '../utils/format.js'

function MonthlySection() {
  const [month, setMonth] = useState(currentMonthKey())
  const { data, loading } = useApi(`/reports/monthly?month=${month}`)
  const { toast } = useToast()

  const dl = async (url, name) => {
    try {
      await downloadBlob(`/api/${url}`, name)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-primary-700" />
          <h3 className="font-extrabold text-slate-800">تقرير شهري</h3>
        </div>
        <input type="month" className="input !w-auto ms-auto" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
            <div className="p-4 rounded-xl bg-slate-50">
              <p className="text-xs font-bold text-slate-500">المتوقع</p>
              <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(data.expected)}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50">
              <p className="text-xs font-bold text-emerald-600">المحصل</p>
              <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmtMoney(data.collected)}</p>
            </div>
            <div className="p-4 rounded-xl bg-red-50">
              <p className="text-xs font-bold text-red-600">المتبقي</p>
              <p className="text-lg font-extrabold text-red-700 mt-1">{fmtMoney(data.remaining)}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50">
              <p className="text-xs font-bold text-emerald-600">دافعون</p>
              <p className="text-lg font-extrabold text-emerald-700 mt-1">{data.paidStudents}</p>
            </div>
            <div className="p-4 rounded-xl bg-red-50">
              <p className="text-xs font-bold text-red-600">غير دافعين</p>
              <p className="text-lg font-extrabold text-red-700 mt-1">{data.unpaidStudents}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">الطالب</th>
                  <th className="th">المبلغ</th>
                  <th className="th">الحالة</th>
                  <th className="th">تاريخ الدفع</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p._id} className="border-t border-slate-100">
                    <td className="td font-semibold">{p.student.name}</td>
                    <td className="td">{fmtMoney(p.amount)}</td>
                    <td className="td">{p.status === 'paid' ? 'مدفوع' : p.status === 'overdue' ? 'متأخر' : 'غير مدفوع'}</td>
                    <td className="td">{p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={() => dl(`reports/monthly/pdf?month=${month}`, `report-${month}.pdf`)}>
              <FileDown size={16} /> تحميل التقرير PDF
            </button>
            <button className="btn-outline" onClick={() => dl(`reports/export/payments?month=${month}`, `payments-${month}.xlsx`)}>
              <FileSpreadsheet size={16} /> تصدير Excel
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function YearlySection() {
  const [year, setYear] = useState(new Date().getFullYear())
  const { data, loading } = useApi(`/reports/yearly?year=${year}`)
  const { toast } = useToast()

  const exportYear = async () => {
    try {
      const rows = data.months.map((m) => ({
        'الشهر': monthLabel(m.month),
        'المتوقع': m.expected,
        'المحصل': m.collected,
        'المتبقي': m.remaining,
        'دافعون': m.paidStudents,
        'غير دافعين': m.unpaidStudents,
      }))
      const res = await fetch('/api/reports/export/payments', { headers: { Authorization: 'Bearer ' + localStorage.getItem('homunity_token') } })
      if (!res.ok) throw new Error('خطأ')
      const blob = await res.blob()
      downloadBlob(`/api/reports/export/students?filter=all`, `yearly-${year}.xlsx`)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-primary-700" />
          <h3 className="font-extrabold text-slate-800">إيرادات السنة</h3>
        </div>
        <input type="number" className="input !w-28 ms-auto" dir="ltr" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">الشهر</th>
                  <th className="th">المتوقع</th>
                  <th className="th">المحصل</th>
                  <th className="th">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month} className="border-t border-slate-100">
                    <td className="td font-semibold">{monthLabel(m.month)}</td>
                    <td className="td">{fmtMoney(m.expected)}</td>
                    <td className="td text-emerald-600 font-semibold">{fmtMoney(m.collected)}</td>
                    <td className="td text-red-600 font-semibold">{fmtMoney(m.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 rounded-xl bg-primary-50 flex items-center justify-between">
            <span className="font-bold text-primary-800">إجمالي المحصل {year}</span>
            <span className="font-extrabold text-lg text-primary-900">{fmtMoney(data.totalCollected)} EGP</span>
          </div>
        </>
      )}
    </div>
  )
}

function ExportsSection() {
  const { toast } = useToast()
  const dl = async (url, name) => {
    try {
      await downloadBlob(`/api/${url}`, name)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Download size={18} className="text-primary-700" />
        <h3 className="font-extrabold text-slate-800">تصدير البيانات</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ['/reports/export/students?filter=active', 'الطلاب النشطون', FileText],
          ['/reports/export/students?filter=all', 'جميع الطلاب', FileText],
          ['/reports/export/rooms', 'الغرف', DoorOpen],
        ].map(([url, label, Icon]) => (
          <button key={url} className="btn-outline justify-start" onClick={() => dl(url, label + '.xlsx')}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Reports() {
  return (
    <div className="space-y-4">
      <MonthlySection />
      <YearlySection />
      <ExportsSection />
    </div>
  )
}
