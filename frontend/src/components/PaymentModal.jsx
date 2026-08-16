import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import { fmtMoney } from '../utils/format.js'

export default function PaymentModal({ open, onClose, onSaved, payment }) {
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [proof, setProof] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const remaining = payment ? Math.max(0, (Number(payment.amount) || 0) - (Number(payment.paidAmount) || 0)) : 0

  useEffect(() => {
    if (open && payment) {
      setAmount(String(remaining))
      setPaidAt(payment.paidAt ? new Date(payment.paidAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
      setMethod('cash')
      setNote('')
      setProof('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment])

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
    if (!amount || Number(amount) <= 0) return toast('Enter payment amount', 'error')
    if (Number(amount) > remaining) return toast(`Amount exceeds remaining (${fmtMoney(remaining)} EGP)`, 'error')
    setSaving(true)
    try {
      await api.post(`/payments/${payment._id}/pay`, { amount: Number(amount), date: paidAt, method, note, proof })
      toast(Number(amount) >= remaining ? 'Full payment recorded' : 'Partial payment recorded')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record Payment">
      {payment && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm">
          <p className="font-bold text-slate-700">{payment.student?.name}</p>
          <p className="text-slate-500 mt-1">
            Month {payment.month} — Due: {fmtMoney(payment.amount)} EGP
          </p>
          <p className="text-slate-500 mt-0.5">
            Paid: {fmtMoney(payment.paidAmount || 0)} EGP — Remaining: <span className="font-bold text-red-600">{fmtMoney(remaining)} EGP</span>
          </p>
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">Amount Paid</label>
          <input className="input" type="number" min="1" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment Date</label>
          <input className="input" type="date" dir="ltr" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Note (Optional)</label>
          <input className="input" placeholder="e.g. Partial payment — remaining amount coming soon" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment Proof (Screenshot — Optional)</label>
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
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : remaining > 0 && Number(amount) < remaining ? 'Record Partial Payment' : 'Confirm Payment'}
        </button>
      </div>
    </Modal>
  )
}