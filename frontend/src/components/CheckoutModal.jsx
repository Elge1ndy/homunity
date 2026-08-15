import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import Badge from './Badge.jsx'

const REASONS = ['إيجار غير مدفوع', 'تلف أثاث', 'تلف الغرفة', 'أدوات ناقصة', 'تكاليف إصلاح', 'تكاليف تنظيف', 'أخرى']

export default function CheckoutModal({ open, student, payments, financial, deposit, onClose, onDone }) {
  const { toast } = useToast()
  const [deductAmount, setDeductAmount] = useState('')
  const [deductReason, setDeductReason] = useState(REASONS[0])
  const [deductDescription, setDeductDescription] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('cash')
  const [refundNotes, setRefundNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDeductAmount('')
      setDeductReason(REASONS[0])
      setDeductDescription('')
      setRefundAmount('')
      setRefundMethod('cash')
      setRefundNotes('')
    }
  }, [open])

  const reasonMap = { 'إيجار غير مدفوع': 'unpaid_rent', 'تلف أثاث': 'furniture', 'تلف الغرفة': 'room', 'أدوات ناقصة': 'missing', 'تكاليف إصلاح': 'repair', 'تكاليف تنظيف': 'cleaning', 'أخرى': 'other' }

  const paidMonths = payments?.filter((p) => p.status === 'paid').length || 0
  const unpaidMonths = payments?.filter((p) => p.status !== 'paid').length || 0
  const outstanding = financial?.totalRemaining || 0
  const remaining = deposit?.remainingAmount || 0

  const n = (x) => Number(x) || 0
  const deduct = n(deductAmount)
  const refund = n(refundAmount)

  const submit = async () => {
    if (deduct < 0 || refund < 0) return toast('قيم غير صالحة', 'error')
    if (deduct + refund > remaining) return toast(`مجموع الخصم والاسترداد أكبر من الرصيد المتبقي (${remaining} ج.م)`, 'error')
    setSaving(true)
    try {
      await api.post(`/students/${student._id}/checkout`, {
        checkOutDate: new Date().toISOString().slice(0, 10),
        deductAmount: deduct,
        deductReason: reasonMap[deductReason] || deductReason,
        deductDescription: deductDescription,
        refundAmount: refund,
        refundMethod,
        refundNotes,
      })
      toast('تم إنهاء الإقامة وتسوية التأمين')
      onDone()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`إنهاء إقامة ${student.name}`} wide>
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm space-y-1">
          <p className="font-bold text-slate-700">{student.name} — {student.studentId}</p>
          <p className="text-slate-500">دخول: {student.checkInDate || '—'} | خروج: {new Date().toISOString().slice(0, 10)}</p>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-400 mb-2">الإيجار الشهري — المستحق عن {financial?.monthsPaid + financial?.monthsUnpaid || 0} شهر</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-slate-50">
              <p className="text-[11px] font-bold text-slate-500">شهور مدفوعة</p>
              <p className="font-extrabold text-slate-800">{paidMonths}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50">
              <p className="text-[11px] font-bold text-red-500">شهور غير مدفوعة</p>
              <p className="font-extrabold text-red-700">{unpaidMonths}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <p className="text-[11px] font-bold text-slate-500">المتوقع</p>
              <p className="font-extrabold text-slate-800">{fmtNum(financial?.totalExpected)}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50">
              <p className="text-[11px] font-bold text-red-500">إيجار متأخر</p>
              <p className="font-extrabold text-red-700">{fmtNum(outstanding)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-teal-800">التأمين</span>
            <Badge label={deposit?.statusLabel || '—'} cls={deposit?.status === 'paid' ? 'bg-teal-100 text-teal-700' : deposit?.status === 'full' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
            <div className="p-2 rounded-lg bg-white/60">
              <p className="text-[11px] font-bold text-teal-700">الأصل</p>
              <p className="font-extrabold">{fmtNum(deposit?.originalAmount)}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/60">
              <p className="text-[11px] font-bold text-red-600">الخصومات</p>
              <p className="font-extrabold text-red-700">{fmtNum(deposit?.totalDeductions)}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/60">
              <p className="text-[11px] font-bold text-emerald-600">المسترد</p>
              <p className="font-extrabold text-emerald-700">{fmtNum(deposit?.refundedAmount)}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/60">
              <p className="text-[11px] font-bold text-teal-700">المتبقي</p>
              <p className="font-extrabold">{fmtNum(remaining)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 p-4 rounded-xl border border-red-100 bg-red-50/40">
            <p className="font-bold text-red-700 text-sm">خصم من التأمين (اختياري)</p>
            <input className="input" type="number" dir="ltr" value={deductAmount} onChange={(e) => setDeductAmount(e.target.value)} placeholder="مبلغ الخصم" />
            <select className="input" value={deductReason} onChange={(e) => setDeductReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input className="input" value={deductDescription} onChange={(e) => setDeductDescription(e.target.value)} placeholder="وصف الخصم" />
          </div>
          <div className="space-y-3 p-4 rounded-xl border border-emerald-100 bg-emerald-50/40">
            <p className="font-bold text-emerald-700 text-sm">استرداد المتبقي (اختياري)</p>
            <input className="input" type="number" dir="ltr" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="مبلغ الاسترداد" />
            <select className="input" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
              <option value="cash">نقدًا</option>
              <option value="transfer">تحويل بنكي</option>
              <option value="other">أخرى</option>
            </select>
            <input className="input" value={refundNotes} onChange={(e) => setRefundNotes(e.target.value)} placeholder="ملاحظات الاسترداد" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-danger" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'إنهاء الإقامة'}
        </button>
      </div>
    </Modal>
  )
}

function fmtNum(v) {
  return v === null || v === undefined ? '—' : Number(v).toLocaleString('ar-EG')
}