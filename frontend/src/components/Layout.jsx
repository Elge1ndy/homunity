import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  BedSingle,
  Wallet,
  FileText,
  BarChart3,
  Building2,
  Archive,
  Bell,
  ListOrdered,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Home,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api'
import { getSocket } from '../socket'

const NAV = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, perm: null },
  { to: '/students', label: 'الطلاب', icon: Users, perm: 'students' },
  { to: '/rooms', label: 'الغرف', icon: DoorOpen, perm: 'rooms' },
  { to: '/beds', label: 'الأسرة', icon: BedSingle, perm: 'beds' },
  { to: '/payments', label: 'المدفوعات', icon: Wallet, perm: 'payments' },
  { to: '/invoices', label: 'الفواتير', icon: FileText, perm: 'invoices' },
  { to: '/reports', label: 'التقارير', icon: BarChart3, perm: 'reports' },
  { to: '/housing', label: 'السكن', icon: Building2, perm: 'settings' },
  { to: '/archived', label: 'الأرشيف', icon: Archive, perm: 'students' },
  { to: '/notifications', label: 'الإشعارات', icon: Bell, perm: null },
  { to: '/activity', label: 'سجل النشاط', icon: ListOrdered, perm: null },
  { to: '/settings', label: 'الإعدادات', icon: SettingsIcon, perm: 'settings' },
]

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])

  const load = () => {
    api.get('/notifications').then((r) => {
      setItems(r.data.notifications.slice(0, 6))
      setUnread(r.data.notifications.filter((n) => !n.read).length)
    })
  }

  useEffect(() => {
    load()
    const socket = getSocket()
    if (socket) {
      socket.on('data:refresh', load)
      socket.on('payment:updated', load)
      socket.on('student:added', load)
    }
    return () => {
      if (socket) {
        socket.off('data:refresh', load)
        socket.off('payment:updated', load)
        socket.off('student:added', load)
      }
    }
  }, [])

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -start-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-700">الإشعارات</span>
              <NavLink to="/notifications" className="text-xs text-primary-700 font-semibold" onClick={() => setOpen(false)}>
                عرض الكل
              </NavLink>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 && <p className="p-4 text-sm text-slate-400 text-center">لا توجد إشعارات</p>}
              {items.map((n) => (
                <div key={n._id} className={`px-4 py-3 border-b border-slate-50 ${n.read ? '' : 'bg-primary-50/50'}`}>
                  <p className="text-sm font-bold text-slate-700">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const pageTitle = NAV.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))?.label || 'Homunity'
  const perms = user?.permissions || {}

  return (
    <div className="min-h-screen flex">
      <aside
        className={`fixed inset-y-0 start-0 z-40 w-64 bg-primary-900 text-white flex flex-col transform transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:rtl:translate-x-0'}`}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
          <div className="p-2 rounded-lg bg-white/10">
            <Home size={20} />
          </div>
          <div>
            <p className="font-extrabold leading-none">HOMUNITY</p>
            <p className="text-[11px] text-primary-200">إدارة السكن الطلابي</p>
          </div>
          <button className="lg:hidden ms-auto text-white/70" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {NAV.filter((n) => !n.perm || perms[n.perm] !== false).map((item) => {
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  active ? 'bg-white/15 text-white' : 'text-primary-100 hover:bg-white/10'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-white/10 text-sm font-bold">{user?.name?.slice(0, 1)}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{user?.name}</p>
              <p className="text-[11px] text-primary-200">{user?.username}</p>
            </div>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 lg:ms-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 flex items-center gap-3 px-4 lg:px-8">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <h1 className="font-extrabold text-lg text-slate-800">{pageTitle}</h1>
          <div className="ms-auto flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="p-2 rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-1.5 text-sm font-semibold"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
