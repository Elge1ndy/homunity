import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  LayoutGrid,
  Home,
  DoorOpen,
  BedDouble,
  User,
  MoveRight,
  Wrench,
  CalendarClock,
  Building2,
  Sparkles,
} from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import PropertyFormModal from '../components/PropertyFormModal.jsx'
import LevelFormModal from '../components/LevelFormModal.jsx'
import RoomFormModal from '../components/RoomFormModal.jsx'
import AssignBedModal from '../components/AssignBedModal.jsx'
import TransferModal from '../components/TransferModal.jsx'
import MaintenanceModal from '../components/MaintenanceModal.jsx'
import { fmtMoney } from '../utils/format.js'

const GENDER = {
  male: { label: 'Male', cls: 'bg-blue-100 text-blue-700' },
  female: { label: 'Female', cls: 'bg-pink-100 text-pink-700' },
  '': null,
}

const BED_STYLE = {
  available: { chip: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100', dot: 'bg-emerald-500', label: 'Available', text: 'text-emerald-700' },
  reserved: { chip: 'bg-amber-50 border-amber-300 hover:bg-amber-100', dot: 'bg-amber-500', label: 'Reserved', text: 'text-amber-700' },
  occupied: { chip: 'bg-primary-50 border-primary-300', dot: 'bg-primary-600', label: 'Occupied', text: 'text-primary-800' },
  maintenance: { chip: 'bg-slate-100 border-slate-300 hover:bg-slate-200', dot: 'bg-slate-500', label: 'Maintenance', text: 'text-slate-600' },
}

const MINI = [
  { key: 'floors', icon: LayoutGrid, label: 'Floors', bg: 'bg-primary-50 text-primary-700', onlyHouse: true },
  { key: 'apartments', icon: Home, label: 'Apartments', bg: 'bg-amber-50 text-amber-600' },
  { key: 'rooms', icon: DoorOpen, label: 'Rooms', bg: 'bg-blue-50 text-blue-600' },
  { key: 'beds', icon: BedDouble, label: 'Total Beds', bg: 'bg-slate-100 text-slate-700' },
  { key: 'available', icon: Sparkles, label: 'Available', bg: 'bg-emerald-50 text-emerald-600' },
  { key: 'reserved', icon: CalendarClock, label: 'Reserved', bg: 'bg-amber-50 text-amber-600' },
  { key: 'occupied', icon: User, label: 'Occupied', bg: 'bg-primary-50 text-primary-700' },
  { key: 'maintenance', icon: Wrench, label: 'Maintenance', bg: 'bg-slate-100 text-slate-600' },
]

function BedChip({ bed, onTransfer, onStatus, canEdit, onPrice, onDelete }) {
  const st = BED_STYLE[bed.status] || BED_STYLE.available
  return (
    <div className={`p-3 rounded-xl border ${st.chip}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[11px] font-bold ${st.text}`}>
          <span className={`inline-block w-2 h-2 rounded-full ${st.dot} ms-1 align-middle`} />
           Bed {bed.bedNumber}
        </p>
        <span className="text-[10px] font-bold text-slate-400">{st.label}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] font-extrabold text-slate-700">{fmtMoney(bed.price)} EGP</span>
        <div className="flex items-center gap-0.5">
          {canEdit && (
            <>
              <button className="p-1 rounded hover:bg-white/70 text-slate-500" title={bed.monthlyRent ? 'Change bed price' : 'Set bed price'} onClick={() => onPrice(bed)}>
                <Pencil size={10} />
              </button>
              {bed.status !== 'occupied' && (
                <button className="p-1 rounded hover:bg-red-100 text-red-500" title="Delete bed" onClick={() => onDelete(bed)}>
                  <Trash2 size={10} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {bed.summer && (
        <div className="mt-1.5 p-2 rounded-lg bg-orange-50 border border-orange-200">
          <p className="text-[10px] font-extrabold text-orange-700 flex items-center gap-1">
            <Sparkles size={10} /> Summer Course
          </p>
          <p className="text-xs font-extrabold text-slate-700 truncate">{bed.summer.studentName}</p>
          <p className="text-[10px] text-slate-500 font-mono" dir="ltr">
            {bed.summer.fromDate} → {bed.summer.toDate}
          </p>
          <p className="text-[10px] font-bold text-orange-700">{fmtMoney(bed.summer.rent)} EGP/month {bed.summer.deposit > 0 && `• Deposit ${fmtMoney(bed.summer.deposit)}`}</p>
        </div>
      )}
      {bed.status === 'occupied' && bed.student && !bed.summer ? (
        <div className="mt-1.5">
          <Link to={`/students/${bed.student._id}`} className="text-xs font-extrabold text-primary-800 hover:underline truncate block">
            {bed.student.name}
          </Link>
          <p className="text-[10px] text-slate-400 font-mono" dir="ltr">
            {bed.student.studentId}
          </p>
          <button className="btn-ghost text-primary-700 !py-1 !px-1.5 text-[11px] mt-1.5 w-full justify-center" onClick={() => onTransfer(bed)}>
            <MoveRight size={12} /> Transfer
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-2">
          {bed.status !== 'occupied' && (
            <select
              className="input !py-1 !px-1.5 text-[11px] !w-auto flex-1"
              value={bed.status}
              disabled={!canEdit}
              onChange={(e) => onStatus(bed, e.target.value)}
            >
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="maintenance">Maintenance</option>
            </select>
          )}
          {bed.status === 'available' && canEdit && (
            <button className="btn-ghost text-emerald-700 !py-1 !px-1.5 text-[11px]" title="Assign student" onClick={() => onTransfer(bed, true)}>
              <User size={12} /> Assign
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function RoomBlock({ room, canEdit, onEditRoom, onDeleteRoom, onTransfer, onStatus, onPrice, onDeleteBed }) {
  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <DoorOpen size={15} className="text-blue-600" />
          <p className="font-extrabold text-slate-800">Room {room.number}</p>
          <span className="text-[10px] font-bold text-slate-400">
            {room.capacity} beds • {fmtMoney(room.monthlyRent)} EGP
          </span>
        </div>
        <div className="flex items-center gap-1">
          {room.status === 'inactive' && <Badge label="Inactive" cls="bg-slate-200 text-slate-600" />}
          {canEdit && (
            <>
              <button className="btn-ghost text-slate-500" title="Edit room" onClick={() => onEditRoom(room)}>
                <Pencil size={13} />
              </button>
              <button className="btn-ghost text-red-600" title="Delete room" onClick={() => onDeleteRoom(room)}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {room.beds.map((b) => (
          <BedChip key={b.bedNumber} bed={b} onTransfer={onTransfer} onStatus={onStatus} canEdit={canEdit} onPrice={onPrice} onDelete={onDeleteBed} />
        ))}
      </div>
    </div>
  )
}

function ApartmentBlock({ ap, floors, canEdit, onEdit, onDelete, onAddRoom, onEditRoom, onDeleteRoom, onTransfer, onStatus, onPrice, onDeleteBed, fin, maintenance, onAddMaintenance, onDeleteMaintenance }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Home size={16} className="text-amber-600" />
          <p className="font-extrabold text-slate-800">Apartment {ap.name}</p>
          {ap.code && <span className="font-mono text-[11px] text-slate-400" dir="ltr">{ap.code}</span>}
          {ap.status === 'inactive' && <Badge label="Inactive" cls="bg-slate-200 text-slate-600" />}
          {ap.monthlyRent > 0 && <span className="text-[11px] font-bold text-slate-400">Default rent {fmtMoney(ap.monthlyRent)} EGP</span>}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <>
              <button className="btn-ghost text-slate-500" title="Maintenance expense" onClick={() => onAddMaintenance(ap)}>
                <Wrench size={14} />
              </button>
              <button className="btn-ghost text-slate-500" title="Add room" onClick={() => onAddRoom(ap)}>
                <Plus size={14} /> Room
              </button>
              <button className="btn-ghost" title="Edit apartment" onClick={() => onEdit(ap)}>
                <Pencil size={13} />
              </button>
              <button className="btn-ghost text-red-600" title="Delete apartment" onClick={() => onDelete(ap)}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
      {fin && ap.rooms.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 text-[11px] font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">Expected {fmtMoney(fin.expected)} EGP</span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">Collected {fmtMoney(fin.paid)} EGP</span>
          <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200">Remaining {fmtMoney(fin.remaining)} EGP</span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">Deposits {fmtMoney(fin.deposits)} EGP</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">Occupied {fin.occupied} beds</span>
          {fin.maintenance > 0 && <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-300">Maintenance {fmtMoney(fin.maintenance)} EGP</span>}
          <span className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200">Net {fmtMoney(fin.net)} EGP</span>
        </div>
      )}
      {(maintenance || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {(maintenance || []).map((m) => (
            <span key={m._id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600">
              <Wrench size={11} className="text-slate-400" />
              {m.name} — {fmtMoney(m.amount)} EGP <span className="text-slate-400 font-mono" dir="ltr">{m.date}</span>
              {canEdit && (
                <button className="text-red-500 hover:text-red-700" title="Delete expense" onClick={() => onDeleteMaintenance(m)}>
                  <Trash2 size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {ap.rooms.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">No rooms in this apartment</p>
      ) : (
        <div className="space-y-3">
          {ap.rooms.map((r) => (
            <RoomBlock key={r._id} room={r} canEdit={canEdit} onEditRoom={onEditRoom} onDeleteRoom={onDeleteRoom} onTransfer={onTransfer} onStatus={onStatus} onPrice={onPrice} onDeleteBed={onDeleteBed} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PropertyDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { data, loading, refetch } = useApi(`/properties/${id}`)
  const finData = useApi(`/properties/${id}/finance`)
  const [editOpen, setEditOpen] = useState(false)
  const [level, setLevel] = useState(null) // { kind: 'floor'|'apartment', item }
  const [roomTarget, setRoomTarget] = useState(null) // { ap }
  const [roomEdit, setRoomEdit] = useState(null)
  const [assign, setAssign] = useState(null) // { room, bed }
  const [transfer, setTransfer] = useState(null) // { bed }
  const [maint, setMaint] = useState(null) // { apartmentId }

  const finMap = {}
  ;(finData.data?.rows || []).forEach((r) => {
    finMap[r.apartmentId] = r.finance
  })
  const totals = finData.data?.totals

  useRealtime(() => { refetch(); finData.refetch() }, ['property:updated', 'room:updated', 'student:updated', 'student:added', 'summer:updated'])

  if (loading || !data) return <Spinner full />

  const { property, stats, floors, apartments, unlinkedApartments, unlinkedRooms } = data
  const canEdit = user?.permissions?.properties !== false
  const maintenanceOf = (apId) => (property.maintenance || []).filter((m) => String(m.apartmentId) === String(apId))

  const del = async (url, msg) => {
    if (!window.confirm(msg)) return
    try {
      await api.delete(url)
      toast('Deleted')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const deleteRoom = (room) => del(`/properties/${id}/rooms/${room._id}`, `Delete room ${room.number}?`)

  const deleteLevel = (x) => {
    if (x.kind === 'floor') del(`/properties/${id}/floors/${x._id}`, `Delete floor ${x.name}?`)
    else if (x.kind === 'apartment' || (x.rooms && Array.isArray(x.rooms))) del(`/properties/${id}/apartments/${x._id}`, `Delete apartment ${x.name}?`)
    else deleteRoom(x)
  }

  const setBedStatus = async (bed, status) => {
    try {
      await api.put(`/rooms/${bed.roomId}/bed-status`, { bedNumber: bed.bedNumber, status })
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const editBedPrice = async (bed) => {
    const v = window.prompt(
      `Bed ${bed.bedNumber} in room ${bed.roomNumber} monthly price.\nLeave empty to use room price (${bed.roomMonthlyRent})`,
      bed.monthlyRent ?? ''
    )
    if (v === null) return
    try {
      await api.put(`/rooms/${bed.roomId}/beds/${bed.bedNumber}`, { monthlyRent: String(v).trim() === '' ? null : Number(v) })
      toast('Bed price updated')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const deleteBed = async (bed) => {
    if (!window.confirm(`Delete bed ${bed.bedNumber} from room ${bed.roomNumber}?`)) return
    try {
      await api.delete(`/rooms/${bed.roomId}/beds/${bed.bedNumber}`)
      toast('Bed deleted')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const openTransfer = (bed, isAssign = false) => {
    if (isAssign) {
      setAssign({ room: { _id: bed.roomId, number: bed.roomNumber }, bed })
    } else {
      setTransfer(bed)
    }
  }

  const editRoom = (room) => {
    setRoomEdit(room)
    setRoomTarget({ ap: null })
  }

  const deleteMaintenance = async (m) => {
    if (!window.confirm(`Delete maintenance expense "${m.name}" (${fmtMoney(m.amount)} EGP)?`)) return
    try {
      await api.delete(`/properties/${id}/maintenance/${m._id}`)
      toast('Expense deleted')
      refetch()
      finData.refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary-700">
        <ArrowRight size={16} /> Back
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${property.type === 'house' ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-600'}`}>
              {property.type === 'house' ? <Building2 size={26} /> : <Home size={26} />}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                {property.name}
                <Badge label={property.type === 'house' ? 'Full House' : 'Standalone Apartment'} cls={property.type === 'house' ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700'} />
                {GENDER[property.gender] && <Badge {...GENDER[property.gender]} />}
                {property.status === 'inactive' && <Badge label="Inactive" cls="bg-slate-200 text-slate-600" />}
              </h2>
              {property.code && <p className="font-mono text-sm text-slate-400" dir="ltr">{property.code}</p>}
              {property.address && <p className="text-sm text-slate-500 mt-1">{property.address}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> Edit
            </button>
            {property.type === 'house' && (
              <button className="btn-outline" onClick={() => setLevel({ kind: 'floor', item: null })}>
                <Plus size={15} /> Add Floor
              </button>
            )}
            <button className="btn-outline" onClick={() => setLevel({ kind: 'apartment', item: null })}>
              <Plus size={15} /> Add Apartment
            </button>
            <button className="btn-primary" onClick={() => { setRoomEdit(null); setRoomTarget({ ap: null }) }}>
              <Plus size={15} /> Add Room
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mt-6">
          {MINI.filter((m) => !m.onlyHouse || property.type === 'house').map((m) => (
            <div key={m.key} className={`p-3 rounded-xl ${m.bg}`}>
              <m.icon size={16} className="mb-1.5" />
              <p className="text-[10px] font-bold opacity-70">{m.label}</p>
              <p className="text-lg font-extrabold mt-0.5">{stats[m.key] ?? 0}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-[10px] font-bold text-emerald-600">Expected monthly rent</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{fmtMoney(totals?.expected ?? 0)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-[10px] font-bold text-blue-600">Collected this month</p>
            <p className="text-lg font-extrabold text-blue-700 mt-0.5">{fmtMoney(totals?.paid ?? 0)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-[10px] font-bold text-red-600">Remaining</p>
            <p className="text-lg font-extrabold text-red-700 mt-0.5">{fmtMoney(totals?.remaining ?? 0)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[10px] font-bold text-amber-600">Total deposits</p>
            <p className="text-lg font-extrabold text-amber-700 mt-0.5">{fmtMoney(totals?.deposits ?? 0)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-300">
            <p className="text-[10px] font-bold text-slate-600">Maintenance expenses</p>
            <p className="text-lg font-extrabold text-slate-700 mt-0.5">{fmtMoney(totals?.maintenance ?? 0)} EGP</p>
          </div>
          <div className="p-3 rounded-xl bg-violet-50 border border-violet-200">
            <p className="text-[10px] font-bold text-violet-600">Net</p>
            <p className="text-lg font-extrabold text-violet-700 mt-0.5">{fmtMoney(totals?.net ?? 0)} EGP</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${stats.occupancy >= 100 ? 'bg-red-500' : stats.occupancy >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${stats.occupancy}%` }} />
          </div>
          <span className="font-bold text-slate-600">Occupancy rate {stats.occupancy}%</span>
        </div>
      </div>

      {property.type === 'house' && (
        <div className="space-y-4">
          {floors.length === 0 && (
            <div className="card">
              <EmptyState message="No floors yet — add the first floor" />
            </div>
          )}
          {floors.map((f) => (
            <div key={f._id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-slate-950 text-white">
                <div className="flex items-center gap-2">
                  <LayoutGrid size={16} className="text-primary-300" />
                  <p className="font-extrabold">{f.name || 'Unnamed floor'}</p>
                  {f.code && <span className="font-mono text-[11px] text-slate-400" dir="ltr">{f.code}</span>}
                  {f.status === 'inactive' && <Badge label="Inactive" cls="bg-white/10 text-slate-300" />}
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <>
                      <button className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300" title="Edit floor" onClick={() => setLevel({ kind: 'floor', item: f })}>
                        <Pencil size={14} />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400" title="Delete floor" onClick={() => deleteLevel({ kind: 'floor', ...f })}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {f.apartments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">No apartments on this floor</p>
                ) : (
                  f.apartments.map((ap) => (
                    <ApartmentBlock
                      key={ap._id}
                      ap={ap}
                      fin={finMap[ap._id]}
                      maintenance={maintenanceOf(ap._id)}
                      onAddMaintenance={(a) => setMaint({ apartmentId: a._id })}
                      onDeleteMaintenance={deleteMaintenance}
                      canEdit={canEdit}
                      onEdit={(item) => setLevel({ kind: 'apartment', item })}
                      onDelete={deleteLevel}
                      onAddRoom={(a) => { setRoomEdit(null); setRoomTarget({ ap: a }) }}
                      onEditRoom={editRoom}
                      onDeleteRoom={deleteLevel}
                      onTransfer={openTransfer}
                      onStatus={setBedStatus}
                      onPrice={editBedPrice}
                      onDeleteBed={deleteBed}
                    />
                  ))
                )}
              </div>
            </div>
          ))}

          {unlinkedApartments.length > 0 && (
            <div className="card p-4">
              <p className="font-extrabold text-slate-700 text-sm mb-3">Apartments without a floor</p>
              <div className="space-y-3">
                {unlinkedApartments.map((ap) => (
                  <ApartmentBlock key={ap._id} ap={ap} fin={finMap[ap._id]} maintenance={maintenanceOf(ap._id)} onAddMaintenance={(a) => setMaint({ apartmentId: a._id })} onDeleteMaintenance={deleteMaintenance} canEdit={canEdit} onEdit={(item) => setLevel({ kind: 'apartment', item })} onDelete={deleteLevel} onAddRoom={(a) => { setRoomEdit(null); setRoomTarget({ ap: a }) }} onEditRoom={editRoom} onDeleteRoom={deleteLevel} onTransfer={openTransfer} onStatus={setBedStatus} onPrice={editBedPrice} onDeleteBed={deleteBed} />
                ))}
              </div>
            </div>
          )}

          {unlinkedRooms.length > 0 && (
            <div className="card p-4">
              <p className="font-extrabold text-slate-700 text-sm mb-3">Rooms without an apartment</p>
              <div className="space-y-3">
                {unlinkedRooms.map((r) => (
                  <RoomBlock key={r._id} room={r} canEdit={canEdit} onEditRoom={editRoom} onDeleteRoom={deleteLevel} onTransfer={openTransfer} onStatus={setBedStatus} onPrice={editBedPrice} onDeleteBed={deleteBed} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {property.type === 'apartment' && (
        <div className="card p-4 space-y-3">
          {apartments.map((ap) => (
            <ApartmentBlock key={ap._id} ap={ap} fin={finMap[ap._id]} maintenance={maintenanceOf(ap._id)} onAddMaintenance={(a) => setMaint({ apartmentId: a._id })} onDeleteMaintenance={deleteMaintenance} canEdit={canEdit} onEdit={(item) => setLevel({ kind: 'apartment', item })} onDelete={deleteLevel} onAddRoom={(a) => { setRoomEdit(null); setRoomTarget({ ap: a }) }} onEditRoom={editRoom} onDeleteRoom={deleteLevel} onTransfer={openTransfer} onStatus={setBedStatus} onPrice={editBedPrice} onDeleteBed={deleteBed} />
          ))}
          {unlinkedRooms.length > 0 &&
            unlinkedRooms.map((r) => <RoomBlock key={r._id} room={r} canEdit={canEdit} onEditRoom={editRoom} onDeleteRoom={deleteLevel} onTransfer={openTransfer} onStatus={setBedStatus} onPrice={editBedPrice} onDeleteBed={deleteBed} />)}
        </div>
      )}

      <PropertyFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={refetch} property={property} />
      {level && (
        <LevelFormModal
          open={!!level}
          onClose={() => setLevel(null)}
          onSaved={refetch}
          propertyId={id}
          kind={level.kind}
          item={level.item}
          floors={property.type === 'house' ? floors : []}
        />
      )}
      {roomTarget && (
        <RoomFormModal
          open={!!roomTarget}
          onClose={() => setRoomTarget(null)}
          onSaved={refetch}
          room={roomEdit}
          defaults={{
            propertyId: property._id,
            apartmentId: roomTarget.ap?.apartmentId || roomTarget.ap?._id || '',
            floorId: roomTarget.ap?.floorId || '',
          }}
        />
      )}
      {assign && <AssignBedModal open={!!assign} onClose={() => setAssign(null)} onDone={() => { refetch(); }} room={assign.room} bed={assign.bed} />}
      {transfer && (
        <TransferModal
          open={!!transfer}
          onClose={() => setTransfer(null)}
          onDone={refetch}
          source={{ roomId: transfer.roomId, bedNumber: transfer.bedNumber, student: transfer.student }}
        />
      )}
      {maint && (
        <MaintenanceModal
          open={!!maint}
          onClose={() => setMaint(null)}
          onSaved={() => {
            refetch()
            finData.refetch()
          }}
          property={property}
          apartmentId={maint.apartmentId}
        />
      )}
    </div>
  )
}
