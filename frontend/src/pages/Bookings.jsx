import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sun, UserPlus, LogOut, BedDouble } from 'lucide-react'
import { useApi } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import Spinner from '../components/Spinner.jsx'
import { currentMonthKey } from '../utils/format.js'

const WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export default function Bookings() {
  const [month, setMonth] = useState(currentMonthKey())
  const [selected, setSelected] = useState(null)

  const courses = useApi('/summer-courses')
  const students = useApi('/students')
  const rooms = useApi('/rooms')

  useRealtime(() => { courses.refetch(); students.refetch() }, ['summer:updated', 'student:added', 'student:updated', 'room:updated'])

  const all = courses.data?.courses || []
  const allStudents = students.data?.students || []
  const roomMap = {}
  ;(rooms.data?.rooms || []).forEach((r) => {
    roomMap[r._id] = r
  })

  const nDays = daysInMonth(month)
  const today = new Date().toISOString().slice(0, 10)
  const viewIsCurrent = month === currentMonthKey()
  const todayDay = viewIsCurrent ? Math.min(Number(today.slice(8, 10)), nDays) : 0

  const dayItems = (day) => {
    const key = `${month}-${String(day).padStart(2, '0')}`
    const items = []
    all.forEach((c) => {
      const endEffective = c.status === 'ended' ? (c.endedAt ? c.endedAt.slice(0, 10) : c.toDate) : '9999-12-31'
      if (c.fromDate <= key && key <= endEffective) {
        items.push({ kind: 'course', c })
      }
    })
    allStudents.forEach((s) => {
      if (s.status === 'active' && s.roomId && key >= (s.checkInDate || '0000-01-01') && key <= (s.checkOutDate || '9999-12-31')) {
        items.push({ kind: 'student', s, event: key === s.checkInDate ? 'in' : key === s.checkOutDate ? 'out' : null })
      }
    })
    return items
  }

  const countActiveCourses = (d) => dayItems(d).filter((x) => x.kind === 'course').length
  const monthStats = all.reduce(
    (acc, c) => {
      if (c.fromDate.startsWith(month) || (c.toDate || '').startsWith(month) || (c.fromDate < month + '-01' && c.toDate >= month + '-31')) acc.courses++
      return acc
    },
    { courses: 0 }
  )

  const openDay = (day) => {
    const its = dayItems(day)
    if (its.length > 0) setSelected({ day, items: its })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" className="input !w-auto" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button className="btn-outline !py-2" onClick={() => setMonth(currentMonthKey())}>
          Today
        </button>
        <div className="flex gap-4 text-xs font-bold text-slate-500 ms-auto">
          <span className="flex items-center gap-1.5">
            <Sun size={14} className="text-orange-500" /> Summer Course
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300" /> Stay
          </span>
          <span className="flex items-center gap-1.5">
            <UserPlus size={14} className="text-primary-700" /> Check-in
          </span>
          <span className="flex items-center gap-1.5">
            <LogOut size={14} className="text-red-500" /> Check-out
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 min-w-[130px]">
          <p className="text-[10px] font-bold text-orange-600">Courses This Month</p>
          <p className="text-lg font-extrabold text-orange-700 mt-0.5">{monthStats.courses}</p>
        </div>
        <div className="p-3 rounded-xl bg-primary-50 border border-primary-200 min-w-[130px]">
          <p className="text-[10px] font-bold text-primary-600">Guests Today</p>
          <p className="text-lg font-extrabold text-primary-700 mt-0.5">{todayDay ? dayItems(todayDay).filter((x) => x.kind === 'student').length : '—'}</p>
        </div>
      </div>

      {courses.loading || students.loading ? (
        <Spinner full />
      ) : (
        <div className="card p-6">
          <h3 className="font-extrabold text-slate-800 mb-4">Bed Bookings</h3>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1">
                {d}
              </div>
            ))}
            {Array.from({ length: nDays }, (_, i) => i + 1).map((day) => {
              const its = dayItems(day)
              const key = `${month}-${String(day).padStart(2, '0')}`
              const isToday = key === today
              return (
                <button
                  key={key}
                  onClick={() => openDay(day)}
                  className={`min-h-[86px] rounded-xl border p-1.5 flex flex-col gap-1 text-right transition-colors ${its.length > 0 ? 'bg-white border-slate-300 hover:ring-2 hover:ring-primary-400' : 'bg-slate-50 border-slate-100 cursor-default'} ${isToday ? 'ring-2 ring-primary-400' : ''}`}
                >
                  <span className={`text-xs font-extrabold ${isToday ? 'text-primary-700' : 'text-slate-500'}`}>{day}</span>
                  <div className="space-y-0.5 overflow-hidden">
                    {its.slice(0, 4).map((x, i) => (
                      <div key={i} className={`text-[9px] font-bold leading-tight truncate px-1 py-0.5 rounded ${x.kind === 'course' ? 'bg-orange-100 text-orange-700' : x.event === 'in' ? 'bg-primary-100 text-primary-800' : x.event === 'out' ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {x.kind === 'course' ? (
                          <>
                            <Sun size={8} className="inline align-middle ms-0.5" />
                            {x.c.studentName} — {roomMap[x.c.roomId]?.number || '?'}/{x.c.bedNumber}
                          </>
                        ) : (
                          <>
                            {x.event === 'in' ? <UserPlus size={8} className="inline align-middle ms-0.5" /> : x.event === 'out' ? <LogOut size={8} className="inline align-middle ms-0.5" /> : <BedDouble size={8} className="inline align-middle ms-0.5" />}
                            {x.s.name}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {its.length > 4 && <span className="text-[9px] font-bold text-slate-400 ms-auto">+{its.length - 4}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-extrabold text-slate-800">Bookings for day {selected.day} — {month.replace('-', ' / ')}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6 space-y-2">
              {selected.items.map((x, i) =>
                x.kind === 'course' ? (
                  <div key={i} className="p-3 rounded-xl bg-orange-50 border border-orange-200">
                    <p className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <Sun size={15} className="text-orange-600" />
                      <Link to={`/students/${x.c.studentId}`} className="hover:text-primary-700">
                        {x.c.studentName}
                      </Link>
                      <span className="text-[10px] text-orange-600 font-bold">{x.c.fromDate} → {x.c.toDate}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {[x.c.propertyName, x.c.floorName, x.c.apartmentName].filter(Boolean).join(' — ')} • Room {roomMap[x.c.roomId]?.number || '—'} Bed {x.c.bedNumber} • {x.c.rent} EGP/month
                    </p>
                  </div>
                ) : (
                  <div key={i} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <Link to={`/students/${x.s._id}`} className="text-sm font-extrabold text-slate-800 hover:text-primary-700">
                        {x.s.name}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {x.event === 'in' ? `Checking in today (${x.s.checkInDate})` : x.event === 'out' ? `Checking out today (${x.s.checkOutDate})` : 'Guest'} • Room {roomMap[x.s.roomId]?.number || '—'} Bed {x.s.bedNumber || '—'}
                      </p>
                    </div>
                    {x.event === 'in' && <UserPlus size={16} className="text-primary-600 shrink-0" />}
                    {x.event === 'out' && <LogOut size={16} className="text-red-500 shrink-0" />}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
