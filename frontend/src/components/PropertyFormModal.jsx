import { useEffect, useState } from 'react'
import { Plus, Trash2, Home, Building } from 'lucide-react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function PropertyFormModal({ open, onClose, onSaved, property }) {
  const { toast } = useToast()
  const edit = !!property
  const [form, setForm] = useState({})
  const [floors, setFloors] = useState([])
  const [apartment, setApartment] = useState({ name: '', code: '', monthlyRent: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (property) {
        setForm({ name: property.name || '', code: property.code || '', type: property.type || 'house', gender: property.gender || '', address: property.address || '', notes: property.notes || '', status: property.status || 'active' })
        setFloors((property.floors || []).map((f) => ({ name: f.name || '', code: f.code || '' })))
        const ap = (property.apartments || [])[0]
        setApartment({ name: ap?.name || '', code: ap?.code || '', monthlyRent: ap?.monthlyRent || '' })
      } else {
        setForm({ name: '', code: '', type: 'house', gender: '', address: '', notes: '', status: 'active' })
        setFloors([{ name: '', code: '' }])
        setApartment({ name: '', code: '', monthlyRent: '' })
      }
    }
  }, [open, property])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name.trim()) {
      toast('اسم العقار مطلوب', 'warn')
      return
    }
    if (!edit && form.type === 'house' && !floors.some((f) => f.name.trim())) {
      toast('أضف دورًا واحدًا على الأقل للبيت', 'warn')
      return
    }
    setSaving(true)
    try {
      if (edit) {
        await api.put(`/properties/${property._id}`, form)
        toast('تم تحديث العقار')
      } else {
        await api.post('/properties', {
          ...form,
          floors: form.type === 'house' ? floors.filter((f) => f.name.trim()).map((f) => ({ name: f.name.trim(), code: f.code.trim() })) : [],
          apartments: form.type === 'apartment' ? [{ name: apartment.name || form.name, code: apartment.code, monthlyRent: apartment.monthlyRent }] : [],
        })
        toast('تمت إضافة العقار')
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
    <Modal open={open} onClose={onClose} title={edit ? 'تعديل العقار' : 'إضافة عقار جديد'}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">اسم العقار *</label>
            <input className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">الكود</label>
            <input className="input" dir="ltr" value={form.code} onChange={set('code')} />
          </div>
        </div>

        {!edit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">نوع العقار</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: 'house' }))}
                  className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${form.type === 'house' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <Home size={16} /> بيت كامل
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: 'apartment' }))}
                  className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${form.type === 'apartment' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <Building size={16} /> شقة مستقلة
                </button>
              </div>
            </div>
            <div>
              <label className="label">نوع السكن</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: '', l: 'مختلط' },
                  { v: 'male', l: 'ذكور' },
                  { v: 'female', l: 'إناث' },
                ].map((g) => (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, gender: g.v }))}
                    className={`p-3 rounded-xl border text-sm font-bold ${form.gender === g.v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    {g.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {edit && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">نوع السكن</label>
              <select className="input" value={form.gender} onChange={set('gender')}>
                <option value="">مختلط</option>
                <option value="male">ذكور</option>
                <option value="female">إناث</option>
              </select>
            </div>
            <div>
              <label className="label">الحالة</label>
              <select className="input" value={form.status} onChange={set('status')}>
                <option value="active">نشط</option>
                <option value="inactive">متوقف</option>
              </select>
            </div>
          </div>
        )}

        {!edit && form.type === 'house' && (
          <div>
            <label className="label">الأدوار (Floor)</label>
            <div className="space-y-2">
              {floors.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" placeholder={`اسم الدور ${i + 1} *`} value={f.name} onChange={(e) => setFloors((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input className="input !w-28" dir="ltr" placeholder="كود" value={f.code} onChange={(e) => setFloors((arr) => arr.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} />
                  <button className="btn-ghost text-red-600" onClick={() => setFloors((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-outline !py-1.5 text-xs mt-2" onClick={() => setFloors((arr) => [...arr, { name: '', code: '' }])}>
              <Plus size={14} /> إضافة دور
            </button>
          </div>
        )}

        {!edit && form.type === 'apartment' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">اسم الشقة</label>
              <input className="input" value={apartment.name} onChange={(e) => setApartment((a) => ({ ...a, name: e.target.value }))} placeholder={form.name} />
            </div>
            <div>
              <label className="label">كود الشقة</label>
              <input className="input" dir="ltr" value={apartment.code} onChange={(e) => setApartment((a) => ({ ...a, code: e.target.value }))} />
            </div>
            <div>
              <label className="label">الإيجار الافتراضي</label>
              <input className="input" type="number" dir="ltr" value={apartment.monthlyRent} onChange={(e) => setApartment((a) => ({ ...a, monthlyRent: e.target.value }))} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">العنوان</label>
            <input className="input" value={form.address} onChange={set('address')} />
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <input className="input" value={form.notes} onChange={set('notes')} />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          إلغاء
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : edit ? 'حفظ التعديلات' : 'إضافة العقار'}
        </button>
      </div>
    </Modal>
  )
}