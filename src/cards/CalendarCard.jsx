import { useState } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, InfoModal } from '../atoms'
import { e } from '../config'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'

// ── Helpers ──────────────────────────────────────────────────────────

function groupByDay(events) {
  const groups = {}
  for (const ev of events) {
    const d = new Date(ev.start)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!groups[key]) groups[key] = { key, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), events: [] }
    groups[key].events.push(ev)
  }
  return Object.values(groups).sort((a, b) => a.date - b.date)
}

function dayLabel(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const str = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
  if (d.getTime() === today.getTime()) return `Heute \u00B7 ${str}`
  if (d.getTime() === tomorrow.getTime()) return `Morgen \u00B7 ${str}`
  return str
}

function fmtTime(ev) {
  if (ev.allDay) return 'Ganztaegig'
  const s = ev.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  if (!ev.end || ev.end.getTime() === ev.start.getTime()) return s
  const e = ev.end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${s}\u2013${e}`
}

// ── Event Row ────────────────────────────────────────────────────────

function EventRow({ ev, showEnd, showLocation }) {
  return (
    <div className="flex gap-2.5 items-start p-2 px-2.5 rounded-[9px] bg-surface mb-1.5"
      style={{ borderLeft: `3px solid ${ev.color}` }}>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-text-muted font-mono mb-0.5">
          {showEnd ? fmtTime(ev) : (ev.allDay ? 'Ganztaegig' : ev.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))}
        </div>
        <div className="text-[15px] text-text-primary truncate">{ev.summary || 'Kein Titel'}</div>
        {showLocation && ev.location && (
          <div className="text-[12px] text-text-muted font-mono mt-0.5 truncate">{ev.location}</div>
        )}
        {ev.calendar && (
          <div className="text-[11px] font-mono mt-0.5" style={{ color: ev.color }}>{ev.calendar}</div>
        )}
      </div>
    </div>
  )
}

// ── Modal (erweiterte Ansicht) ───────────────────────────────────────

function CalendarModal({ onClose, haEvents }) {
  const { events: gcalEvents } = useGoogleCalendar(14)
  const now = new Date()
  const all = [...haEvents, ...gcalEvents].filter(ev => {
    if (ev.allDay) return true
    const end = ev.end || ev.start
    return end >= now
  })
  const grouped = groupByDay(all)

  return (
    <InfoModal onClose={onClose} wide>
      <Label>Kalender</Label>
      <div className="text-[12px] text-text-muted font-mono mb-3">Naechste 14 Tage</div>
      <div className="flex gap-3 mb-3">
        <span className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-blue)' }} />
          Johannes
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-teal)' }} />
          Tanja
        </span>
      </div>
      {grouped.length > 0 ? grouped.map(group => (
        <div key={group.key}>
          <div className="text-[11px] tracking-[1.5px] text-text-muted font-mono mt-3 mb-1.5 uppercase">
            {dayLabel(group.date)}
          </div>
          {group.events.map((ev, i) => (
            <EventRow key={`${ev.uid || ''}-${i}`} ev={ev} showEnd showLocation />
          ))}
        </div>
      )) : (
        <div className="text-[15px] text-text-muted py-2">Keine Termine in den naechsten 14 Tagen</div>
      )}
    </InfoModal>
  )
}

// ── Haupt-Card ───────────────────────────────────────────────────────

export function CalendarCard() {
  const { entities } = useHA()
  const { events: gcalEvents, loading, error } = useGoogleCalendar(7)
  const [showModal, setShowModal] = useState(false)

  // HA-Events (Radarr) als einheitliches Format
  const haEvents = []
  const radarr = e(entities, 'calendar.radarr')
  if (radarr?.state === 'on' && radarr?.attributes?.message)
    haEvents.push({ start: new Date(), end: new Date(), allDay: true, summary: radarr.attributes.message, color: 'var(--color-amber)', uid: 'radarr', source: 'ha' })

  // Filter: vergangene Nicht-Ganztags-Termine ausblenden
  const now = new Date()
  const allEvents = [...haEvents, ...gcalEvents].filter(ev => {
    if (ev.allDay) return true
    // Endzeit nutzen falls vorhanden, sonst Startzeit
    const end = ev.end || ev.start
    return end >= now
  })
  const grouped = groupByDay(allEvents)

  // Kompakt: max 3 Tage anzeigen
  const compactGroups = grouped.slice(0, 3)
  const hasMore = grouped.length > 3 || gcalEvents.length > 6

  return (
    <>
      <Card className="cursor-pointer" onClick={() => setShowModal(true)}>
        <Label>Kalender</Label>

        {loading && !gcalEvents.length && !haEvents.length && (
          <div className="text-xs text-text-muted font-mono py-2">Lade Kalender...</div>
        )}

        {error && !gcalEvents.length && (
          <div className="flex items-center gap-2 p-2 rounded-lg mb-1.5" style={{ background: 'var(--color-red)', opacity: 0.12 }}>
            <span className="text-[12px] font-mono" style={{ color: 'var(--color-red)' }}>Kalender nicht erreichbar</span>
          </div>
        )}

        {compactGroups.length > 0 ? compactGroups.map(group => (
          <div key={group.key}>
            <div className="text-[11px] tracking-[1.5px] text-text-muted font-mono mt-2.5 mb-1 uppercase first:mt-0">
              {dayLabel(group.date)}
            </div>
            {group.events.map((ev, i) => (
              <EventRow key={`${ev.uid || ''}-${i}`} ev={ev} showEnd={false} showLocation={false} />
            ))}
          </div>
        )) : !loading && (
          <div className="text-[15px] text-text-muted py-2">Keine Termine diese Woche</div>
        )}

        {hasMore && (
          <div className="text-[12px] text-text-muted mt-2 font-mono hover:text-text-primary transition-colors">
            + weitere Termine anzeigen
          </div>
        )}
      </Card>

      {showModal && <CalendarModal onClose={() => setShowModal(false)} haEvents={haEvents} />}
    </>
  )
}
