import { Link } from 'react-router-dom'
import {
  Users,
  BedDouble,
  CircleCheck,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Clock,
  UserPlus,
  DoorOpen,
  FileText,
  BarChart3,
  Archive,
  ShieldCheck,
} from 'lucide-react'
import { useApi } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import StatCard from '../components/StatCard.jsx'
import Badge from '../components/Badge.jsx'
import { fmtMoney, monthLabel, timeAgo, paymentStatus, fmtDate } from '../utils/format.js'

export default function Dashboard() {
  const { data, loading, refetch } = useApi('/stats')
  useRealtime(refetch, ['student:added', 'student:updated', 'room:updated', 'payment:updated', 'invoice:created', 'housing:updated'])

  if (loading || !data) return <Spinner full />

  const s = data.students
  const b = data.beds
  const cm = data.currentMonth
  const dep = data.deposits?.totals || {}
  const perHousing = data.deposits?.perHousing || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Students" value={s.active} sub={`Total ${s.total} (Archived ${s.archived})`} accent="teal" />
        <StatCard icon={BedDouble} label="Occupied Beds" value={`${b.occupied} / ${b.total}`} sub={`Occupancy Rate ${data.occupancy}%`} accent="blue" />
        <StatCard icon={CircleCheck} label="Available Beds" value={b.free} sub={`${data.roomsCount} rooms`} accent="amber" />
        <StatCard icon={Wallet} label="Total Beds" value={b.total} sub="All rooms" accent="red" />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary-700" />
            <h3 className="font-extrabold text-slate-800">Deposits</h3>
          </div>
          <Link to="/deposits" className="text-xs font-bold text-primary-700">
            Full deposit report &larr;
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <StatCard icon={ShieldCheck} label="Total Required" value={fmtMoney(dep.required)} accent="slate" sub="All students" />
          <StatCard icon={CircleCheck} label="Paid" value={fmtMoney(dep.paid)} accent="teal" sub="Recorded deposits" />
          <StatCard icon={AlertTriangle} label="Unpaid" value={fmtMoney(dep.unpaid)} accent="red" sub="Overdue" />
          <StatCard icon={ShieldCheck} label="Deductions" value={fmtMoney(dep.deductions)} accent="amber" sub="Total deductions" />
          <StatCard icon={Archive} label="Refunded" value={fmtMoney(dep.refunded)} accent="emerald" sub="Refunds" />
          <StatCard icon={Wallet} label="Currently Held" value={fmtMoney(dep.held)} accent="blue" sub="Net deposits" />
        </div>
        {perHousing.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {perHousing.map((h) => (
              <div key={h.housingId} className="px-3 py-2 rounded-xl bg-slate-100 text-sm">
                <span className="font-bold text-slate-600">{h.housingName || 'Housing'}:</span>
                <span className="font-extrabold text-teal-700 ms-1">{fmtMoney(h.paid)}</span>
                <span className="text-[10px] text-slate-400">Required {fmtMoney(h.required)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-primary-700" />
            <h3 className="font-extrabold text-slate-800">Revenue {monthLabel(cm.month)}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Expected</span>
              <span className="font-bold text-slate-800">{fmtMoney(cm.expected)} EGP</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Collected</span>
              <span className="font-bold text-emerald-600">{fmtMoney(cm.collected)} EGP</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Remaining</span>
              <span className="font-bold text-red-600">{fmtMoney(cm.remaining)} EGP</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
              <span className="text-slate-500">Paying Students</span>
              <span className="font-bold text-slate-700">{cm.paidStudents}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Non-paying</span>
              <span className="font-bold text-red-600">{cm.unpaidStudents}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-red-500" />
            <h3 className="font-extrabold text-slate-800">Unpaid &mdash; {monthLabel(cm.month)}</h3>
          </div>
          {data.unpaidList.length === 0 ? (
            <EmptyState message="All payments for the month are recorded!" />
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {data.unpaidList.map((p) => (
                <Link key={p._id} to={`/students/${p.studentId}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-primary-50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{p.student.name}</p>
                    <p className="text-xs text-slate-400">
                      {p.student.studentId} • {p.room ? `Room ${p.room}` : 'No room'}
                    </p>
                  </div>
                  <Badge {...paymentStatus[p.status]} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-amber-500" />
            <h3 className="font-extrabold text-slate-800">Expiring Soon</h3>
          </div>
          {data.expiring.length === 0 ? (
            <EmptyState message="No residencies expiring soon" />
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {data.expiring.map((s) => (
                <Link key={s._id} to={`/students/${s._id}`} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{s.name}</p>
                    <p className="text-xs text-slate-400">Expires on {fmtDate(s.checkOutDate)}</p>
                  </div>
                  <Badge label={`${s.daysLeft} days`} cls="bg-amber-200 text-amber-800" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-extrabold text-slate-800 mb-4">Recent Activity</h3>
          {data.recentActivity.length === 0 ? (
            <EmptyState message="No activity yet" />
          ) : (
            <div className="space-y-3">
              {data.recentActivity.map((a) => (
                <div key={a._id} className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary-50 text-primary-700 text-sm font-bold mt-0.5">{a.adminName?.slice(0, 1)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{a.action}</p>
                    <p className="text-xs text-slate-400">
                      {a.adminName} • {timeAgo(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-extrabold text-slate-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/students" className="flex items-center gap-2 p-3 rounded-xl bg-primary-50 text-primary-800 text-sm font-bold hover:bg-primary-100">
              <UserPlus size={16} /> Add Student
            </Link>
            <Link to="/rooms" className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 text-blue-800 text-sm font-bold hover:bg-blue-100">
              <DoorOpen size={16} /> Manage Rooms
            </Link>
            <Link to="/payments" className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-bold hover:bg-emerald-100">
              <Wallet size={16} /> Record Payment
            </Link>
            <Link to="/invoices" className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 text-amber-800 text-sm font-bold hover:bg-amber-100">
              <FileText size={16} /> Create Invoice
            </Link>
            <Link to="/reports" className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 text-purple-800 text-sm font-bold hover:bg-purple-100">
              <BarChart3 size={16} /> Reports
            </Link>
            <Link to="/archived" className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200">
              <Archive size={16} /> Archive
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
