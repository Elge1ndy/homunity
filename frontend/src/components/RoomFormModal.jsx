import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function RoomFormModal({ open, onClose, onSaved, room }) {
  const { toast } = useToast()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        room
          ? { number: room.number, type: room.type, capacity: room.capacity, monthlyRent: room.monthlyRent, floor: room.floor || '', status: room.status, notes: room.notes || '' }
          : { number: '', type: 'shared', capacity: 4, monthlyRent: '', floor: '', status: 'active', notes: '' }
      )
    }
  }, [open, room])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setSaving(true)
    try {
      if (room) {
        await api.put(`/rooms/${room._id}`, form)
        toast('تم تحديث الغرفة')
      } else {
        await api.post('/rooms', form)
        toast('تمت إضافة الغرفة')
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
    <Modal open={open} onClose={onClose} title={room ? 'تعديل الغرفة' : 'إضافة غرفة'}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">رقم الغرفة *</label>
          <input className="input" value={form.number} onChange={set('number')} />
        </div>
        <div>
          <label className="label">النوع</label>
          <select className="input" value={form.type} onChange={set('type')}>
            <option value="shared">مشتركة</option>
            <option value="single">فردية</option>
            <option value="double">مزدوجة</option>
            <option value="triple">ثلاثية</option>
          </select>
        </div>
        <div>
          <label className="label">السعة (عدد الأسرة)</label>
          <input className="input" type="number" dir="ltr" min="1" value={form.capacity} onChange={set('capacity')} disabled={room && room.beds?.some((b) => b.studentId)} />
          {room && room.beds?.some((b) => b.studentId) && <p className="text-[11px] text-amber-600 mt-1">لا يمكن تغيير السعة لوجود طلاب</p>}
        </div>
        <div>
          <label className="label">الإيجار الشهري</label>
          <input className="input" type="number" dir="ltr" value={form.monthlyRent} onChange={set('monthlyRent')} />
        </div>
        <div>
          <label className="label">الطابق</label>
          <input className="input" value={form.floor} onChange={set('floor')} />
        </div>
        <div>
          <label className="label">الحالة</label>
          <select className="input" value={form.status} onChange={set('status')}>
            <option value="active">نشطة</option>
            <option value="inactive">غير نشطة</option>
          </select>
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
          {saving ? <Spinner /> : room ? 'حفظ التعديلات' : 'إضافة الغرفة'}
        </button>
      </div>
    </Modal>
  )
}
