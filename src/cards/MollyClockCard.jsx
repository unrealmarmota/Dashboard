import { useState, useMemo, useEffect } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, InfoModal } from '../atoms'
import { MOLLY_PERSONS } from '../config'
import { SECTORS, SECTOR_STEP, sectorAngle, sectorById, resolvePerson } from '../lib/mollyClock'

// ─── Geometrie ──────────────────────────────────────────────────────
const SIZE = 280
const C = SIZE / 2
const R_CASE = 136   // Aeusseres Gehaeuse
const R_FACE = 110   // Zifferblatt (innerhalb der Luenette)
const R_ICON = 123   // Emoji der Sektoren – in der Luenette
const R_LABEL = 96   // Beschriftung der Sektoren – auf dem Zifferblatt
const R_WEDGE_IN = 42
const HAND_BASE = 68 // Laenge des ersten Zeigers
const HAND_STEP = 15 // jede weitere Person etwas kuerzer

// Winkel 0 = 12 Uhr, im Uhrzeigersinn
// Waagerechte Sektoren brauchen mehr Platz nach innen – sonst stossen lange
// Woerter an die Luenette. Radius abhaengig vom Sinus des Winkels.
const labelRadius = (deg) => R_LABEL - 15 * Math.abs(Math.sin(deg * Math.PI / 180))

const polar = (r, deg) => {
  const rad = (deg - 90) * Math.PI / 180
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }
}

const wedgePath = (deg, rIn, rOut, half = SECTOR_STEP / 2) => {
  const a = polar(rOut, deg - half), b = polar(rOut, deg + half)
  const c = polar(rIn, deg + half), d = polar(rIn, deg - half)
  return `M ${a.x} ${a.y} A ${rOut} ${rOut} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${rIn} ${rIn} 0 0 0 ${d.x} ${d.y} Z`
}

// Kuerzester Weg auf dem Kreis, kumulativ – der Zeiger dreht so nie "falsch herum"
const shortestDelta = (from, to) => ((to - from) % 360 + 540) % 360 - 180

