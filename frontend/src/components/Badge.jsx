export default function Badge({ label, cls }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cls || 'bg-slate-100 text-slate-600'}`}>{label}</span>
}
