import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import Badge from './Badge.jsx'
import { fmtMoney } from '../utils/format.js'

const REASONS = ['Unpaid Rent', 'Furniture Damage', 'Room Damage', 'Missing Items', 'Repair Costs', 'Cleaning Costs', 'Other']

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

  const reasonMap = { 'Unpaid Rent': 'unpaid_rent', 'Furniture Damage': 'furniture', 'Room Damage': 'room', 'Missing Items': 'missing', 'Repair Costs': 'repair', 'Cleaning Costs': 'cleaning', 'Other': 'other' }

  const paidMonths = payments?.filter((p) => p.status === 'paid').length || 0
  const unpaidMonths = payments?.filter((p) => p.status !== 'paid').length || 0
  const outstanding = financial?.totalRemaining || 0
  const remaining = deposit?.remainingAmount || 0

  const n = (x) => Number(x) || 0
  const deduct = n(deductAmount)
  const refund = n(refundAmount)

  const submit = async () => {
    if (deduct < 0 || refund < 0) return toast('Invalid values', 'error')
    if (deduct + refund > remaining) return toast(`Total deduction and refund exceeds remaining balance (${remaining} EGP)`, 'error')
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
      toast('Checkout completed and deposit settled')
      onDone()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Checkout ${student.name}`} wide>
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm space-y-1">
          <p className="font-bold text-slate-700">{student.name} — {student.studentId}</p>
          <p className="text-slate-500">Check-in: {student.checkInDate || '—'} | Check-out: {new Date().toISOString().slice(0, 10)}</p>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-400 mb-2">Monthly Rent — Due for {financial?.monthsPaid + financial?.monthsUnpaid || 0} months</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-slate-50">
              <p className="text-[11px] font-bold text-slate-500">Paid Months</p>
              <p className="font-extrabold text-slate-800">{paidMonths}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50">
              <p className="text-[11px] font-bold text-red-500">Unpaid Months</p>
              <p className="font-extrabold text-red-700">{unpaidMonths}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <p className="text-[11px] font-bold text-slate-500">Expected</p>
              <p className="font-extrabold text-slate-800">{fmtMoney(financial?.totalExpected)}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50">
              <p className="text-[11px] font-bold text-red-500">Overdue Rent</p>
              <p className="font-extrabold text-red-700">{fmtMoney(outstanding)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-teal-800">Deposit</span>
            <Badge label={deposit?.statusLabel || '—'} cls={deposit?.status === 'paid' ? 'bg-teal-100 text-teal-700' : deposit?.status === 'full' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
            <div className="p-2 rounded-lg bg-white/60">
              <p className="text-[11px] font-bold text-teal-700">Original</p>
              <p className="font-extrabold">{fmtMoney(deposit?.originalAmount)}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/60">
              <p className="text-[11px] font-bold text-red-600">Deductions</p>
              <p className="font-extrabold text-red-700">{fmtMoney(deposit?.totalDeductions)}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/60">
              <p className="text-[11px] font-bold text-emerald-600">Refunded</p>
              <p className="font-extrabold text-emerald-700">{fmtMoney(deposit?.refundedAmount)}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/60">
              <p className="text-[11px] font-bold text-teal-700">Remaining</p>
              <p className="font-extrabold">{fmtMoney(remaining)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 p-4 rounded-xl border border-red-100 bg-red-50/40">
            <p className="font-bold text-red-700 text-sm">Deposit Deduction (Optional)</p>
            <input className="input" type="number" dir="ltr" value={deductAmount} onChange={(e) => setDeductAmount(e.target.value)} placeholder="Deduction amount" />
            <select className="input" value={deductReason} onChange={(e) => setDeductReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input className="input" value={deductDescription} onChange={(e) => setDeductDescription(e.target.value)} placeholder="Deduction description" />
          </div>
          <div className="space-y-3 p-4 rounded-xl border border-emerald-100 bg-emerald-50/40">
            <p className="font-bold text-emerald-700 text-sm">Refund Remaining (Optional)</p>
            <input className="input" type="number" dir="ltr" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Refund amount" />
            <select className="input" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
            <input className="input" value={refundNotes} onChange={(e) => setRefundNotes(e.target.value)} placeholder="Refund notes" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-danger" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'Complete Checkout'}
        </button>
      </div>
    </Modal>
  )
}