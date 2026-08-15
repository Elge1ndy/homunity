import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import { fmtMoney } from '../utils/format.js'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function overlap(a1, a2, b1, b2) {
  if (!a1 || !b1) return false
  const e2 = a2 || '9999-12-31'
  const e1 = b2 || '9999-12-31'
  return a1 <= e1 && b1 <= e2
}

function monthsBetween(from, to) {
  if (!from || !to) return 0
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  const dayFrac = (b.getDate() - a.getDate()) / 30
  return Math.round(Math.max(0.03, months + dayFrac) * 100) / 100
}

export default function SummerCourseModal({ open, onClose, onSaved, students, properties, rooms, courses }) {
  const { toast } = useToast()
  const [studentId, setStudentId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [apartmentId, setApartmentId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [bedNumber, setBedNumber] = useState('')
  const [fromDate, setFromDate] = useState(today())
  const [toDate, setToDate] = useState('')
  const [rent, setRent] = useState('')
  const [deposit, setDeposit] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [paidDate, setPaidDate] = useState(today())
  const [paidMethod, setPaidMethod] = useState('cash')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setStudentId('')
      setPropertyId('')
      setFloorId('')
      setApartmentId('')
      setRoomId('')
      setBedNumber('')
      setFromDate(today())
      setToDate('')
      setRent('')
      setDeposit('')
      setPaidAmount('')
      setPaidDate(today())
      setPaidMethod('cash')
    }
  }, [open])

  const property = properties.find((p) => p._id === propertyId)
  const isHouse = property?.type === 'house'
  const floor = (property?.floors || []).find((f) => f._id === floorId)
  const apartments = (property?.apartments || []).filter((a) => (!isHouse || !floorId ? true : a.floorId === floorId))
  const roomsIn = useMemo(() => {
    if (!propertyId || !apartmentId) return []
    return rooms.filter((r) => r.propertyId === propertyId && r.apartmentId === apartmentId)
  }, [rooms, propertyId, apartmentId])
  const room = roomsIn.find((r) => r._id === roomId)
  const bed = (room?.beds || []).find((b) => b.bedNumber === Number(bedNumber))
  const bedPrice = bed ? bed.monthlyRent || room.monthlyRent || 0 : 0

  useEffect(() => {
    if (bedPrice && !rent) setRent(String(bedPrice))
  }, [bedPrice, rent])

  const months = monthsBetween(fromDate, toDate)
  const totalRent = Math.round((Number(rent) || 0) * months)
  const total = totalRent + (Number(deposit) || 0)
  const remaining = Math.max(0, total - (Number(paidAmount) || 0))

  const bedHint = (b) => {
    if (b.studentId) return { busy: true, text: 'مشغول بطالب حاليًا' }
    const c = (courses || []).find((x) => x.roomId === roomId && x.bedNumber === b.bedNumber && overlap(fromDate, toDate, x.fromDate, x.toDate))
    if (c) return { busy: true, text: `محجوز في كورس (${c.studentName}) ${c.fromDate} → ${c.toDate}` }
    const s = (students || []).find((x) => x.roomId === roomId && x.bedNumber === b.bedNumber && overlap(fromDate, toDate, x.checkInDate, x.checkOutDate))
    if (s) return { busy: true, text: `مشغول بطالب (${s.name})` }
    return { busy: false, text: `متاح • ${fmtMoney(b.monthlyRent || room.monthlyRent || 0)} ج.م` }
  }

  const pickBed = (bn) => {
    setBedNumber(bn)
    const b = (room?.beds || []).find((x) => x.bedNumber === bn)
    if (b) setRent(String(b.monthlyRent || room.monthlyRent || ''))
  }

  const submit = async () => {
    if (!studentId) return toast('اختر الطالب', 'warn')
    if (!fromDate || !toDate) return toast('حدد تاريخ البداية والنهاية', 'warn')
    if (toDate < fromDate) return toast('تاريخ النهاية قبل تاريخ البداية', 'warn')
    if (!roomId || !bedNumber) return toast('اختر الغرفة والسرير', 'warn')
    setSaving(true)
    try {
      await api.post('/summer-courses', {
        studentId,
        roomId,
        bedNumber: Number(bedNumber),
        fromDate,
        toDate,
        rent: Number(rent) || 0,
        deposit: Number(deposit) || 0,
        paidAmount: Number(paidAmount) || 0,
        paidDate,
        paidMethod,
      })
      toast('تمت إضافة الكورس الصيفي')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة كورس صيفي" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">الطالب</label>
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">اختر الطالب</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.studentId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">العقار</label>
            <select className="input" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setFloorId(''); setApartmentId(''); setRoomId(''); setBedNumber(''); }}>
              <option value="">اختر العقار</option>
              {properties.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.type === 'house' ? '(بيت)' : '(شقة مستقلة)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(isHouse || apartments.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isHouse && (
              <div>
                <label className="label">الدور</label>
                <select className="input" value={floorId} onChange={(e) => { setFloorId(e.target.value); setApartmentId(''); setRoomId(''); setBedNumber(''); }}>
                  <option value="">كل الأدوار</option>
                  {(property?.floors || []).map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name || 'دور بدون اسم'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">الشقة</label>
              <select className="input" value={apartmentId} onChange={(e) => { setApartmentId(e.target.value); setRoomId(''); setBedNumber(''); }}>
                <option value="">اختر الشقة</option>
                {apartments.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">الغرفة</label>
            <select className="input" value={roomId} onChange={(e) => { setRoomId(e.target.value); setBedNumber(''); }}>
              <option value="">اختر الغرفة</option>
              {roomsIn.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.number} ({r.beds?.length || 0} سرير — {fmtMoney(r.monthlyRent)} ج.م)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">السرير</label>
            <select className="input" value={bedNumber} onChange={(e) => pickBed(e.target.value)}>
              <option value="">اختر السرير</option>
              {(room?.beds || []).map((b) => {
                const h = bedHint(b)
                return (
                  <option key={b.bedNumber} value={b.bedNumber}>
                    سرير {b.bedNumber} — {h.text}
                  </option>
                )
              })}
            </select>
            {bed && <p className={`text-xs mt-1 font-bold ${bedHint(bed).busy ? 'text-red-600' : 'text-emerald-600'}`}>{bedHint(bed).text}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">من تاريخ</label>
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="label">إلى تاريخ</label>
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">الإيجار الشهري (مستقل)</label>
            <input type="number" className="input" value={rent} onChange={(e) => setRent(e.target.value)} placeholder={bedPrice ? `افتراضي ${bedPrice}` : ''} />
          </div>
          <div>
            <label className="label">التأمين</label>
            <input type="number" className="input" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label">دفعة أولى عند التسجيل</label>
            <input type="number" className="input" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" />
          </div>
        </div>

        {Number(paidAmount) > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">تاريخ الدفعة</label>
              <input type="date" className="input" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
            <div>
              <label className="label">طريقة الدفع</label>
              <select className="input" value={paidMethod} onChange={(e) => setPaidMethod(e.target.value)}>
                <option value="cash">نقدًا</option>
                <option value="transfer">تحويل بنكي</option>
                <option value="other">أخرى</option>
              </select>
            </div>
          </div>
        )}

        {toDate && fromDate && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400">المدة</p>
              <p className="text-sm font-extrabold text-slate-700 mt-0.5">{months} شهر</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">إيجار الفترة</p>
              <p className="text-sm font-extrabold text-slate-700 mt-0.5">{fmtMoney(totalRent)} ج.م</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">الإجمالي</p>
              <p className="text-sm font-extrabold text-primary-700 mt-0.5">{fmtMoney(total)} ج.م</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">المدفوع</p>
              <p className="text-sm font-extrabold text-emerald-600 mt-0.5">{fmtMoney(paidAmount || 0)} ج.م</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">المتبقي</p>
              <p className="text-sm font-extrabold text-red-600 mt-0.5">{fmtMoney(remaining)} ج.م</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'إضافة الكورس'}
        </button>
      </div>
    </Modal>
  )
}
