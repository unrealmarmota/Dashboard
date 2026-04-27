import { useState, useEffect } from 'react'
import { Card, Label, InfoModal } from '../atoms'
import { useCountdowns } from '../hooks/useCountdowns'

const EMOJIS = ['\uD83C\uDF89', '\u2708\uFE0F', '\uD83C\uDFD6\uFE0F', '\uD83C\uDF82', '\uD83C\uDF84', '\uD83C\uDFD5\uFE0F', '\uD83C\uDFAD', '\uD83D\uDE02', '\u2B50', '\uD83C\uDF0A']

const fmtDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

function DaysBadge({ days }) {
  if (days === 0) return <span className="text-amber font-mono font-bold text-sm">Heute!</span>
  if (days === 1) return <span className="text-amber font-mono font-bold text-sm">Morgen!</span>
  return (
    <div className="text-right">
      <div className={`text-xl font-bold font-mono leading-none ${days <= 14 ? 'text-amber' : 'text-teal'}`}>{days}</div>
      <div className="text-[10px] text-text-muted font-mono">Tage</div>
    </div>
  )
}

export function CountdownCard() {
  const { getAll, add, remove } = useCountdowns()
  const [tick, setTick] = useState(0)

  // Re-render taeglich damit Tage aktuell bleiben
  useEffect(() => {
    const now = new Date()
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now
    const t = setTimeout(() => setTick(n => n + 1), msUntilMidnight)
    return () => clearTimeout(t)
  }, [])

  const [open,     setOpen]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [label,    setLabel]    = useState('')
  const [date,     setDate]     = useState('')
  const [emoji,    setEmoji]    = useState('\uD83C\uDF89')

  const countdowns = getAll()
  const upcoming   = countdowns.filter(c => c.daysLeft >= 0)

  const handleAdd = () => {
    if (!label.trim() || !date) return
    add(label.trim(), date, emoji)
    setLabel(''); setDate(''); setEmoji('\uD83C\uDF89'); setShowForm(false)
    setTick(n => n + 1)
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <Label>{'\u23F3'} Countdown</Label>
          <button onClick={() => { setOpen(true); setShowForm(false) }}
            className="text-[11px] font-mono text-text-muted hover:text-teal cursor-pointer transition-colors border border-border rounded px-2 py-0.5">
            Bearbeiten
          </button>
        </div>

        {upcoming.length === 0 ? (
          <div className="text-text-muted text-sm font-mono text-center py-6">
            <div className="text-2xl mb-2">{'\uD83D\uDCC5'}</div>
            {`Keine Ereignisse \u2014 `}
            <button onClick={() => { setOpen(true); setShowForm(true) }}
              className="text-teal cursor-pointer underline-offset-2 underline">
              {`hinzuf\u00FCgen`}
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {upcoming.slice(0, 3).map((c, i) => (
              <div key={c.id}
                className={`flex items-center gap-3 py-2.5 ${i < Math.min(upcoming.length, 3) - 1 ? 'border-b border-border' : ''}`}>
                <span className="text-2xl w-8 text-center">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary font-mono truncate">{c.label}</div>
                  <div className="text-[11px] text-text-muted">{fmtDate(c.date)}</div>
                </div>
                <DaysBadge days={c.daysLeft} />
              </div>
            ))}
            {upcoming.length > 3 && (
              <button onClick={() => setOpen(true)}
                className="text-[11px] text-text-muted font-mono text-center pt-2 cursor-pointer hover:text-teal transition-colors">
                +{upcoming.length - 3} weitere anzeigen
              </button>
            )}
          </div>
        )}
      </Card>

      {open && (
        <InfoModal onClose={() => { setOpen(false); setShowForm(false) }} wide>
          <div className="pt-2">
            <div className="text-center mb-4">
              <div className="text-2xl mb-1">{'\u23F3'}</div>
              <div className="text-base font-semibold text-text-primary font-mono">Countdown</div>
            </div>

            <div className="flex flex-col gap-2 mb-3">
              {upcoming.length === 0 && (
                <div className="text-text-muted text-sm font-mono text-center py-4">Noch keine Ereignisse</div>
              )}
              {upcoming.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary font-mono font-semibold">{c.label}</div>
                    <div className="text-[11px] text-text-muted">{fmtDate(c.date)}</div>
                  </div>
                  <DaysBadge days={c.daysLeft} />
                  <button onClick={() => { remove(c.id); setTick(n => n + 1) }}
                    className="text-text-muted hover:text-red text-xl cursor-pointer transition-colors ml-1 leading-none">
                    {'\u00D7'}
                  </button>
                </div>
              ))}
            </div>

            {/* Add-Form als direktes JSX – KEIN Sub-Komponente (wuerde bei Re-render unmounten) */}
            {showForm ? (
              <div className="p-3 rounded-lg bg-surface border border-teal/30 flex flex-col gap-3 mt-1">
                <div className="text-[12px] font-mono text-text-muted">Neues Ereignis</div>
                <div className="flex gap-2 flex-wrap">
                  {EMOJIS.map(em => (
                    <button key={em} onClick={() => setEmoji(em)}
                      className={`text-xl cursor-pointer rounded p-1 transition-colors ${emoji === em ? 'bg-teal/20 ring-1 ring-teal' : ''}`}>
                      {em}
                    </button>
                  ))}
                </div>
                <input
                  value={label}
                  onChange={ev => setLabel(ev.target.value)}
                  placeholder={`Bezeichnung (z.B. Urlaub)`}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-teal"
                  onKeyDown={ev => ev.key === 'Enter' && handleAdd()}
                />
                <input
                  type="date"
                  value={date}
                  onChange={ev => setDate(ev.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-teal"
                />
                <div className="flex gap-2">
                  <button onClick={handleAdd}
                    className="flex-1 py-2 rounded-lg bg-teal/10 border border-teal text-teal text-sm font-mono cursor-pointer hover:bg-teal/20 transition-colors">
                    {`Hinzuf\u00FCgen`}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-lg border border-border text-text-muted text-sm font-mono cursor-pointer hover:border-text-muted transition-colors">
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)}
                className="w-full py-2 rounded-lg border border-border text-text-muted text-sm font-mono cursor-pointer hover:border-teal hover:text-teal transition-colors">
                {`+ Ereignis hinzuf\u00FCgen`}
              </button>
            )}
          </div>
        </InfoModal>
      )}
    </>
  )
}
