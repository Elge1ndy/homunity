import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function DepositEditModal({ open, studentId, deposit, onClose, onSaved }) {
  const { toast } = useToast()
  const [originalAmount, setOriginalAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('other')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setOriginalAmount(deposit?.originalAmount || '')
      setPaymentDate(deposit?.paymentDate || '')
      setPaymentMethod(deposit?.paymentMethod || 'other')
      setNotes(deposit?.notes || '')
    }
  }, [open, deposit])

  const submit = async () => {
    const v = Number(originalAmount)
    if (v <= 0) return toast('Enter a valid deposit amount', 'error')
    if (v < (deposit?.totalDeductions || 0)) return toast('Amount cannot be less than recorded deductions', 'error')
    setSaving(true)
    try {
      await api.put(`/students/${studentId}/deposit`, { originalAmount: v, paymentDate, paymentMethod, notes })
      toast('Deposit details updated (logged in activity log)')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Deposit Details">
      <div className="space-y-4">
        <div>
          <label className="label">Deposit Amount (EGP)</label>
          <input className="input" type="number" dir="ltr" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">Payment Date</label>
            <input className="input" type="date" dir="ltr" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="label">Payment Method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="text-xs text-slate-400">Every edit is logged in the activity log as an audit record. No financial record is ever deleted.</p>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'Save Changes'}
        </button>
      </div>
    </Modal>
  )
}