import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

const PERM_LABELS = [
  ['students', 'إدارة الطلاب'],
  ['rooms', 'إدارة الغرف'],
  ['beds', 'إدارة الأسرة'],
  ['payments', 'إدارة المدفوعات'],
  ['invoices', 'إدارة الفواتير'],
  ['reports', 'التقارير'],
  ['notifications', 'الإشعارات'],
  ['activity', 'سجل النشاط'],
  ['settings', 'الإعدادات'],
  ['export', 'استيراد / تصدير'],
]

export default function AdminModal({ open, onClose, onSaved, admin }) {
  const { toast } = useToast()
  const [form, setForm] = useState({})
  const [perms, setPerms] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        admin
          ? { name: admin.name, username: admin.username, phone: admin.phone || '', password: '' }
          : { name: '', username: '', phone: '', password: '' }
      )
      const p = {}
      PERM_LABELS.forEach(([k]) => (p[k] = admin ? admin.permissions?.[k] !== false : true))
      setPerms(p)
    }
  }, [open, admin])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setSaving(true)
    try {
      const body = { ...form, permissions: perms }
      if (admin) {
        if (!body.password) delete body.password
        await api.put(`/admins/${admin._id}`, body)
        toast('تم تحديث بيانات المدير')
      } else {
        await api.post('/admins', body)
        toast('تمت إضافة مدير جديد')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={admin ? 'تعديل مدير' : 'إضافة مدير'}>
      <div className="space-y-4">
        <div>
          <label className="label">الاسم *</label>
          <input className="input" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label">اسم المستخدم *</label>
          <input className="input" dir="ltr" value={form.username} onChange={set('username')} />
        </div>
        <div>
          <label className="label">رقم الهاتف</label>
          <input className="input" dir="ltr" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <label className="label">{admin ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور *'}</label>
          <input className="input" dir="ltr" type="password" value={form.password} onChange={set('password')} />
        </div>
        <div>
          <p className="label">الصلاحيات</p>
          <div className="grid grid-cols-2 gap-2">
            {PERM_LABELS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                <input type="checkbox" checked={perms[k]} onChange={(e) => setPerms((p) => ({ ...p, [k]: e.target.checked }))} className="accent-primary-700" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : 'حفظ'}
        </button>
      </div>
    </Modal>
  )
}
