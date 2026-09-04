import { useState, useMemo, useEffect } from 'react'
import { useHA } from '../context/HAContext'
import { useSettings } from '../context/SettingsContext'
import { Card, Label, InfoModal } from '../atoms'
import { MOLLY_PERSONS } from '../config'
import { SECTORS, SECTOR_STEP, sectorAngle, sectorById, resolvePerson } from '../lib/mollyClock'

// ─── Geometrie ──────────────────────────────────────────────────────
// Zwei Häute auf identischer Geometrie, siehe design/Main.dc.html
// (Messing & Patina) und design/Wurzelwerk.dc.html.
const SIZE = 400
const C = SIZE / 2
const R_CASE = 190   // Aeusserer Messingring
const R_FACE = 152   // Zifferblatt
const R_ICON = 170   // Sektor-Icons in der Luenette
const R_LABEL = 138  // Sektor-Beschriftung auf dem Blatt
const R_WEDGE_IN = 44
const R_LEAF = 168   // Wurzelwerk: Ranke mit Blaettern
const HAND_BASE = 88 // Laenge des ersten Zeigers – Zeigerkopf bleibt unter der Beschriftung
const HAND_STEP = 18 // jede weitere Person etwas kuerzer

const BARK = '#6b5a3e'
const LEAF_DIM = '#3f5c47'

const SKINS = {
  brass: { label: 'Messing' },
  vine: { label: 'Wurzelwerk' },
}

// Sektor-Icons: 20x20-Raster, Strichzeichnung, ein Stil
const ICONS = {
  home: 'M3 10.4 10 4.2l7 6.2V16.6a1 1 0 0 1-1 1h-3.4v-4.4H7.4v4.4H4a1 1 0 0 1-1-1z',
  work: 'M3.2 7.4h13.6v9.2H3.2z M7.4 7.4V5.6a.8.8 0 0 1 .8-.8h3.6a.8.8 0 0 1 .8.8v1.8 M3.2 11.4h13.6',
  school: 'M2.6 8 10 4.6 17.4 8 10 11.4z M5.6 9.6v3.5c0 1.1 2 2.2 4.4 2.2s4.4-1.1 4.4-2.2V9.6',
  shopping: 'M3.4 7.6h13.2l-1.3 8.1a1 1 0 0 1-1 .8H5.7a1 1 0 0 1-1-.8z M7.2 7.6 9.1 3.8 M12.8 7.6 10.9 3.8',
  visiting: 'M2.6 16.8c0-2.6 2.1-4.2 4.8-4.2s4.8 1.6 4.8 4.2 M13 12.8c2.3-.3 4.4 1 4.4 3.4',
  holiday: 'M4 9.6a6 6 0 0 1 12 0z M10 9.6V16.8 M7.4 16.8c1.1-1.3 4.1-1.3 5.2 0',
  travel: 'M3.6 13.2 5.2 8.8h9.6l1.6 4.4v3.2h-2.2v-1.6H5.8v1.6H3.6z',
  lost: 'M7.2 7.4a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.3-2.8 4.2',
  peril: 'M11.8 3.2 5.4 11.4h3.8L8.2 16.8l6.4-8.4h-3.8z',
  homeward: 'M13.4 6.6 8.4 8.4 6.6 13.4l5-1.8z',
}
// Kreise, die sich nicht als Pfad ausdruecken lassen
const ICON_DOTS = {
  visiting: [[7.4, 7.2, 2.6], [14.4, 8.4, 2]],
  travel: [[6.6, 13.4, 1], [13.4, 13.4, 1]],
  lost: [[10, 15.8, 0.9]],
  homeward: [[10, 10, 6.8]],
}

// Winkel 0 = 12 Uhr, im Uhrzeigersinn
const polar = (r, deg) => {
  const rad = (deg - 90) * Math.PI / 180
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }
}

// Waagerechte Sektoren brauchen mehr Platz nach innen – sonst stossen
// lange Woerter an den Rand.
const labelRadius = (base, deg, pull) => base - pull * Math.abs(Math.sin(deg * Math.PI / 180))

const wedgePath = (deg, rIn, rOut, half = SECTOR_STEP / 2) => {
  const a = polar(rOut, deg - half), b = polar(rOut, deg + half)
  const c = polar(rIn, deg + half), d = polar(rIn, deg - half)
  return `M ${a.x} ${a.y} A ${rOut} ${rOut} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${rIn} ${rIn} 0 0 0 ${d.x} ${d.y} Z`
}

