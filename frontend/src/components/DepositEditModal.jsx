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
    if (v <= 0) return toast('أدخل قيمة تأمين صحيحة', 'error')
    if (v < (deposit?.totalDeductions || 0)) return toast('المبلغ لا يمكن أن يقل عن الخصومات المسجلة', 'error')
    setSaving(true)
    try {
      await api.put(`/students/${studentId}/deposit`, { originalAmount: v, paymentDate, paymentMethod, notes })
      toast('تم تعديل بيانات التأمين (بتسجيل في سجل النشاط)')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="تعديل بيانات التأمين">
      <div className="space-y-4">
        <div>
          <label className="label">قيمة التأمين (ج.م)</label>
          <input className="input" type="number" dir="ltr" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">تاريخ الدفع</label>
            <input className="input" type="date" dir="ltr" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="label">طريقة الدفع</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">نقدًا</option>
              <option value="transfer">تحويل بنكي</option>
              <option value="other">أخرى</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">ملاحظات</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="text-xs text-slate-400">كل تعديل يُسجل في سجل النشاط كسجل مراجعة (Audit) ولا يُحذف أي سجل مالي.</p>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'حفظ التعديل'}
        </button>
      </div>
    </Modal>
  )
}