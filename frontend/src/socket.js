import { useEffect } from 'react'
import { io } from 'socket.io-client'

let socket = null
const subs = new Map()

function bindAll() {
  subs.forEach((fns, event) => fns.forEach((fn) => socket.on(event, fn)))
}

export function connectSocket(token) {
  if (!token || socket) return
  const url = import.meta.env.DEV ? 'http://localhost:5000' : undefined
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
  })
  socket.on('connect', bindAll)
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (!socket) return
  socket.disconnect()
  socket = null
}

export function useRealtime(fn, events) {
  useEffect(() => {
    events.forEach((event) => {
      if (!subs.has(event)) subs.set(event, new Set())
      subs.get(event).add(fn)
    })
    if (socket) events.forEach((event) => socket.on(event, fn))
    return () => {
      events.forEach((event) => {
        const fns = subs.get(event)
        if (fns) {
          fns.delete(fn)
          if (fns.size === 0) subs.delete(event)
        }
        if (socket) socket.off(event, fn)
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}