export function MollyClockCard({ persons = MOLLY_PERSONS }) {
  const { entities, callService } = useHA()
  const [hands, setHands] = useState({})     // key -> { sector, angle, changedAt }
  const [picker, setPicker] = useState(null) // Person fuer manuelle Uebersteuerung

  // Aufenthalt aus HA ableiten
  const resolved = useMemo(
    () => persons.map(p => ({
      ...p,
      ...resolvePerson(entities, p),
      canOverride: Boolean(p.override && entities[p.override]),
    })),
    [entities, persons]
  )

  // Zielwinkel setzen – kumulativ, damit CSS sauber dreht statt zu springen
  useEffect(() => {
    setHands(prev => {
      let dirty = false
      const next = { ...prev }
      for (const p of resolved) {
        const target = sectorAngle(p.sector)
        const cur = prev[p.key]
        if (!cur) {
          next[p.key] = { sector: p.sector, angle: target, changedAt: 0 }
          dirty = true
        } else if (cur.sector !== p.sector) {
          next[p.key] = {
            sector: p.sector,
            angle: cur.angle + shortestDelta(cur.angle, target),
            changedAt: Date.now(),
          }
          dirty = true
        }
      }
      return dirty ? next : prev
    })
  }, [resolved])

  // Welche Sektoren sind belegt? (fuer die Hervorhebung im Zifferblatt)
  const occupied = useMemo(() => {
    const m = {}
    resolved.forEach(p => { (m[p.sector] ||= []).push(p) })
    return m
  }, [resolved])

  const setOverride = (person, option) => {
    if (!person.override) return
    callService('input_select', 'select_option', { entity_id: person.override, option })
    setPicker(null)
  }

  return (
    <Card accent className="molly-card">
      <div className="flex items-start justify-between gap-2">
        <Label>Familienuhr</Label>
        <span className="text-[11px] text-text-muted font-mono">automatisch</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 max-w-[820px] mx-auto">
        {/* ── Zifferblatt ── */}
        <svg className="molly-clock shrink-0" viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%"
          style={{ maxWidth: 340 }} role="img" aria-label="Familienuhr">
          <defs>
            <radialGradient id="mcFace" cx="50%" cy="38%" r="72%">
              <stop offset="0%" stopColor="var(--color-surface)" />
              <stop offset="100%" stopColor="var(--color-bg)" />
            </radialGradient>
            <linearGradient id="mcCase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0.12" />
            </linearGradient>
          </defs>

          {/* Gehaeuse mit Luenette */}
          <circle cx={C} cy={C} r={R_CASE} fill="var(--color-surface)" stroke="url(#mcCase)" strokeWidth="4" />
          <circle cx={C} cy={C} r={R_FACE} fill="url(#mcFace)" stroke="var(--color-border)" strokeWidth="1.5" />

          {/* Sektoren */}
          {SECTORS.map(s => {
            const deg = sectorAngle(s.id)
            const here = occupied[s.id] || []
            const icon = polar(R_ICON, deg)
            const label = polar(labelRadius(deg), deg)
            const div = polar(R_CASE - 2, deg + SECTOR_STEP / 2)
            const divIn = polar(R_FACE, deg + SECTOR_STEP / 2)
            const color = here[0]?.color || 'var(--color-text-muted)'
            return (
              <g key={s.id}>
                {/* Luenetten-Segment */}
                <path d={wedgePath(deg, R_FACE, R_CASE - 2)} fill={color}
                  className="molly-wedge" style={{ opacity: here.length ? 0.2 : 0 }} />
                {/* Zifferblatt-Segment */}
                <path d={wedgePath(deg, R_WEDGE_IN, R_FACE)} fill={color}
                  className="molly-wedge" style={{ opacity: here.length ? 0.1 : 0 }} />
                <line x1={div.x} y1={div.y} x2={divIn.x} y2={divIn.y}
                  stroke="var(--color-border)" strokeWidth="1" />
                <text x={icon.x} y={icon.y} textAnchor="middle" dominantBaseline="central"
                  fontSize="14" opacity={here.length ? 1 : 0.5}>{s.icon}</text>
                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central"
                  fontSize="8" fontFamily="var(--font-mono)"
                  fill={here.length ? color : 'var(--color-text-muted)'}
                  fontWeight={here.length ? 700 : 400}
                  opacity={here.length ? 1 : 0.6}>{s.label}</text>
              </g>
            )
          })}

          {/* Zeiger */}
          {resolved.map((p, i) => {
            const hand = hands[p.key]
            if (!hand) return null
            const len = Math.max(30, HAND_BASE - i * HAND_STEP)
            const tipY = C - len
            return (
              <g key={p.key} className="molly-hand" style={{ transform: `rotate(${hand.angle}deg)` }}>
                <g className="molly-quiver" style={{ animationDelay: `${i * -1.7}s` }}>
                  <line x1={C} y1={C + 12} x2={C} y2={tipY + 10}
                    stroke={p.color} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
                  <circle cx={C} cy={C + 12} r="3.5" fill={p.color} opacity="0.85" />
                  {hand.changedAt > 0 && (
                    <circle key={hand.changedAt} cx={C} cy={tipY} r="11"
                      fill="none" stroke={p.color} strokeWidth="2" className="molly-pulse" />
                  )}
                  <circle cx={C} cy={tipY} r="11" fill="var(--color-card)" stroke={p.color} strokeWidth="2" />
                  <text x={C} y={tipY} textAnchor="middle" dominantBaseline="central" fontSize="12">
                    {p.avatar}
                  </text>
                </g>
              </g>
            )
          })}

          {/* Nabe */}
          <circle cx={C} cy={C} r="15" fill="var(--color-card)" stroke="var(--color-amber)" strokeWidth="1.5" opacity="0.9" />
          <circle cx={C} cy={C} r="5" fill="var(--color-amber)" />
        </svg>

        {/* ── Legende ── */}
        <div className="w-full sm:max-w-[380px] flex flex-col gap-2">
          {resolved.map(p => {
            const sec = sectorById(p.sector)
            const alarm = p.sector === 'peril'
            return (
              <button key={p.key} onClick={() => p.canOverride && setPicker(p)}
                className={`molly-row w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                  alarm ? 'bg-red-dim border-red-border' : 'bg-surface/60 border-border'
                } ${p.canOverride ? 'cursor-pointer hover:border-amber-border' : 'cursor-default'}`}>
                <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg border"
                  style={{ borderColor: p.color, background: 'var(--color-card)' }}>{p.avatar}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold font-mono" style={{ color: p.color }}>{p.name}</span>
                  <span className="block text-[15px] font-sans text-text-primary leading-tight truncate">
                    {sec.icon} {p.label}
                  </span>
                  {p.detail && <span className="block text-[11px] text-text-muted font-mono truncate">{p.detail}</span>}
                </span>
                {p.canOverride && <span className="text-[11px] text-text-muted font-mono shrink-0">{'✎'}</span>}
              </button>
            )
          })}
          <div className="text-[11px] text-text-muted font-mono opacity-70 px-1">
            Zeiger folgen Zonen, Proximity &amp; Kalender
            {resolved.some(p => p.canOverride) && <> {'·'} Tippen = manuell setzen</>}
          </div>
        </div>
      </div>

      {picker && (
        <InfoModal onClose={() => setPicker(null)}>
          <div className="pt-1">
            <div className="text-center mb-4">
              <div className="text-2xl mb-1">{picker.avatar}</div>
              <div className="text-base font-semibold text-text-primary font-mono">{picker.name}</div>
              <div className="text-[11px] text-text-muted font-mono">Aufenthalt manuell setzen</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setOverride(picker, 'Auto')}
                className="col-span-2 py-2 rounded-lg border border-teal-border bg-teal-dim text-teal text-[13px] font-mono cursor-pointer">
                {'↻'} Automatik
              </button>
              {SECTORS.map(s => (
                <button key={s.id} onClick={() => setOverride(picker, s.label)}
                  className={`py-2 px-2 rounded-lg border text-[12px] font-mono cursor-pointer transition-colors ${
                    picker.sector === s.id
                      ? 'border-amber bg-amber/[0.12] text-amber font-bold'
                      : 'border-border bg-transparent text-text-muted hover:text-text-primary'
                  }`}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-text-muted font-mono text-center opacity-70">
              Setzt {picker.override}
            </div>
          </div>
        </InfoModal>
      )}
    </Card>
  )
}
