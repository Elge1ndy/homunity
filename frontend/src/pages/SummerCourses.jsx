import { useState } from 'react'
import { Plus, Check, X, Sun, Wallet, Trash2, ChevronDown } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'
import SummerCourseModal from '../components/SummerCourseModal.jsx'
import { fmtMoney, fmtDate } from '../utils/format.js'

const FILTERS = [
  ['all', 'الكل'],
  ['active', 'نشط'],
  ['ended', 'منتهي'],
]

function PayModal({ open, onClose, onSaved, course }) {
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast('أدخل المبلغ', 'warn')
    setSaving(true)
    try {
      await api.post(`/summer-courses/${course._id}/pay`, { amount: Number(amount), date, method, note })
      toast('تم تسجيل الدفعة')
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`دفعة لكورس ${course?.studentName}`}>
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-slate-50 text-sm">
          <p className="text-slate-500">
            الإجمالي <b className="text-slate-700">{fmtMoney(course?.total)}</b> • المدفوع{' '}
            <b className="text-emerald-700">{fmtMoney(course?.paid)}</b> • المتبقي <b className="text-red-700">{fmtMoney(course?.remaining)}</b> ج.م
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">المبلغ</label>
            <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label">التاريخ</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">طريقة الدفع</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">نقدًا</option>
              <option value="transfer">تحويل بنكي</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div>
            <label className="label">ملاحظة</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'تسجيل الدفعة'}
        </button>
      </div>
    </Modal>
  )
}

export default function SummerCourses() {
  const { toast } = useToast()
  const [filter, setFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const [expanded, setExpanded] = useState({})

  const { data, loading, refetch } = useApi('/summer-courses')
  const students = useApi('/students?status=active')
  const properties = useApi('/properties')
  const rooms = useApi('/rooms')

  useRealtime(refetch, ['summer:updated', 'student:updated', 'student:added', 'property:updated', 'room:updated'])

  const courses = (data?.courses || []).filter((c) => filter === 'all' || c.status === filter)

  const end = async (c) => {
    if (!window.confirm(`إنهاء كورس ${c.studentName}؟`)) return
    try {
      await api.post(`/summer-courses/${c._id}/end`)
      toast('تم إنهاء الكورس')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const remove = async (c) => {
    if (!window.confirm(`حذف كورس ${c.studentName} نهائيًا؟ لا يمكن التراجع.`)) return
    try {
      await api.delete(`/summer-courses/${c._id}`)
      toast('تم حذف الكورس')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${filter === v ? 'bg-primary-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> إضافة كورس صيفي
        </button>
      </div>

      {loading ? (
        <Spinner full />
      ) : !courses.length ? (
        <div className="card">
          <EmptyState message="لا توجد كورسات صيفية — أضف كورسًا لطالب في سرير متاح" />
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => {
            const isActive = c.status === 'active'
            const expandedIds = expanded[c._id]
            return (
              <div key={c._id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isActive ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Sun size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-800 truncate">{c.studentName}</p>
                    <p className="font-mono text-[11px] text-slate-400" dir="ltr">
                      {c.studentCode}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p className="font-bold">
                      {[c.propertyName, c.floorName, c.apartmentName].filter(Boolean).join(' — ') || 'بدون مكان'}
                    </p>
                    <p className="text-slate-400 mt-0.5">
                      غرفة {rooms.data?.rooms?.find((r) => r._id === c.roomId)?.number || '—'} سرير {c.bedNumber}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p className="font-bold" dir="ltr">
                      {c.fromDate} → {c.toDate}
                    </p>
                    <p className="text-slate-400 mt-0.5">{c.months} شهر • {fmtMoney(c.rent)} ج.م/شهر</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge label={isActive ? 'نشط' : 'منتهي'} cls={isActive ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'} />
                    {c.remaining > 0 && <Badge label={`متبقي ${fmtMoney(c.remaining)}`} cls="bg-red-100 text-red-700" />}
                    {c.remaining === 0 && <Badge label="مدفوع بالكامل" cls="bg-emerald-100 text-emerald-700" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {isActive && (
                      <button className="btn-primary !py-1.5 text-xs" onClick={() => setPayTarget(c)}>
                        <Check size={14} /> دفعة
                      </button>
                    )}
                    {isActive && (
                      <button className="btn-outline !py-1.5 text-xs" onClick={() => end(c)}>
                        <X size={14} /> إنهاء
                      </button>
                    )}
                    <button className="btn-ghost text-slate-400" onClick={() => setExpanded((e) => ({ ...e, [c._id]: !e[c._id] }))}>
                      <ChevronDown size={16} className={`transition-transform ${expandedIds ? 'rotate-180' : ''}`} />
                    </button>
                    <button className="btn-ghost text-red-600" onClick={() => remove(c)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {expandedIds && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-50">
                      <p className="text-[10px] font-bold text-slate-400">إيجار الفترة</p>
                      <p className="text-sm font-extrabold text-slate-700 mt-0.5">{fmtMoney(c.totalRent)} ج.م</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50">
                      <p className="text-[10px] font-bold text-slate-400">التأمين</p>
                      <p className="text-sm font-extrabold text-slate-700 mt-0.5">{fmtMoney(c.deposit)} ج.م</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50">
                      <p className="text-[10px] font-bold text-slate-400">الإجمالي</p>
                      <p className="text-sm font-extrabold text-primary-700 mt-0.5">{fmtMoney(c.total)} ج.م</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50">
                      <p className="text-[10px] font-bold text-emerald-600">المدفوع</p>
                      <p className="text-sm font-extrabold text-emerald-700 mt-0.5">{fmtMoney(c.paid)} ج.م</p>
                    </div>
                    <div className="p-3 rounded-xl bg-red-50">
                      <p className="text-[10px] font-bold text-red-600">المتبقي</p>
                      <p className="text-sm font-extrabold text-red-700 mt-0.5">{fmtMoney(c.remaining)} ج.م</p>
                    </div>
                    <div className="col-span-2 sm:col-span-5">
                      <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <Wallet size={12} /> سجل الدفعات
                      </p>
                      {(c.payments || []).length === 0 ? (
                        <p className="text-xs text-slate-400">لا توجد دفعات مسجلة</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(c.payments || []).map((p, i) => (
                            <span key={p._id || i} className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600">
                              {fmtMoney(p.amount)} ج.م • <span dir="ltr">{p.date}</span> • {p.method === 'cash' ? 'نقدًا' : p.method === 'transfer' ? 'تحويل' : 'أخرى'} {p.by && `• ${p.by}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <SummerCourseModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
        students={students.data?.students || []}
        properties={properties.data?.properties || []}
        rooms={rooms.data?.rooms || []}
        courses={data?.courses || []}
      />
      <PayModal open={!!payTarget} onClose={() => setPayTarget(null)} onSaved={refetch} course={payTarget} />
    </div>
  )
}
