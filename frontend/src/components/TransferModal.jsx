import { useEffect, useState } from 'react'
import { MoveRight } from 'lucide-react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import { fmtMoney } from '../utils/format.js'

const ST_LOCALE = { available: 'متاح', reserved: 'محجوز', maintenance: 'صيانة', occupied: 'مشغول' }

export default function TransferModal({ open, onClose, onDone, source }) {
  const { toast } = useToast()
  const [properties, setProperties] = useState([])
  const [rooms, setRooms] = useState([])
  const [candidates, setCandidates] = useState([])
  const [form, setForm] = useState({})
  const [beds, setBeds] = useState([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [saving, setSaving] = useState(false)

  const isAssign = !source // من صفحة الأسرة: تعيين طالب بدون غرفة على سرير متاح

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
      toast('اختر الغرفة والسرير الجديد', 'warn')
      return
    }
    setSaving(true)
    try {
      if (isAssign) {
        if (!form.studentId) {
          toast('اختر الطالب', 'warn')
          setSaving(false)
          return
        }
        await api.put(`/students/${form.studentId}`, { roomId: form.roomId, bedNumber: Number(form.bedNumber) })
        toast('تم تعيين الطالب على السرير')
      } else {
        const r = await api.post(`/students/${source.student._id}/transfer`, {
          toRoomId: form.roomId,
          toBedNumber: Number(form.bedNumber),
          transferDate: form.transferDate,
          reason: form.reason,
          prorate: form.prorate,
          monthlyRent: form.monthlyRent,
        })
        toast(r.data.proration ? `تم النقل — سُعر شهر ${r.data.proration.month} نسبيًا بمبلغ ${fmtMoney(r.data.proration.amount)}` : 'تم نقل الطالب')
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
    <Modal open={open} onClose={onClose} title={isAssign ? 'تعيين طالب على سرير' : `نقل الطالب ${source?.student?.name || ''}`} wide>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {!isAssign && source && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-bold text-slate-400 mb-2">الموقع الحالي</p>
              <p className="text-sm font-bold text-slate-700">
                {[source.student.propertyName, source.student.floorName, source.student.apartmentName].filter(Boolean).join(' — ') || '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                غرفة <b>{source.student.roomNumber || ''}</b> — سرير <b>{source.bedNumber}</b>
              </p>
              <p className="text-sm font-extrabold text-primary-700 mt-2">
                السعر الحالي: {fmtMoney(oldRent)} ج.م
              </p>
            </div>
          )}

          {isAssign && (
            <div>
              <label className="label">الطالب (بدون غرفة)</label>
              <select className="input" value={form.studentId} onChange={set('studentId')}>
                <option value="">اختر الطالب</option>
                {candidates.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.studentId})
                  </option>
                ))}
              </select>
              {candidates.length === 0 && <p className="text-xs text-slate-400 mt-2">لا يوجد طلاب نشطون بدون غرفة</p>}
            </div>
          )}

          <div className="p-4 rounded-xl bg-primary-50 border border-primary-200">
            <p className="text-[11px] font-bold text-primary-600 mb-2">السعر الجديد</p>
            <p className="text-lg font-extrabold text-primary-800">{fmtMoney(newRent)} ج.م</p>
            {chosenRoom && (
              <p className="text-[11px] text-primary-600 mt-1">
                سعر غرفة {chosenRoom.number} ({fmtMoney(chosenRoom.monthlyRent)} ج.م)
              </p>
            )}
            {!isAssign && (
              <input className="input mt-3 !bg-white" type="number" placeholder="سعر مخصص (اختياري)" dir="ltr" value={form.monthlyRent} onChange={set('monthlyRent')} />
            )}
          </div>

          {!isAssign && (
            <>
              <div>
                <label className="label">تاريخ النقل</label>
                <input className="input" type="date" dir="ltr" value={form.transferDate} onChange={set('transferDate')} />
              </div>
              <div>
                <label className="label">السبب (اختياري)</label>
                <input className="input" value={form.reason} onChange={set('reason')} placeholder="مثال: تغيير رغبة، انتقال لدور أهدأ..." />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" className="accent-primary-600" checked={form.prorate} onChange={(e) => setForm((f) => ({ ...f, prorate: e.target.checked }))} />
                احتساب فرق السعر تناسبيًا حسب الأيام في شهر النقل
              </label>
            </>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">العقار</label>
              <select className="input" value={form.propertyId} onChange={set('propertyId')}>
                <option value="">اختر العقار</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.type === 'house' ? 'بيت' : 'شقة'})
                  </option>
                ))}
              </select>
            </div>
            {currentProperty?.type === 'house' && (
              <div>
                <label className="label">الدور</label>
                <select className="input" value={form.floorId} onChange={set('floorId')}>
                  <option value="">كل الأدوار</option>
                  {currentFloors.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name || f.code}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">الشقة</label>
              <select className="input" value={form.apartmentId} onChange={set('apartmentId')}>
                <option value="">كل الشقق</option>
                {currentApartments.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name || a.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">الغرفة</label>
              <select className="input" value={form.roomId} onChange={set('roomId')}>
                <option value="">اختر الغرفة</option>
                {apartmentRooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.number} ({fmtMoney(r.monthlyRent)} ج.م)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">السرير ({freeBeds.length} متاح)</label>
            {loadingTargets ? (
              <div className="p-6"><Spinner /></div>
            ) : beds.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">اختر غرفة لعرض الأسرة</p>
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
                      سرير {b.bedNumber}
                      <span className="block text-[10px] font-bold mt-0.5 opacity-70">{occupied ? 'مشغول' : maintenance ? 'صيانة' : reserved ? 'محجوز' : 'متاح'}</span>
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
            تغيير السعر: <b className="text-red-600">{fmtMoney(oldRent)}</b> <MoveRight size={13} className="inline text-slate-400" />{' '}
            <b className="text-emerald-600">{fmtMoney(newRent)}</b> ج.م
          </p>
        )}
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : isAssign ? 'تعيين' : 'تنفيذ النقل'}
        </button>
      </div>
    </Modal>
  )
}