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
      toast('Select a student', 'warn')
      return
    }
    setSaving(true)
    try {
      await api.put(`/students/${studentId}`, { roomId: room._id, bedNumber: bed.bedNumber })
      toast('Bed assigned successfully')
      onDone()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Assign Bed ${bed.bedNumber} — Room ${room.number}`}>
      <div className="space-y-4">
        <div>
          <label className="label">Student (without room)</label>
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select a student</option>
            {candidates.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.studentId})
              </option>
            ))}
          </select>
          {candidates.length === 0 && <p className="text-xs text-slate-400 mt-2">No active students without a room</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'Assign'}
        </button>
      </div>
    </Modal>
  )
}
