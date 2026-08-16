import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import { monthLabel } from '../utils/format.js'

export default function InvoiceModal({ open, onClose, onCreated, students }) {
  const { toast } = useToast()
  const [studentId, setStudentId] = useState('')
  const [payments, setPayments] = useState([])
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setStudentId('')
      setPayments([])
      setSelected([])
    }
  }, [open])

  useEffect(() => {
    if (!studentId) {
      setPayments([])
      setSelected([])
      return
    }
    api.get(`/payments/student/${studentId}`).then((r) => {
      setPayments(r.data.payments)
      setSelected([])
    })
  }, [studentId])

  const toggle = (month) => {
    setSelected((s) => (s.includes(month) ? s.filter((m) => m !== month) : [...s, month]))
  }

  const total = payments.filter((p) => selected.includes(p.month)).reduce((a, p) => a + Number(p.amount), 0)

  const submit = async () => {
    if (!studentId || selected.length === 0) {
      toast('Select a student and at least one month', 'warn')
      return
    }
    setSaving(true)
    try {
      await api.post('/invoices', { studentId, months: selected })
      toast('Invoice created')
      onCreated()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Invoice" wide>
      <div className="space-y-4">
        <div>
          <label className="label">Student</label>
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select student</option>
            {students?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.studentId})
              </option>
            ))}
          </select>
        </div>

        {studentId && (
          <div>
            <p className="label">Select Months</p>
            {payments.length === 0 && <p className="text-sm text-slate-400">No payments for this student</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {payments.map((p) => {
                const on = selected.includes(p.month)
                return (
                  <button
                    key={p.month}
                    onClick={() => toggle(p.month)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      on ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{monthLabel(p.month)}</span>
                    <span className="text-xs text-slate-400">{p.amount} EGP</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-primary-50 border border-primary-100">
            <span className="font-bold text-primary-800">Total</span>
            <span className="font-extrabold text-lg text-primary-900">{total} EGP</span>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'Create Invoice'}
        </button>
      </div>
    </Modal>
  )
}
