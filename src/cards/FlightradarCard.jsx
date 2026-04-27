import { useState } from 'react'
import { Card, Label, InfoModal } from '../atoms'
import { useHA } from '../context/HAContext'

const FR24_URL = 'https://www.flightradar24.com/48.83,9.32/10'
const ENTITY_ID = 'sensor.flightradar24_current_in_area_2'

function fmtAlt(ft) {
  if (!ft) return '\u2013'
  const m = Math.round(ft * 0.3048)
  return `${(ft / 1000).toFixed(1)}k ft (${m.toLocaleString('de')} m)`
}

function fmtSpeed(kts) {
  if (!kts) return '\u2013'
  const kmh = Math.round(kts * 1.852)
  return `${kmh} km/h`
}

function fmtDist(km) {
  if (km == null) return '\u2013'
  return `${km.toFixed(1)} km`
}

function headingArrow(deg) {
  const arrows = ['\u2191','\u2197','\u2192','\u2198','\u2193','\u2199','\u2190','\u2196']
  return arrows[Math.round(deg / 45) % 8]
}

function FlightRow({ f, compact }) {
  const origin = f.airport_origin_code_iata || '\u2013'
  const dest = f.airport_destination_code_iata || '\u2013'
  const airline = f.airline_short || f.airline || ''
  const flight = f.flight_number || f.callsign || '\u2013'
  const aircraft = f.aircraft_code || ''

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface border border-border">
        <span className="text-sm">{'\u2708\uFE0F'}</span>
        <span className="text-xs font-bold text-teal font-mono">{flight}</span>
        <span className="text-[11px] text-text-muted font-sans truncate flex-1">
          {origin} {'\u2192'} {dest}
        </span>
        <span className="text-[10px] text-text-muted font-mono">{fmtDist(f.distance)}</span>
      </div>
    )
  }

  return (
    <div className="p-3 rounded-xl bg-surface border border-border">
      <div className="flex items-start gap-3">
        {f.aircraft_photo_small && (
          <img src={f.aircraft_photo_small} alt={aircraft}
            className="w-16 h-10 object-cover rounded-lg shrink-0 bg-bg" loading="lazy" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-teal font-mono">{flight}</span>
            <span className="text-[11px] text-text-muted font-sans">{airline}</span>
            {aircraft && <span className="text-[10px] text-text-muted font-mono bg-bg px-1.5 py-0.5 rounded">{aircraft}</span>}
          </div>
          <div className="text-sm font-sans text-text-primary mb-1.5">
            <span className="font-medium">{f.airport_origin_city || origin}</span>
            <span className="text-text-muted mx-1.5">{'\u2192'}</span>
            <span className="font-medium">{f.airport_destination_city || dest}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[10px] text-text-muted font-mono">
            <span>{'\u2191'} {fmtAlt(f.altitude)}</span>
            <span>{'\uD83D\uDCA8'} {fmtSpeed(f.ground_speed)}</span>
            <span>{headingArrow(f.heading)} {f.heading}{'\u00B0'}</span>
            <span>{'\uD83D\uDCCD'} {fmtDist(f.distance)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FlightradarCard() {
  const { entities } = useHA()
  const [showDetail, setShowDetail] = useState(false)

  const sensor = entities[ENTITY_ID]
  const count = parseInt(sensor?.state) || 0
  const flights = sensor?.attributes?.flights || []

  // Sortiere nach Entfernung (naechstes zuerst)
  const sorted = [...flights].sort((a, b) => (a.distance || 999) - (b.distance || 999))
  const closest = sorted[0]

  return (
    <>
      <Card onClick={() => setShowDetail(true)} className="cursor-pointer hover:border-teal-border transition-colors">
        <div className="flex items-center justify-between">
          <Label>{'\u2708\uFE0F'} Flugverkehr {'\u00B7'} 30 km</Label>
          <span className="text-[10px] text-teal font-mono">{'\u25CF'} Live</span>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <div className="text-4xl font-bold text-text-primary font-sans leading-none">
            {count}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text-muted font-sans">
              {count === 1 ? 'Flugzeug' : 'Flugzeuge'} im Umkreis
            </div>
            {closest && (
              <div className="text-[11px] text-text-primary font-sans mt-1 truncate">
                <span className="text-teal font-mono font-bold">{closest.flight_number || closest.callsign}</span>
                {' '}{closest.airport_origin_code_iata} {'\u2192'} {closest.airport_destination_code_iata}
                <span className="text-text-muted ml-1">({fmtDist(closest.distance)})</span>
              </div>
            )}
          </div>
        </div>

        {sorted.length > 1 && (
          <div className="mt-2 flex flex-col gap-1">
            {sorted.slice(0, 3).map(f => (
              <FlightRow key={f.id} f={f} compact />
            ))}
            {sorted.length > 3 && (
              <div className="text-[10px] text-text-muted font-sans text-center mt-0.5">
                + {sorted.length - 3} weitere
              </div>
            )}
          </div>
        )}

        {count === 0 && (
          <div className="mt-2 text-[11px] text-text-muted font-sans text-center py-2">
            Aktuell keine Flugzeuge im Umkreis
          </div>
        )}
      </Card>

      {showDetail && (
        <InfoModal onClose={() => setShowDetail(false)} wide>
          <div className="text-center mb-4">
            <div className="text-base font-semibold text-text-primary font-sans">{'\u2708\uFE0F'} Flugverkehr</div>
            <div className="text-[11px] text-text-muted font-sans mt-0.5">Waiblingen {'\u00B7'} 30 km Radius {'\u00B7'} {count} {count === 1 ? 'Flug' : 'Fl\u00FCge'}</div>
          </div>

          {sorted.length > 0 ? (
            <div className="flex flex-col gap-2">
              {sorted.map(f => (
                <FlightRow key={f.id} f={f} />
              ))}
            </div>
          ) : (
            <div className="text-center text-text-muted text-sm font-sans py-8">
              Aktuell keine Flugzeuge im Umkreis
            </div>
          )}

          <a href={FR24_URL} target="_blank" rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-teal-border hover:bg-teal/[0.06] transition-colors no-underline">
            <span className="text-sm font-semibold text-text-primary font-sans">Flightradar24 {'\u00F6'}ffnen</span>
            <span className="text-text-muted text-sm">{'\u2197\uFE0F'}</span>
          </a>
        </InfoModal>
      )}
    </>
  )
}
