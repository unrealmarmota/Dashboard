import { useState, useEffect, useMemo } from 'react'
import { Card, Label, InfoModal } from '../atoms'
import { useHA } from '../context/HAContext'

const RAINVIEWER_URL = 'https://www.rainviewer.com/map.html?loc=48.8305,9.3169,10&oFa=1&oC=0&oU=0&oCS=0&oF=0&oAP=0&rmt=4&c=3&o=83&lm=0&th=0&sm=1&sn=1'

const HISTORY_IDS = [
  'sensor.gw3000a_outdoor_temperature',
  'sensor.gw3000a_humidity',
  'sensor.gw3000a_relative_pressure',
  'sensor.gw3000a_rain_rate_piezo',
  'sensor.gw3000a_uv_index',
]

function windDirLabel(deg) {
  const dirs = ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function uvColor(uv) {
  if (uv <= 2) return '#4ade80'
  if (uv <= 5) return '#facc15'
  if (uv <= 7) return '#f97316'
  if (uv <= 10) return '#f87171'
  return '#c084fc'
}

function uvLabel(uv) {
  if (uv <= 2) return 'Niedrig'
  if (uv <= 5) return 'Mittel'
  if (uv <= 7) return 'Hoch'
  if (uv <= 10) return 'Sehr hoch'
  return 'Extrem'
}

function fmt(val, dec = 1) {
  const n = parseFloat(val)
  return isNaN(n) ? '\u2013' : n.toFixed(dec)
}

function pressureTrend(delta) {
  if (delta == null || isNaN(delta)) return { arrow: '', label: '', color: '', forecast: '' }
  if (delta > 2)   return { arrow: '\u2B06\u2B06', label: 'Stark steigend', color: '#4ade80', forecast: 'Wird sonnig' }
  if (delta > 0.5) return { arrow: '\u2B06',   label: 'Steigend',       color: '#4ade80', forecast: 'Besserung' }
  if (delta > -0.5)return { arrow: '\u2194\uFE0F',  label: 'Stabil',         color: 'var(--color-text-muted)', forecast: 'Gleichbleibend' }
  if (delta > -2)  return { arrow: '\u2B07',   label: 'Fallend',        color: '#f97316', forecast: 'Wird schlechter' }
  return              { arrow: '\u2B07\u2B07', label: 'Stark fallend',  color: '#f87171', forecast: 'Sturm m\u00F6glich' }
}

function StatChip({ icon, value, unit, label, color, sub }) {
  return (
    <div className="px-2 py-1.5 rounded-xl bg-surface border border-border text-center">
      <div className="text-base leading-none mb-0.5">{icon}</div>
      <div className="text-lg font-bold font-sans leading-tight" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="text-xs text-text-muted font-normal ml-0.5">{unit}</span>}
      </div>
      <div className="text-[11px] text-text-muted font-sans mt-0.5 truncate">{label}</div>
      {sub && <div className="text-[10px] font-sans mt-0.5 truncate" style={{ color: sub.color || 'var(--color-text-muted)' }}>{sub.text}</div>}
    </div>
  )
}

