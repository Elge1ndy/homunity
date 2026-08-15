import { useEffect, useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function LevelFormModal({ open, onClose, onSaved, propertyId, kind, item, floors }) {
  const { toast } = useToast()
  const edit = !!item
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (kind === 'floor') {
        setForm(item ? { name: item.name || '', code: item.code || '', status: item.status || 'active' } : { name: '', code: '', status: 'active' })
      } else {
        setForm(item ? { name: item.name || '', code: item.code || '', monthlyRent: item.monthlyRent || '', status: item.status || 'active', floorId: item.floorId || '' } : { name: '', code: '', monthlyRent: '', status: 'active', floorId: '' })
      }
    }
  }, [open, item, kind])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name.trim()) {
      toast(kind === 'floor' ? 'اسم الدور مطلوب' : 'اسم الشقة مطلوب', 'warn')
      return
    }
    setSaving(true)
    try {
      if (kind === 'floor') {
        if (edit) await api.put(`/properties/${propertyId}/floors/${item._id}`, form)
        else await api.post(`/properties/${propertyId}/floors`, form)
        toast(edit ? 'تم تعديل الدور' : 'تمت إضافة الدور')
      } else {
        if (edit) await api.put(`/properties/${propertyId}/apartments/${item._id}`, form)
        else await api.post(`/properties/${propertyId}/apartments`, form)
        toast(edit ? 'تم تعديل الشقة' : 'تمت إضافة الشقة')
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
    <Modal open={open} onClose={onClose} title={edit ? `تعديل ${kind === 'floor' ? 'الدور' : 'الشقة'}` : `إضافة ${kind === 'floor' ? 'دور' : 'شقة'}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{kind === 'floor' ? 'اسم الدور' : 'اسم الشقة'} *</label>
            <input className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">الكود</label>
            <input className="input" dir="ltr" value={form.code} onChange={set('code')} />
          </div>
          {kind === 'apartment' && (
            <>
              <div>
                <label className="label">الإيجار الافتراضي (يُستخدم عند إضافة غرفة)</label>
                <input className="input" type="number" dir="ltr" value={form.monthlyRent} onChange={set('monthlyRent')} />
              </div>
              {floors?.length > 0 && (
                <div>
                  <label className="label">الدور</label>
                  <select className="input" value={form.floorId} onChange={set('floorId')}>
                    <option value="">بدون دور</option>
                    {floors.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name || f.code}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          <div>
            <label className="label">الحالة</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="active">نشط</option>
              <option value="inactive">متوقف</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : edit ? 'حفظ التعديلات' : 'إضافة'}
        </button>
      </div>
    </Modal>
  )
}