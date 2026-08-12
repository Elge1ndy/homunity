import { io } from 'socket.io-client'
import { useEffect, useRef } from 'react'
import { useToast } from './context/ToastContext'

let socket = null

export function connectSocket(token) {
  if (socket) return socket
  const url = import.meta.env.VITE_SOCKET_URL || (location.port === '5173' ? 'http://localhost:5000' : undefined)
  socket = io(url, { auth: { token } })
  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function useRealtime(refetch, events = [], { silent } = {}) {
  const { toast } = useToast()
  const ref = useRef(refetch)
  ref.current = refetch
  useEffect(() => {
    if (!socket) return
    const handler = () => {
      if (typeof ref.current === 'function') ref.current()
      if (!silent) toast('تم تحديث البيانات فورًا', 'info')
    }
    events.forEach((ev) => socket.on(ev, handler))
    return () => events.forEach((ev) => socket.off(ev, handler))
  }, [JSON.stringify(events)])
}
