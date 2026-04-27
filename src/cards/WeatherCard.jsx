import { useState, useEffect } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, InfoModal } from '../atoms'
import { e, fmtTime, WEATHER_ICONS } from '../config'

function SunArc({ sunriseISO, sunsetISO }) {
  const now = new Date()
  const sunrise = sunriseISO ? new Date(sunriseISO) : null
  const sunset = sunsetISO ? new Date(sunsetISO) : null
  const sunriseStr = sunrise ? fmtTime(sunriseISO) : '\u2013'
  const sunsetStr = sunset ? fmtTime(sunsetISO) : '\u2013'

  let progress = 0
  if (sunrise && sunset) {
    const riseToday = sunrise > sunset ? new Date(sunrise.getTime() - 86400000) : sunrise
    const dayLen = sunset.getTime() - riseToday.getTime()
    const elapsed = now.getTime() - riseToday.getTime()
    progress = Math.max(0, Math.min(1, elapsed / dayLen))
  }

  const W = 280, H = 128, cx = W / 2, cy = H - 22, rx = 110, ry = 90
  const toXY = (t) => ({ x: cx + rx * Math.cos(Math.PI - t * Math.PI), y: cy - ry * Math.sin(t * Math.PI) })
  const start = toXY(0), end = toXY(1), sun = toXY(progress)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
      <defs>
        <linearGradient id="arcgrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.3" />
          <stop offset="50%" stopColor="var(--color-amber)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path d={`M ${start.x},${start.y} A ${rx},${ry} 0 0 1 ${end.x},${end.y}`} fill="none" stroke="var(--color-dim)" strokeWidth={2} strokeDasharray="4 4" />
      {progress > 0 && progress < 1 && (
        <path d={`M ${start.x},${start.y} A ${rx},${ry} 0 0 1 ${sun.x},${sun.y}`} fill="none" stroke="url(#arcgrad)" strokeWidth={2.5} strokeLinecap="round" />
      )}
      <line x1={cx - rx - 10} y1={cy} x2={cx + rx + 10} y2={cy} stroke="var(--color-border)" strokeWidth={1} />
      <circle cx={start.x} cy={start.y} r={4} fill="var(--color-amber)" opacity={0.6} />
      <text x={start.x - 4} y={start.y + 16} fill="var(--color-text-muted)" fontSize={10} fontFamily="var(--font-mono)" textAnchor="middle">{'\uD83C\uDF05'} {sunriseStr}</text>
      <circle cx={end.x} cy={end.y} r={4} fill="#f97316" opacity={0.6} />
      <text x={end.x + 4} y={end.y + 16} fill="var(--color-text-muted)" fontSize={10} fontFamily="var(--font-mono)" textAnchor="middle">{'\uD83C\uDF07'} {sunsetStr}</text>
      {progress > 0 && progress < 1 && (<>
        <circle cx={sun.x} cy={sun.y} r={10} fill="var(--color-amber)" opacity={0.15} />
        <circle cx={sun.x} cy={sun.y} r={6} fill="var(--color-amber)" opacity={0.9} />
        <circle cx={sun.x} cy={sun.y} r={3} fill="white" opacity={0.8} />
      </>)}
      <text x={cx} y={cy - 28} fill="var(--color-text-primary)" fontSize={13} fontFamily="var(--font-mono)" textAnchor="middle" fontWeight="500">
        {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </text>
    </svg>
  )
}

