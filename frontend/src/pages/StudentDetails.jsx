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
    api
      .get(`/students/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => toast(errMsg(e), 'error'))
      .finally(() => setLoading(false))
    api.get('/rooms').then((r) => setRooms(r.data.rooms)).catch(() => {})
  }

  useEffect(load, [id])

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
      toast('تمت إضافة الملاحظة')
      load()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const sendReminder = async (p) => {
    try {
      const r = await api.get(`/whatsapp/remind/${p._id}`)
      window.open(r.url, '_blank')
      toast('تم فتح واتساب مع رسالة التذكير')
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const remove = async () => {
    const name = data?.student?.name || 'الطالب'
    if (!window.confirm(`هل أنت متأكد من حذف "${name}" نهائيًا؟ سيتم حذف كل بياناته ومدفوعاته ولا يمكن التراجع.`)) return
    try {
      await api.delete(`/students/${id}`)
      toast('تم حذف الطالب نهائيًا')
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
        <ArrowRight size={16} /> رجوع
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
                {student.room ? `غرفة ${student.room.number} — سرير ${student.bedNumber || '—'}` : 'بدون غرفة'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {student.status === 'active' && (
              <>
                <button className="btn-outline" onClick={() => setEditOpen(true)}>
                  <Pencil size={15} /> تعديل
                </button>
                <button className="btn-primary !py-2" onClick={() => setTransferOpen(true)}>
                  <MoveRight size={15} /> نقل
                </button>
                <button
                  className="btn-outline text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setCheckoutOpen(true)}
                >
                  <Ban size={15} /> إنهاء الإقامة
                </button>
                <button
                  className="btn-outline text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => window.confirm('أرشفة الطالب؟ ستبقى كل بياناته محفوظة.') && doAction('/archive', 'تمت أرشفة الطالب')}
                >
                  <Archive size={15} /> أرشفة
                </button>
                <button className="btn-danger" onClick={remove}>
                  <Trash2 size={15} /> حذف
                </button>
              </>
            )}
            {student.status === 'archived' && (
              <button className="btn-outline" onClick={() => doAction('/restore', 'تمت استعادة الطالب')}>
                <RotateCcw size={15} /> استعادة
              </button>
            )}
            {student.status === 'archived' && (
              <button className="btn-danger" onClick={remove}>
                <Trash2 size={15} /> حذف نهائي
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
              <h3 className="font-extrabold text-slate-800">الملخص المالي</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-xs font-bold text-slate-500">Expected Rent</p>
                <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(financial.totalExpected)} ج.م</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50">
                <p className="text-xs font-bold text-emerald-600">Total Paid</p>
                <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmtMoney(financial.totalPaid)} ج.م</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50">
                <p className="text-xs font-bold text-red-600">Total Remaining</p>
                <p className="text-lg font-extrabold text-red-700 mt-1">{fmtMoney(financial.totalRemaining)} ج.م</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-50">
                <p className="text-xs font-bold text-orange-600">Total Overdue</p>
                <p className="text-lg font-extrabold text-orange-700 mt-1">{fmtMoney(financial.totalOverdue)} ج.م</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50">
                <p className="text-xs font-bold text-indigo-600">Total Upcoming</p>
                <p className="text-lg font-extrabold text-indigo-700 mt-1">{fmtMoney(financial.totalUpcoming)} ج.م</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50">
                <p className="text-xs font-bold text-amber-600">Deposit</p>
                <p className="text-lg font-extrabold text-amber-700 mt-1">{fmtMoney(deposit.originalAmount)} ج.م</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-100">
                <p className="text-xs font-bold text-slate-600">Total Due</p>
                <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(financial.totalDue)} ج.م</p>
              </div>
              <div className="p-4 rounded-xl bg-violet-50">
                <p className="text-xs font-bold text-violet-600">المواقف</p>
                <p className="text-sm font-extrabold text-violet-700 mt-1">
                  {financial.monthsPaid + financial.monthsPartial + financial.monthsUnpaid + financial.monthsOverdue + financial.monthsUpcoming} شهر
                </p>
                <p className="text-[10px] text-violet-500 mt-0.5">مدفوع {financial.monthsPaid} • جزئي {financial.monthsPartial} • متأخر {financial.monthsOverdue} • قادم {financial.monthsUpcoming}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-primary-700" />
                <h3 className="font-extrabold text-slate-800">التأمين</h3>
                {deposit?.statusLabel && <Badge label={deposit.statusLabel} cls={deposit.status === 'paid' ? 'bg-teal-100 text-teal-700' : deposit.status === 'full' ? 'bg-emerald-100 text-emerald-700' : deposit.status === 'partial' || deposit.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'} />}
              </div>
              <div className="flex flex-wrap gap-2">
                {deposit?.paymentStatus !== 'paid' && (
                  <button className="btn-primary !py-1.5 text-xs" onClick={() => setPayOpen(true)}>
                    <Check size={14} /> تسجيل دفع التأمين
                  </button>
                )}
                <button className="btn-outline !py-1.5 text-xs" onClick={() => setEditDepOpen(true)}>
                  <Pencil size={14} /> تعديل
                </button>
                {deposit?.paymentStatus === 'paid' && deposit?.remainingAmount > 0 && deposit?.status !== 'full' && (
                  <>
                    <button className="btn-outline !py-1.5 text-xs text-red-600 !border-red-200" onClick={() => setDeductOpen(true)}>
                      خصم
                    </button>
                    <button className="btn-outline !py-1.5 text-xs text-emerald-700 !border-emerald-200" onClick={() => setRefundOpen(true)} disabled={deposit.remainingAmount <= 0}>
                      استرداد
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-xs font-bold text-slate-500">المطلوب (الأصل)</p>
                <p className="text-lg font-extrabold text-slate-800 mt-1">{fmtMoney(deposit?.originalAmount)}</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50">
                <p className="text-xs font-bold text-red-600">إجمالي الخصومات</p>
                <p className="text-lg font-extrabold text-red-700 mt-1">{fmtMoney(deposit?.totalDeductions)}</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50">
                <p className="text-xs font-bold text-emerald-600">المسترد</p>
                <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmtMoney(deposit?.refundedAmount)}</p>
              </div>
              <div className="p-4 rounded-xl bg-teal-50">
                <p className="text-xs font-bold text-teal-600">المتبقي</p>
                <p className="text-lg font-extrabold text-teal-700 mt-1">{fmtMoney(deposit?.remainingAmount)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm">
              <span className="text-slate-500">
                تاريخ الدفع: <b className="text-slate-700" dir="ltr">{deposit?.paymentDate || '—'}</b>
              </span>
              <span className="text-slate-500">
                طريقة الدفع: <b className="text-slate-700">{deposit?.paymentMethod === 'cash' ? 'نقدًا' : deposit?.paymentMethod === 'transfer' ? 'تحويل بنكي' : 'أخرى'}</b>
              </span>
              {deposit?.paymentProof && (
                <a href={deposit.paymentProof} target="_blank" rel="noreferrer" className="text-primary-700 font-semibold flex items-center gap-1">
                  <Image size={14} /> إثبات الدفع
                </a>
              )}
              {deposit?.refundDate && (
                <span className="text-slate-500">
                  تاريخ الاسترداد: <b className="text-slate-700" dir="ltr">{deposit.refundDate}</b>
                </span>
              )}
              {deposit?.paymentStatus === 'paid' && (
                <button className="text-primary-700 font-semibold flex items-center gap-1" onClick={() => downloadBlob(`/api/students/${student._id}/deposit/receipt?type=pay`, `deposit-receipt.pdf`)}>
                  <FileText size={14} /> وصل استلام التأمين
                </button>
              )}
            </div>

            {deposit?.originalAmount > 0 && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-2">الخصومات</p>
                  {(deposit?.deductions || []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">لا توجد خصومات</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="th">المبلغ</th>
                            <th className="th">السبب</th>
                            <th className="th">التاريخ</th>
                            <th className="th">مرفق</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deposit.deductions.map((x) => (
                            <tr key={x._id} className="border-t border-slate-100">
                              <td className="td font-extrabold text-red-700">{fmtMoney(x.amount)} ج.م</td>
                              <td className="td">
                                <p className="font-semibold text-slate-700">{x.reason}</p>
                                {x.description && <p className="text-xs text-slate-400">{x.description}</p>}
                                {x.adminName && <p className="text-[10px] text-slate-300">بواسطة: {x.adminName}</p>}
                              </td>
                              <td className="td" dir="ltr">{x.date}</td>
                              <td className="td">
                                {x.attachment ? (
                                  <a href={x.attachment} target="_blank" rel="noreferrer" className="text-primary-700 text-xs font-bold">
                                    عرض
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
                  <p className="text-xs font-bold text-slate-400 mb-2">الاستردادات</p>
                  {(deposit?.refunds || []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">لا توجد استردادات</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="th">المبلغ</th>
                            <th className="th">التاريخ</th>
                            <th className="th">الطريقة</th>
                            <th className="th">الوصل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deposit.refunds.map((x) => (
                            <tr key={x._id} className="border-t border-slate-100">
                              <td className="td font-extrabold text-emerald-700">{fmtMoney(x.amount)} ج.م</td>
                              <td className="td" dir="ltr">{x.date}</td>
                              <td className="td">{x.method === 'cash' ? 'نقدًا' : x.method === 'transfer' ? 'تحويل بنكي' : 'أخرى'}</td>
                              <td className="td">
                                <button className="btn-ghost text-primary-700" onClick={() => downloadBlob(`/api/students/${student._id}/deposit/receipt?type=refund&id=${x._id}`, 'refund-settlement.pdf')}>
                                  <FileText size={14} /> وصل
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
                <h3 className="font-extrabold text-slate-800">الدفعات الشهرية</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  مدفوع {financial.monthsPaid} • جزئي {financial.monthsPartial} • غير مدفوع {financial.monthsUnpaid} • متأخر {financial.monthsOverdue} • قادم {financial.monthsUpcoming}
                </p>
              </div>
              <span className="text-xs text-slate-500 font-bold">المتبقي الإجمالي: {fmtMoney(financial.totalRemaining)} ج.م</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">الشهر</th>
                    <th className="th">المتوقع</th>
                    <th className="th">المدفوع</th>
                    <th className="th">المتبقي</th>
                    <th className="th">الاستحقاق</th>
                    <th className="th">الحالة</th>
                    <th className="th">تاريخ آخر دفع</th>
                    <th className="th">الإثبات</th>
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
                        <td className="td">{fmtMoney(p.amount)} ج.م</td>
                        <td className="td font-bold text-emerald-700">{fmtMoney(paidAmount)} ج.م</td>
                        <td className="td font-bold text-red-600">{fmtMoney(remaining)} ج.م</td>
                        <td className="td" dir="ltr">{p.dueDate}</td>
                        <td className="td">
                          <Badge {...(paymentStatus[p.status] || paymentStatus.unpaid)} />
                        </td>
                        <td className="td">{p.paidAt ? fmtDate(p.paidAt) : '—'}</td>
                        <td className="td">
                          {p.proof ? (
                            <a href={p.proof} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-700 text-xs font-bold">
                              <Image size={14} /> عرض
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-1 justify-end">
                            {p.status !== 'paid' && remaining > 0 ? (
                              <button className="btn-primary !py-1.5 text-xs" onClick={() => setPayTarget(p)}>
                                <Check size={14} /> {paidAmount > 0 ? 'دفعة إضافية' : 'تسجيل دفع'}
                              </button>
                            ) : null}
                            {paidAmount > 0 && (
                              <button
                                className="btn-ghost text-primary-700"
                                title="وصل الاستلام"
                                onClick={() => downloadBlob(`/api/payments/${p._id}/receipt`, `receipt-${p.month}.pdf`)}
                              >
                                <FileText size={14} />
                              </button>
                            )}
                            <button
                              className="btn-ghost text-emerald-600"
                              title="تذكير عبر واتساب"
                              onClick={() => sendReminder(p)}
                            >
                              <MessageCircle size={14} />
                            </button>
                            {p.status === 'paid' ? (
                              <button
                                className="btn-ghost text-red-600"
                                onClick={() => window.confirm('التراجع عن هذا الدفع؟') && api.post(`/payments/${p._id}/unpaid`).then(() => { toast('تم التراجع'); load() }).catch((e) => toast(errMsg(e), 'error'))}
                              >
                                تراجع
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
              <h3 className="font-extrabold text-slate-800">سجل النقل والأسعار</h3>
            </div>
            {(student.transfers || []).length === 0 && (student.rentHistory || []).length === 0 ? (
              <EmptyState message="لا توجد عمليات نقل — استخدم زر (نقل) لتغيير مكان الطالب" />
            ) : (
              <div className="space-y-3">
                {(student.transfers || []).slice().reverse().map((t) => (
                  <div key={t._id} className="p-3 rounded-xl bg-primary-50/60 border border-primary-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        {[t.from?.propertyName, t.from?.floorName, t.from?.apartmentName].filter(Boolean).join(' — ') || 'بدون مكان'} غرفة {t.from?.roomNumber || '—'} سرير {t.from?.bedNumber || '—'}
                      </p>
                      <MoveRight size={15} className="text-primary-400 shrink-0" />
                      <p className="text-sm font-bold text-slate-700">
                        {[t.to?.propertyName, t.to?.floorName, t.to?.apartmentName].filter(Boolean).join(' — ') || 'بدون مكان'} غرفة {t.to?.roomNumber || '—'} سرير {t.to?.bedNumber || '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                      <span className="font-extrabold text-red-600">{fmtMoney(t.from?.price)} ج.م</span>
                      <MoveRight size={12} className="text-slate-400" />
                      <span className="font-extrabold text-emerald-600">{fmtMoney(t.to?.price)} ج.م</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500" dir="ltr">{t.date}</span>
                      {t.reason && <span className="text-slate-500">• {t.reason}</span>}
                      {t.prorated && <Badge label="تسعير نسبي" cls="bg-amber-100 text-amber-700" />}
                      <span className="text-slate-400">• بواسطة {t.byName || '—'}</span>
                    </div>
                  </div>
                ))}
                {student.rentHistory?.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-100 mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="th">من</th>
                          <th className="th">إلى</th>
                          <th className="th">السعر</th>
                          <th className="th">الموقع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {student.rentHistory.slice().reverse().map((h) => (
                          <tr key={h._id} className="border-t border-slate-100">
                            <td className="td" dir="ltr">{h.fromDate}</td>
                            <td className="td" dir="ltr">{h.toDate}</td>
                            <td className="td font-extrabold">{fmtMoney(h.price)} ج.م</td>
                            <td className="td">غرفة {h.roomId ? rooms.find((r) => String(r._id) === String(h.roomId))?.number || '—' : '—'} سرير {h.bedNumber || '—'}</td>
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
                <h3 className="font-extrabold text-slate-800">الكورسات الصيفية</h3>
              </div>
              <Link to="/summer-courses" className="text-xs text-primary-700 font-semibold">
                كل الكورسات
              </Link>
            </div>
            {myCourses.length === 0 ? (
              <EmptyState message="لا توجد كورسات صيفية لهذا الطالب" />
            ) : (
              <div className="space-y-2">
                {myCourses.map((c) => (
                  <div key={c._id} className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-extrabold text-slate-700" dir="ltr">
                        {c.fromDate} → {c.toDate}
                      </p>
                      <Badge label={c.status === 'active' ? 'نشط' : 'منتهي'} cls={c.status === 'active' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {[c.propertyName, c.floorName, c.apartmentName].filter(Boolean).join(' — ') || 'بدون مكان'} • غرفة {rooms.find((r) => String(r._id) === String(c.roomId))?.number || '—'} سرير {c.bedNumber} • {c.months} شهر × {fmtMoney(c.rent)} ج.م
                    </p>
                    <p className="text-xs font-bold mt-1.5">
                      الإجمالي <span className="text-primary-700">{fmtMoney(c.total)} ج.م</span> • المدفوع <span className="text-emerald-700">{fmtMoney(c.paid)}</span> • المتبقي{' '}
                      <span className={c.remaining > 0 ? 'text-red-700' : 'text-emerald-700'}>{fmtMoney(c.remaining)} ج.م</span>
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
                <h3 className="font-extrabold text-slate-800">الفواتير</h3>
              </div>
              <button className="btn-primary !py-1.5 text-xs" onClick={() => setInvOpen(true)}>
                <Plus size={14} /> إنشاء فاتورة
              </button>
            </div>
            {invoices.length === 0 ? (
              <EmptyState message="لا توجد فواتير" />
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv._id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50">
                    <div>
                      <p className="font-mono text-sm font-bold text-primary-700" dir="ltr">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">
                        {inv.months.map(monthLabel).join('، ')} — {fmtMoney(inv.total)} ج.م
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
                        onClick={() => window.confirm('حذف الفاتورة؟') && api.delete(`/invoices/${inv._id}`).then(() => { toast('تم الحذف'); load() }).catch((e) => toast(errMsg(e), 'error'))}
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
              <h3 className="font-extrabold text-slate-800">ملاحظات خاصة</h3>
            </div>
            <div className="flex gap-2 mb-4">
              <input className="input" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="أضف ملاحظة..." />
              <button className="btn-primary !px-3" onClick={addNote}>
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {student.privateNotes?.length === 0 && <p className="text-sm text-slate-400 text-center py-2">لا توجد ملاحظات</p>}
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
              <h3 className="font-extrabold text-slate-800">سجل النشاط</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activity.length === 0 && <p className="text-sm text-slate-400 text-center py-2">لا يوجد نشاط</p>}
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
