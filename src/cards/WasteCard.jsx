import { useHA } from '../context/HAContext'
import { Card, Label } from '../atoms'
import { v, a } from '../config'

// Strip waste type prefix, keep only "in X Tagen" / "Heute" / "Morgen"
function extractDays(stateStr) {
  if (!stateStr || stateStr === '\u2013') return '\u2013'
  const match = stateStr.match(/in (\d+) tagen?/i)
  if (match) {
    const n = parseInt(match[1])
    if (n === 0) return 'Heute'
    if (n === 1) return 'Morgen'
    return `in ${n} Tagen`
  }
  return stateStr
}

// Find next pickup from sensor.nachste_abholung schedule attributes
function nextFromSchedule(entities, keyword) {
  const attrs = entities?.['sensor.nachste_abholung']?.attributes
  if (!attrs) return '\u2013'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dates = Object.keys(attrs)
    .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .filter(k => (attrs[k] || '').toLowerCase().includes(keyword.toLowerCase()))
    .sort()
  for (const d of dates) {
    const date = new Date(d + 'T00:00:00')
    const diff = Math.round((date - today) / 86400000)
    if (diff >= 0) {
      if (diff === 0) return 'Heute'
      if (diff === 1) return 'Morgen'
      return `in ${diff} Tagen`
    }
  }
  return '\u2013'
}

function Dot({ color }) {
  return <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
}

export function WasteCard({ compact = false }) {
  const { entities } = useHA()
  const items = [
    { color: '#92400e', label: 'Biomüll',      text: extractDays(v(entities, 'sensor.biotonne')) },
    { color: '#d1d5db', label: 'Restmüll',     text: nextFromSchedule(entities, 'restmüll') },
    { color: '#3b82f6', label: 'Papiertonne',  text: extractDays(v(entities, 'sensor.papiertonne_container')) },
    { color: '#facc15', label: 'Gelbe Tonne',  text: nextFromSchedule(entities, 'gelbe tonne') },
  ]

  if (compact) {
    return (
      <Card>
        <Label>Müllabfuhr</Label>
        <div className="flex flex-col gap-1.5">
          {items.map((t, i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 px-2 rounded-lg bg-surface">
              <Dot color={t.color} />
              <span className="text-[11px] text-text-muted font-mono w-20 shrink-0">{t.label}</span>
              <span className="text-xs text-text-primary font-mono truncate">{t.text}</span>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <Label>Müllabfuhr {'\u00B7'} Nächste Leerung</Label>
      {items.map((t, i) => (
        <div key={i} className={`flex gap-2.5 items-center py-2 ${i < items.length - 1 ? 'border-b border-border' : ''}`}>
          <Dot color={t.color} />
          <span className="text-sm text-text-muted w-24 shrink-0">{t.label}</span>
          <div className="text-[15px] text-text-primary">{t.text}</div>
        </div>
      ))}
    </Card>
  )
}
