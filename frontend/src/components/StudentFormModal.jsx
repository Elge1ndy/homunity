import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import { getAutoFill, setAutoFill, clearAutoFill } from '../utils/autoFill.js'

export default function StudentFormModal({ open, onClose, onSaved, student, rooms }) {
  const { toast } = useToast()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)

  useEffect(() => {
    if (open) {
      if (student) {
        setForm({
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
        })
      } else {
        const saved = getAutoFill('student') || {}
        const hasAuto = !!(saved.roomId || saved.monthlyRent)
        setAutoFilled(hasAuto)
        setForm({
          name: '',
          phone: '',
          university: saved.university || '',
          email: '',
          roomId: saved.roomId || '',
          bedNumber: '',
          monthlyRent: saved.monthlyRent || '',
          depositAmount: saved.depositAmount || '',
          checkInDate: new Date().toISOString().slice(0, 10),
          checkOutDate: '',
          notes: '',
        })
      }
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
        toast('Student updated successfully')
      } else {
        await api.post('/students', body)
        setAutoFill('student', {
          roomId: body.roomId,
          monthlyRent: body.monthlyRent,
          depositAmount: body.depositAmount,
          university: body.university,
        })
        toast('Student added successfully ✓')
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
    <Modal open={open} onClose={onClose} title={student ? 'Edit Student' : 'Add New Student'} wide>
      {!student && autoFilled && (
        <div className="flex items-center justify-between gap-2 bg-primary-50 border border-primary-200 text-primary-800 text-xs font-semibold rounded-xl px-4 py-2.5 mb-4">
          <span>✨ Auto-filled from last student</span>
          <button onClick={() => { clearAutoFill('student'); setAutoFilled(false); setForm((f) => ({ ...f, roomId: '', monthlyRent: '', depositAmount: '', university: '' })) }} className="text-primary-600 hover:text-primary-800 underline">Clear</button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="Full Name" />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input className="input" dir="ltr" value={form.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" />
        </div>
        <div>
          <label className="label">University</label>
          <input className="input" value={form.university} onChange={set('university')} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" dir="ltr" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label">Room</label>
          <select className="input" value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value, bedNumber: '' }))}>
            <option value="">No room</option>
            {rooms?.map((r) => (
              <option key={r._id} value={r._id}>
                {r.number} — {r.type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Bed</label>
          <select className="input" value={form.bedNumber} onChange={set('bedNumber')} disabled={!room}>
            <option value="">Select bed</option>
            {freeBeds.map((b) => (
              <option key={b.bedNumber} value={b.bedNumber}>
                Bed {b.bedNumber} {b.studentId ? '(Occupied)' : '(Available)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Monthly Rent</label>
          <input className="input" type="number" dir="ltr" value={form.monthlyRent} onChange={set('monthlyRent')} placeholder={room ? `Default ${room.monthlyRent}` : ''} />
        </div>
        {!student && (
          <div>
            <label className="label">Deposit Paid</label>
            <input className="input" type="number" dir="ltr" value={form.depositAmount} onChange={set('depositAmount')} placeholder="0" />
          </div>
        )}
        <div>
          <label className="label">Check-in Date</label>
          <input className="input" type="date" dir="ltr" value={form.checkInDate} onChange={set('checkInDate')} />
        </div>
        <div>
          <label className="label">Check-out Date</label>
          <input className="input" type="date" dir="ltr" value={form.checkOutDate} onChange={set('checkOutDate')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows="2" value={form.notes} onChange={set('notes')} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : student ? 'Save Changes' : 'Add Student'}
        </button>
      </div>
    </Modal>
  )
}
