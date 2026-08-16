import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useApi } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import PaymentModal from '../components/PaymentModal.jsx'
import Spinner from '../components/Spinner.jsx'
import { fmtMoney, monthLabel, currentMonthKey } from '../utils/format.js'

const WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function dayColor(items) {
  if (items.some((i) => i.status === 'overdue')) return 'bg-red-50 border-red-300 text-red-700'
  if (items.some((i) => i.status === 'paid')) return 'bg-emerald-50 border-emerald-300 text-emerald-700'
  if (items.length > 0) return 'bg-amber-50 border-amber-300 text-amber-700'
  return 'bg-white border-slate-200 text-slate-400'
}

function badge(status) {
  return status === 'paid'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'overdue'
      ? 'bg-red-100 text-red-700'
      : 'bg-slate-100 text-slate-600'
}

const STATUS_LABEL = { paid: 'Paid', overdue: 'Overdue', unpaid: 'Unpaid' }

export default function Calendar() {
  const [month, setMonth] = useState(currentMonthKey())
  const [selected, setSelected] = useState(null)
  const [payTarget, setPayTarget] = useState(null)
  const { data, loading, refetch } = useApi(`/payments/calendar?month=${month}`)
  useRealtime(refetch, ['payment:updated'])

  const days = data?.days || {}
  const nDays = daysInMonth(month)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="month"
          className="input !w-auto"
          dir="ltr"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <div className="flex gap-4 text-xs font-bold text-slate-500 ms-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300" /> Paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-300" /> Due
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-300" /> Overdue
          </span>
        </div>
      </div>

      {loading ? (
        <Spinner full />
      ) : (
        <div className="card p-6">
          <h3 className="font-extrabold text-slate-800 mb-4">Payment Calendar {monthLabel(month)}</h3>
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-xs font-bold text-slate-400 py-1">
                {d}
              </div>
            ))}
            {Array.from({ length: nDays }, (_, i) => i + 1).map((day) => {
              const key = `${month}-${String(day).padStart(2, '0')}`
              const its = days[key] || []
              return (
                <button
                  key={key}
                  onClick={() => its.length > 0 && setSelected({ day, key, items: its })}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors ${dayColor(its)} ${its.length > 0 ? 'hover:ring-2 hover:ring-primary-400' : 'cursor-default'}`}
                >
                  <span className="text-sm font-bold">{day}</span>
                  {its.length > 0 && <span className="text-[10px] font-bold">{its.length}</span>}
                </button>
              )
            })}
          </div>
          {nDays === 0 && <EmptyNote month={month} />}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-extrabold text-slate-800">
                Payments for day {selected.day} — {monthLabel(month)}
              </h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-2">
              {selected.items.map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200">
                  <div className="min-w-0">
                    <Link
                      to={`/students/${p.student?._id}`}
                      className="font-bold text-sm text-slate-800 hover:text-primary-700"
                    >
                      {p.student?.name || '—'}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtMoney(p.amount)} EGP — {p.dueDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge(p.status)}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                    {p.status !== 'paid' && (
                      <button className="btn-primary !py-1 text-xs" onClick={() => setPayTarget(p)}>
                        <Check size={14} /> Pay
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={() => {
          refetch()
          setSelected(null)
        }}
        payment={payTarget}
      />
    </div>
  )
}

function EmptyNote({ month }) {
  return (
    <p className="text-sm text-slate-400 text-center py-6">
      No payments recorded for {monthLabel(month)}
    </p>
  )
}