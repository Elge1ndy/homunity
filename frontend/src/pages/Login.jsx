import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, User, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Spinner from '../components/Spinner.jsx'
import { errMsg } from '../hooks/useApi.js'
import Logo from '../components/Logo.jsx'
import api from '../api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [watermark, setWatermark] = useState('')
  const [logo, setLogo] = useState('')

  useEffect(() => {
    api.get('/public/housing').then((r) => {
      setWatermark(r.data.housing?.watermark || '')
      setLogo(r.data.housing?.logo || '')
    }).catch(() => {})
  }, [])

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
    <>
      <style>{`
        @keyframes h-blob1 { 50% { transform: translate(40px, 30px) scale(1.15); } }
        @keyframes h-blob2 { 50% { transform: translate(-50px, -20px) scale(1.2); } }
        @keyframes h-blob3 { 50% { transform: translate(20px, -40px) scale(1.1); } }
        @keyframes h-float { 50% { transform: translateY(-8px) rotate(2deg); } }
        @keyframes h-rise { from { opacity: 0; transform: translateY(26px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes h-shake { 20%, 60% { transform: translateX(-7px); } 40%, 80% { transform: translateX(7px); } }
        @keyframes h-pulse-glow { 50% { box-shadow: 0 0 0 9px rgba(20,184,166,.12); } }
        .h-blob { position: absolute; border-radius: 50%; filter: blur(70px); will-change: transform; }
        .h-card { animation: h-rise .6s cubic-bezier(.2,.8,.3,1) both; }
        .h-logo { animation: h-float 3.6s ease-in-out infinite; }
        .h-error { animation: h-shake .4s ease both; }
        .h-input { transition: box-shadow .2s ease, border-color .2s ease, transform .2s ease; }
        .h-input:focus { box-shadow: 0 0 0 4px rgba(20,184,166,.15); transform: translateY(-1px); }
        .h-submit { background: linear-gradient(135deg, #0d9488, #14b8a6); transition: transform .18s ease, box-shadow .18s ease, filter .18s; }
        .h-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 30px -8px rgba(20,184,166,.55); filter: brightness(1.05); }
        .h-submit:active:not(:disabled) { transform: scale(.97); }
        .h-glow { animation: h-pulse-glow 2.6s ease-in-out infinite; transition: transform .2s; }
        .h-glow:hover { transform: scale(1.05); }
        .h-brand { text-align: center; margin-bottom: 28px; }
        .h-brand-ring { display: inline-flex; padding: 5px; border-radius: 28px; background: linear-gradient(135deg, #14b8a6, #0ea5e9, #14b8a6); background-size: 200% 200%; animation: h-gradient 4s ease-in-out infinite; }
        @keyframes h-gradient { 50% { background-position: 100% 100%; } }
        .h-brand-inner { display: flex; align-items: center; justify-content: center; width: 110px; height: 110px; border-radius: 24px; background: linear-gradient(145deg, #0f172a, #1e293b); backdrop-filter: blur(12px); box-shadow: 0 20px 50px -10px rgba(0,0,0,.5); }
        .h-brand-name { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; margin-top: 14px; background: linear-gradient(135deg, #5eead4, #14b8a6, #0ea5e9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .h-brand-tag { font-size: 13px; color: #94a3b8; margin-top: 4px; font-weight: 600; }
      `}</style>

      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
        <div className="h-blob w-[26rem] h-[26rem] -top-40 -start-40 bg-primary-700/40" style={{ animation: 'h-blob1 9s ease-in-out infinite' }} />
        <div className="h-blob w-[30rem] h-[30rem] -bottom-44 -end-44 bg-teal-500/25" style={{ animation: 'h-blob2 11s ease-in-out infinite' }} />
        <div className="h-blob w-72 h-72 top-1/4 end-1/5 bg-emerald-400/15" style={{ animation: 'h-blob3 8s ease-in-out infinite' }} />

        <div className="relative w-full max-w-md">
          <div className="h-brand">
            <div className="h-brand-ring h-glow">
              <div className="h-brand-inner">
                {logo ? (
                  <img src={logo} alt="الشعار" className="w-20 h-20 object-contain drop-shadow-lg" />
                ) : (
                  <Logo size={44} tagline={false} />
                )}
              </div>
            </div>
            <h1 className="h-brand-name">Homeunity</h1>
            <p className="h-brand-tag">إدارة السكن الطلابي</p>
            {watermark && (
              <p className="mt-3 text-[11px] text-slate-500 tracking-wider select-none" style={{ opacity: 0.7 }}>
                {watermark}
              </p>
            )}
          </div>

          <div className="h-card card p-8 shadow-2xl">
            <h2 className="text-xl font-extrabold text-slate-800 mb-1">مرحبًا بك 👋</h2>
            <p className="text-sm text-slate-500 mb-6">سجّل دخولك لإدارة السكن</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">اسم المستخدم أو رقم الهاتف</label>
                <div className="relative">
                  <User size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input ps-9 h-input" dir="ltr" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="admin" autoFocus />
                </div>
              </div>
              <div>
                <label className="label">كلمة المرور</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input ps-9 pe-10 h-input" dir="ltr" type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-700 text-[11px] font-bold px-1">
                    {showPass ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="h-error flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              <button className="h-submit btn-primary w-full py-2.5" disabled={loading || !identifier || !password}>
                {loading ? (
                  <>
                    <Spinner /> جارٍ الدخول...
                  </>
                ) : (
                  'دخول'
                )}
              </button>
            </form>
          </div>

          <div className="h-card flex items-center justify-center gap-2 text-xs text-slate-500 mt-5" style={{ animationDelay: '.15s' }}>
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>
              احفظ بيانات الدخول في مكان آمن
            </span>
          </div>
        </div>
      </div>
    </>
  )
}