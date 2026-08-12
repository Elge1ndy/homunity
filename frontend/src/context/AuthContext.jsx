import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api'
import { connectSocket, disconnectSocket } from '../socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('homunity_token')
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then((r) => {
        setUser(r.data.user)
        connectSocket(token)
      })
      .catch(() => {
        localStorage.removeItem('homunity_token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (identifier, password) => {
    const { data } = await api.post('/auth/login', { identifier, password })
    localStorage.setItem('homunity_token', data.token)
    setUser(data.user)
    connectSocket(data.token)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('homunity_token')
    disconnectSocket()
    setUser(null)
  }

  const setUserInfo = (u) => setUser(u)

  return <AuthContext.Provider value={{ user, loading, login, logout, setUserInfo }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
