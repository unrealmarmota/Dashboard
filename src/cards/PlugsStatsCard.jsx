import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useHA } from '../context/HAContext'
import { useSettings } from '../context/SettingsContext'
import { Card, Label, InfoModal } from '../atoms'
import { v } from '../config'

const COLORS = ['#818cf8', '#f472b6', '#22d3ee', '#fb923c', '#a78bfa', '#f97316', '#34d399', '#e879f9']
const ICONS  = ['\uD83D\uDD0C', '\uD83D\uDDA5\uFE0F', '\uD83D\uDC1F', '\u2615', '\uD83C\uDFAE', '\uD83E\uDDF5', '\u26A1', '\uD83D\uDCA1']

const PERIODS = [
  { key: 'today', label: 'Heute' },
  { key: 'week',  label: '7 Tage' },
  { key: 'month', label: 'Monat' },
]

const tooltipStyle = {
  background: 'var(--color-card)', border: '1px solid var(--color-border)',
  borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
}

function PeriodTabs({ period, setPeriod }) {
  return (
    <div className="flex gap-1">
      {PERIODS.map(p => (
        <button key={p.key} onClick={(e) => { e.stopPropagation(); setPeriod(p.key) }}
          className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors border ${period === p.key ? 'bg-teal/10 border-teal text-teal' : 'border-border text-text-muted bg-transparent'}`}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

function PlugDetailModal({ plug, rawH, rawD, stats, onClose }) {
  const { settings } = useSettings()
  const [period, setPeriod] = useState('today')

  const kwh = stats[plug.power]?.[period] ?? 0
  const eur = kwh * settings.strompreis
  const fmtKwh = (val) => val < 0.005 ? '\u2013' : `${val.toFixed(2)} kWh`
  const fmtEur = (val) => val < 0.001 ? '' : `${val.toFixed(2)} \u20AC`

  const chartData = (() => {
    if (period === 'today') {
      return (rawH[plug.power] || []).map(e => ({
        t: `${new Date(e.start).getHours()}:00`,
        value: Math.round(e.mean || 0),
      }))
    }
    const entries = period === 'week'
      ? (rawD[plug.power] || []).slice(-7)
      : (rawD[plug.power] || [])
    return entries.map(e => {
      const d = new Date(e.start)
      return {
        t: `${d.getDate()}.${d.getMonth() + 1}.`,
        value: Math.round((e.mean || 0) * 24 / 10) / 100,
      }
    })
  })()

  const yUnit = period === 'today' ? ' W' : ' kWh'

  return (
    <InfoModal onClose={onClose} wide>
      <div className="pt-2">
        <div className="text-center mb-4">
          <div className="text-3xl mb-1">{plug.icon}</div>
          <div className="text-lg font-semibold text-text-primary font-mono">{plug.label}</div>
          <div className="text-[11px] text-text-muted font-mono mt-0.5">{plug.id}</div>
        </div>

        {/* Periode-Auswahl */}
        <div className="flex justify-center mb-4">
          <PeriodTabs period={period} setPeriod={setPeriod} />
        </div>

        {/* Zusammenfassung */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PERIODS.map(p => (
            <div key={p.key}
              className={`p-2 rounded-lg border text-center ${period === p.key ? 'bg-surface border-teal/40' : 'bg-surface border-border'}`}>
              <div className="text-base font-bold font-mono" style={{ color: plug.color }}>
                {fmtKwh(stats[plug.power]?.[p.key] ?? 0)}
              </div>
              <div className="text-[9px] text-text-muted font-mono mt-0.5">{p.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Verlauf-Chart */}
        {chartData.length > 0 && (
          <div className="p-2.5 rounded-lg bg-surface border border-border">
            <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">
              {period === 'today' ? 'Leistungsverlauf heute (W)' : 'Tagesverbrauch (kWh)'}
            </div>
            <div style={{ width: '100%', height: 160 }}>
              <ResponsiveContainer>
                {period === 'today' ? (
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`plugGrad_${plug.label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={plug.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={plug.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" stroke="var(--color-text-muted)" tickLine={false}
                      fontSize={9} fontFamily="var(--font-mono)" interval={3} />
                    <YAxis stroke="var(--color-text-muted)" tickLine={false}
                      fontSize={9} fontFamily="var(--font-mono)" width={38} unit={yUnit} />
                    <Tooltip contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      formatter={(val) => [`${val}${yUnit}`, plug.label]} />
                    <Area type="monotone" dataKey="value"
                      stroke={plug.color} fill={`url(#plugGrad_${plug.label})`}
                      strokeWidth={1.5} dot={false} />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                    <XAxis dataKey="t" stroke="var(--color-text-muted)" tickLine={false}
                      fontSize={9} fontFamily="var(--font-mono)"
                      interval={period === 'week' ? 0 : Math.floor(chartData.length / 6)} />
                    <YAxis stroke="var(--color-text-muted)" tickLine={false}
                      fontSize={9} fontFamily="var(--font-mono)" width={38} unit={yUnit} />
                    <Tooltip contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      formatter={(val) => [`${val}${yUnit}`, plug.label]} />
                    <Bar dataKey="value" fill={plug.color} fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Kosten */}
        {eur > 0.001 && (
          <div className="mt-3 p-2.5 rounded-lg bg-surface border border-border flex justify-between items-center">
            <span className="text-[12px] text-text-muted font-mono">Kosten ({PERIODS.find(p => p.key === period)?.label})</span>
            <span className="text-base font-bold font-mono text-green">{fmtEur(eur)}</span>
          </div>
        )}
      </div>
    </InfoModal>
  )
}

export function PlugsStatsCard() {
  const { entities, connected, sendMessage } = useHA()
  const { settings } = useSettings()
  const [period, setPeriod] = useState('today')
  const [stats,  setStats]  = useState({})
  const [rawH,   setRawH]   = useState({}) // hourly entries
  const [rawD,   setRawD]   = useState({}) // daily entries
  const [openAll,    setOpenAll]    = useState(false)
  const [openPlug,   setOpenPlug]   = useState(null)  // individual plug detail
  const [tick,   setTick]   = useState(0)

  // Auto-discover alle sensor.steckdose_*_power
  const PLUGS = useMemo(() => {
    const keys = Object.keys(entities).filter(id => /^sensor\.steckdose_.*_power$/.test(id))
    return keys.map((power, i) => {
      const name = power.replace('sensor.steckdose_', '').replace('_power', '')
      const switchId = `switch.steckdose_${name}`
      const label = entities[power]?.attributes?.friendly_name?.replace(/^Steckdose\s*/i, '').replace(/\s*Leistung$/i, '').trim() || name
      return { id: switchId, label, power, icon: ICONS[i % ICONS.length], color: COLORS[i % COLORS.length] }
    }).sort((a, b) => a.label.localeCompare(b.label, 'de'))
  }, [Object.keys(entities).filter(id => /^sensor\.steckdose_.*_power$/.test(id)).join()])
  const STAT_IDS = useMemo(() => PLUGS.map(p => p.power), [PLUGS])

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 300000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!connected || STAT_IDS.length === 0) return
    const now        = new Date()
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    // Monat: seit 1. des aktuellen Monats (nicht rolling 30 Tage)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    Promise.all([
      sendMessage({
        type: 'recorder/statistics_during_period',
        start_time: todayStart.toISOString(), end_time: now.toISOString(),
        statistic_ids: STAT_IDS, period: 'hour', types: ['mean'],
      }),
      sendMessage({
        type: 'recorder/statistics_during_period',
        start_time: monthStart.toISOString(), end_time: now.toISOString(),
        statistic_ids: STAT_IDS, period: 'day', types: ['mean'],
      }),
    ]).then(([hourly, daily]) => {
      const result = {}, rH = {}, rD = {}
      for (const sid of STAT_IDS) {
        const hEntries = hourly?.[sid] || []
        const dEntries = daily?.[sid]  || []
        const todayKwh = hEntries.reduce((s, e) => s + (e.mean || 0), 0) / 1000
        const weekKwh  = dEntries.slice(-7).reduce((s, e) => s + (e.mean || 0) * 24, 0) / 1000
        // Monat: alle Eintraege seit 1. (rawD enthaelt nur Monatsdaten)
        const monthKwh = dEntries.reduce((s, e) => s + (e.mean || 0) * 24, 0) / 1000
        result[sid] = { today: todayKwh, week: weekKwh, month: monthKwh }
        rH[sid] = hEntries
        rD[sid] = dEntries
      }
      setStats(result); setRawH(rH); setRawD(rD)
    }).catch(() => {})
  }, [connected, tick, STAT_IDS.join()])

  const kwh      = (sid) => stats[sid]?.[period] ?? 0
  const liveW    = (sid) => { const w = parseFloat(v(entities, sid)); return isNaN(w) ? null : w }
  const totalKwh = PLUGS.reduce((s, p) => s + kwh(p.power), 0)
  const totalEur = totalKwh * settings.strompreis
  const fmtKwh   = (val) => val < 0.005 ? '\u2013' : `${val.toFixed(2)} kWh`
  const fmtEur   = (val) => val < 0.001 ? '' : `${val.toFixed(2)} \u20AC`

  // Chart data fuer Gesamt-Modal
  const chartData = (() => {
    if (period === 'today') {
      const hourMap = {}
      for (const p of PLUGS) {
        for (const e of (rawH[p.power] || [])) {
          const h = new Date(e.start).getHours()
          if (!hourMap[h]) hourMap[h] = { t: `${h}:00` }
          hourMap[h][p.label] = Math.round(e.mean || 0)
        }
      }
      return Array.from({ length: 24 }, (_, h) => ({ t: `${String(h).padStart(2,'0')}:00`, ...(hourMap[h] || {}) }))
        .filter(d => Object.keys(d).length > 1)
    }
    const dateMap = {}
    for (const p of PLUGS) {
      const entries = period === 'week' ? (rawD[p.power] || []).slice(-7) : (rawD[p.power] || [])
      for (const e of entries) {
        const d = new Date(e.start)
        const key = d.toISOString().slice(0, 10)
        if (!dateMap[key]) dateMap[key] = { t: `${d.getDate()}.${d.getMonth() + 1}.`, _ts: d.getTime() }
        dateMap[key][p.label] = Math.round((e.mean || 0) * 24 / 10) / 100
      }
    }
    return Object.values(dateMap).sort((a, b) => a._ts - b._ts)
  })()

  const hasChart = chartData.length > 0
  const yUnit    = period === 'today' ? ' W' : ' kWh'
  const yLabel   = period === 'today' ? 'Mittl. Leistung (W)' : 'Tagesverbrauch (kWh)'

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <Label>{'\uD83D\uDD0C'} Steckdosen-Statistik</Label>
          <PeriodTabs period={period} setPeriod={setPeriod} />
        </div>

        <div className="flex flex-col">
          {PLUGS.map((p, i) => {
            const k   = kwh(p.power)
            const eur = k * settings.strompreis
            const w   = liveW(p.power)
            return (
              <div key={p.id}
                onClick={() => setOpenPlug(p)}
                className={`flex items-center gap-2.5 py-2.5 cursor-pointer hover:bg-surface/40 rounded px-1 transition-colors ${i < PLUGS.length - 1 ? 'border-b border-border' : ''}`}>
                <span className="text-lg w-6 text-center">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary">{p.label}</div>
                  {w !== null && <div className="text-[11px] font-mono" style={{ color: p.color }}>{'\u26A1'} {w.toFixed(0)} W</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-text-primary">{fmtKwh(k)}</div>
                  {eur > 0 && <div className="text-[11px] font-mono text-green">{fmtEur(eur)}</div>}
                </div>
                <span className="text-text-muted text-xs ml-1">{'\u203A'}</span>
              </div>
            )
          })}

          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border px-1 cursor-pointer hover:bg-surface/30 rounded"
            onClick={() => setOpenAll(true)}>
            <span className="text-[12px] text-text-muted font-mono">Gesamt ({PERIODS.find(p => p.key === period)?.label})</span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-mono font-bold text-text-primary">{totalKwh.toFixed(2)} kWh</span>
              {totalEur > 0 && <span className="text-[12px] font-mono text-green">{fmtEur(totalEur)}</span>}
              <span className="text-text-muted text-xs">{'\u203A'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Individuelle Steckdose Detail-Modal */}
      {openPlug && (
        <PlugDetailModal
          plug={openPlug}
          rawH={rawH}
          rawD={rawD}
          stats={stats}
          onClose={() => setOpenPlug(null)}
        />
      )}

      {/* Gesamt-Übersicht Modal */}
      {openAll && (
        <InfoModal onClose={() => setOpenAll(false)} wide>
          <div className="pt-2">
            <div className="text-center mb-3">
              <div className="text-2xl mb-1">{'\uD83D\uDD0C'}</div>
              <div className="text-base font-semibold text-text-primary font-mono">Steckdosen-Verbrauch</div>
              <div className="text-[11px] text-text-muted font-mono mt-0.5">{'\u00D8'}-Leistung \u00D7 Zeit</div>
            </div>

            <div className="flex gap-1 mb-4 justify-center">
              <PeriodTabs period={period} setPeriod={setPeriod} />
            </div>

            {/* Verbrauchskurve */}
            {hasChart && (
              <div className="mb-4 p-2.5 rounded-lg bg-surface border border-border">
                <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">{yLabel}</div>
                <div style={{ width: '100%', height: 160 }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                      <XAxis dataKey="t" stroke="var(--color-text-muted)" tickLine={false}
                        fontSize={9} fontFamily="var(--font-mono)"
                        interval={period === 'today' ? 3 : period === 'week' ? 0 : Math.floor(chartData.length / 6)} />
                      <YAxis stroke="var(--color-text-muted)" tickLine={false}
                        fontSize={9} fontFamily="var(--font-mono)" width={38} unit={yUnit} />
                      <Tooltip contentStyle={tooltipStyle}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        formatter={(val, name) => [`${val}${yUnit}`, name]}
                        labelFormatter={(l) => l} />
                      <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'var(--font-mono)', paddingTop: 4 }}
                        formatter={(val) => PLUGS.find(p => p.label === val)?.icon + ' ' + val} />
                      {PLUGS.map((p, i) => (
                        <Bar key={p.label} dataKey={p.label}
                          stackId="1" fill={p.color} fillOpacity={0.8}
                          radius={i === PLUGS.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Per-Plug Breakdown */}
            <div className="flex flex-col gap-2">
              {PLUGS.map(p => {
                const k   = kwh(p.power)
                const eur = k * settings.strompreis
                const w   = liveW(p.power)
                const pct = totalKwh > 0 ? (k / totalKwh) * 100 : 0
                return (
                  <div key={p.id} className="p-3 rounded-lg bg-surface border border-border cursor-pointer hover:border-border/80"
                    onClick={() => { setOpenAll(false); setOpenPlug(p) }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.icon}</span>
                        <span className="text-sm font-mono text-text-primary">{p.label}</span>
                        {w !== null && <span className="text-[11px] font-mono" style={{ color: p.color }}>{'\u26A1'}{w.toFixed(0)} W</span>}
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold font-mono text-text-primary">{fmtKwh(k)}</div>
                        {eur > 0 && <div className="text-[12px] font-mono text-green">{fmtEur(eur)}</div>}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                    <div className="text-[10px] text-text-muted font-mono mt-1">{pct.toFixed(0)}% des Gesamtverbrauchs &rsaquo; Tippen f&uuml;r Details</div>
                  </div>
                )
              })}

              <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                <div>
                  <div className="text-[11px] text-text-muted font-mono">Gesamt {PERIODS.find(p => p.key === period)?.label}</div>
                  <div className="text-xl font-bold font-mono text-text-primary">{totalKwh.toFixed(2)} kWh</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-text-muted font-mono">Kosten ({settings.strompreis} {'\u20AC'}/kWh)</div>
                  <div className="text-xl font-bold font-mono text-green">{fmtEur(totalEur)}</div>
                </div>
              </div>
            </div>
          </div>
        </InfoModal>
      )}
    </>
  )
}
