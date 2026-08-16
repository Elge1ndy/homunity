import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Archive,
  Ban,
  Check,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
  History,
  Wallet,
  Image,
  MessageCircle,
  ShieldCheck,
  MoveRight,
  Sun,
} from 'lucide-react'
import api from '../api'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import PaymentModal from '../components/PaymentModal.jsx'
import StudentFormModal from '../components/StudentFormModal.jsx'
import InvoiceModal from '../components/InvoiceModal.jsx'
import DepositPayModal from '../components/DepositPayModal.jsx'
import DepositEditModal from '../components/DepositEditModal.jsx'
import DeductionModal from '../components/DeductionModal.jsx'
import RefundModal from '../components/RefundModal.jsx'
import CheckoutModal from '../components/CheckoutModal.jsx'
import TransferModal from '../components/TransferModal.jsx'
import { studentStatus, paymentStatus, invoiceStatus, fmtMoney, fmtDate, fmtDateTime, monthLabel, timeAgo, downloadBlob } from '../utils/format.js'
import { useApi } from '../hooks/useApi.js'
import { Link } from 'react-router-dom'

export default function StudentDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payTarget, setPayTarget] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [invOpen, setInvOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [editDepOpen, setEditDepOpen] = useState(false)
  const [deductOpen, setDeductOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [rooms, setRooms] = useState([])
  const summer = useApi('/summer-courses')

  const load = () => {
    setLoading(true)
    const controller = new AbortController()
    api
      .get(`/students/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => { if (e.name !== 'AbortError') toast(errMsg(e), 'error') })
      .finally(() => setLoading(false))
    api.get('/rooms').then((r) => setRooms(r.data.rooms)).catch(() => {})
    return () => controller.abort()
  }

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [id])

  const doAction = async (url, okMsg) => {
    try {
      await api.post(`/students/${id}${url}`)
      toast(okMsg)
      load()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    try {
      await api.post(`/students/${id}/notes`, { text: noteText })
      setNoteText('')
      toast('Note added')
      load()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const sendReminder = async (p) => {
    try {
      const r = await api.get(`/whatsapp/remind/${p._id}`)
      window.open(r.url, '_blank')
      toast('WhatsApp opened with reminder message')
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const remove = async () => {
    const name = data?.student?.name || 'Student'
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"? All data and payments will be deleted and cannot be undone.`)) return
    try {
      await api.delete(`/students/${id}`)
      toast('Student deleted permanently')
      navigate('/students')
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  if (loading || !data) return <Spinner full />

  const { student, housing, payments, invoices, activity, financial, deposit } = data
  const myCourses = (summer.data?.courses || []).filter((c) => String(c.studentId) === String(student._id))

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary-700">
        <ArrowRight size={16} /> Back
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-primary-50 text-primary-700 text-2xl font-extrabold">{student.name?.slice(0, 1)}</div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                {student.name} <Badge {...studentStatus[student.status]} />
              </h2>
              <p className="font-mono text-sm text-primary-700 font-bold" dir="ltr">{student.studentId}</p>
              <p className="text-sm text-slate-500 mt-1">
                {student.room ? `Room ${student.room.number} — Bed ${student.bedNumber || '—'}` : 'No room'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {student.status === 'active' && (
              <>
                <button className="btn-outline" onClick={() => setEditOpen(true)}>
                  <Pencil size={15} /> Edit
                </button>
                <button className="btn-primary !py-2" onClick={() => setTransferOpen(true)}>
                  <MoveRight size={15} /> Transfer
                </button>
                <button
                  className="btn-outline text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setCheckoutOpen(true)}
                >
                  <Ban size={15} /> Check-out
                </button>
                <button
                  className="btn-outline text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => window.confirm('Archive student? All data will be kept.') && doAction('/archive', 'Student archived')}
                >
                  <Archive size={15} /> Archive
                </button>
                <button className="btn-danger" onClick={remove}>
                  <Trash2 size={15} /> Delete
                </button>
              </>
            )}
            {student.status === 'archived' && (
              <button className="btn-outline" onClick={() => doAction('/restore', 'Student restored')}>
                <RotateCcw size={15} /> Restore
              </button>
            )}
            {student.status === 'archived' && (
              <button className="btn-danger" onClick={remove}>
                  <Trash2 size={15} /> Delete permanently
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone size={15} className="text-slate-400" /> <span dir="ltr">{student.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <GraduationCap size={15} className="text-slate-400" /> {student.university || '—'}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail size={15} className="text-slate-400" /> {student.email || '—'}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin size={15} className="text-slate-400" /> {housing?.name || ''}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet size={20} className="text-primary-700" />
              <h3 className="font-extrabold text-slate-800">Financial Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-xs font-bold text-slate-500">Expected Rent</p>
                <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(financial.totalExpected)} EGP</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50">
                <p className="text-xs font-bold text-emerald-600">Total Paid</p>
                <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmtMoney(financial.totalPaid)} EGP</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50">
                <p className="text-xs font-bold text-red-600">Total Remaining</p>
                <p className="text-lg font-extrabold text-red-700 mt-1">{fmtMoney(financial.totalRemaining)} EGP</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-50">
                <p className="text-xs font-bold text-orange-600">Total Overdue</p>
                <p className="text-lg font-extrabold text-orange-700 mt-1">{fmtMoney(financial.totalOverdue)} EGP</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50">
                <p className="text-xs font-bold text-indigo-600">Total Upcoming</p>
                <p className="text-lg font-extrabold text-indigo-700 mt-1">{fmtMoney(financial.totalUpcoming)} EGP</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50">
                <p className="text-xs font-bold text-amber-600">Deposit</p>
                <p className="text-lg font-extrabold text-amber-700 mt-1">{fmtMoney(deposit.originalAmount)} EGP</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-100">
                <p className="text-xs font-bold text-slate-600">Total Due</p>
                <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(financial.totalDue)} EGP</p>
              </div>
              <div className="p-4 rounded-xl bg-violet-50">
                <p className="text-xs font-bold text-violet-600">Status</p>
                <p className="text-sm font-extrabold text-violet-700 mt-1">
                  {financial.monthsPaid + financial.monthsPartial + financial.monthsUnpaid + financial.monthsOverdue + financial.monthsUpcoming} months
                </p>
                <p className="text-[10px] text-violet-500 mt-0.5">Paid {financial.monthsPaid} • Partial {financial.monthsPartial} • Overdue {financial.monthsOverdue} • Upcoming {financial.monthsUpcoming}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-primary-700" />
                <h3 className="font-extrabold text-slate-800">Deposit</h3>
                {deposit?.statusLabel && <Badge label={deposit.statusLabel} cls={deposit.status === 'paid' ? 'bg-teal-100 text-teal-700' : deposit.status === 'full' ? 'bg-emerald-100 text-emerald-700' : deposit.status === 'partial' || deposit.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'} />}
              </div>
              <div className="flex flex-wrap gap-2">
                {deposit?.paymentStatus !== 'paid' && (
                  <button className="btn-primary !py-1.5 text-xs" onClick={() => setPayOpen(true)}>
                    <Check size={14} /> Record deposit payment
                  </button>
                )}
                <button className="btn-outline !py-1.5 text-xs" onClick={() => setEditDepOpen(true)}>
                  <Pencil size={14} /> Edit
                </button>
                {deposit?.paymentStatus === 'paid' && deposit?.remainingAmount > 0 && deposit?.status !== 'full' && (
                  <>
                    <button className="btn-outline !py-1.5 text-xs text-red-600 !border-red-200" onClick={() => setDeductOpen(true)}>
                      Deduct
                    </button>
                    <button className="btn-outline !py-1.5 text-xs text-emerald-700 !border-emerald-200" onClick={() => setRefundOpen(true)} disabled={deposit.remainingAmount <= 0}>
                      Refund
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-xs font-bold text-slate-500">Required (Original)</p>
                <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(deposit?.originalAmount)}</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50">
                <p className="text-xs font-bold text-red-600">Total Deductions</p>
                <p className="text-lg font-extrabold text-red-700 mt-1">{fmtMoney(deposit?.totalDeductions)}</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50">
                <p className="text-xs font-bold text-emerald-600">Refunded</p>
                <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmtMoney(deposit?.refundedAmount)}</p>
              </div>
              <div className="p-4 rounded-xl bg-teal-50">
                <p className="text-xs font-bold text-teal-600">Remaining</p>
                <p className="text-lg font-extrabold text-teal-700 mt-1">{fmtMoney(deposit?.remainingAmount)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm">
              <span className="text-slate-500">
                Payment date: <b className="text-slate-700" dir="ltr">{deposit?.paymentDate || '—'}</b>
              </span>
              <span className="text-slate-500">
                Payment method: <b className="text-slate-700">{deposit?.paymentMethod === 'cash' ? 'Cash' : deposit?.paymentMethod === 'transfer' ? 'Bank Transfer' : 'Other'}</b>
              </span>
              {deposit?.paymentProof && (
                <a href={deposit.paymentProof} target="_blank" rel="noreferrer" className="text-primary-700 font-semibold flex items-center gap-1">
                  <Image size={14} /> Payment proof
                </a>
              )}
              {deposit?.refundDate && (
                <span className="text-slate-500">
                  Refund date: <b className="text-slate-700" dir="ltr">{deposit.refundDate}</b>
                </span>
              )}
              {deposit?.paymentStatus === 'paid' && (
                <button className="text-primary-700 font-semibold flex items-center gap-1" onClick={() => downloadBlob(`/api/students/${student._id}/deposit/receipt?type=pay`, `deposit-receipt.pdf`)}>
                  <FileText size={14} /> Deposit receipt
                </button>
              )}
            </div>

            {deposit?.originalAmount > 0 && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-2">Deductions</p>
                  {(deposit?.deductions || []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">No deductions</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="th">Amount</th>
                            <th className="th">Reason</th>
                            <th className="th">Date</th>
                            <th className="th">Attachment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deposit.deductions.map((x) => (
                            <tr key={x._id} className="border-t border-slate-100">
                              <td className="td font-extrabold text-red-700">{fmtMoney(x.amount)} EGP</td>
                              <td className="td">
                                <p className="font-semibold text-slate-700">{x.reason}</p>
                                {x.description && <p className="text-xs text-slate-400">{x.description}</p>}
                                {x.adminName && <p className="text-[10px] text-slate-300">By: {x.adminName}</p>}
                              </td>
                              <td className="td" dir="ltr">{x.date}</td>
                              <td className="td">
                                {x.attachment ? (
                                  <a href={x.attachment} target="_blank" rel="noreferrer" className="text-primary-700 text-xs font-bold">
                                    View
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-2">Refunds</p>
                  {(deposit?.refunds || []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">No refunds</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="th">Amount</th>
                            <th className="th">Date</th>
                            <th className="th">Method</th>
                            <th className="th">Receipt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deposit.refunds.map((x) => (
                            <tr key={x._id} className="border-t border-slate-100">
                              <td className="td font-extrabold text-emerald-700">{fmtMoney(x.amount)} EGP</td>
                              <td className="td" dir="ltr">{x.date}</td>
                              <td className="td">{x.method === 'cash' ? 'Cash' : x.method === 'transfer' ? 'Bank Transfer' : 'Other'}</td>
                              <td className="td">
                                <button className="btn-ghost text-primary-700" onClick={() => downloadBlob(`/api/students/${student._id}/deposit/receipt?type=refund&id=${x._id}`, 'refund-settlement.pdf')}>
                                  <FileText size={14} /> Receipt
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
              <div>
                <h3 className="font-extrabold text-slate-800">Monthly Payments</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paid {financial.monthsPaid} • Partial {financial.monthsPartial} • Unpaid {financial.monthsUnpaid} • Overdue {financial.monthsOverdue} • Upcoming {financial.monthsUpcoming}
                </p>
              </div>
              <span className="text-xs text-slate-500 font-bold">Total remaining: {fmtMoney(financial.totalRemaining)} EGP</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Month</th>
                    <th className="th">Expected</th>
                    <th className="th">Paid</th>
                    <th className="th">Remaining</th>
                    <th className="th">Due date</th>
                    <th className="th">Status</th>
                    <th className="th">Last payment date</th>
                    <th className="th">Proof</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const paidAmount = Number(p.paidAmount) || 0
                    const remaining = Math.max(0, (Number(p.amount) || 0) - paidAmount)
                    return (
                      <tr key={p._id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="td font-semibold">{monthLabel(p.month)}</td>
                        <td className="td">{fmtMoney(p.amount)} EGP</td>
                        <td className="td font-bold text-emerald-700">{fmtMoney(paidAmount)} EGP</td>
                        <td className="td font-bold text-red-600">{fmtMoney(remaining)} EGP</td>
                        <td className="td" dir="ltr">{p.dueDate}</td>
                        <td className="td">
                          <Badge {...(paymentStatus[p.status] || paymentStatus.unpaid)} />
                        </td>
                        <td className="td">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                        <td className="td">
                          {p.proof ? (
                            <a href={p.proof} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-700 text-xs font-bold">
                              <Image size={14} /> View
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-1 justify-end">
                            {p.status !== 'paid' && remaining > 0 ? (
                              <button className="btn-primary !py-1.5 text-xs" onClick={() => setPayTarget(p)}>
                                <Check size={14} /> {paidAmount > 0 ? 'Additional payment' : 'Record payment'}
                              </button>
                            ) : null}
                            {paidAmount > 0 && (
                              <button
                                className="btn-ghost text-primary-700"
                                title="Payment receipt"
                                onClick={() => downloadBlob(`/api/payments/${p._id}/receipt`, `receipt-${p.month}.pdf`)}
                              >
                                <FileText size={14} />
                              </button>
                            )}
                            <button
                              className="btn-ghost text-emerald-600"
                              title="WhatsApp reminder"
                              onClick={() => sendReminder(p)}
                            >
                              <MessageCircle size={14} />
                            </button>
                            {p.status === 'paid' ? (
                              <button
                                className="btn-ghost text-red-600"
                                onClick={() => window.confirm('Reverse this payment?') && api.post(`/payments/${p._id}/unpaid`).then(() => { toast('Reversed'); load() }).catch((e) => toast(errMsg(e), 'error'))}
                              >
                                Reverse
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <MoveRight size={20} className="text-primary-700" />
              <h3 className="font-extrabold text-slate-800">Transfer & Price History</h3>
            </div>
            {(student.transfers || []).length === 0 && (student.rentHistory || []).length === 0 ? (
              <EmptyState message="No transfers yet — use the (Transfer) button to change student location" />
            ) : (
              <div className="space-y-3">
                {(student.transfers || []).slice().reverse().map((t) => (
                  <div key={t._id} className="p-3 rounded-xl bg-primary-50/60 border border-primary-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        {[t.from?.propertyName, t.from?.floorName, t.from?.apartmentName].filter(Boolean).join(' — ') || 'No location'} Room {t.from?.roomNumber || '—'} Bed {t.from?.bedNumber || '—'}
                      </p>
                      <MoveRight size={15} className="text-primary-400 shrink-0" />
                      <p className="text-sm font-bold text-slate-700">
                        {[t.to?.propertyName, t.to?.floorName, t.to?.apartmentName].filter(Boolean).join(' — ') || 'No location'} Room {t.to?.roomNumber || '—'} Bed {t.to?.bedNumber || '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        <span className="font-extrabold text-red-600">{fmtMoney(t.from?.price)} EGP</span>
                        <MoveRight size={12} className="text-slate-400" />
                        <span className="font-extrabold text-emerald-600">{fmtMoney(t.to?.price)} EGP</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500" dir="ltr">{t.date}</span>
                      {t.reason && <span className="text-slate-500">• {t.reason}</span>}
                      {t.prorated && <Badge label="Prorated" cls="bg-amber-100 text-amber-700" />}
                      <span className="text-slate-400">• By {t.byName || '—'}</span>
                    </div>
                  </div>
                ))}
                {student.rentHistory?.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-100 mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="th">From</th>
                          <th className="th">To</th>
                          <th className="th">Price</th>
                          <th className="th">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {student.rentHistory.slice().reverse().map((h) => (
                          <tr key={h._id} className="border-t border-slate-100">
                            <td className="td" dir="ltr">{h.fromDate}</td>
                            <td className="td" dir="ltr">{h.toDate}</td>
                            <td className="td font-extrabold">{fmtMoney(h.price)} EGP</td>
                            <td className="td">Room {h.roomId ? rooms.find((r) => String(r._id) === String(h.roomId))?.number || '—' : '—'} Bed {h.bedNumber || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sun size={20} className="text-orange-500" />
                <h3 className="font-extrabold text-slate-800">Summer Courses</h3>
              </div>
              <Link to="/summer-courses" className="text-xs text-primary-700 font-semibold">
                All Courses
              </Link>
            </div>
            {myCourses.length === 0 ? (
              <EmptyState message="No summer courses for this student" />
            ) : (
              <div className="space-y-2">
                {myCourses.map((c) => (
                  <div key={c._id} className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-extrabold text-slate-700" dir="ltr">
                        {c.fromDate} → {c.toDate}
                      </p>
                      <Badge label={c.status === 'active' ? 'Active' : 'Ended'} cls={c.status === 'active' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {[c.propertyName, c.floorName, c.apartmentName].filter(Boolean).join(' — ') || 'No location'} • Room {rooms.find((r) => String(r._id) === String(c.roomId))?.number || '—'} Bed {c.bedNumber} • {c.months} months × {fmtMoney(c.rent)} EGP
                    </p>
                    <p className="text-xs font-bold mt-1.5">
                      Total <span className="text-primary-700">{fmtMoney(c.total)} EGP</span> • Paid <span className="text-emerald-700">{fmtMoney(c.paid)}</span> • Remaining{' '}
                      <span className={c.remaining > 0 ? 'text-red-700' : 'text-emerald-700'}>{fmtMoney(c.remaining)} EGP</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-primary-700" />
                <h3 className="font-extrabold text-slate-800">Invoices</h3>
              </div>
              <button className="btn-primary !py-1.5 text-xs" onClick={() => setInvOpen(true)}>
                <Plus size={14} /> Create invoice
              </button>
            </div>
            {invoices.length === 0 ? (
              <EmptyState message="No invoices" />
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv._id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50">
                    <div>
                      <p className="font-mono text-sm font-bold text-primary-700" dir="ltr">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">
                        {inv.months.map(monthLabel).join(', ')} — {fmtMoney(inv.total)} EGP
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge {...invoiceStatus[inv.status]} />
                      <button
                        className="btn-ghost text-primary-700"
                        onClick={() => downloadBlob(`/api/invoices/${inv._id}/pdf`, `${inv.invoiceNumber}.pdf`)}
                      >
                        <FileText size={14} /> PDF
                      </button>
                      <button
                        className="btn-ghost text-red-600"
                        onClick={() => window.confirm('Delete invoice?') && api.delete(`/invoices/${inv._id}`).then(() => { toast('Deleted'); load() }).catch((e) => toast(errMsg(e), 'error'))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <StickyNote size={20} className="text-amber-500" />
              <h3 className="font-extrabold text-slate-800">Private Notes</h3>
            </div>
            <div className="flex gap-2 mb-4">
              <input className="input" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." />
              <button className="btn-primary !px-3" onClick={addNote}>
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {student.privateNotes?.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No notes</p>}
              {student.privateNotes?.map((n, i) => (
                <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-sm text-slate-700">{n.text}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {n.by} • {fmtDateTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <History size={20} className="text-slate-400" />
              <h3 className="font-extrabold text-slate-800">Activity Log</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activity.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No activity</p>}
              {activity.map((a) => (
                <div key={a._id} className="flex items-start gap-2">
                  <div className="p-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold mt-0.5">{a.adminName?.slice(0, 1)}</div>
                  <div>
                    <p className="text-sm text-slate-700">{a.action}</p>
                    <p className="text-xs text-slate-400">{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PaymentModal open={!!payTarget} onClose={() => setPayTarget(null)} onSaved={load} payment={payTarget} />
      <StudentFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} student={student} rooms={rooms} />
      <InvoiceModal open={invOpen} onClose={() => setInvOpen(false)} onCreated={load} students={[student]} />
      <DepositPayModal open={payOpen} studentId={student._id} originalAmount={deposit?.originalAmount || 0} onClose={() => setPayOpen(false)} onSaved={load} />
      <DepositEditModal open={editDepOpen} studentId={student._id} deposit={deposit} onClose={() => setEditDepOpen(false)} onSaved={load} />
      <DeductionModal open={deductOpen} studentId={student._id} remaining={deposit?.remainingAmount ?? null} onClose={() => setDeductOpen(false)} onSaved={load} />
      <RefundModal open={refundOpen} studentId={student._id} remaining={deposit?.remainingAmount ?? null} onClose={() => setRefundOpen(false)} onSaved={load} />
      <CheckoutModal open={checkoutOpen} student={student} payments={payments} financial={financial} deposit={deposit} onClose={() => setCheckoutOpen(false)} onDone={load} />
      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onDone={load}
        source={{ roomId: student.roomId, bedNumber: student.bedNumber, student }}
      />
    </div>
  )
}
