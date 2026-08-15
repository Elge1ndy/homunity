const BASE = '/api'

function getToken() {
  return localStorage.getItem('homunity_token')
}

async function request(method, url, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const opts = { method, headers }
  if (body !== undefined) {
    if (body instanceof FormData) {
      delete headers['Content-Type']
      opts.body = body
    } else {
      opts.body = JSON.stringify(body)
    }
  }

  const res = await fetch(`${BASE}${url}`, opts)
  let data
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    data = await res.json()
  } else {
    data = await res.text()
  }

  if (!res.ok) {
    if (res.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('homunity_token')
      window.location.href = '/login'
    }
    const err = new Error(data?.message || 'حدث خطأ')
    err.response = { status: res.status, data }
    throw err
  }

  return { data }
}

const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  delete: (url) => request('DELETE', url),
}

export default api
