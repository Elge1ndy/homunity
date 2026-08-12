import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, BedDouble, Eye } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import RoomFormModal from '../components/RoomFormModal.jsx'
import Badge from '../components/Badge.jsx'
import { fmtMoney } from '../utils/format.js'

const TYPE_LABEL = { shared: 'مشتركة', single: 'فردية', double: 'مزدوجة', triple: 'ثلاثية' }

export default function Rooms() {
  const { toast } = useToast()
  const { data, loading, refetch } = useApi('/rooms')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useRealtime(refetch, ['room:updated', 'student:added', 'student:updated'])

  const remove = async (r) => {
    if (!window.confirm(`حذف الغرفة ${r.number}؟`)) return
    try {
      await api.delete(`/rooms/${r._id}`)
      toast('تم حذف الغرفة')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{data?.rooms?.length || 0} غرفة</p>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={16} /> إضافة غرفة
        </button>
      </div>

      {loading ? (
        <Spinner full />
      ) : !data?.rooms?.length ? (
        <div className="card">
          <EmptyState message="لا توجد غرف بعد — ابدأ بإضافة غرفة" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.rooms.map((r) => {
            const occupied = (r.beds || []).filter((b) => b.studentId).length
            const pct = r.capacity ? Math.round((occupied / r.capacity) * 100) : 0
            return (
              <div key={r._id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800">غرفة {r.number}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{TYPE_LABEL[r.type] || r.type} {r.floor ? `• الطابق ${r.floor}` : ''}</p>
                  </div>
                  <Badge label={r.status === 'active' ? 'نشطة' : 'متوقفة'} cls={r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'} />
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>
                      {occupied} / {r.capacity} مشغول
                    </span>
                    <span>{fmtMoney(r.monthlyRent)} EGP</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-4 pt-4 border-t border-slate-100">
                  <Link to={`/beds`} className="btn-ghost text-primary-700">
                    <BedDouble size={14} /> الأسرة
                  </Link>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setEditing(r)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil size={14} /> تعديل
                  </button>
                  <button className="btn-ghost text-red-600 ms-auto" onClick={() => remove(r)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <RoomFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} room={editing} />
    </div>
  )
}
