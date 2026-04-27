const TABS = [
  { id: 'oben', icon: '\uD83C\uDFE0', label: 'Oben' },
  { id: 'unten', icon: '\uD83D\uDECF', label: 'Unten' },
  { id: 'infos', icon: '\uD83D\uDCCA', label: 'Infos' },
  { id: 'familie', icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', label: 'Familie' },
]

export function TabBar({ active, onChange, badges = {} }) {
  return (
    <div className="bg-bg/[0.97] border-b border-border px-3 sm:px-5 pt-3 pb-2 backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
      <div className="flex gap-1 sm:gap-2.5 p-1.5 rounded-2xl bg-surface/60 border border-border max-w-[700px] mx-auto overflow-visible">
        {TABS.map(t => {
          const badge = badges[t.id] || 0
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative flex-1 flex items-center justify-center gap-2 sm:gap-3 px-2 sm:px-5 py-4 sm:py-4 rounded-xl border-none cursor-pointer text-[20px] sm:text-[22px] font-sans tracking-wide transition-all ${
                active === t.id
                  ? 'bg-amber/[0.15] text-amber font-semibold shadow-[0_1px_4px_rgba(217,119,6,0.2)]'
                  : 'bg-transparent text-text-muted hover:text-text-primary hover:bg-surface'
              }`}
            >
              <span className="hidden sm:inline text-2xl">{t.icon}</span>
              <span>{t.label}</span>
              {badge > 0 && active !== t.id && (
                <span className="absolute -top-1.5 -right-0.5 min-w-[20px] h-[20px] px-0.5 flex items-center justify-center rounded-full bg-amber text-[11px] font-bold font-mono text-bg leading-none">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
