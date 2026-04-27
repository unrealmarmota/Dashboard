import { useState, useEffect, useRef } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useHA } from '../context/HAContext'
import { Card, InfoModal } from '../atoms'
import { v } from '../config'

const PERIODS = [
  { id: 'today', label: 'Heute', hours: 24 },
  { id: 'week', label: 'Woche', hours: 168 },
  { id: 'month', label: 'Monat', hours: 720 },
]

export function EnergyChart({ height = 140, compact = false }) {
  const { entities, connected, sendMessage } = useHA()
  const [period, setPeriod] = useState('today')
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const lastPeriodRef = useRef(null)

  const hours = PERIODS.find(p => p.id === period)?.hours || 168

  useEffect(() => {
    if (!connected) return
    if (lastPeriodRef.current === period && chartData.length > 0) return
    lastPeriodRef.current = period
    setLoading(true)
    const fetchHistory = async () => {
      try {
        const now = new Date()
        let start
        if (period === 'today') {
          start = new Date(now); start.setHours(0, 0, 0, 0)
        } else {
          start = new Date(now.getTime() - hours * 3600 * 1000)
        }
        const result = await sendMessage({
          type: 'history/history_during_period', start_time: start.toISOString(), end_time: now.toISOString(),
          entity_ids: ['sensor.solakon_one_pv_leistung', 'sensor.shellypro3em_total_active_power', 'sensor.solakon_one_batterie_leistung_2'],
          minimal_response: true, no_attributes: true, significant_changes_only: false,
        })
        if (!result) { setLoading(false); return }
        const buckets = {}
        const addToBucket = (entries, key) => {
          for (const entry of entries) {
            const raw = entry.lu ?? entry.last_changed ?? entry.last_updated
            const ts = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
            // Für "Heute" feiner bucketen (pro Stunde), für Woche/Monat pro Tag
            const bk = period === 'today'
              ? `${String(ts.getHours()).padStart(2, '0')}:${String(Math.floor(ts.getMinutes() / 15) * 15).padStart(2, '0')}`
              : `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}T${String(ts.getHours()).padStart(2, '0')}`
            if (!buckets[bk]) buckets[bk] = { solar: [], grid: [], battery: [] }
            const val = parseFloat(entry.s ?? entry.state)
            if (!isNaN(val)) buckets[bk][key].push(val)
          }
        }
        addToBucket(result['sensor.solakon_one_pv_leistung'] || [], 'solar')
        addToBucket(result['sensor.shellypro3em_total_active_power'] || [], 'grid')
        addToBucket(result['sensor.solakon_one_batterie_leistung_2'] || [], 'battery')
        const sorted = Object.keys(buckets).sort()
        setChartData(sorted.map(key => {
          const b = buckets[key]
          const solarAvg = b.solar.length > 0 ? b.solar.reduce((a, v) => a + v, 0) / b.solar.length : 0
          const gridAvg = b.grid.length > 0 ? b.grid.reduce((a, v) => a + v, 0) / b.grid.length : 0
          const batAvg = b.battery.length > 0 ? b.battery.reduce((a, v) => a + v, 0) / b.battery.length : 0
          let timeLabel
          if (period === 'today') {
            timeLabel = key
          } else if (period === 'week') {
            timeLabel = `${key.slice(8, 10)}.${key.slice(5, 7)} ${key.slice(11, 13)}h`
          } else {
            timeLabel = `${key.slice(8, 10)}.${key.slice(5, 7)}`
          }
          return { time: timeLabel, solar: Math.round(solarAvg), verbrauch: Math.max(0, Math.round(solarAvg + gridAvg + batAvg)), battery: Math.round(batAvg) }
        }))
      } catch (err) { console.warn('History fetch failed:', err) }
      setLoading(false)
    }
    fetchHistory()
  }, [connected, sendMessage, period, hours])

  // Auto-refresh alle 5 Minuten
  useEffect(() => {
    const iv = setInterval(() => { lastPeriodRef.current = null }, 300000)
    return () => clearInterval(iv)
  }, [])

  // Fallback realtime (nur wenn keine History-Daten)
  const lastRef = useRef(0)
  useEffect(() => {
    if (chartData.length > 0 || loading) return
    const now = Date.now()
    if (now - lastRef.current < 60000) return
    lastRef.current = now
    const solarW = parseFloat(v(entities, 'sensor.solakon_one_pv_leistung')) || 0
    const gridW = parseFloat(v(entities, 'sensor.shellypro3em_total_active_power')) || 0
    const batW = parseFloat(v(entities, 'sensor.solakon_one_batterie_leistung_2')) || 0
    const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    setChartData(prev => {
      const next = [...prev, { time, solar: Math.round(solarW), verbrauch: Math.max(0, Math.round(solarW + gridW + batW)), battery: Math.round(batW) }]
      return next.length > 120 ? next.slice(-120) : next
    })
  }, [entities, chartData.length, loading])

  const [showExpanded, setShowExpanded] = useState(false)
  const periodLabel = PERIODS.find(p => p.id === period)?.label || 'Woche'

  const renderChart = (chartHeight, sfx = '') => (
    <>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex gap-2">
          {[{ col: 'var(--color-amber)', l: 'Solar' }, { col: 'var(--color-teal)', l: 'Verbrauch' }, { col: '#a78bfa', l: 'Batterie' }].map(i => (
            <div key={i.l} className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded-sm" style={{ background: i.col }} />
              <span className="text-[10px] text-text-muted font-mono">{i.l}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => { if (p.id !== period) { lastPeriodRef.current = null; setPeriod(p.id) } }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border-none cursor-pointer transition-colors ${
                p.id === period ? 'bg-amber text-black font-bold' : 'bg-surface text-text-muted hover:text-text-primary'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: chartHeight }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[11px] text-text-muted font-mono">Lade {periodLabel}...</span>
          </div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id={`sg${sfx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-amber)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-amber)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`cg${sfx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-teal)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-teal)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={sfx ? 9 : 7} tickLine={false} fontFamily="var(--font-mono)" interval="preserveStartEnd" />
              <YAxis stroke="var(--color-text-muted)" fontSize={sfx ? 10 : 8} tickLine={false} unit=" W" fontFamily="var(--font-mono)" width={sfx ? 48 : 40} />
              <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: sfx ? 12 : 10, fontFamily: 'var(--font-mono)' }} labelStyle={{ color: 'var(--color-text-muted)' }} />
              <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="3 3" strokeOpacity={0.3} />
              <Area type="monotone" dataKey="solar" stroke="var(--color-amber)" fill={`url(#sg${sfx})`} strokeWidth={1.5} name="Solar (W)" />
              <Area type="monotone" dataKey="verbrauch" stroke="var(--color-teal)" fill={`url(#cg${sfx})`} strokeWidth={1.5} name="Verbrauch (W)" />
              <Line type="monotone" dataKey="battery" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="Batterie (W)" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  )

  if (compact) return <div className="mt-3">{renderChart(height)}</div>

  return (
    <>
      <Card accent>
        <div onClick={() => setShowExpanded(true)} className="cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted font-mono">SOLAR VS. VERBRAUCH</span>
          </div>
          {renderChart(height)}
        </div>
      </Card>
      {showExpanded && (
        <InfoModal onClose={() => setShowExpanded(false)} wide>
          <div className="pt-2">
            <div className="text-center mb-3">
              <span className="text-xs text-text-muted font-mono tracking-[1.5px]">SOLAR VS. VERBRAUCH</span>
            </div>
            {renderChart(300, 'E')}
          </div>
        </InfoModal>
      )}
    </>
  )
}
