import { useEffect, useState } from 'react'
import { MoveRight } from 'lucide-react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import { fmtMoney } from '../utils/format.js'

const ST_LOCALE = { available: 'Available', reserved: 'Reserved', maintenance: 'Maintenance', occupied: 'Occupied' }

export default function TransferModal({ open, onClose, onDone, source }) {
  const { toast } = useToast()
  const [properties, setProperties] = useState([])
  const [rooms, setRooms] = useState([])
  const [candidates, setCandidates] = useState([])
  const [form, setForm] = useState({})
  const [beds, setBeds] = useState([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [saving, setSaving] = useState(false)

  const isAssign = !source // From beds page: assign roomless student to an available bed

  useEffect(() => {
    if (open) {
      setForm({
        studentId: '',
        propertyId: '',
        floorId: '',
        apartmentId: '',
        roomId: '',
        bedNumber: '',
        transferDate: new Date().toISOString().slice(0, 10),
        reason: '',
        prorate: true,
        monthlyRent: '',
      })
      setBeds([])
      api.get('/properties').then((r) => setProperties(r.data.properties)).catch(() => {})
      api.get('/rooms').then((r) => setRooms(r.data.rooms)).catch(() => {})
      api.get('/students?status=active').then((r) => setCandidates(r.data.students.filter((s) => !s.roomId || !s.bedNumber))).catch(() => {})
    }
  }, [open, source])

  const currentProperty = properties.find((p) => p._id === form.propertyId)
  const currentFloors = currentProperty?.type === 'house' ? currentProperty.floors || [] : []
  const currentApartments = currentProperty?.apartments || []
  const propertyRooms = rooms.filter((r) => String(r.propertyId || '') === String(form.propertyId))
  const floorRooms = form.floorId ? propertyRooms.filter((r) => String(r.floorId || '') === String(form.floorId)) : propertyRooms
  const apartmentRooms = form.apartmentId ? floorRooms.filter((r) => String(r.apartmentId || '') === String(form.apartmentId)) : floorRooms
  const chosenRoom = rooms.find((r) => r._id === form.roomId)

  const loadBeds = async (roomId) => {
    setLoadingTargets(true)
    try {
      const r = await api.get(`/rooms/${roomId}`)
      setBeds(r.data.room.beds || [])
    } catch (e) {
      setBeds([])
    } finally {
      setLoadingTargets(false)
    }
  }

  const set = (k) => (e) => {
    const v = e.target.value
    const next = { ...form, [k]: v }
    if (k === 'propertyId') {
      next.floorId = ''
      next.apartmentId = ''
      next.roomId = ''
      next.bedNumber = ''
      setBeds([])
    }
    if (k === 'floorId') {
      next.apartmentId = ''
      next.roomId = ''
      next.bedNumber = ''
      setBeds([])
    }
    if (k === 'apartmentId') {
      next.roomId = ''
      next.bedNumber = ''
      setBeds([])
    }
    if (k === 'roomId') {
      next.bedNumber = ''
      setBeds([])
      if (v) loadBeds(v)
    }
    setForm(next)
  }

  const submit = async () => {
    if (!form.roomId || !form.bedNumber) {
      toast('Select the new room and bed', 'warn')
      return
    }
    setSaving(true)
    try {
      if (isAssign) {
        if (!form.studentId) {
          toast('Select the student', 'warn')
          setSaving(false)
          return
        }
        await api.put(`/students/${form.studentId}`, { roomId: form.roomId, bedNumber: Number(form.bedNumber) })
        toast('Student assigned to bed')
      } else {
        const r = await api.post(`/students/${source.student._id}/transfer`, {
          toRoomId: form.roomId,
          toBedNumber: Number(form.bedNumber),
          transferDate: form.transferDate,
          reason: form.reason,
          prorate: form.prorate,
          monthlyRent: form.monthlyRent,
        })
        toast(r.data.proration ? `Transfer completed — Month ${r.data.proration.month} prorated at ${fmtMoney(r.data.proration.amount)}` : 'Student transferred')
      }
      onDone()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const freeBeds = beds.filter((b) => !b.studentId && b.status !== 'maintenance')
  const oldRent = source ? source.student.monthlyRent : 0
  const newRent = form.monthlyRent !== '' ? Number(form.monthlyRent) : chosenRoom ? Number(chosenRoom.monthlyRent) || 0 : 0

  return (
    <Modal open={open} onClose={onClose} title={isAssign ? 'Assign Student to Bed' : `Transfer Student ${source?.student?.name || ''}`} wide>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {!isAssign && source && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-bold text-slate-400 mb-2">Current Location</p>
              <p className="text-sm font-bold text-slate-700">
                {[source.student.propertyName, source.student.floorName, source.student.apartmentName].filter(Boolean).join(' — ') || '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Room <b>{source.student.roomNumber || ''}</b> — Bed <b>{source.bedNumber}</b>
              </p>
              <p className="text-sm font-extrabold text-primary-700 mt-2">
                Current Price: {fmtMoney(oldRent)} EGP
              </p>
            </div>
          )}

          {isAssign && (
            <div>
              <label className="label">Student (No Room)</label>
              <select className="input" value={form.studentId} onChange={set('studentId')}>
                <option value="">Select student</option>
                {candidates.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.studentId})
                  </option>
                ))}
              </select>
              {candidates.length === 0 && <p className="text-xs text-slate-400 mt-2">No active students without a room</p>}
            </div>
          )}

          <div className="p-4 rounded-xl bg-primary-50 border border-primary-200">
            <p className="text-[11px] font-bold text-primary-600 mb-2">New Price</p>
            <p className="text-lg font-extrabold text-primary-800">{fmtMoney(newRent)} EGP</p>
            {chosenRoom && (
              <p className="text-[11px] text-primary-600 mt-1">
                Room {chosenRoom.number} price ({fmtMoney(chosenRoom.monthlyRent)} EGP)
              </p>
            )}
            {!isAssign && (
              <input className="input mt-3 !bg-white" type="number" placeholder="Custom price (optional)" dir="ltr" value={form.monthlyRent} onChange={set('monthlyRent')} />
            )}
          </div>

          {!isAssign && (
            <>
              <div>
                <label className="label">Transfer Date</label>
                <input className="input" type="date" dir="ltr" value={form.transferDate} onChange={set('transferDate')} />
              </div>
              <div>
                <label className="label">Reason (Optional)</label>
                <input className="input" value={form.reason} onChange={set('reason')} placeholder="e.g., preference change, moving to a quieter floor..." />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" className="accent-primary-600" checked={form.prorate} onChange={(e) => setForm((f) => ({ ...f, prorate: e.target.checked }))} />
                Prorate price difference based on days in transfer month
              </label>
            </>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Property</label>
              <select className="input" value={form.propertyId} onChange={set('propertyId')}>
                <option value="">Select property</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.type === 'house' ? 'House' : 'Apartment'})
                  </option>
                ))}
              </select>
            </div>
            {currentProperty?.type === 'house' && (
              <div>
                <label className="label">Floor</label>
                <select className="input" value={form.floorId} onChange={set('floorId')}>
                  <option value="">All floors</option>
                  {currentFloors.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name || f.code}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Apartment</label>
              <select className="input" value={form.apartmentId} onChange={set('apartmentId')}>
                <option value="">All apartments</option>
                {currentApartments.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name || a.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Room</label>
              <select className="input" value={form.roomId} onChange={set('roomId')}>
                <option value="">Select room</option>
                {apartmentRooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.number} ({fmtMoney(r.monthlyRent)} EGP)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Bed ({freeBeds.length} available)</label>
            {loadingTargets ? (
              <div className="p-6"><Spinner /></div>
            ) : beds.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">Select a room to view beds</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {beds.map((b) => {
                  const free = !b.studentId
                  const occupied = !!b.studentId
                  const maintenance = b.status === 'maintenance'
                  const reserved = b.status === 'reserved'
                  const chosen = Number(form.bedNumber) === Number(b.bedNumber)
                  return (
                    <button
                      key={b.bedNumber}
                      disabled={occupied || maintenance}
                      onClick={() => setForm((f) => ({ ...f, bedNumber: String(b.bedNumber) }))}
                      className={`p-3 rounded-xl border text-sm font-bold transition-colors ${
                        chosen
                          ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200'
                          : occupied
                            ? 'border-primary-200 bg-primary-50 text-primary-700 cursor-not-allowed opacity-70'
                            : maintenance
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                              : reserved
                                ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Bed {b.bedNumber}
                      <span className="block text-[10px] font-bold mt-0.5 opacity-70">{occupied ? 'Occupied' : maintenance ? 'Maintenance' : reserved ? 'Reserved' : 'Available'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
        {!isAssign && source && oldRent !== newRent && (
          <p className="text-sm text-slate-500 me-auto self-center">
            Price change: <b className="text-red-600">{fmtMoney(oldRent)}</b> <MoveRight size={13} className="inline text-slate-400" />{' '}
            <b className="text-emerald-600">{fmtMoney(newRent)}</b> EGP
          </p>
        )}
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : isAssign ? 'Assign' : 'Execute Transfer'}
        </button>
      </div>
    </Modal>
  )
}