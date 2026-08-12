import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function StudentFormModal({ open, onClose, onSaved, student, rooms }) {
  const { toast } = useToast()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        student
          ? {
              name: student.name || '',
              phone: student.phone || '',
              university: student.university || '',
              email: student.email || '',
              roomId: student.roomId || student.room?._id || '',
              bedNumber: student.bedNumber || '',
              monthlyRent: student.monthlyRent || '',
              checkInDate: student.checkInDate || '',
              checkOutDate: student.checkOutDate || '',
              notes: student.notes || '',
            }
          : {
              name: '',
              phone: '',
              university: '',
              email: '',
              roomId: '',
              bedNumber: '',
              monthlyRent: '',
              checkInDate: new Date().toISOString().slice(0, 10),
              checkOutDate: '',
              notes: '',
            }
      )
    }
  }, [open, student])

  const room = rooms?.find((r) => String(r._id) === String(form.roomId))
  const freeBeds = room ? (room.beds || []).filter((b) => !b.studentId || String(b.studentId) === String(student?._id)) : []

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setSaving(true)
    try {
      const body = { ...form }
      if (!body.bedNumber) body.bedNumber = null
      if (student) {
        await api.put(`/students/${student._id}`, body)
        toast('تم تحديث بيانات الطالب')
      } else {
        await api.post('/students', body)
        toast('تمت إضافة الطالب')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={student ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">الاسم *</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="الاسم الكامل" />
        </div>
        <div>
          <label className="label">رقم الهاتف *</label>
          <input className="input" dir="ltr" value={form.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" />
        </div>
        <div>
          <label className="label">الجامعة</label>
          <input className="input" value={form.university} onChange={set('university')} />
        </div>
        <div>
          <label className="label">البريد الإلكتروني</label>
          <input className="input" dir="ltr" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label">الغرفة</label>
          <select className="input" value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value, bedNumber: '' }))}>
            <option value="">بدون غرفة</option>
            {rooms?.map((r) => (
              <option key={r._id} value={r._id}>
                {r.number} — {r.type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">السرير</label>
          <select className="input" value={form.bedNumber} onChange={set('bedNumber')} disabled={!room}>
            <option value="">اختر السرير</option>
            {freeBeds.map((b) => (
              <option key={b.bedNumber} value={b.bedNumber}>
                سرير {b.bedNumber} {b.studentId ? '(الطالب الحالي)' : '(متاح)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">الإيجار الشهري</label>
          <input className="input" type="number" dir="ltr" value={form.monthlyRent} onChange={set('monthlyRent')} placeholder={room ? `افتراضي ${room.monthlyRent}` : ''} />
        </div>
        <div>
          <label className="label">تاريخ الدخول</label>
          <input className="input" type="date" dir="ltr" value={form.checkInDate} onChange={set('checkInDate')} />
        </div>
        <div>
          <label className="label">تاريخ الخروج</label>
          <input className="input" type="date" dir="ltr" value={form.checkOutDate} onChange={set('checkOutDate')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">ملاحظات</label>
          <textarea className="input" rows="2" value={form.notes} onChange={set('notes')} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : student ? 'حفظ التعديلات' : 'إضافة الطالب'}
        </button>
      </div>
    </Modal>
  )
}
