import { useState, useEffect } from 'react'
import api from '../api'
import Spinner from './Spinner.jsx'

export default function LicenseModal({ onActivated }) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    api.get('/license/status').then((r) => {
      if (r.data.licensed) {
        onActivated()
      } else {
        setChecking(false)
      }
    }).catch(() => setChecking(false))
  }, [])

  const activate = async () => {
    if (!key.trim()) {
      setError('Please enter a license key')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/license/activate', { key: key.trim() })
      onActivated()
    } catch (e) {
      setError(e.response?.data?.message || 'Invalid license key')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">Homeunity</h1>
          <p className="text-slate-500 mt-2">Student Housing Management</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">License Key</label>
            <input
              className="input text-center font-mono text-lg tracking-wider"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="HOMEUNITY-XXXX-XXXX-XXXX-XXXX"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <button
            className="btn-primary w-full"
            onClick={activate}
            disabled={loading}
          >
            {loading ? <Spinner /> : 'Activate License'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Enter your license key to activate the software.
          </p>
        </div>
      </div>
    </div>
  )
}
