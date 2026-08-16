import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function DepositPayModal({ open, studentId, originalAmount, onClose, onSaved }) {
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [method, setMethod] = useState('cash')
  const [proof, setProof] = useState('')
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(originalAmount ? '' : '')
      setDate(new Date().toISOString().slice(0, 10))
      setMethod('cash')
      setProof('')
      setNote('')
      setUploading(false)
      setSaving(false)
    }
  }, [open, originalAmount])

  const uploadFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('proof', file)
      const { data } = await api.post('/upload/proof', fd)
      setProof(data.path)
      toast('Payment proof uploaded')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (originalAmount <= 0 && (!Number(amount) || Number(amount) <= 0)) return toast('Enter the deposit amount first', 'error')
    setSaving(true)
    try {
      const body = { date, method, proof, note }
      if (originalAmount <= 0) body.amount = Number(amount)
      await api.post(`/students/${studentId}/deposit/pay`, body)
      toast('Deposit payment recorded')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record Deposit Payment">
      <div className="space-y-4">
        {originalAmount > 0 && (
          <div className="p-3 rounded-xl bg-slate-50 text-sm">
            <span className="text-slate-500 font-bold">Registered deposit amount: </span>
            <span className="text-primary-700 font-extrabold">{originalAmount} EGP</span>
          </div>
        )}
        {originalAmount <= 0 && (
          <div>
            <label className="label">Deposit Amount (EGP)</label>
            <input className="input" type="number" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
        )}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">Payment Date</label>
            <input className="input" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="label">Payment Method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Payment Proof (Screenshot)</label>
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
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'Confirm Payment'}
        </button>
      </div>
    </Modal>
  )
}