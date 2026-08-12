import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function PaymentModal({ open, onClose, onSaved, payment }) {
  const { toast } = useToast()
  const [paidAt, setPaidAt] = useState('')
  const [proof, setProof] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPaidAt(payment?.paidAt ? new Date(payment.paidAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
      setProof('')
    }
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
      toast('تم رفع إثبات الدفع')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    setSaving(true)
    try {
      await api.post(`/payments/${payment._id}/paid`, { paidAt, proof })
      toast('تم تسجيل الدفعة كمدفوعة')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="تسجيل الدفع">
      {payment && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm">
          <p className="font-bold text-slate-700">{payment.student?.name}</p>
          <p className="text-slate-500 mt-1">
            شهر {payment.month} — المبلغ: {payment.amount} EGP
          </p>
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">تاريخ الدفع</label>
          <input className="input" type="date" dir="ltr" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div>
          <label className="label">إثبات الدفع (سكرين شوت)</label>
          <input className="input" type="file" accept="image/*" onChange={uploadFile} disabled={uploading} />
          {uploading && (
            <p className="text-xs text-primary-600 mt-1 flex items-center gap-1">
              <Spinner /> جاري الرفع...
            </p>
          )}
          {proof && (
            <a href={proof} target="_blank" rel="noreferrer" className="text-xs text-primary-700 font-semibold mt-1 inline-block">
              ✓ تم رفع الصورة — عرض
            </a>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'تأكيد الدفع'}
        </button>
      </div>
    </Modal>
  )
}
