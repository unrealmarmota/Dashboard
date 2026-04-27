import { useState, useEffect, useRef, useCallback } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, Pill } from '../atoms'
import { e, v, HA_TOKEN, HA_BASE } from '../config'
const COORDS_KEY = 'enyaq_last_coords'

function useEnyaqCoords() {
  const { entities } = useHA()
  const tracker = e(entities, 'device_tracker.skoda_enyaq_standort')
  const lat = tracker?.attributes?.latitude
  const lon = tracker?.attributes?.longitude

  useEffect(() => {
    if (lat != null && lon != null) {
      localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lon }))
    }
  }, [lat, lon])

  if (lat != null && lon != null) return { lat, lon, cached: false }
  try {
    const cached = JSON.parse(localStorage.getItem(COORDS_KEY))
    if (cached?.lat != null) return { ...cached, cached: true }
  } catch {}
  return null
}

function EnyaqImage() {
  const { entities } = useHA()
  const [blobUrl, setBlobUrl] = useState(null)
  const tracker = e(entities, 'device_tracker.skoda_enyaq_standort')
  const imgUrl = tracker?.attributes?.entity_picture

  useEffect(() => {
    if (!imgUrl) return
    const fullUrl = imgUrl.startsWith('http') ? imgUrl : `${HA_BASE}${imgUrl}`
    let cancelled = false
    let objectUrl = null
    fetch(fullUrl, { headers: { Authorization: `Bearer ${HA_TOKEN}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => {
        if (blob && !cancelled) {
          objectUrl = URL.createObjectURL(blob)
          setBlobUrl(objectUrl)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imgUrl])

  return (
    <img src={blobUrl || '/enyaq.webp'} alt="Skoda Enyaq"
      className="w-full h-auto rounded-lg block bg-surface" />
  )
}

function EnyaqMap({ coords }) {
  if (!coords) return (
    <div className="w-full aspect-[2/1] rounded-lg bg-surface flex items-center justify-center text-text-muted text-xs font-mono">
      Kein Standort verfuegbar
    </div>
  )
  const { lat, lon, cached } = coords
  const d = 0.002
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`
  return (
    <div className="relative w-full aspect-[2/1] rounded-lg overflow-hidden bg-surface">
      <iframe src={src} className="w-full h-full border-0" loading="lazy" title="Standort" />
      {cached && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-text-muted font-mono">
          Zuletzt bekannt
        </div>
      )}
    </div>
  )
}

function ImageMapSwiper({ coords }) {
  const [page, setPage] = useState(0)
  const touchRef = useRef(null)

  const onTouchStart = useCallback(ev => {
    touchRef.current = ev.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback(ev => {
    if (touchRef.current == null) return
    const diff = ev.changedTouches[0].clientX - touchRef.current
    touchRef.current = null
    if (Math.abs(diff) < 40) return
    setPage(p => diff < 0 ? Math.min(p + 1, 1) : Math.max(p - 1, 0))
  }, [])

  return (
    <div>
      <div className="overflow-hidden rounded-lg" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${page * 100}%)` }}>
          <div className="w-full shrink-0"><EnyaqImage /></div>
          <div className="w-full shrink-0"><EnyaqMap coords={coords} /></div>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 mt-1.5">
        {[0, 1].map(i => (
          <button key={i} onClick={() => setPage(i)}
            className={`w-1.5 h-1.5 rounded-full transition-colors cursor-pointer ${i === page ? 'bg-white' : 'bg-white/25'}`} />
        ))}
      </div>
    </div>
  )
}

export function CarCard() {
  const { entities, callService } = useHA()
  const coords = useEnyaqCoords()
  const battery = v(entities, 'sensor.skoda_enyaq_batteriestand')
  const range = v(entities, 'sensor.skoda_enyaq_reichweite')
  const chargeStatus = v(entities, 'sensor.skoda_enyaq_ladestatus')
  const km = v(entities, 'sensor.skoda_enyaq_kilometerstand')
  const weather = e(entities, 'weather.forecast_stauferabby')
  const localTemp = weather?.attributes?.temperature
  const remainingTime = v(entities, 'sensor.skoda_enyaq_verbleibende_ladezeit')
  const chargePower = v(entities, 'sensor.skoda_enyaq_ladeleistung')
  const chargeRate = v(entities, 'sensor.skoda_enyaq_laderate')
  const soc = parseFloat(battery) || 0
  const isCharging = chargeStatus === 'charging'
  const remainingMin = parseInt(remainingTime) || 0
  const remainingStr = remainingMin >= 60 ? `${Math.floor(remainingMin / 60)}h ${remainingMin % 60}min` : `${remainingMin} min`

  const statusMap = { connect_cable: 'Kabel verbinden', charging: 'Laedt', ready: 'Bereit', ready_for_charging: 'Ladebereit', not_charging: 'Nicht laden', conservation: 'Erhaltung', target_reached: 'Ziel erreicht' }

  const barColor = isCharging ? 'linear-gradient(90deg, var(--color-teal), #06b6d4)' : soc > 50 ? 'var(--color-green)' : soc > 20 ? 'var(--color-amber)' : 'var(--color-red)'
  const tempNum = parseFloat(localTemp)
  const isCold = !isNaN(tempNum) && tempNum < 5
  const isHot = !isNaN(tempNum) && tempNum > 28
  const showClimate = isCold || isHot

  return (
    <Card>
      <Label>Skoda Enyaq {'\u00B7'} E-Auto</Label>
      <ImageMapSwiper coords={coords} />
      <div className="mt-2">
        <div className="flex justify-between mb-1">
          <span className="text-[12px] text-text-muted font-mono">AKKU</span>
          <span className="text-[14px] font-mono text-white font-bold">{battery}%</span>
        </div>
        <div className="h-1.5 bg-dim rounded-sm overflow-hidden mb-1.5 relative">
          <div className="h-full rounded-sm transition-[width] duration-500" style={{ width: `${soc}%`, background: barColor }} />
          <div className="absolute top-0 h-full w-px bg-white/50" style={{ left: '80%' }} title="Ladelimit 80%" />
        </div>
        <div className="flex gap-1.5 items-center mb-1.5 flex-wrap">
          {isCharging ? <Pill color="teal">{'\u26A1'} LADEN</Pill> : <Pill color="amber">{statusMap[chargeStatus] || chargeStatus}</Pill>}
          <span className="text-[12px] text-text-muted font-mono">{range} km</span>
        </div>
        {isCharging && (
          <div className="flex gap-1.5 items-center mb-1.5 px-2 py-1 rounded-md bg-teal-dim border border-teal-border text-[11px] font-mono text-teal flex-wrap">
            <span>{'\u23F1'} {remainingStr}</span>
            <span className="text-text-muted">{'\u00B7'}</span>
            <span>{chargePower} kW</span>
          </div>
        )}
        <div className="flex gap-2 text-[11px] text-text-muted font-mono flex-wrap">
          <span>{'\uD83D\uDEE3\uFE0F'} {km} km</span>
          <span>{'\uD83C\uDF21\uFE0F'} {localTemp != null ? `${parseFloat(localTemp).toFixed(1)}` : '\u2013'}{'\u00B0'}C</span>
        </div>
      </div>
      {showClimate && (
        <div className={`mt-2 p-2 px-3 rounded-lg flex justify-between items-center border ${isCold ? 'bg-blue/[0.08] border-blue/20' : 'bg-red/[0.08] border-red/20'}`}>
          <span className={`text-xs ${isCold ? 'text-blue' : 'text-red'}`}>
            {isCold ? '\u2744\uFE0F Vorheizen' : '\uD83C\uDF21\uFE0F Kuehlen'}
          </span>
          <button onClick={() => callService('climate', 'turn_on', { entity_id: 'climate.skoda_enyaq_klimaanlage' })}
            className={`px-2 py-0.5 rounded-md border cursor-pointer text-[12px] ${isCold ? 'border-blue/40 bg-blue/[0.15] text-blue' : 'border-red/40 bg-red/[0.15] text-red'}`}>Start</button>
        </div>
      )}
    </Card>
  )
}