// Boegen mit Luecken statt einer durchgehenden Maschinenlinie
const arcPath = (r, a0, a1) => {
  const p0 = polar(r, a0), p1 = polar(r, a1)
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`
}

// Geschlossener, leicht atmender Ring – nichts daran ist exakt rund
const organicRing = (r, n = 30, amp = 6, seed = 0) => {
  const pts = Array.from({ length: n }, (_, k) =>
    polar(r + Math.sin(k * 1.3 + seed) * amp + Math.sin(k * 0.41 + seed) * amp * 0.7, k * 360 / n))
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let k = 1; k <= n; k++) {
    const a = pts[(k - 1) % n], b = pts[k % n]
    d += ` Q ${a.x.toFixed(1)} ${a.y.toFixed(1)} ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)}`
  }
  return d + ' Z'
}

// Deterministisches "Zittern" – von Hand gestochen, nicht gefraest
const jitter = (i, amp) => Math.sin(i * 2.399) * amp

// Kuerzester Weg auf dem Kreis, kumulativ – der Zeiger dreht so nie "falsch herum"
const shortestDelta = (from, to) => ((to - from) % 360 + 540) % 360 - 180

const handLength = (i) => Math.max(38, HAND_BASE - i * HAND_STEP)

function SectorIcon({ id, x, y, size, color, opacity }) {
  const s = size / 20
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}
      fill="none" stroke={color} strokeWidth={1.35 / s} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
      {ICONS[id] && <path d={ICONS[id]} />}
      {(ICON_DOTS[id] || []).map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}
    </g>
  )
}

// Der rotierende Zeiger-Rahmen ist in beiden Häuten derselbe – nur der
// Inhalt (Nadel vs. Trieb) unterscheidet sich.
function Hand({ hand, index, children }) {
  return (
    <g className="molly-hand" style={{ transform: `rotate(${hand.angle}deg)` }}>
      <g className="molly-quiver" style={{ animationDelay: `${index * -1.7}s` }}>
        {children}
      </g>
    </g>
  )
}

// ─── Haut 1: Messing & Patina ───────────────────────────────────────
function DialBrass({ resolved, occupied, hands }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Familienuhr">
      <defs>
        <radialGradient id="mcFace" cx="50%" cy="34%" r="78%">
          <stop offset="0%" stopColor="var(--color-surface)" />
          <stop offset="72%" stopColor="var(--color-card)" />
          <stop offset="100%" stopColor="var(--color-bg)" />
        </radialGradient>
        {/* Messing-Schimmer aus dem Amber-Token – bleibt themefaehig */}
        <linearGradient id="mcBrass" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.95" />
          <stop offset="38%" stopColor="var(--color-amber)" stopOpacity="0.62" />
          <stop offset="62%" stopColor="var(--color-amber)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0.8" />
        </linearGradient>
        <filter id="mcGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <clipPath id="mcClip"><circle cx={C} cy={C} r="196" /></clipPath>
        {resolved.map(p => (
          <pattern key={p.key} id={`mcHatch-${p.key}`} width="7" height="7"
            patternTransform="rotate(38)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke={p.color} strokeWidth="1.5" opacity="0.5" />
          </pattern>
        ))}
      </defs>

      <circle cx={C} cy={C} r={R_FACE} fill="url(#mcFace)" />

      {/* Gehaeuse: gestochene Boegen mit Luecken, wandernde Staerke */}
      {[[7, 171, R_CASE, 5.2, 1], [189, 353, R_CASE, 4.4, 1],
        [2, 358, 196.5, 0.9, 0.32], [12, 348, 181.5, 0.8, 0.22]].map(([a0, a1, r, sw, op], i) => (
        <path key={i} d={arcPath(r, a0, a1)} fill="none" stroke="url(#mcBrass)"
          strokeWidth={sw} strokeLinecap="round" opacity={op} />
      ))}

      {SECTORS.map((s, i) => {
        const deg = sectorAngle(s.id)
        const p = (occupied[s.id] || [])[0]
        const col = p?.color || 'var(--color-amber)'
        const j = jitter(i, 1.1)
        const d1 = polar(R_FACE + 2, deg + SECTOR_STEP / 2 + j)
        const d2 = polar(R_CASE - 3, deg + SECTOR_STEP / 2 - j)
        const ic = polar(R_ICON, deg)
        const lb = polar(labelRadius(R_LABEL, deg, 20), deg)
        return (
          <g key={s.id}>
            {/* belegter Sektor: schraffiert statt flaechig gefuellt */}
            <path d={wedgePath(deg, R_FACE + 2, R_CASE - 4)}
              fill={p ? `url(#mcHatch-${p.key})` : 'transparent'}
              className="molly-wedge" style={{ opacity: p ? 0.85 : 0 }} />
            <path d={wedgePath(deg, R_WEDGE_IN, R_FACE)} fill={col}
              className="molly-wedge" style={{ opacity: p ? 0.08 : 0 }} />
            <line x1={d1.x} y1={d1.y} x2={d2.x} y2={d2.y}
              stroke="var(--color-amber)" strokeWidth="0.9" opacity="0.3" />
            {[-10.5, 10.5].map(d => {
              const k1 = polar(R_CASE - 6, deg + d), k2 = polar(R_CASE - 11, deg + d)
              return <line key={d} x1={k1.x} y1={k1.y} x2={k2.x} y2={k2.y}
                stroke="var(--color-amber)" strokeWidth="0.7" opacity="0.18" />
            })}
            <SectorIcon id={s.id} x={ic.x} y={ic.y} size={21} color={col} opacity={p ? 1 : 0.42} />
            <text x={lb.x} y={lb.y} textAnchor="middle" dominantBaseline="central"
              className="molly-sector-label" fill={p ? col : 'var(--color-text-muted)'}
              fontWeight={p ? 600 : 500} opacity={p ? 1 : 0.65}>{s.label}</text>
          </g>
        )
      })}

      {/* Zeiger: geschmiedete Nadel mit Gegengewicht */}
      {resolved.map((p, i) => {
        const hand = hands[p.key]
        if (!hand) return null
        const L = handLength(i)
        const mid = L * 0.55
        return (
          <Hand key={p.key} hand={hand} index={i}>
            <circle cx={C} cy={C + 28} r="6" fill={p.color} opacity="0.45" />
            <path d={`M ${C - 15.9} ${C + 1.7} L ${C - 2} ${C - mid} L ${C} ${C - L} L ${C + 2} ${C - mid} L ${C + 15.9} ${C + 1.7} Z`}
              fill={p.color} opacity="0.92" />
            {hand.changedAt > 0 && (
              <circle key={hand.changedAt} cx={C} cy={C - L} r="17"
                fill="none" stroke={p.color} strokeWidth="2" className="molly-pulse" />
            )}
            <circle cx={C} cy={C - L} r="17" fill="var(--color-card)" stroke={p.color} strokeWidth="1.9" />
            <circle cx={C} cy={C - L} r="21.5" fill="none" stroke={p.color} strokeWidth="0.7" opacity="0.35" />
            <text x={C} y={C - L} textAnchor="middle" dominantBaseline="central"
              className="molly-hand-initial" fill={p.color}>{p.initial}</text>
          </Hand>
        )
      })}

      {/* Nabe: gestochene Rosette */}
      <circle cx={C} cy={C} r="19" fill="var(--color-card)" stroke="url(#mcBrass)" strokeWidth="1.6" />
      {Array.from({ length: 16 }, (_, k) => {
        const a = polar(8, k * 22.5), b = polar(15, k * 22.5)
        return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke="var(--color-amber)" strokeWidth="0.6" opacity="0.32" />
      })}
      <circle cx={C} cy={C} r="4.5" fill="url(#mcBrass)" />

      <g clipPath="url(#mcClip)">
        <rect x="0" y="0" width={SIZE} height={SIZE} filter="url(#mcGrain)" opacity="0.055" />
      </g>
    </svg>
  )
}

