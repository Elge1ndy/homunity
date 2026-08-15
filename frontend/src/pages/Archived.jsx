import { useNavigate } from 'react-router-dom'
import { RotateCcw, Trash2, Eye, Archive } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import { fmtDate, fmtMoney, studentStatus } from '../utils/format.js'
import Badge from '../components/Badge.jsx'

export default function Archived() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { data, loading, refetch } = useApi('/students?status=archived')
  useRealtime(refetch, ['student:updated', 'student:added'])

  const restore = async (s) => {
    try {
      await api.post(`/students/${s._id}/restore`)
      toast('تمت استعادة الطالب')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const purge = async (s) => {
    if (!window.confirm(`حذف ${s.name} نهائيًا؟ لا يمكن التراجع.`)) return
    try {
      await api.delete(`/students/${s._id}`)
      toast('تم الحذف')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Archive size={18} className="text-amber-500" />
          <h3 className="font-extrabold text-slate-800">الطلاب المؤرشفون</h3>
          <span className="ms-auto text-sm text-slate-400">{data?.students?.length || 0} طالب</span>
        </div>
        {loading ? (
          <Spinner full />
        ) : !data?.students?.length ? (
          <EmptyState message="لا يوجد طلاب مؤرشفون" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">رقم الطالب</th>
                  <th className="th">الاسم</th>
                  <th className="th">الهاتف</th>
                  <th className="th">الإيجار</th>
                  <th className="th">تاريخ الخروج</th>
                  <th className="th">تاريخ الأرشفة</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="td font-mono font-bold text-primary-700" dir="ltr">{s.studentId}</td>
                    <td className="td font-semibold">{s.name}</td>
                    <td className="td" dir="ltr">{s.phone}</td>
                    <td className="td">{fmtMoney(s.monthlyRent)}</td>
                    <td className="td">{s.checkOutDate ? fmtDate(s.checkOutDate) : '—'}</td>
                    <td className="td">{s.archivedAt ? fmtDate(s.archivedAt) : '—'}</td>
                    <td className="td">
                      <div className="flex items-center gap-1">
                        <button className="p-2 rounded-lg hover:bg-primary-50 text-primary-700" onClick={() => navigate(`/students/${s._id}`)}>
                          <Eye size={15} />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600" onClick={() => restore(s)}>
                          <RotateCcw size={15} />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => purge(s)}>
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
    </div>
  )
}
