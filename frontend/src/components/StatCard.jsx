const ACCENTS = {
  teal: 'text-primary-700 bg-primary-50',
  blue: 'text-blue-700 bg-blue-50',
  amber: 'text-amber-700 bg-amber-50',
  red: 'text-red-700 bg-red-50',
  slate: 'text-slate-700 bg-slate-50',
}

export default function StatCard({ icon: Icon, label, value, sub, accent = 'teal' }) {
  return (
    <div className="card p-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className="text-2xl font-extrabold text-slate-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${ACCENTS[accent]}`}>
        <Icon size={22} />
      </div>
    </div>
  )
}
