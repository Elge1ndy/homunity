import { useState } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import AdminModal from '../components/AdminModal.jsx'

export default function Settings() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { data, loading, refetch } = useApi('/admins')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useRealtime(refetch, ['admin:updated'])

  const remove = async (a) => {
    if (!window.confirm(`حذف المدير ${a.name}؟`)) return
    try {
      await api.delete(`/admins/${a._id}`)
      toast('تم حذف المدير')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const toggleActive = async (a) => {
    try {
      await api.put(`/admins/${a._id}`, { active: !a.active })
      toast(a.active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const admins = data?.admins || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{admins.length} مدير</p>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={16} /> إضافة مدير
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner full />
        ) : !admins.length ? (
          <EmptyState message="لا يوجد مديرون" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">الاسم</th>
                  <th className="th">اسم المستخدم</th>
                  <th className="th">الهاتف</th>
                  <th className="th">الحالة</th>
                  <th className="th">الصلاحيات</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-full bg-primary-100 text-primary-700 text-xs font-extrabold">{a.name?.slice(0, 1)}</div>
                        <span className="font-bold text-slate-800">
                          {a.name}
                          {String(a._id) === String(user?._id) && <span className="ms-1 text-xs text-primary-700">(أنت)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="td font-mono" dir="ltr">{a.username}</td>
                    <td className="td" dir="ltr">{a.phone || '—'}</td>
                    <td className="td">
                      <button onClick={() => toggleActive(a)} disabled={String(a._id) === String(user?._id)}>
                        <Badge label={a.active ? 'نشط' : 'معطل'} cls={a.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'} />
                      </button>
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(a.permissions || {})
                          .filter(([, v]) => v)
                          .slice(0, 3)
                          .map(([k]) => (
                            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-[11px] font-bold">
                              <ShieldCheck size={11} />
                              {k}
                            </span>
                          ))}
                        {Object.values(a.permissions || {}).filter((v) => v).length > 3 && (
                          <span className="text-[11px] text-slate-400 font-bold self-center">+{Object.values(a.permissions || {}).filter((v) => v).length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                          onClick={() => {
                            setEditing(a)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                          disabled={String(a._id) === String(user?._id)}
                          onClick={() => remove(a)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} admin={editing} />
    </div>
  )
}