// ─── Haut 2: Wurzelwerk ─────────────────────────────────────────────
function DialVine({ resolved, occupied, hands }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Familienuhr">
      <defs>
        <radialGradient id="mcFloor" cx="50%" cy="46%" r="62%">
          <stop offset="0%" stopColor={LEAF_DIM} stopOpacity="0.28" />
          <stop offset="100%" stopColor={LEAF_DIM} stopOpacity="0" />
        </radialGradient>
        {resolved.map(p => (
          <radialGradient key={p.key} id={`mcGlow-${p.key}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={p.color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      <circle cx={C} cy={C} r="196" fill="url(#mcFloor)" />
      <path d={organicRing(R_LEAF, 30, 6, 0.6)} fill="none" stroke={BARK} strokeWidth="3.4" strokeLinecap="round" opacity="0.9" />
      <path d={organicRing(R_LEAF - 9, 24, 4.2, 2.4)} fill="none" stroke={BARK} strokeWidth="1.4" opacity="0.45" />

      {SECTORS.map((s, i) => {
        const deg = sectorAngle(s.id)
        const p = (occupied[s.id] || [])[0]
        const col = p?.color || LEAF_DIM
        const ic = polar(R_LEAF, deg)
        const lb = polar(labelRadius(132, deg, 16), deg)
        const top = C - R_LEAF
        return (
          <g key={s.id}>
            <g transform={`rotate(${deg + jitter(i, 3.5)} ${C} ${C})`}>
              <path d={`M ${C} ${top - 22} Q ${C + 17} ${top} ${C} ${top + 22} Q ${C - 17} ${top} ${C} ${top - 22} Z`}
                fill={col} className="molly-wedge" fillOpacity={p ? 0.32 : 0.2}
                stroke={col} strokeWidth={p ? 1.5 : 1} strokeOpacity={p ? 0.95 : 0.5} />
              <path d={`M ${C} ${top - 19} L ${C} ${top + 19}`} stroke={col} strokeWidth="0.8" opacity="0.45" />
            </g>
            <SectorIcon id={s.id} x={ic.x} y={ic.y} size={17} color={p ? col : '#8aa694'} opacity={p ? 1 : 0.6} />
            <text x={lb.x} y={lb.y} textAnchor="middle" dominantBaseline="central"
              className="molly-sector-label molly-sector-label-vine"
              fill={p ? col : 'var(--color-text-muted)'}
              fontWeight={p ? 600 : 500} opacity={p ? 1 : 0.8}>{s.label}</text>
          </g>
        )
      })}

      {/* Zeiger: wachsender Trieb mit Laterne */}
      {resolved.map((p, i) => {
        const hand = hands[p.key]
        if (!hand) return null
        const L = handLength(i)
        const tip = polar(L, 0)
        const c1 = polar(L * 0.42, -11)
        const c2 = polar(L * 0.78, 7)
        return (
          <Hand key={p.key} hand={hand} index={i}>
            <path d={`M ${C} ${C} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${tip.x} ${tip.y}`}
              fill="none" stroke={BARK} strokeWidth="3.2" strokeLinecap="round" />
            {[[0.42, -1], [0.66, 1], [0.84, -1]].map(([t, side], k) => {
              const b = polar(L * t, side * 7)
              return (
                <g key={k} transform={`rotate(${side * 52} ${b.x} ${b.y})`}>
                  <path d={`M ${b.x} ${b.y - 9} Q ${b.x + 6} ${b.y} ${b.x} ${b.y + 9} Q ${b.x - 6} ${b.y} ${b.x} ${b.y - 9} Z`}
                    fill={p.color} fillOpacity="0.32" stroke={p.color} strokeWidth="0.8" strokeOpacity="0.6" />
                </g>
              )
            })}
            <circle cx={tip.x} cy={tip.y} r="34" fill={`url(#mcGlow-${p.key})`} />
            {hand.changedAt > 0 && (
              <circle key={hand.changedAt} cx={tip.x} cy={tip.y} r="16"
                fill="none" stroke={p.color} strokeWidth="2" className="molly-pulse" />
            )}
            <circle cx={tip.x} cy={tip.y} r="16" fill="var(--color-card)" stroke={p.color} strokeWidth="1.8" />
            <text x={tip.x} y={tip.y} textAnchor="middle" dominantBaseline="central"
              className="molly-hand-initial molly-hand-initial-vine" fill={p.color}>{p.initial}</text>
          </Hand>
        )
      })}

      {/* Wurzelstock */}
      {[[22, 2.4, 0.95], [15, 1.4, 0.6], [8, 1.1, 0.4]].map(([r, sw, op]) => (
        <path key={r} d={organicRing(r, 14, 1.6, r)} fill="none" stroke={BARK} strokeWidth={sw} opacity={op} />
      ))}
      <circle cx={C} cy={C} r="3.4" fill={BARK} />
    </svg>
  )
}

