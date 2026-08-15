import { useState } from 'react'
import { ListOrdered } from 'lucide-react'
import { useApi } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import { fmtDateTime } from '../utils/format.js'

const CATEGORIES = [
  ['', 'الكل'],
  ['students', 'الطلاب'],
  ['rooms', 'الغرف'],
  ['payments', 'المدفوعات'],
  ['invoices', 'الفواتير'],
  ['housing', 'السكن'],
  ['admins', 'المديرين'],
  ['auth', 'الدخول'],
  ['general', 'أخرى'],
]

export default function ActivityLog() {
  const [category, setCategory] = useState('')
  const { data, loading, refetch } = useApi(`/activity?limit=300${category ? `&category=${category}` : ''}`, [category])

  useRealtime(refetch, ['data:refresh', 'payment:updated', 'student:added', 'admin:updated', 'room:updated', 'invoice:created'])

  const activity = data?.activity || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{activity.length} حدث</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setCategory(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              category === val ? 'bg-primary-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Spinner full />
        ) : !activity.length ? (
          <EmptyState message="لا يوجد نشاط مسجل" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">الحدث</th>
                  <th className="th">بواسطة</th>
                  <th className="th">التصنيف</th>
                  <th className="th">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="td font-semibold text-slate-800">{a.action}</td>
                    <td className="td">{a.adminName || '—'}</td>
                    <td className="td">
                      <span className="inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">
                        <ListOrdered size={12} />
                        {CATEGORIES.find(([v]) => v === a.category)?.[1] || a.category || 'أخرى'}
                      </span>
                    </td>
                    <td className="td text-slate-500">{fmtDateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
