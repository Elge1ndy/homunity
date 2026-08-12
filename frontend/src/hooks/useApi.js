import { useState, useEffect, useCallback } from 'react'
import api from '../api'

export function useApi(path, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(path)
      setData(data)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    load()
  }, [load, ...deps])

  return { data, loading, error, refetch: load }
}

export function errMsg(e) {
  return (e.response && e.response.data && e.response.data.message) || 'حدث خطأ غير متوقع'
}