export function MollyClockCard({ persons = MOLLY_PERSONS }) {
  const { entities, callService } = useHA()
  const { settings, updateSetting } = useSettings()
  const [hands, setHands] = useState({})     // key -> { sector, angle, changedAt }
  const [picker, setPicker] = useState(null) // Person fuer manuelle Uebersteuerung
  const skin = SKINS[settings.mollySkin] ? settings.mollySkin : 'brass'

  // Aufenthalt aus HA ableiten
  const resolved = useMemo(
    () => persons.map(p => ({
      ...p,
      ...resolvePerson(entities, p),
      initial: p.initial || p.name.charAt(0).toUpperCase(),
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

  // Personen links/rechts der Uhr aufteilen
  const left = resolved.filter((_, i) => i % 2 === 0)
  const right = resolved.filter((_, i) => i % 2 === 1)

  const plate = (p) => {
    const sec = sectorById(p.sector)
    const alarm = p.sector === 'peril'
    return (
      <button key={p.key} onClick={() => p.canOverride && setPicker(p)}
        className={`molly-plate ${alarm ? 'molly-plate-alarm' : ''} ${p.canOverride ? 'molly-plate-tap' : ''}`}>
        <span className="molly-disc" style={{ borderColor: p.color, color: p.color }}>
          <span>{p.initial}</span>
        </span>
        <span className="molly-plate-text">
          <span className="molly-name" style={{ color: p.color }}>{p.name}</span>
          <span className="molly-place">
            <svg viewBox="0 0 20 20" width="19" height="19" aria-hidden="true" style={{ flex: 'none' }}>
              <SectorIcon id={sec.id} x={10} y={10} size={19} color={p.color} opacity={0.9} />
            </svg>
            {p.label}
          </span>
          {p.detail && <span className="molly-detail">{p.detail}</span>}
        </span>
        {p.canOverride && <span className="molly-edit" aria-hidden="true">{'✎'}</span>}
      </button>
    )
  }

  const Dial = skin === 'vine' ? DialVine : DialBrass

  return (
    <Card accent className={`molly-card molly-skin-${skin}`}>
      <div className="flex items-center justify-between gap-2">
        <Label>Familienuhr</Label>
        <div className="molly-skin-toggle">
          {Object.entries(SKINS).map(([key, s]) => (
            <button key={key} onClick={() => updateSetting('mollySkin', key)}
              className={skin === key ? 'is-active' : ''}
              aria-pressed={skin === key}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="molly-body">
        <div className="molly-side molly-side-a">{left.map(plate)}</div>
        <div className="molly-dial">
          <Dial resolved={resolved} occupied={occupied} hands={hands} />
        </div>
        <div className="molly-side molly-side-b">{right.map(plate)}</div>
      </div>

      <div className="molly-foot">
        Zeiger folgen Zonen, Proximity &amp; Kalender
        {resolved.some(p => p.canOverride) && <> {'·'} Tippen = manuell setzen</>}
      </div>

      {picker && (
        <InfoModal onClose={() => setPicker(null)}>
          <div className="pt-1">
            <div className="text-center mb-4">
              <div className="molly-disc molly-disc-lg mx-auto mb-2"
                style={{ borderColor: picker.color, color: picker.color }}>
                <span>{picker.initial}</span>
              </div>
              <div className="molly-name text-base" style={{ color: picker.color }}>{picker.name}</div>
              <div className="text-[11px] text-text-muted font-mono">Aufenthalt manuell setzen</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setOverride(picker, 'Auto')}
                className="col-span-2 py-2 rounded-lg border border-teal-border bg-teal-dim text-teal text-[13px] font-mono cursor-pointer">
                {'↻'} Automatik
              </button>
              {SECTORS.map(s => (
                <button key={s.id} onClick={() => setOverride(picker, s.label)}
                  className={`flex items-center gap-2 py-2 px-2.5 rounded-lg border text-[12px] font-mono cursor-pointer transition-colors ${
                    picker.sector === s.id
                      ? 'border-amber bg-amber/[0.12] text-amber font-bold'
                      : 'border-border bg-transparent text-text-muted hover:text-text-primary'
                  }`}>
                  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" style={{ flex: 'none' }}>
                    <SectorIcon id={s.id} x={10} y={10} size={18} color="currentColor" opacity={1} />
                  </svg>
                  {s.label}
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
