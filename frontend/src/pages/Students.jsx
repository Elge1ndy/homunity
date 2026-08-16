import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Search, Upload, Download, Eye, Pencil, ChevronDown, Trash2 } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import StudentFormModal from '../components/StudentFormModal.jsx'
import ImportModal from '../components/ImportModal.jsx'
import { studentStatus, fmtDate, fmtMoney, downloadBlob } from '../utils/format.js'

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['ended', 'Ended'],
  ['archived', 'Archived'],
  ['unpaid', 'Unpaid'],
  ['paid', 'Paid'],
]

export default function Students() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const { data, loading, refetch } = useApi(`/students?status=${filter}&q=${encodeURIComponent(query)}`)
  const roomsData = useApi('/rooms')

  useRealtime(refetch, ['student:added', 'student:updated', 'payment:updated', 'room:updated'])

  const doExport = async (f) => {
    setExportOpen(false)
    try {
      await downloadBlob(`/api/students/export?filter=${f}`, `students-${f}.xlsx`)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const remove = async (s) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${s.name}"? All data and payments will be deleted and cannot be undone.`)) return
    try {
      await api.delete(`/students/${s._id}`)
      toast('Student deleted permanently')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input ps-9"
            placeholder="Search by name, phone, or student ID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setQuery(q)}
          />
        </div>
        <div className="relative">
          <button className="btn-outline" onClick={() => setExportOpen((o) => !o)}>
            <Download size={16} /> Export <ChevronDown size={14} />
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute end-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-20 py-1">
                {[['all', 'All Students'], ['active', 'Active'], ['archived', 'Archived'], ['ended', 'Ended'], ['paid', 'Paid'], ['unpaid', 'Unpaid']].map(([v, l]) => (
                  <button key={v} onClick={() => doExport(v)} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">
                    {l}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button className="btn-outline" onClick={() => setImportOpen(true)}>
          <Upload size={16} /> Import Excel
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={16} /> Add Student
        </button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {FILTERS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${filter === v ? 'bg-primary-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Spinner full />
        ) : !data?.students?.length ? (
          <EmptyState message="No students found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Student ID</th>
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">University</th>
                  <th className="th">Room</th>
                  <th className="th">Bed</th>
                  <th className="th">Rent</th>
                  <th className="th">Check-out</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/students/${s._id}`)}>
                    <td className="td font-mono font-bold text-primary-700" dir="ltr">{s.studentId}</td>
                    <td className="td font-semibold">{s.name}</td>
                    <td className="td" dir="ltr">{s.phone}</td>
                    <td className="td">{s.university || '—'}</td>
                    <td className="td">{s.room ? s.room.number : '—'}</td>
                    <td className="td">{s.bedNumber ? `Bed ${s.bedNumber}` : '—'}</td>
                    <td className="td">{fmtMoney(s.monthlyRent)}</td>
                    <td className="td">{s.checkOutDate ? fmtDate(s.checkOutDate) : '—'}</td>
                    <td className="td">
                      <Badge {...studentStatus[s.status]} />
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/students/${s._id}`} className="p-2 rounded-lg hover:bg-primary-50 text-primary-700">
                          <Eye size={15} />
                        </Link>
                        <button
                          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                          onClick={() => {
                            setEditing(s)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={() => remove(s)}>
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

      <StudentFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} student={editing} rooms={roomsData.data?.rooms || []} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={refetch} />
    </div>
  )
}
