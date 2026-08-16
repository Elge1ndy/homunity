import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Home, Building, LayoutGrid, DoorOpen, BedDouble } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import PropertyFormModal from '../components/PropertyFormModal.jsx'
import { fmtMoney } from '../utils/format.js'

const GENDER = {
  male: { label: 'Male', cls: 'bg-blue-100 text-blue-700' },
  female: { label: 'Female', cls: 'bg-pink-100 text-pink-700' },
  '': null,
}

export default function Properties() {
  const { toast } = useToast()
  const { data, loading, refetch } = useApi('/properties')
  const overview = useApi('/finance/overview')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useRealtime(() => { refetch(); overview.refetch() }, ['property:updated', 'room:updated', 'student:updated', 'student:added', 'summer:updated', 'payment:updated'])

  const remove = async (p) => {
    if (!window.confirm(`Delete property ${p.name}? This cannot be undone.`)) return
    try {
      await api.delete(`/properties/${p._id}`)
      toast('Property deleted')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      {overview.data?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400">Properties / Rooms / Occupied</p>
            <p className="text-lg font-extrabold text-slate-700 mt-0.5">
              {overview.data.totals.properties} / {overview.data.totals.rooms} / {overview.data.totals.occupied}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-[10px] font-bold text-emerald-600">Expected this month</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{fmtMoney(overview.data.totals.expected)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-[10px] font-bold text-blue-600">Collected</p>
            <p className="text-lg font-extrabold text-blue-700 mt-0.5">{fmtMoney(overview.data.totals.paid)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-[10px] font-bold text-red-600">Remaining</p>
            <p className="text-lg font-extrabold text-red-700 mt-0.5">{fmtMoney(overview.data.totals.remaining)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[10px] font-bold text-amber-600">Deposits</p>
            <p className="text-lg font-extrabold text-amber-700 mt-0.5">{fmtMoney(overview.data.totals.deposits)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-violet-50 border border-violet-200">
            <p className="text-[10px] font-bold text-violet-600">
              Net <span className="text-slate-400">(after maintenance {fmtMoney(overview.data.totals.maintenance)})</span>
            </p>
            <p className="text-lg font-extrabold text-violet-700 mt-0.5">{fmtMoney(overview.data.totals.net)} EGP</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{data?.properties?.length || 0} properties</p>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={16} /> Add Property
        </button>
      </div>

      {loading ? (
        <Spinner full />
      ) : !data?.properties?.length ? (
        <div className="card">
          <EmptyState message="No properties — start by adding a standalone house or apartment" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.properties.map((p) => {
            const s = p.stats || {}
            const pct = s.occupancy || 0
            const gender = GENDER[p.gender]
            return (
              <div key={p._id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${p.type === 'house' ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-600'}`}>
                      {p.type === 'house' ? <Home size={22} /> : <Building size={22} />}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800">{p.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge label={p.type === 'house' ? 'Full House' : 'Standalone Apartment'} cls={p.type === 'house' ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700'} />
                        {gender && <Badge {...gender} />}
                        {p.status === 'inactive' && <Badge label="Inactive" cls="bg-slate-200 text-slate-600" />}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost" onClick={() => { setEditing(p); setFormOpen(true) }}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost text-red-600" onClick={() => remove(p)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1"><LayoutGrid size={10} /> Floors</p>
                    <p className="text-sm font-extrabold text-slate-700 mt-0.5">{p.type === 'house' ? s.floors : '—'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1"><Home size={10} /> Apartments</p>
                    <p className="text-sm font-extrabold text-slate-700 mt-0.5">{s.apartments}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1"><DoorOpen size={10} /> Rooms</p>
                    <p className="text-sm font-extrabold text-slate-700 mt-0.5">{s.rooms}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1"><BedDouble size={10} /> Beds</p>
                    <p className="text-sm font-extrabold text-slate-700 mt-0.5">{s.beds}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>
                      Occupied <b className="text-slate-700">{s.occupied} / {s.beds}</b>
                    </span>
                    <span className="font-bold text-slate-600">{pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  <Link to={`/properties/${p._id}`} className="btn-primary !py-1.5 text-xs ms-auto">
                    Open Property
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PropertyFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} property={editing} />
    </div>
  )
}