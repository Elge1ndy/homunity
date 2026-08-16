export default function Logo({ size = 22, tagline = true }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-teal-500 text-white shadow-lg shadow-primary-900/40">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.8 12 3.5l9 7.3" />
          <path d="M5.2 9.6V20.5h13.6V9.6" />
          <rect x="10" y="13.5" width="4" height="7" />
        </svg>
      </div>
      <div>
        <p className="font-extrabold leading-none text-white text-lg" dir="ltr">Homeunity</p>
        {tagline && <p className="text-[10px] text-slate-400 mt-1 font-semibold">Student Housing Management</p>}
      </div>
    </div>
  )
}