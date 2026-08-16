import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function RefundModal({ open, studentId, remaining, onClose, onSaved }) {
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [method, setMethod] = useState('cash')
  const [proof, setProof] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount('')
      setDate(new Date().toISOString().slice(0, 10))
      setMethod('cash')
      setProof('')
      setNotes('')
    }
  }, [open])

  const uploadFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('proof', file)
      const { data } = await api.post('/upload/proof', fd)
      setProof(data.path)
      toast('Refund proof uploaded')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    const v = Number(amount)
    if (!v || v <= 0) return toast('Enter a valid refund amount', 'error')
    if (remaining !== null && v > remaining) return toast(`Amount exceeds remaining balance (${remaining} EGP)`, 'error')
    setSaving(true)
    try {
      await api.post(`/students/${studentId}/deposit/refund`, { amount: v, date, method, proof, notes })
      toast('Refund recorded')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Deposit Refund">
      <div className="space-y-4">
        {remaining !== null && remaining !== undefined && (
          <div className="p-3 rounded-xl bg-slate-50 text-sm">
            <span className="text-slate-500 font-bold">Refundable Balance: </span>
            <span className="text-emerald-600 font-extrabold">{remaining} EGP</span>
          </div>
        )}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">Refund Amount (EGP)</label>
            <input className="input" type="number" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="flex-1">
            <label className="label">Refund Date</label>
            <input className="input" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Refund Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Refund Proof (Optional)</label>
          <input className="input" type="file" accept="image/*" onChange={uploadFile} disabled={uploading} />
          {uploading && (
            <p className="text-xs text-primary-600 mt-1 flex items-center gap-1">
              <Spinner /> Uploading...
            </p>
          )}
          {proof && (
            <a href={proof} target="_blank" rel="noreferrer" className="text-xs text-primary-700 font-semibold mt-1 inline-block">
              ✓ Image uploaded — View
            </a>
          )}
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'Record Refund'}
        </button>
      </div>
    </Modal>
  )
}