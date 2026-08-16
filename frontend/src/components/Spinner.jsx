import { Loader2, Inbox } from 'lucide-react'

export default function Spinner({ full }) {
  if (full) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    )
  }
  return <Loader2 className="animate-spin text-primary-600" size={22} />
}

export function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-400">
      <Inbox size={40} className="mb-3" />
      <p className="text-sm">{message || 'No data'}</p>
    </div>
  )
}
