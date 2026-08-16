import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function MaintenanceModal({ open, onClose, onSaved, property, apartmentId }) {
  const { toast } = useToast()
  const [apId, setApId] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setApId(apartmentId || '')
      setName('')
      setAmount('')
      setDate(new Date().toISOString().slice(0, 10))
      setNotes('')
    }
  }, [open, apartmentId])

  const submit = async () => {
    if (!apId) return toast('Select the apartment', 'warn')
    if (!name.trim()) return toast('Maintenance name is required', 'warn')
    if (!amount || Number(amount) <= 0) return toast('Enter the amount', 'warn')
    setSaving(true)
    try {
      await api.post(`/properties/${property._id}/maintenance`, { apartmentId: apId, name: name.trim(), amount: Number(amount), date, notes })
      toast('Maintenance expense added')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Maintenance Expense">
      <div className="space-y-4">
        <div>
          <label className="label">Apartment</label>
          <select className="input" value={apId} onChange={(e) => setApId(e.target.value)}>
            <option value="">Select apartment</option>
            {(property?.apartments || []).map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Description</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., plumbing repair" />
          </div>
          <div>
            <label className="label">Amount</label>
            <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'Add'}
        </button>
      </div>
    </Modal>
  )
}
