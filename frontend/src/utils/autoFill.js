export function getAutoFill(key) {
  try {
    const raw = localStorage.getItem(`auto_${key}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setAutoFill(key, data) {
  try {
    localStorage.setItem(`auto_${key}`, JSON.stringify(data))
  } catch {}
}

export function clearAutoFill(key) {
  localStorage.removeItem(`auto_${key}`)
}