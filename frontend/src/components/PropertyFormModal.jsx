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
      toast('Property name is required', 'warn')
      return
    }
    if (!edit && form.type === 'house' && !floors.some((f) => f.name.trim())) {
      toast('Add at least one floor', 'warn')
      return
    }
    setSaving(true)
    try {
      if (edit) {
        await api.put(`/properties/${property._id}`, form)
        toast('Property updated successfully')
      } else {
        await api.post('/properties', {
          ...form,
          floors: form.type === 'house' ? floors.filter((f) => f.name.trim()).map((f) => ({ name: f.name.trim(), code: f.code.trim() })) : [],
          apartments: form.type === 'apartment' ? [{ name: apartment.name || form.name, code: apartment.code, monthlyRent: apartment.monthlyRent }] : [],
        })
        toast('Property added successfully')
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
    <Modal open={open} onClose={onClose} title={edit ? 'Edit Property' : 'Add New Property'}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Property Name *</label>
            <input className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">Code</label>
            <input className="input" dir="ltr" value={form.code} onChange={set('code')} />
          </div>
        </div>

        {!edit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Property Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: 'house' }))}
                  className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${form.type === 'house' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <Home size={16} /> Full House
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: 'apartment' }))}
                  className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${form.type === 'apartment' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <Building size={16} /> Apartment
                </button>
              </div>
            </div>
            <div>
              <label className="label">Housing Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: '', l: 'Mixed' },
                  { v: 'male', l: 'Male' },
                  { v: 'female', l: 'Female' },
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
              <label className="label">Housing Type</label>
              <select className="input" value={form.gender} onChange={set('gender')}>
                <option value="">Mixed</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        )}

        {!edit && form.type === 'house' && (
          <div>
            <label className="label">Floors</label>
            <div className="space-y-2">
              {floors.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" placeholder={`Floor name ${i + 1} *`} value={f.name} onChange={(e) => setFloors((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input className="input !w-28" dir="ltr" placeholder="Code" value={f.code} onChange={(e) => setFloors((arr) => arr.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} />
                  <button className="btn-ghost text-red-600" onClick={() => setFloors((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-outline !py-1.5 text-xs mt-2" onClick={() => setFloors((arr) => [...arr, { name: '', code: '' }])}>
              <Plus size={14} /> Add Floor
            </button>
          </div>
        )}

        {!edit && form.type === 'apartment' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Apartment Name</label>
              <input className="input" value={apartment.name} onChange={(e) => setApartment((a) => ({ ...a, name: e.target.value }))} placeholder={form.name} />
            </div>
            <div>
              <label className="label">Apartment Code</label>
              <input className="input" dir="ltr" value={apartment.code} onChange={(e) => setApartment((a) => ({ ...a, code: e.target.value }))} />
            </div>
            <div>
              <label className="label">Default Rent</label>
              <input className="input" type="number" dir="ltr" value={apartment.monthlyRent} onChange={(e) => setApartment((a) => ({ ...a, monthlyRent: e.target.value }))} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={set('address')} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={set('notes')} />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : edit ? 'Save Changes' : 'Add Property'}
        </button>
      </div>
    </Modal>
  )
}