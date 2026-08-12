import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, KeyRound, User, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Spinner from '../components/Spinner.jsx'
import { errMsg } from '../hooks/useApi.js'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(identifier, password)
      navigate('/')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-800 via-primary-700 to-teal-600 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-white/10 mb-4">
            <Home size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">HOMUNITY</h1>
          <p className="text-primary-100 mt-2">نظام إدارة السكن الطلابي</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-extrabold text-slate-800 mb-6">تسجيل الدخول</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">اسم المستخدم أو رقم الهاتف</label>
              <div className="relative">
                <User size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input ps-9" dir="ltr" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="admin" />
              </div>
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <KeyRound size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input ps-9" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
            <button className="btn-primary w-full py-2.5" disabled={loading || !identifier || !password}>
              {loading ? <Spinner /> : 'دخول'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-primary-100 mt-4">
          الحساب الافتراضي: <span className="font-mono font-bold">admin</span> / <span className="font-mono font-bold">admin123</span>
        </p>
      </div>
    </div>
  )
}
