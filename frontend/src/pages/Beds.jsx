import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DoorOpen, User } from 'lucide-react'
import api from '../api'
import { useApi } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import AssignBedModal from '../components/AssignBedModal.jsx'

export default function Beds() {
  const { data, loading, refetch } = useApi('/rooms')
  const [assign, setAssign] = useState(null)

  useRealtime(refetch, ['room:updated', 'student:added', 'student:updated'])

  const studentMap = {}
  const students = useApi('/students?status=active')

  return (
    <div className="space-y-4">
      {loading || students.loading ? (
        <Spinner full />
      ) : !data?.rooms?.length ? (
        <div className="card">
          <EmptyState message="لا توجد غرف — أضف غرفًا أولًا" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.rooms.map((r) => {
            const occupied = (r.beds || []).filter((b) => b.studentId).length
            return (
              <div key={r._id} className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DoorOpen size={18} className="text-primary-700" />
                    <h3 className="font-extrabold text-slate-800">غرفة {r.number}</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{occupied}/{r.capacity}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(r.beds || []).map((b) => {
                    const stu = b.studentId ? students.data?.students?.find((s) => String(s._id) === String(b.studentId)) : null
                    const free = !b.studentId
                    return (
                      <button
                        key={b.bedNumber}
                        onClick={() => free && setAssign({ room: r, bed: b })}
                        className={`p-3 rounded-xl text-right transition-colors ${
                          free ? 'bg-emerald-50 border border-emerald-200 hover:bg-emerald-100' : 'bg-primary-50 border border-primary-200'
                        }`}
                      >
                        <p className="text-[11px] font-bold text-slate-400 mb-1">سرير {b.bedNumber}</p>
                        {free ? (
                          <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> متاح
                          </p>
                        ) : (
                          <div>
                            <p className="text-xs font-bold text-primary-800 flex items-center gap-1 truncate">
                              <User size={12} /> {stu?.name || 'طالب'}
                            </p>
                            <p className="text-[10px] text-primary-500 font-mono" dir="ltr">{stu?.studentId || ''}</p>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
                <Link to={`/students?q=`} className="text-xs text-primary-700 font-bold mt-3 inline-block">
                  إدارة الطلاب
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {assign && <AssignBedModal open={!!assign} onClose={() => setAssign(null)} onDone={() => { refetch(); students.refetch() }} room={assign.room} bed={assign.bed} />}
    </div>
  )
}
