import { useEffect, useState } from 'react'
import { RefreshCw, Download } from 'lucide-react'

export default function PWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let updateHandler = null
    let stateHandler = null
    let controllerHandler = null
    let reg = null

    navigator.serviceWorker.ready.then((registration) => {
      reg = registration
      updateHandler = () => {
        const newWorker = reg.installing
        if (!newWorker) return
        stateHandler = () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        }
        newWorker.addEventListener('statechange', stateHandler)
      }
      reg.addEventListener('updatefound', updateHandler)
    })

    controllerHandler = () => { window.location.reload() }
    navigator.serviceWorker.addEventListener('controllerchange', controllerHandler)

    return () => {
      if (reg && updateHandler) reg.removeEventListener('updatefound', updateHandler)
      if (controllerHandler) navigator.serviceWorker.removeEventListener('controllerchange', controllerHandler)
    }
  }, [])

  const handleUpdate = () => {
    if (!registration?.waiting) return
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-20 inset-x-0 z-50 flex justify-center px-4" style={{ animation: 'slideUp .4s ease' }}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
      `}</style>
      <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl max-w-sm">
        <Download size={20} className="text-primary-400 flex-shrink-0" />
        <p className="text-sm font-semibold flex-1">تحديث جديد متاح</p>
        <button
          onClick={handleUpdate}
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
        >
          <RefreshCw size={13} /> تحديث
        </button>
      </div>
    </div>
  )
}