function WeatherAnimation({ isRaining, solar, wind, uv }) {
  const isNight = solar < 10 && uv === 0
  const isSunny = !isNight && solar > 400
  const isCloudy = !isNight && solar >= 10 && solar <= 400
  const isWindy = wind > 20

  const rainDrops = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      x: 8 + (i * 9) % 64,
      delay: (i * 0.15) % 0.8,
      h: 6 + (i % 3) * 2,
    })), [])

  const stars = useMemo(() =>
    [{ x: 12, y: 10, r: 1 }, { x: 50, y: 8, r: 0.8 }, { x: 68, y: 18, r: 1.2 },
     { x: 30, y: 6, r: 0.7 }, { x: 58, y: 28, r: 0.9 }], [])

  const drift = isWindy ? 'wxDrift 2s ease-in-out infinite' : 'none'

  return (
    <div style={{ width: 80, height: 60, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <style>{`
        @keyframes wxRain { 0% { transform: translateY(-8px); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(60px); opacity: 0; } }
        @keyframes wxRainWindy { 0% { transform: translate(0,-8px) skewX(-15deg); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translate(12px,60px) skewX(-15deg); opacity: 0; } }
        @keyframes wxSunPulse { 0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 0.9; } 50% { transform: translate(-50%,-50%) scale(1.15); opacity: 1; } }
        @keyframes wxSunSpin { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes wxCloud1 { 0% { transform: translateX(-30px); } 100% { transform: translateX(85px); } }
        @keyframes wxCloud2 { 0% { transform: translateX(-20px); } 100% { transform: translateX(90px); } }
        @keyframes wxStarTwinkle { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes wxMoonGlow { 0%,100% { filter: drop-shadow(0 0 3px rgba(250,204,21,0.4)); } 50% { filter: drop-shadow(0 0 6px rgba(250,204,21,0.7)); } }
        @keyframes wxDrift { 0%,100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
      `}</style>
      <svg width="80" height="60" viewBox="0 0 80 60" fill="none"
        style={{ position: 'absolute', inset: 0, animation: drift }}>
        {isSunny && (
          <g>
            <circle cx="40" cy="24" r="16" fill="var(--color-amber)" opacity="0.15"
              style={{ transformOrigin: '40px 24px', animation: 'wxSunPulse 3s ease-in-out infinite' }} />
            <g style={{ transformOrigin: '40px 24px', animation: 'wxSunSpin 12s linear infinite' }}>
              {[0,45,90,135,180,225,270,315].map(deg => (
                <line key={deg} x1="40" y1="24"
                  x2={40 + Math.cos(deg * Math.PI / 180) * 18} y2={24 + Math.sin(deg * Math.PI / 180) * 18}
                  stroke="var(--color-amber)" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
              ))}
            </g>
            <circle cx="40" cy="24" r="7" fill="var(--color-amber)" opacity="0.85" />
          </g>
        )}
        {isCloudy && (
          <g>
            <g style={{ animation: `wxCloud1 ${isWindy ? '4s' : '8s'} linear infinite` }}>
              <ellipse cx="0" cy="20" rx="14" ry="7" fill="var(--color-text-muted)" opacity="0.35" />
              <ellipse cx="8" cy="16" rx="10" ry="6" fill="var(--color-text-muted)" opacity="0.3" />
            </g>
            <g style={{ animation: `wxCloud2 ${isWindy ? '5s' : '11s'} linear infinite`, animationDelay: '2s' }}>
              <ellipse cx="0" cy="32" rx="12" ry="6" fill="var(--color-text-muted)" opacity="0.25" />
              <ellipse cx="7" cy="28" rx="8" ry="5" fill="var(--color-text-muted)" opacity="0.2" />
            </g>
          </g>
        )}
        {isNight && (
          <g>
            <g style={{ animation: 'wxMoonGlow 4s ease-in-out infinite' }}>
              <circle cx="22" cy="20" r="10" fill="var(--color-amber)" opacity="0.85" />
              <circle cx="27" cy="17" r="8" fill="var(--color-bg, #0f172a)" />
            </g>
            {stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r}
                fill="var(--color-text-muted)"
                style={{ animation: `wxStarTwinkle ${1.5 + i * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }} />
            ))}
          </g>
        )}
        {isRaining && rainDrops.map((d, i) => (
          <line key={i} x1={d.x} y1={0} x2={d.x} y2={d.h}
            stroke="var(--color-blue)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"
            style={{ animation: `${isWindy ? 'wxRainWindy' : 'wxRain'} ${0.6 + d.delay}s linear infinite`, animationDelay: `${d.delay}s` }} />
        ))}
      </svg>
    </div>
  )
}

function WindCompass({ dir, dir10m, size = 80 }) {
  const c = size / 2
  const r = c - 8
  const toXY = (deg, rad) => {
    const a = (deg - 90) * Math.PI / 180
    return [c + rad * Math.cos(a), c + rad * Math.sin(a)]
  }
  const [ax, ay] = toXY(dir, r - 8)
  const [tx, ty] = toXY(dir + 180, r - 16)
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="shrink-0" style={{ width: size, height: size }}>
      <circle cx={c} cy={c} r={r} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={1} />
      {[['N',c,12],['S',c,size-8],['O',size-8,c+4],['W',8,c+4]].map(([l,x,y]) => (
        <text key={l} x={x} y={y} fontSize={9} textAnchor="middle" dominantBaseline="middle"
          fill="var(--color-text-muted)" fontFamily="var(--font-mono)">{l}</text>
      ))}
      {[0,45,90,135,180,225,270,315].map(d => {
        const [x1,y1] = toXY(d, r - 4); const [x2,y2] = toXY(d, r)
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-border)" strokeWidth={1} />
      })}
      {typeof dir10m === 'number' && !isNaN(dir10m) && (() => {
        const [ax2, ay2] = toXY(dir10m, r - 8)
        const [tx2, ty2] = toXY(dir10m + 180, r - 16)
        return <line x1={tx2} y1={ty2} x2={ax2} y2={ay2} stroke="var(--color-text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="2 2" opacity="0.6" />
      })()}
      <line x1={tx} y1={ty} x2={ax} y2={ay} stroke="var(--color-teal)" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={ax} cy={ay} r={3.5} fill="var(--color-teal)" />
      <circle cx={c} cy={c} r={3} fill="var(--color-text-muted)" />
    </svg>
  )
}

function SparkChart({ label, data, unit, color }) {
  if (!data || data.length < 2) return null
  const W = 280, H = 44
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 0.1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - 8 - ((v - min) / range) * (H - 16),
  ])
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${W},${H} L 0,${H} Z`
  const last = pts[pts.length - 1]
  const gradId = `sg-${label.replace(/\s/g, '')}`
  const isFloat = label === 'Luftdruck'
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[11px] text-text-muted font-sans uppercase tracking-wider">{label}</div>
        <div className="text-xs font-sans" style={{ color }}>
          <span className="font-bold">{data[data.length - 1].toFixed(isFloat ? 1 : 0)}</span>
          <span className="text-text-muted ml-0.5">{unit}</span>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden bg-surface border border-border px-2 pt-1 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 44 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
          <text x={2} y={H - 2} fontSize={9} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">{min.toFixed(isFloat ? 1 : 0)}</text>
          <text x={W - 2} y={H - 2} fontSize={9} fill="var(--color-text-muted)" fontFamily="var(--font-mono)" textAnchor="end">{max.toFixed(isFloat ? 1 : 0)}</text>
        </svg>
      </div>
    </div>
  )
}

function StatBox({ label, value, unit, color = 'text-text-primary', size = 'text-xl' }) {
  return (
    <div className="p-3 rounded-xl bg-surface border border-border">
      <div className={`${size} font-bold font-sans ${color} leading-tight`}>
        {value}{unit && <span className="text-xs text-text-muted font-normal ml-0.5">{unit}</span>}
      </div>
      <div className="text-[11px] text-text-muted font-sans mt-0.5">{label}</div>
    </div>
  )
}

export function WeatherStationCard() {
  const { entities, connected, sendMessage } = useHA()
  const [showDetail, setShowDetail] = useState(false)
  const [history, setHistory] = useState({ temp: null, hum: null, pres: null, rain: null, uv: null })
  const [histLoading, setHistLoading] = useState(false)
  const [histHours, setHistHours] = useState(24)
  const [presDelta, setPresDelta] = useState(null)

  // Luftdrucktendenz: 3h-Delta laden
  useEffect(() => {
    if (!connected) return
    const now = new Date()
    const start = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      end_time: now.toISOString(),
      statistic_ids: ['sensor.gw3000a_relative_pressure'],
      period: 'hour',
      types: ['mean'],
    }).then(result => {
      const vals = (result?.['sensor.gw3000a_relative_pressure'] || []).map(e => e.mean).filter(v => v != null)
      if (vals.length >= 2) {
        setPresDelta(vals[vals.length - 1] - vals[0])
      }
    }).catch(() => {})
  }, [connected])

  const get = id => entities[id]?.state
  const isRaining = entities['binary_sensor.gw3000a_rain_state_piezo']?.state === 'on'

  const temp     = parseFloat(get('sensor.gw3000a_outdoor_temperature'))
  const feels    = parseFloat(get('sensor.gw3000a_feels_like_temperature'))
  const dew      = parseFloat(get('sensor.gw3000a_dewpoint'))
  const hum      = parseFloat(get('sensor.gw3000a_humidity'))
  const wSpd     = parseFloat(get('sensor.gw3000a_wind_speed'))
  const wGust    = parseFloat(get('sensor.gw3000a_wind_gust'))
  const wMaxGust = parseFloat(get('sensor.gw3000a_max_daily_gust'))
  const wDir     = parseInt(get('sensor.gw3000a_wind_direction')) || 0
  const wDir10m  = parseInt(get('sensor.gw3000a_wind_direction_10m_avg'))
  const rrRate   = parseFloat(get('sensor.gw3000a_rain_rate_piezo'))
  const rrHour   = parseFloat(get('sensor.gw3000a_hourly_rain_piezo'))
  const rrEvent  = parseFloat(get('sensor.gw3000a_event_rain_piezo'))
  const rrDay    = parseFloat(get('sensor.gw3000a_daily_rain_piezo'))
  const rr24h    = parseFloat(get('sensor.gw3000a_24h_rain_piezo'))
  const rrWeek   = parseFloat(get('sensor.gw3000a_weekly_rain_piezo'))
  const rrMonth  = parseFloat(get('sensor.gw3000a_monthly_rain_piezo'))
  const rrYear   = parseFloat(get('sensor.gw3000a_yearly_rain_piezo'))
  const uv       = parseInt(get('sensor.gw3000a_uv_index')) || 0
  const solar    = parseFloat(get('sensor.gw3000a_solar_radiation'))
  const lux      = parseFloat(get('sensor.gw3000a_solar_lux'))
  const pRel     = parseFloat(get('sensor.gw3000a_relative_pressure'))
  const pAbs     = parseFloat(get('sensor.gw3000a_absolute_pressure'))
  const inTemp   = parseFloat(get('sensor.gw3000a_indoor_temperature'))
  const inHum    = parseFloat(get('sensor.gw3000a_indoor_humidity'))
  const battV    = parseFloat(get('sensor.gw3000a_wh90_battery'))
  const vpd      = parseFloat(get('sensor.gw3000a_vapour_pressure_deficit'))
  const windchill= get('sensor.gw3000a_windchill')
  const windchillNum = parseFloat(windchill)
  const presTrend = pressureTrend(presDelta)

  // Verlauf laden wenn Modal geoeffnet oder Zeitraum geaendert
  useEffect(() => {
    if (!showDetail || !connected) return
    setHistLoading(true)
    const now = new Date()
    const start = new Date(now.getTime() - histHours * 60 * 60 * 1000)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      end_time: now.toISOString(),
      statistic_ids: HISTORY_IDS,
      period: 'hour',
      types: ['mean'],
    }).then(result => {
      const extract = id => (result?.[id] || []).map(e => e.mean).filter(v => v != null)
      setHistory({
        temp: extract('sensor.gw3000a_outdoor_temperature'),
        hum:  extract('sensor.gw3000a_humidity'),
        pres: extract('sensor.gw3000a_relative_pressure'),
        rain: extract('sensor.gw3000a_rain_rate_piezo'),
        uv:   extract('sensor.gw3000a_uv_index'),
      })
    }).catch(() => {}).finally(() => setHistLoading(false))
  }, [showDetail, connected, histHours])

  return (
    <>
      {/* ── Kompakte Karte (volle Breite) ── */}
      <Card onClick={() => setShowDetail(true)} className="cursor-pointer hover:border-teal-border transition-colors !p-2.5 sm:!p-3">
        <div className="flex items-center justify-between h-4">
          <div className="flex items-center gap-2">
            <span className="text-teal text-[10px]">{'\u25CF'}</span>
            {presTrend.forecast && (
              <span className="text-[11px] font-sans font-medium" style={{ color: presTrend.color }}>
                {presTrend.arrow} {presTrend.forecast}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono">
            {!isNaN(battV) && (
              <span className={battV < 2.0 ? 'text-amber' : ''}>{'\uD83D\uDD0B'} {battV.toFixed(2)}V</span>
            )}
          </div>
        </div>

        <div className="flex items-stretch gap-3 mt-1.5 flex-wrap sm:flex-nowrap">
          {/* Linke Spalte: grosse Temperatur + Animation */}
          <div className="shrink-0 min-w-[120px]">
            <div className="flex items-start gap-1">
              <div className="text-[44px] font-bold text-text-primary font-sans leading-none">
                {isNaN(temp) ? '\u2013' : temp.toFixed(1)}{'\u00B0'}
              </div>
              <WeatherAnimation isRaining={isRaining} solar={isNaN(solar) ? 0 : solar} wind={isNaN(wSpd) ? 0 : wSpd} uv={uv} />
            </div>
            <div className="text-[11px] text-text-muted font-sans mt-1.5">
              gef. <span className="text-amber font-medium">{isNaN(feels) ? '\u2013' : feels.toFixed(0)}{'\u00B0'}</span>
              {' '}{'\u00B7'} Tp. {isNaN(dew) ? '\u2013' : dew.toFixed(1)}{'\u00B0'}
              {' '}{'\u00B7'} <span className="text-blue font-medium">{isNaN(hum) ? '\u2013' : hum.toFixed(0)}%</span>
            </div>
            {!isNaN(windchillNum) && windchillNum < temp - 1 && (
              <div className="text-[10px] text-blue font-sans mt-0.5">
                Windchill {windchillNum.toFixed(1)}{'\u00B0'}
              </div>
            )}
          </div>

          {/* Rechte Spalte: Stat-Grid — Regen, Wind, Boeen, Druck, UV, Strahlung */}
          <div className="flex-1 grid grid-cols-[repeat(auto-fit,minmax(105px,1fr))] gap-2">
            <StatChip
              icon={!isNaN(rrRate) && rrRate > 0 ? '\uD83C\uDF27\uFE0F' : '\u2601\uFE0F'}
              value={fmt(rrRate, 1)}
              unit="mm/h"
              label={!isNaN(rrRate) && rrRate > 0 ? 'regnet!' : 'Regen'}
              color={!isNaN(rrRate) && rrRate > 0 ? '#60a5fa' : undefined}
            />
            <StatChip
              icon={'\uD83C\uDF2C\uFE0F'}
              value={fmt(wSpd, 1)}
              unit="km/h"
              label={`Wind ${windDirLabel(wDir)}`}
            />
            <StatChip
              icon={'\uD83D\uDCA8'}
              value={fmt(wGust, 1)}
              unit="km/h"
              label={'B\u00F6en'}
            />
            <StatChip
              icon={'\uD83D\uDCC8'}
              value={fmt(pRel, 0)}
              unit="hPa"
              label="Druck"
              sub={presTrend.label ? { text: `${presTrend.arrow} ${presTrend.label}`, color: presTrend.color } : undefined}
            />
            <StatChip
              icon={'\u2600\uFE0F'}
              value={`UV ${uv}`}
              label={uvLabel(uv)}
              color={uvColor(uv)}
            />
            <StatChip
              icon={'\u26A1'}
              value={fmt(solar, 0)}
              unit={'W/m\u00B2'}
              label="Strahlung"
            />
          </div>
        </div>

      </Card>

      {/* ── Detail Modal ── */}
      {showDetail && (
        <InfoModal onClose={() => setShowDetail(false)} extraWide>
          <div className="text-center mb-3">
            <div className="text-base font-semibold text-text-primary font-sans">{'\uD83D\uDCE1'} Wetter Detail</div>
            <div className="text-[11px] text-text-muted font-sans mt-0.5">GW3000A {'\u00B7'} Ecowitt Wittboy</div>
          </div>

          {/* 2-Spalten-Grid auf md+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            {/* Spalte 1: Temperatur, Innen, Wind */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[11px] text-text-muted font-sans mb-2 uppercase tracking-wider">Temperatur & Feuchte</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label={'Au\u00DFen'} value={isNaN(temp) ? '\u2013' : temp.toFixed(1)} unit={'\u00B0'} size="text-2xl" />
                  <StatBox label={'Gef\u00FChlt'} value={isNaN(feels) ? '\u2013' : feels.toFixed(1)} unit={'\u00B0'} color="text-amber" size="text-2xl" />
                  <StatBox label="Feuchte" value={isNaN(hum) ? '\u2013' : hum.toFixed(0)} unit="%" color="text-blue" />
                  <StatBox label="Taupunkt" value={isNaN(dew) ? '\u2013' : dew.toFixed(1)} unit={'\u00B0'} color="text-teal" />
                </div>
                {!isNaN(vpd) && (
                  <div className="mt-2 px-3 py-2 rounded-xl bg-surface border border-border flex items-center justify-between">
                    <span className="text-[11px] text-text-muted font-sans">Dampfdruckdefizit (VPD)</span>
                    <span className="text-sm font-bold font-sans text-text-primary">{vpd.toFixed(2)} <span className="text-[10px] text-text-muted font-normal">hPa</span></span>
                  </div>
                )}
              </div>

              {(!isNaN(inTemp) || !isNaN(inHum)) && (
                <div>
                  <div className="text-[11px] text-text-muted font-sans mb-2 uppercase tracking-wider">Innenklima (Sensor-Hub)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatBox label="Innen" value={isNaN(inTemp) ? '\u2013' : inTemp.toFixed(1)} unit={'\u00B0'} />
                    <StatBox label="Innen Feuchte" value={isNaN(inHum) ? '\u2013' : inHum.toFixed(0)} unit="%" color="text-blue" />
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] text-text-muted font-sans mb-2 uppercase tracking-wider">Wind</div>
                <div className="flex items-center gap-4 p-3 rounded-xl bg-surface border border-border">
                  <WindCompass dir={wDir} dir10m={!isNaN(wDir10m) ? wDir10m : undefined} />
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <div className="text-lg font-bold text-text-primary font-sans">{isNaN(wSpd) ? '\u2013' : wSpd.toFixed(1)}</div>
                        <div className="text-[10px] text-text-muted font-sans">Wind km/h</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber font-sans">{isNaN(wGust) ? '\u2013' : wGust.toFixed(1)}</div>
                        <div className="text-[10px] text-text-muted font-sans">{'B\u00F6en'} km/h</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-text-primary font-sans">{isNaN(wMaxGust) ? '\u2013' : wMaxGust.toFixed(1)}</div>
                        <div className="text-[10px] text-text-muted font-sans">Max heute</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="px-2 py-1 rounded-lg bg-teal-dim border border-teal-border inline-flex items-center gap-1.5">
                        <span className="text-teal text-sm font-bold font-sans">{windDirLabel(wDir)}</span>
                        <span className="text-text-muted text-xs font-sans">{wDir}{'\u00B0'}</span>
                      </div>
                      {!isNaN(wDir10m) && (
                        <div className="text-[10px] text-text-muted font-sans">
                          10-Min: {windDirLabel(wDir10m)} ({wDir10m}{'\u00B0'})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Spalte 2: UV/Solar, Niederschlag, Luftdruck, Sensor */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[11px] text-text-muted font-sans mb-2 uppercase tracking-wider">UV & Solar</div>
                <div className="p-3 rounded-xl bg-surface border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-sans text-text-primary">UV-Index</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-sans" style={{ color: uvColor(uv) }}>{uvLabel(uv)}</span>
                      <span className="text-lg font-bold font-sans" style={{ color: uvColor(uv) }}>{uv}</span>
                    </div>
                  </div>
                  <div className="relative pt-3 pb-1">
                    <div className="absolute top-0 z-10"
                      style={{ left: `${Math.min(100, Math.max(0, (uv / 11) * 100))}%`, transform: 'translateX(-50%)' }}>
                      <div className="flex flex-col items-center">
                        <div className="text-[9px] font-bold font-mono text-white leading-none mb-0.5"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{uv}</div>
                        <div style={{
                          width: 0, height: 0,
                          borderLeft: '5px solid transparent',
                          borderRight: '5px solid transparent',
                          borderTop: '6px solid white',
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))'
                        }} />
                      </div>
                    </div>
                    <div className="h-3 rounded-full"
                      style={{ background: 'linear-gradient(to right, #4ade80 0%, #facc15 27%, #f97316 55%, #f87171 82%, #c084fc 100%)' }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-text-muted font-sans mb-3 px-0.5">
                    <span>0</span><span>3</span><span>6</span><span>8</span><span>11</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm font-sans text-text-muted">Solarstrahlung</span>
                    <span className="text-sm font-bold font-sans text-amber">{isNaN(solar) ? '\u2013' : solar.toFixed(0)} W/m{'\u00B2'}</span>
                  </div>
                  {!isNaN(lux) && (
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
                      <span className="text-sm font-sans text-text-muted">Helligkeit</span>
                      <span className="text-sm font-bold font-sans text-text-primary">
                        {lux >= 1000 ? `${(lux / 1000).toFixed(1)}k` : lux.toFixed(0)} lx
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-text-muted font-sans mb-2 uppercase tracking-wider">
                  Niederschlag {isRaining && <span className="text-blue normal-case">{'\u00B7 regnet aktuell'}</span>}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Rate',   val: fmt(rrRate, 1),  unit: 'mm/h' },
                    { label: 'Stunde', val: fmt(rrHour, 1),  unit: 'mm'   },
                    { label: 'Heute',  val: fmt(rrDay, 1),   unit: 'mm'   },
                    { label: '24h',    val: fmt(rr24h, 1),   unit: 'mm'   },
                    { label: 'Woche',  val: fmt(rrWeek, 1),  unit: 'mm'   },
                    { label: 'Monat',  val: fmt(rrMonth, 1), unit: 'mm'   },
                  ].map(({ label, val, unit }) => (
                    <div key={label} className="p-2 rounded-xl bg-surface border border-border text-center">
                      <div className="text-base font-bold text-blue font-sans leading-tight">{val}</div>
                      <div className="text-[10px] text-text-muted font-sans">{unit}</div>
                      <div className="text-[10px] text-text-muted font-sans mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
                {!isNaN(rrEvent) && rrEvent > 0 && (
                  <div className="mt-2 text-[10px] text-text-muted font-sans text-center">
                    Event: <span className="text-blue font-medium">{rrEvent.toFixed(1)} mm</span>
                    {!isNaN(rrYear) && <span> {'\u00B7'} Jahr: <span className="text-text-primary font-medium">{rrYear.toFixed(1)} mm</span></span>}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] text-text-muted font-sans mb-2 uppercase tracking-wider">Luftdruck</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="Relativ" value={isNaN(pRel) ? '\u2013' : pRel.toFixed(1)} unit=" hPa" />
                  <StatBox label="Absolut" value={isNaN(pAbs) ? '\u2013' : pAbs.toFixed(1)} unit=" hPa" />
                </div>
                {presTrend.label && (
                  <div className="mt-2 px-3 py-2 rounded-xl bg-surface border border-border flex items-center justify-between">
                    <span className="text-[11px] text-text-muted font-sans">Tendenz (3h)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-sans" style={{ color: presTrend.color }}>
                        {presTrend.arrow} {presTrend.label}
                      </span>
                      {presDelta != null && (
                        <span className="text-[10px] text-text-muted font-mono">
                          {presDelta > 0 ? '+' : ''}{presDelta.toFixed(1)} hPa
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {presTrend.forecast && (
                  <div className="mt-1.5 px-3 py-2 rounded-xl border flex items-center justify-between"
                    style={{ borderColor: presTrend.color + '40', backgroundColor: presTrend.color + '10' }}>
                    <span className="text-[11px] text-text-muted font-sans">Wettertrend</span>
                    <span className="text-sm font-bold font-sans" style={{ color: presTrend.color }}>
                      {presTrend.forecast}
                    </span>
                  </div>
                )}
              </div>

              {!isNaN(battV) && (
                <div className="px-3 py-2 rounded-xl bg-surface border border-border flex items-center justify-between">
                  <span className="text-[11px] text-text-muted font-sans">{'\uD83D\uDD0B'} WH90 Sensor-Batterie</span>
                  <span className={`text-sm font-bold font-sans ${battV < 2.0 ? 'text-amber' : 'text-text-primary'}`}>
                    {battV.toFixed(2)} V
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Verlauf */}
          <div className="border-t border-border pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-text-muted font-sans uppercase tracking-wider">Verlauf</div>
              <div className="flex gap-1">
                {[24, 48].map(h => (
                  <button key={h} onClick={e => { e.stopPropagation(); setHistHours(h) }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${histHours === h ? 'bg-teal/[0.15] border-teal-border text-teal font-bold' : 'bg-transparent border-border text-text-muted'}`}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            {histLoading ? (
              <div className="text-center text-text-muted text-xs py-4">Lade Verlaufsdaten...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SparkChart label="Temperatur" data={history.temp} unit={'\u00B0C'} color="var(--color-amber)" />
                <SparkChart label="Feuchte" data={history.hum} unit="%" color="var(--color-blue)" />
                <SparkChart label="Luftdruck" data={history.pres} unit=" hPa" color="var(--color-teal)" />
                <SparkChart label="Regen" data={history.rain} unit=" mm/h" color="#60a5fa" />
                <SparkChart label="UV-Index" data={history.uv} unit="" color="#facc15" />
              </div>
            )}
          </div>

          {/* Regenradar */}
          <div className="border-t border-border pt-3 mt-3">
            <div className="text-[11px] text-text-muted font-sans mb-2 uppercase tracking-wider">Regenradar</div>
            <div className="rounded-xl overflow-hidden border border-border aspect-square">
              <iframe src={RAINVIEWER_URL} title="Regenradar" className="w-full h-full border-0" loading="lazy" />
            </div>
          </div>
        </InfoModal>
      )}
    </>
  )
}
