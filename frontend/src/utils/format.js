export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

export function monthLabel(month) {
  if (!month) return ''
  const [y, m] = String(month).split('-')
  return `${MONTHS_AR[Number(m) - 1] || m} ${y}`
}

export function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString('en-US')
}

export function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  if (isNaN(d.getTime())) return String(str).slice(0, 10)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function fmtDateTime(str) {
  if (!str) return '—'
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return `${fmtDate(str)} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function timeAgo(str) {
  if (!str) return ''
  const sec = Math.floor((Date.now() - new Date(str).getTime()) / 1000)
  if (sec < 60) return 'الآن'
  if (sec < 3600) return `منذ ${Math.floor(sec / 60)} دقيقة`
  if (sec < 86400) return `منذ ${Math.floor(sec / 3600)} ساعة`
  if (sec < 2592000) return `منذ ${Math.floor(sec / 86400)} يوم`
  return fmtDate(str)
}

export const paymentStatus = {
  paid: { label: 'مدفوع', cls: 'bg-emerald-100 text-emerald-700' },
  unpaid: { label: 'غير مدفوع', cls: 'bg-slate-100 text-slate-600' },
  overdue: { label: 'متأخر', cls: 'bg-red-100 text-red-700' },
}

export const studentStatus = {
  active: { label: 'نشط', cls: 'bg-emerald-100 text-emerald-700' },
  archived: { label: 'مؤرشف', cls: 'bg-amber-100 text-amber-700' },
  ended: { label: 'منتهي', cls: 'bg-slate-200 text-slate-600' },
}

export const invoiceStatus = {
  paid: { label: 'مدفوعة بالكامل', cls: 'bg-emerald-100 text-emerald-700' },
  partial: { label: 'مدفوعة جزئيًا', cls: 'bg-amber-100 text-amber-700' },
  unpaid: { label: 'غير مدفوعة', cls: 'bg-red-100 text-red-700' },
}

export function downloadFile(data, filename) {
  const url = window.URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadBlob(url, filename) {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('homunity_token') || '') } })
  if (!res.ok) throw new Error('فشل التحميل')
  const blob = await res.blob()
  downloadFile(blob, filename)
}
