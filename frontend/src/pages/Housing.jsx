import { useEffect, useState, useRef } from 'react'
import { Save, Upload, UploadCloud, X, Building2, Trash2 } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Spinner from '../components/Spinner.jsx'

export default function Housing() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data, loading, refetch } = useApi('/housing')
  const [form, setForm] = useState({})
  const [servicesText, setServicesText] = useState('')
  const [rulesText, setRulesText] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logoUp, setLogoUp] = useState(false)
  const fileRef = useRef(null)
  const logoRef = useRef(null)

  const canEdit = user?.permissions?.settings !== false
  const housing = data?.housing

  useEffect(() => {
    if (!housing) return
    setForm({
      name: housing.name || '',
      address: housing.address || '',
      phone: housing.phone || '',
      description: housing.description || '',
      dueDay: housing.dueDay || 1,
      currency: housing.currency || 'EGP',
      watermark: housing.watermark || '',
    })
    setServicesText((housing.services || []).join(', '))
    setRulesText((housing.rules || []).join(', '))
  }, [housing])

  useRealtime(refetch, ['housing:updated'])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/housing', {
        ...form,
        services: servicesText.split(',').map((s) => s.trim()).filter(Boolean),
        rules: rulesText.split(',').map((s) => s.trim()).filter(Boolean),
      })
      toast('Housing details saved')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const upload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('images', f))
      await api.post('/housing/images', fd)
      toast('Images uploaded')
      refetch()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = async (url) => {
    try {
      await api.post('/housing/images/remove', { url })
      toast('Image removed')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoUp(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      await api.post('/housing/logo', fd)
      toast('Logo updated')
      refetch()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setLogoUp(false)
    }
  }

  const removeLogo = async () => {
    try {
      await api.put('/housing', { logo: '' })
      toast('Logo removed')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  if (loading) return <Spinner full />

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} className="text-primary-700" />
          <h2 className="font-extrabold text-slate-800">Housing Details</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Housing Name *</label>
            <input className="input" value={form.name} onChange={set('name')} disabled={!canEdit} />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" dir="ltr" value={form.phone} onChange={set('phone')} disabled={!canEdit} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={set('address')} disabled={!canEdit} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea className="input min-h-[90px]" value={form.description} onChange={set('description')} disabled={!canEdit} />
          </div>
          <div>
            <label className="label">Payment Due Day</label>
            <input className="input" type="number" min="1" max="28" value={form.dueDay} onChange={set('dueDay')} disabled={!canEdit} />
          </div>
          <div>
            <label className="label">Currency</label>
            <input className="input" dir="ltr" value={form.currency} onChange={set('currency')} disabled={!canEdit} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Watermark Name</label>
            <input className="input" value={form.watermark} onChange={set('watermark')} placeholder="Type your name here to appear on the login page, sidebar, and invoices" disabled={!canEdit} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Services (comma-separated)</label>
            <input className="input" value={servicesText} onChange={(e) => setServicesText(e.target.value)} placeholder="Wi-Fi, electricity, water" disabled={!canEdit} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Housing Rules (comma-separated)</label>
            <textarea className="input min-h-[70px]" value={rulesText} onChange={(e) => setRulesText(e.target.value)} placeholder="Maintain quiet after 11 PM" disabled={!canEdit} />
          </div>
        </div>
        {canEdit && (
          <div className="flex justify-end mt-6">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : <><Save size={16} /> Save</>}
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <UploadCloud size={18} className="text-primary-700" />
          <h2 className="font-extrabold text-slate-800">Application Logo</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {housing?.logo ? (
            <img src={housing.logo} alt="Logo" className="h-20 w-20 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs font-bold">
              No logo
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Appears on the sidebar, login page, and in PDF invoice and report headers</p>
            {canEdit && (
              <div className="flex gap-2 mt-2">
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                <button className="btn-outline" onClick={() => logoRef.current?.click()} disabled={logoUp}>
                  {logoUp ? <Spinner /> : <><Upload size={15} /> Upload Logo</>}
                </button>
                {housing?.logo && (
                  <button className="btn-outline border-red-200 text-red-600 hover:bg-red-50" onClick={removeLogo}>
                    <Trash2 size={15} /> Remove
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-slate-800">Housing Images</h2>
          {canEdit && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
              <button className="btn-outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Spinner /> : <><Upload size={16} /> Upload Images</>}
              </button>
            </>
          )}
        </div>
        {!housing?.images?.length ? (
          <p className="text-sm text-slate-400 text-center py-8">No images yet</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {housing.images.map((url) => (
              <div key={url} className="relative group rounded-xl overflow-hidden border border-slate-200">
                <img src={url} alt="Housing" className="w-full h-32 object-cover" />
                {canEdit && (
                  <button
                    onClick={() => removeImage(url)}
                    className="absolute top-2 end-2 p-1.5 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
