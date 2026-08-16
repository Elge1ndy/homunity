import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

const REASONS = ['Unpaid Rent', 'Furniture Damage', 'Room Damage', 'Missing Items', 'Repair Costs', 'Cleaning Costs', 'Other']

export default function DeductionModal({ open, studentId, remaining, onClose, onSaved }) {
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState(REASONS[0])
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [attachment, setAttachment] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount('')
      setReason(REASONS[0])
      setDescription('')
      setDate(new Date().toISOString().slice(0, 10))
      setAttachment('')
      setUploading(false)
      setSaving(false)
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
      setAttachment(data.path)
      toast('Attachment uploaded')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    const v = Number(amount)
    if (!v || v <= 0) return toast('Enter a valid deduction amount', 'error')
    if (remaining !== null && v > remaining) return toast(`Deduction exceeds available deposit balance (${remaining} EGP)`, 'error')
    setSaving(true)
    try {
      await api.post(`/students/${studentId}/deposit/deduct`, {
        amount: v,
        reason,
        description,
        date,
        attachment,
      })
      toast('Deduction recorded')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Deposit Deduction">
      <div className="space-y-4">
        {remaining !== null && remaining !== undefined && (
          <div className="p-3 rounded-xl bg-slate-50 text-sm">
            <span className="text-slate-500 font-bold">Available for deduction: </span>
            <span className="text-red-600 font-extrabold">{remaining} EGP</span>
          </div>
        )}
        <div>
          <label className="label">Amount (EGP)</label>
          <input className="input" type="number" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Reason</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Detailed Description</label>
          <textarea className="input" rows="2" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">Date</label>
            <input className="input" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="label">Attachment (Optional)</label>
            <input className="input" type="file" accept="image/*" onChange={uploadFile} disabled={uploading} />
            {uploading && (
              <p className="text-xs text-primary-600 mt-1 flex items-center gap-1">
                <Spinner /> Uploading...
              </p>
            )}
            {attachment && (
              <a href={attachment} target="_blank" rel="noreferrer" className="text-xs text-primary-700 font-semibold mt-1 inline-block">
                ✓ Uploaded — View
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-danger" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'Record Deduction'}
        </button>
      </div>
    </Modal>
  )
}