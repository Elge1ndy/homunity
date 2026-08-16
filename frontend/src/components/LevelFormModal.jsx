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
      toast(kind === 'floor' ? 'Floor name is required' : 'Apartment name is required', 'warn')
      return
    }
    setSaving(true)
    try {
      if (kind === 'floor') {
        if (edit) await api.put(`/properties/${propertyId}/floors/${item._id}`, form)
        else await api.post(`/properties/${propertyId}/floors`, form)
        toast(edit ? 'Floor updated' : 'Floor added')
      } else {
        if (edit) await api.put(`/properties/${propertyId}/apartments/${item._id}`, form)
        else await api.post(`/properties/${propertyId}/apartments`, form)
        toast(edit ? 'Apartment updated' : 'Apartment added')
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
    <Modal open={open} onClose={onClose} title={edit ? `Edit ${kind === 'floor' ? 'Floor' : 'Apartment'}` : `Add ${kind === 'floor' ? 'Floor' : 'Apartment'}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{kind === 'floor' ? 'Floor Name' : 'Apartment Name'} *</label>
            <input className="input" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">Code</label>
            <input className="input" dir="ltr" value={form.code} onChange={set('code')} />
          </div>
          {kind === 'apartment' && (
            <>
              <div>
                <label className="label">Default Rent (used when adding a room)</label>
                <input className="input" type="number" dir="ltr" value={form.monthlyRent} onChange={set('monthlyRent')} />
              </div>
              {floors?.length > 0 && (
                <div>
                  <label className="label">Floor</label>
                  <select className="input" value={form.floorId} onChange={set('floorId')}>
                    <option value="">No Floor</option>
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
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner /> : edit ? 'Save Changes' : 'Add'}
        </button>
      </div>
    </Modal>
  )
}