export function WeatherCard() {
  const { entities, sendMessage, connected } = useHA()
  const [forecast, setForecast] = useState([])
  const [openDay, setOpenDay] = useState(null)
  const weather = e(entities, 'weather.forecast_stauferabby')
  const sun = e(entities, 'sun.sun')
  const solcastHeute = e(entities, 'sensor.solcast_pv_forecast_prognose_heute')
  const solcastMorgen = e(entities, 'sensor.solcast_pv_forecast_prognose_morgen')
  const solcastPeakMorgen = e(entities, 'sensor.solcast_pv_forecast_prognose_spitzenleistung_morgen')
  const solcastPeakZeit = e(entities, 'sensor.solcast_pv_forecast_zeitpunkt_spitzenleistung_morgen')

  useEffect(() => {
    if (!connected) return
    const fetchForecast = async () => {
      try {
        const result = await sendMessage({
          type: 'call_service', domain: 'weather', service: 'get_forecasts',
          service_data: { type: 'daily' },
          target: { entity_id: 'weather.forecast_stauferabby' },
          return_response: true,
        })
        const fc = result?.response?.['weather.forecast_stauferabby']?.forecast || []
        setForecast(fc.slice(0, 3))
      } catch (err) { console.warn('Forecast fetch failed:', err) }
    }
    fetchForecast()
    const iv = setInterval(fetchForecast, 1800000)
    return () => clearInterval(iv)
  }, [connected, sendMessage])

  if (!weather) return null

  const sunAttrs = sun?.attributes || {}

  const dayName = (iso) => {
    const d = new Date(iso), today = new Date(), tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Heute'
    if (d.toDateString() === tomorrow.toDateString()) return 'Morgen'
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
  }

  return (
    <Card>
      <Label>Wetter {'\u00B7'} StauferAbby</Label>
      <SunArc sunriseISO={sunAttrs.next_rising} sunsetISO={sunAttrs.next_setting} />
      {forecast.length > 0 && (
        <div className="mt-2 border-t border-border pt-3">
          <div className="text-xs text-text-muted font-mono tracking-[1.5px] mb-2 uppercase">Vorhersage</div>
          {solcastMorgen && (
            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-surface border border-border">
              <span className="text-base">{'☀️'}</span>
              <div className="flex-1 flex gap-3 text-xs font-mono">
                <span className="text-text-muted">Heute <span className="text-amber font-bold">{parseFloat(solcastHeute?.state || 0).toFixed(1)} kWh</span></span>
                <span className="text-text-muted">Morgen <span className="text-amber font-bold">{parseFloat(solcastMorgen.state).toFixed(1)} kWh</span></span>
                {solcastPeakMorgen && <span className="text-text-muted">Peak <span className="text-text-primary">{solcastPeakMorgen.state} W</span></span>}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {forecast.map((fc, i) => {
              const fcIcon = WEATHER_ICONS[fc.condition] || '\u2601\uFE0F'
              const hi = typeof fc.temperature === 'number' ? Math.round(fc.temperature) : '\u2013'
              const lo = typeof fc.templow === 'number' ? Math.round(fc.templow) : null
              const rain = typeof fc.precipitation === 'number' ? fc.precipitation : null
              return (
                <div key={i} onClick={() => setOpenDay({ ...fc, icon: fcIcon, hi, lo, rain, day: dayName(fc.datetime) })}
                  className="flex-1 p-2.5 rounded-[10px] bg-surface border border-border text-center cursor-pointer active:scale-95 transition-transform">
                  <div className="text-xs text-text-muted font-mono mb-1">{dayName(fc.datetime)}</div>
                  <div className="text-[26px] mb-1">{fcIcon}</div>
                  <div className="text-base font-bold text-white font-mono">{hi}{'\u00B0'}</div>
                  {lo !== null && <div className="text-[13px] text-text-muted font-mono">{lo}{'\u00B0'}</div>}
                  {rain !== null && rain > 0 && (
                    <div className="text-[11px] text-blue font-mono mt-0.5">{'\uD83C\uDF27'} {rain} mm</div>
                  )}
                </div>
              )
            })}
          </div>
          {openDay && (
            <InfoModal onClose={() => setOpenDay(null)} wide>
              <div className="text-center pt-4">
                <div className="text-xs text-text-muted font-mono mb-2">{openDay.day}</div>
                <div className="text-[56px] mb-2">{openDay.icon}</div>
                <div className="text-[42px] font-extrabold font-sans text-white">{openDay.hi}{'\u00B0'}</div>
                {openDay.lo !== null && <div className="text-lg text-text-muted font-mono">Min: {openDay.lo}{'\u00B0'}</div>}
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm font-mono">
                  {openDay.rain !== null && openDay.rain > 0 && (
                    <div className="p-2 rounded-lg bg-surface text-center">
                      <div className="text-blue text-lg font-bold">{openDay.rain} mm</div>
                      <div className="text-text-muted text-xs">Niederschlag</div>
                    </div>
                  )}
                  {typeof openDay.humidity === 'number' && (
                    <div className="p-2 rounded-lg bg-surface text-center">
                      <div className="text-teal text-lg font-bold">{openDay.humidity}%</div>
                      <div className="text-text-muted text-xs">Feuchte</div>
                    </div>
                  )}
                  {typeof openDay.wind_speed === 'number' && (
                    <div className="p-2 rounded-lg bg-surface text-center">
                      <div className="text-amber text-lg font-bold">{openDay.wind_speed} km/h</div>
                      <div className="text-text-muted text-xs">Wind</div>
                    </div>
                  )}
                  {openDay.condition && (
                    <div className="p-2 rounded-lg bg-surface text-center">
                      <div className="text-text-primary text-lg font-bold">{openDay.condition}</div>
                      <div className="text-text-muted text-xs">Zustand</div>
                    </div>
                  )}
                </div>
              </div>
            </InfoModal>
          )}
        </div>
      )}
    </Card>
  )
}
