import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function AssignBedModal({ open, onClose, onDone, room, bed }) {
  const { toast } = useToast()
  const [candidates, setCandidates] = useState([])
  const [studentId, setStudentId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setStudentId('')
      api.get('/students?status=active').then((r) => {
        setCandidates(r.data.students.filter((s) => !s.roomId || !s.bedNumber))
      })
    }
  }, [open])

  const submit = async () => {
    if (!studentId) {
      toast('اختر طالبًا', 'warn')
      return
    }
    setSaving(true)
    try {
      await api.put(`/students/${studentId}`, { roomId: room._id, bedNumber: bed.bedNumber })
      toast('تم تعيين السرير')
      onDone()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`تعيين سرير ${bed.bedNumber} — غرفة ${room.number}`}>
      <div className="space-y-4">
        <div>
          <label className="label">الطالب (بدون غرفة)</label>
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">اختر الطالب</option>
            {candidates.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.studentId})
              </option>
            ))}
          </select>
          {candidates.length === 0 && <p className="text-xs text-slate-400 mt-2">لا يوجد طلاب نشطون بدون غرفة</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'تعيين'}
        </button>
      </div>
    </Modal>
  )
}
