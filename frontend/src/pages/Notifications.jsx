import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import api from '../api'
import { useApi, errMsg } from '../hooks/useApi.js'
import { useRealtime } from '../socket.js'
import { useToast } from '../context/ToastContext.jsx'
import Spinner, { EmptyState } from '../components/Spinner.jsx'
import Badge from '../components/Badge.jsx'
import { fmtDateTime } from '../utils/format.js'

const TYPE_LABEL = {
  payment: 'دفعة',
  invoice: 'فاتورة',
  contract: 'عقد',
  student: 'طالب',
  system: 'النظام',
}

export default function Notifications() {
  const { toast } = useToast()
  const { data, loading, refetch } = useApi('/notifications')

  useRealtime(refetch, ['notification:read', 'data:refresh', 'payment:updated', 'student:added', 'invoice:created'])

  const markRead = async (n) => {
    if (n.read) return
    try {
      await api.post(`/notifications/read/${n._id}`)
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all')
      toast('تم تحديد الكل كمقروء')
      refetch()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const notifications = data?.notifications || []
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {notifications.length} إشعار{unread > 0 && <span className="text-red-600 font-bold"> — {unread} غير مقروء</span>}
        </p>
        {unread > 0 && (
          <button className="btn-outline" onClick={markAll}>
            <CheckCheck size={16} /> تحديد الكل كمقروء
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Spinner full />
        ) : !notifications.length ? (
          <EmptyState message="لا توجد إشعارات" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => markRead(n)}
                  className={`w-full text-start px-5 py-4 flex items-start gap-3 transition-colors ${n.read ? 'hover:bg-slate-50' : 'bg-primary-50/50 hover:bg-primary-50'}`}
                >
                  <div className={`p-2.5 rounded-full shrink-0 ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-primary-100 text-primary-700'}`}>
                    <Bell size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm ${n.read ? 'font-semibold text-slate-600' : 'font-extrabold text-slate-800'}`}>{n.title}</p>
                      {!n.read && <Badge label="جديد" cls="bg-primary-100 text-primary-700" />}
                      {n.type && TYPE_LABEL[n.type] && <Badge label={TYPE_LABEL[n.type]} cls="bg-slate-100 text-slate-600" />}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{fmtDateTime(n.createdAt)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
