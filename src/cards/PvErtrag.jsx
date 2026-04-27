import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend } from 'recharts'
import { useHA } from '../context/HAContext'
import { useSettings } from '../context/SettingsContext'
import { InfoModal } from '../atoms'
import { SOLAR_INSTALL_DATE } from '../config'

const KWD_TO_KWH = 24

export function PvErtrag() {
  const { connected, sendMessage } = useHA()
  const { settings } = useSettings()
  const [mode, setMode] = useState('month')
  const [offset, setOffset] = useState(0)
  const [statsValue, setStatsValue] = useState(null)
  const [loading, setLoading] = useState(false)
  const [todayStatsValue, setTodayStatsValue] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [dailyHistory, setDailyHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)

  // Auto-refresh alle 5 Minuten
  const [refreshTick, setRefreshTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setRefreshTick(t => t + 1), 300000)
    return () => clearInterval(iv)
  }, [])

  // Heute: Statistics seit Mitternacht abfragen (Sensor ist total_increasing, kein daily reset)
  useEffect(() => {
    if (mode !== 'today' || offset !== 0 || !connected) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: todayStart.toISOString(), end_time: new Date().toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_energie'],
      period: 'hour', types: ['change'],
    }).then(result => {
      const stats = result?.['sensor.solakon_one_pv_energie'] || []
      setTodayStatsValue(stats.reduce((acc, e) => acc + (e.change || 0), 0))
    }).catch(() => {})
  }, [mode, offset, connected, refreshTick])

  useEffect(() => {
    if (mode === 'today' && offset === 0) { setStatsValue(null); return }
    if (!connected) return
    setLoading(true)
    const now = new Date()
    let start, end
    if (mode === 'today') {
      const d = new Date(now); d.setDate(d.getDate() + offset); d.setHours(0, 0, 0, 0)
      start = d; end = new Date(d); end.setDate(end.getDate() + 1)
    } else if (mode === 'week') {
      const d = new Date(now); const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1 + (offset * 7)); d.setHours(0, 0, 0, 0)
      start = new Date(d); end = new Date(d); end.setDate(end.getDate() + 7)
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      start = new Date(d); end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    const includestoday = end > now && start <= now
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    // IMMER -1ms von end_time: HA Statistics inkludiert Eintraege bei exakter Grenze (Double-Counting)
    const queryEnd = includestoday ? new Date(todayMidnight.getTime() - 1) : new Date(end.getTime() - 1)
    if (queryEnd <= start) { setStatsValue(0); setLoading(false); return }
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(), end_time: queryEnd.toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_energie'],
      period: 'day', types: ['change'],
    }).then(result => {
      const stats = result?.['sensor.solakon_one_pv_energie'] || []
      setStatsValue(stats.reduce((acc, e) => acc + (e.change || 0), 0))
    }).catch(() => setStatsValue(null)).finally(() => setLoading(false))
  }, [mode, offset, connected])

  // Taegliche Energie-Historie seit Installation (fuer Modal)
  useEffect(() => {
    if (!showModal || !connected) return
    setHistLoading(true)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: `${SOLAR_INSTALL_DATE}T00:00:00`,
      end_time: new Date().toISOString(),
      statistic_ids: [
        'sensor.solakon_one_pv_energie',
        'sensor.netzbezug_tag',
        'sensor.einspeisung_tag',
        'sensor.solakon_one_batterie_entladeenergie',
        'sensor.solakon_one_batterie_ladeenergie',
      ],
      period: 'day', types: ['change'],
    }).then(result => {
      const pvEntries = result?.['sensor.solakon_one_pv_energie'] || []
      const importEntries = result?.['sensor.netzbezug_tag'] || []
      const exportEntries = result?.['sensor.einspeisung_tag'] || []
      const batDisEntries = result?.['sensor.solakon_one_batterie_entladeenergie'] || []
      const batChaEntries = result?.['sensor.solakon_one_batterie_ladeenergie'] || []
      // Index by date for joining
      const importMap = {}; for (const e of importEntries) { importMap[new Date(e.start).toDateString()] = e.change || 0 }
      const exportMap = {}; for (const e of exportEntries) { exportMap[new Date(e.start).toDateString()] = (e.change || 0) * KWD_TO_KWH }
      const batDisMap = {}; for (const e of batDisEntries) { batDisMap[new Date(e.start).toDateString()] = Math.max(0, e.change || 0) }
      const batChaMap = {}; for (const e of batChaEntries) { batChaMap[new Date(e.start).toDateString()] = Math.max(0, e.change || 0) }
      const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      const hist = pvEntries.map(e => {
        const d = new Date(e.start)
        const key = d.toDateString()
        const isToday = key === new Date().toDateString()
        const pv    = Math.max(0, e.change || 0)
        const exp   = Math.max(0, exportMap[key] || 0)
        const imp   = Math.max(0, importMap[key] || 0)
        const batDis = batDisMap[key] || 0
        const batCha = batChaMap[key] || 0
        const eigen = Math.max(0, pv - exp)
        // Tatsaechlich solar-gedeckte Energie: eigen + Akkuentladung - Akkuladung
        // (Akkuentladung kommt aus gespeicherter Solar, ggf. vom Vortag)
        const selfSupplied = Math.max(0, eigen + batDis - batCha)
        const savings = selfSupplied * settings.strompreis
        return {
          date: d,
          label: isToday ? 'Heute' : `${dayNames[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`,
          shortLabel: `${d.getDate()}.${d.getMonth() + 1}.`,
          pv: Math.round(pv * 100) / 100,
          eigen: Math.round(selfSupplied * 100) / 100,
          exp: Math.round(exp * 100) / 100,
          imp: Math.round(imp * 100) / 100,
          savings: Math.round(savings * 100) / 100,
          autarkie: (selfSupplied + imp) > 0 ? Math.round(selfSupplied / (selfSupplied + imp) * 1000) / 10 : 0,
        }
      })
      setDailyHistory(hist)
    }).catch(() => {}).finally(() => setHistLoading(false))
  }, [showModal, connected])

  const cycleMode = () => { setMode(m => m === 'today' ? 'week' : m === 'week' ? 'month' : 'today'); setOffset(0) }

  const now = new Date()
  let displayValue, periodLabel
  if (mode === 'today' && offset === 0) {
    displayValue = todayStatsValue ?? 0; periodLabel = 'Heute'
  } else if (mode === 'today') {
    displayValue = statsValue ?? 0
    const d = new Date(now); d.setDate(d.getDate() + offset)
    periodLabel = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
  } else if (mode === 'week') {
    const d = new Date(now); const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1 + (offset * 7))
    const endD = new Date(d); endD.setDate(endD.getDate() + 6)
    displayValue = (statsValue ?? 0) + (offset === 0 ? (todayStatsValue ?? 0) : 0)
    periodLabel = offset === 0 ? 'Diese Woche' : offset === -1 ? 'Letzte Woche'
      : `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} \u2013 ${endD.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`
  } else {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    displayValue = (statsValue ?? 0) + (offset === 0 ? (todayStatsValue ?? 0) : 0)
    periodLabel = offset === 0 ? 'Dieser Monat' : offset === -1 ? 'Letzter Monat'
      : d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }

  const canGoForward = offset < 0

  // Stats fuer Modal
  const bestDay = dailyHistory.length > 0 ? dailyHistory.reduce((best, d) => d.pv > best.pv ? d : best, dailyHistory[0]) : null
  const totalPv = dailyHistory.reduce((acc, d) => acc + d.pv, 0)
  const totalEigen = dailyHistory.reduce((acc, d) => acc + d.eigen, 0)
  const totalExp = dailyHistory.reduce((acc, d) => acc + d.exp, 0)
  const totalImp = dailyHistory.reduce((acc, d) => acc + d.imp, 0)
  const totalSavings = dailyHistory.reduce((acc, d) => acc + d.savings, 0)
  const avgPv = dailyHistory.length > 0 ? totalPv / dailyHistory.length : 0
  const avgAutarkie = dailyHistory.length > 0 ? dailyHistory.reduce((acc, d) => acc + d.autarkie, 0) / dailyHistory.length : 0

  // Modal-View: letzte 14 oder 30 oder alle
  const [modalView, setModalView] = useState('14')
  // Chart-Typ: pv, energie, ersparnis, autarkie
  const [chartType, setChartType] = useState('pv')

  const last14 = dailyHistory.slice(-14)
  const last30 = dailyHistory.slice(-30)
  const chartData = modalView === '14' ? last14 : modalView === '30' ? last30 : dailyHistory
  const bestPv = bestDay?.pv || 0

  const tooltipStyle = { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }

  // Custom Tooltip fuer PV-Chart: zeigt alle Tageswerte
  const PvTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    if (!d) return null
    const rows = [
      { label: '\u2600\uFE0F PV-Ertrag',      val: d.pv,       color: 'var(--color-amber)' },
      { label: '\uD83C\uDF3F Eigenverbrauch',  val: d.eigen,    color: 'var(--color-teal)'  },
      { label: '\u2191 Einspeisung',           val: d.exp,      color: 'var(--color-text-muted)' },
      { label: '\u2193 Netzbezug',             val: d.imp,      color: 'var(--color-red)'   },
      { label: '\uD83C\uDFE0 Autarkie',        val: null, pct: d.autarkie, color: 'var(--color-blue)' },
    ]
    return (
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>{d.label}</div>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: r.color }}>
            <span>{r.label}</span>
            <span style={{ fontWeight: 'bold' }}>
              {r.val != null ? `${r.val.toFixed(2)} kWh` : `${r.pct?.toFixed(1) ?? 0}%`}
            </span>
          </div>
        ))}
      </div>
    )
  }
  const xAxisProps = {
    dataKey: 'shortLabel', stroke: 'var(--color-text-muted)', tickLine: false, fontFamily: 'var(--font-mono)',
    fontSize: chartData.length > 20 ? 7 : 9,
    interval: chartData.length > 20 ? Math.floor(chartData.length / 10) : 0,
    angle: chartData.length > 14 ? -45 : 0,
    textAnchor: chartData.length > 14 ? 'end' : 'middle',
    height: chartData.length > 14 ? 40 : 25,
  }
  const yAxisProps = { stroke: 'var(--color-text-muted)', fontSize: 9, tickLine: false, fontFamily: 'var(--font-mono)', width: 50 }

  const chartTypes = [
    { key: 'pv', label: 'PV-Ertrag', icon: '\u2600\uFE0F' },
    { key: 'energie', label: 'Energie', icon: '\u26A1' },
    { key: 'ersparnis', label: 'Ersparnis', icon: '\uD83D\uDCB0' },
    { key: 'autarkie', label: 'Autarkie', icon: '\uD83C\uDF3F' },
  ]

  return (
    <>
      <div className="mt-2 p-2.5 px-3 rounded-[10px] bg-surface border border-border cursor-pointer select-none active:scale-[0.98] transition-transform"
        onClick={() => setShowModal(true)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={e => { e.stopPropagation(); cycleMode() }}>
            <span className="text-[15px]">{'\u2600\uFE0F'}</span>
            <span className="text-xs text-text-muted font-mono">PV-ERTRAG</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-dim text-amber font-mono border border-amber-border">
              {mode === 'today' ? 'Tag' : mode === 'week' ? 'Woche' : 'Monat'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span onClick={e => { e.stopPropagation(); setOffset(o => o - 1) }}
              className="text-base text-text-muted px-1 cursor-pointer">{'\u2039'}</span>
            <span className="text-[11px] text-text-muted font-mono min-w-[90px] text-center">{periodLabel}</span>
            <span onClick={e => { e.stopPropagation(); if (canGoForward) setOffset(o => o + 1) }}
              className={`text-base px-1 ${canGoForward ? 'text-text-muted cursor-pointer' : 'text-dim cursor-default'}`}>{'\u203A'}</span>
          </div>
        </div>
        <div className="text-center mt-1.5">
          <span className="text-[26px] font-extrabold font-sans text-amber">
            {loading ? '...' : displayValue.toFixed(1)}
          </span>
          <span className="text-[13px] text-text-muted font-mono"> kWh</span>
        </div>
      </div>

      {showModal && (
        <InfoModal onClose={() => setShowModal(false)} wide>
          <div className="pt-2">
            <div className="text-center mb-3">
              <div className="text-3xl mb-1">{'\uD83D\uDCCA'}</div>
              <div className="text-lg font-semibold text-text-primary font-mono">Energie-Tagesuebersicht</div>
              <div className="text-xs text-text-muted font-mono">seit {new Date(SOLAR_INSTALL_DATE).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              <div className="p-1.5 rounded-lg bg-surface text-center">
                <div className="text-amber text-base font-bold font-mono">{totalPv.toFixed(1)}</div>
                <div className="text-text-muted text-[9px] font-mono">PV kWh</div>
              </div>
              <div className="p-1.5 rounded-lg bg-surface text-center">
                <div className="text-teal text-base font-bold font-mono">{totalEigen.toFixed(1)}</div>
                <div className="text-text-muted text-[9px] font-mono">Eigen kWh</div>
              </div>
              <div className="p-1.5 rounded-lg bg-surface text-center">
                <div className="text-green text-base font-bold font-mono">{totalSavings.toFixed(2)}{'\u20AC'}</div>
                <div className="text-text-muted text-[9px] font-mono">Gespart</div>
              </div>
              <div className="p-1.5 rounded-lg bg-surface text-center">
                <div className="text-text-primary text-base font-bold font-mono">{totalExp.toFixed(1)}</div>
                <div className="text-text-muted text-[9px] font-mono">Einsp. kWh</div>
              </div>
              <div className="p-1.5 rounded-lg bg-surface text-center">
                <div className="text-red text-base font-bold font-mono">{totalImp.toFixed(1)}</div>
                <div className="text-text-muted text-[9px] font-mono">Bezug kWh</div>
              </div>
              <div className="p-1.5 rounded-lg bg-surface text-center">
                <div className="text-blue text-base font-bold font-mono">{Math.round(avgAutarkie)}%</div>
                <div className="text-text-muted text-[9px] font-mono">{'\u00D8'} Autarkie</div>
              </div>
            </div>

            {bestDay && (
              <div className="mb-3 p-1.5 px-2.5 rounded-md bg-green/[0.08] border border-green/[0.15] text-center">
                <span className="text-[11px] text-green font-mono">
                  {'\uD83C\uDFC6'} Bester Tag: {bestDay.label} {'\u2014'} {bestDay.pv.toFixed(2)} kWh
                </span>
              </div>
            )}

            {/* Chart Type Toggle */}
            <div className="flex gap-1 mb-2 justify-center flex-wrap">
              {chartTypes.map(ct => (
                <button key={ct.key}
                  onClick={() => setChartType(ct.key)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono border transition-colors cursor-pointer ${
                    chartType === ct.key
                      ? 'bg-amber/20 border-amber/30 text-amber'
                      : 'bg-surface border-border text-text-muted'
                  }`}>
                  {ct.icon} {ct.label}
                </button>
              ))}
            </div>

            {/* Time Range Toggle */}
            <div className="flex gap-1 mb-3 justify-center">
              {[['14', '14T'], ['30', '30T'], ['all', 'Alle']].map(([key, label]) => (
                <button key={key}
                  onClick={() => setModalView(key)}
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono border transition-colors cursor-pointer ${
                    modalView === key
                      ? 'bg-surface border-text-muted text-text-primary'
                      : 'bg-transparent border-border text-text-muted'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Charts */}
            {histLoading ? (
              <div className="text-center py-8 text-text-muted font-mono text-sm">Lade Daten...</div>
            ) : chartData.length > 0 ? (
              <div className="p-2 rounded-lg bg-surface border border-border">
                {/* PV-Ertrag Chart */}
                {chartType === 'pv' && (
                  <>
                    <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1.5">PV-Ertrag pro Tag</div>
                    <div style={{ width: '100%', height: Math.max(180, Math.min(280, chartData.length * 6)) }}>
                      <ResponsiveContainer>
                        <BarChart data={chartData} barSize={chartData.length > 20 ? 8 : 14} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                          <XAxis {...xAxisProps} />
                          <YAxis {...yAxisProps} unit=" kWh" />
                          <ReferenceLine y={avgPv} stroke="var(--color-teal)" strokeDasharray="3 3" strokeOpacity={0.6} />
                          <Tooltip content={<PvTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="pv" radius={[3, 3, 0, 0]}>
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.pv >= bestPv && bestPv > 0 ? 'var(--color-green)' : 'var(--color-amber)'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between mt-1 px-1">
                      <span className="text-[9px] text-teal font-mono">{'\u2500\u2500'} {'\u00D8'} {avgPv.toFixed(2)} kWh/Tag</span>
                      <span className="text-[9px] text-green font-mono">{'\u2588'} = Rekord</span>
                    </div>
                  </>
                )}

                {/* Energie-Bilanz: Eigenverbrauch + Einspeisung (gestapelt) vs. Netzbezug */}
                {chartType === 'energie' && (
                  <>
                    <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1.5">Eigenverbrauch + Einspeisung vs. Netzbezug</div>
                    <div style={{ width: '100%', height: Math.max(180, Math.min(280, chartData.length * 6)) }}>
                      <ResponsiveContainer>
                        <BarChart data={chartData} barSize={chartData.length > 20 ? 6 : 10} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                          <XAxis {...xAxisProps} />
                          <YAxis {...yAxisProps} unit=" kWh" />
                          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            formatter={(val, name) => [`${val.toFixed(2)} kWh`, name === 'eigen' ? 'Eigenverbrauch' : name === 'exp' ? 'Einspeisung' : 'Netzbezug']}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ''} />
                          <Legend formatter={(val) => val === 'eigen' ? 'Eigen' : val === 'exp' ? 'Einsp.' : 'Bezug'}
                            wrapperStyle={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                          <Bar dataKey="eigen" stackId="pv" fill="var(--color-teal)" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="exp" stackId="pv" fill="var(--color-text-muted)" radius={[3, 3, 0, 0]} opacity={0.4} />
                          <Bar dataKey="imp" fill="var(--color-red)" radius={[3, 3, 0, 0]} opacity={0.7} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-3 mt-1">
                      <span className="text-[9px] font-mono"><span className="text-teal">{'\u2588'}</span> Eigenverbrauch</span>
                      <span className="text-[9px] font-mono text-text-muted">{'\u2588'} Einspeisung</span>
                      <span className="text-[9px] font-mono"><span className="text-red">{'\u2588'}</span> Netzbezug</span>
                    </div>
                  </>
                )}

                {/* Ersparnis pro Tag */}
                {chartType === 'ersparnis' && (
                  <>
                    <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1.5">Ersparnis pro Tag ({settings.strompreis.toFixed(2)} {'\u20AC'}/kWh)</div>
                    <div style={{ width: '100%', height: Math.max(180, Math.min(280, chartData.length * 6)) }}>
                      <ResponsiveContainer>
                        <BarChart data={chartData} barSize={chartData.length > 20 ? 8 : 14} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                          <XAxis {...xAxisProps} />
                          <YAxis {...yAxisProps} unit=" \u20AC" />
                          <ReferenceLine y={dailyHistory.length > 0 ? totalSavings / dailyHistory.length : 0}
                            stroke="var(--color-teal)" strokeDasharray="3 3" strokeOpacity={0.6} />
                          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            formatter={(val) => [`${val.toFixed(2)} \u20AC`, 'Ersparnis']}
                            labelFormatter={(_, payload) => {
                              const p = payload?.[0]?.payload
                              return p ? `${p.label} (${p.eigen.toFixed(2)} kWh Eigen)` : ''
                            }} />
                          <Bar dataKey="savings" fill="var(--color-green)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between mt-1 px-1">
                      <span className="text-[9px] text-teal font-mono">{'\u2500\u2500'} {'\u00D8'} {dailyHistory.length > 0 ? (totalSavings / dailyHistory.length).toFixed(2) : '0'} {'\u20AC'}/Tag</span>
                      <span className="text-[9px] text-green font-mono">Gesamt: {totalSavings.toFixed(2)} {'\u20AC'}</span>
                    </div>
                  </>
                )}

                {/* Autarkie pro Tag */}
                {chartType === 'autarkie' && (
                  <>
                    <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1.5">Autarkie pro Tag</div>
                    <div style={{ width: '100%', height: Math.max(180, Math.min(280, chartData.length * 6)) }}>
                      <ResponsiveContainer>
                        <BarChart data={chartData} barSize={chartData.length > 20 ? 8 : 14} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                          <XAxis {...xAxisProps} />
                          <YAxis {...yAxisProps} unit="%" domain={[0, 100]} />
                          <ReferenceLine y={avgAutarkie} stroke="var(--color-teal)" strokeDasharray="3 3" strokeOpacity={0.6} />
                          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            formatter={(val) => [`${typeof val === 'number' ? val.toFixed(1) : val}%`, 'Autarkie']}
                            labelFormatter={(_, payload) => {
                              const p = payload?.[0]?.payload
                              return p ? `${p.label} (${p.eigen.toFixed(2)} kWh Eigen, ${p.imp.toFixed(2)} kWh Bezug)` : ''
                            }} />
                          <Bar dataKey="autarkie" radius={[3, 3, 0, 0]}>
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.autarkie >= 80 ? 'var(--color-green)' : entry.autarkie >= 50 ? 'var(--color-teal)' : entry.autarkie >= 20 ? 'var(--color-amber)' : 'var(--color-red)'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-3 mt-1">
                      <span className="text-[9px] font-mono"><span className="text-green">{'\u2588'}</span> {'\u2265'}80%</span>
                      <span className="text-[9px] font-mono"><span className="text-teal">{'\u2588'}</span> {'\u2265'}50%</span>
                      <span className="text-[9px] font-mono"><span className="text-amber">{'\u2588'}</span> {'\u2265'}20%</span>
                      <span className="text-[9px] font-mono"><span className="text-red">{'\u2588'}</span> {'<'}20%</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted font-mono text-sm">Keine Daten vorhanden</div>
            )}

            {/* Tages-Ranking Top 5 */}
            {dailyHistory.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-surface border border-border">
                <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">
                  Top 5 {chartType === 'pv' ? 'PV-Ertrag' : chartType === 'energie' ? 'Eigenverbrauch' : chartType === 'ersparnis' ? 'Ersparnis' : 'Autarkie'}
                </div>
                {[...dailyHistory].sort((a, b) =>
                  chartType === 'pv' ? b.pv - a.pv :
                  chartType === 'energie' ? b.eigen - a.eigen :
                  chartType === 'ersparnis' ? b.savings - a.savings :
                  b.autarkie - a.autarkie
                ).slice(0, 5).map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-text-muted w-4">{i + 1}.</span>
                      <span className="text-[11px] font-mono text-text-primary">
                        {d.date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span className={`text-[12px] font-bold font-mono ${i === 0 ? 'text-green' : 'text-amber'}`}>
                      {chartType === 'pv' ? `${d.pv.toFixed(2)} kWh` :
                       chartType === 'energie' ? `${d.eigen.toFixed(2)} kWh` :
                       chartType === 'ersparnis' ? `${d.savings.toFixed(2)} \u20AC` :
                       `${d.autarkie}%`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Durchschnitts-Zusammenfassung */}
            {dailyHistory.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-surface border border-border">
                <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Tagesdurchschnitte</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    ['\u2600\uFE0F PV-Ertrag', `${avgPv.toFixed(2)} kWh`, 'text-amber'],
                    ['\uD83C\uDF3F Eigenverbrauch', `${(totalEigen / dailyHistory.length).toFixed(2)} kWh`, 'text-teal'],
                    ['\u2191 Einspeisung', `${(totalExp / dailyHistory.length).toFixed(2)} kWh`, 'text-text-muted'],
                    ['\u2193 Netzbezug', `${(totalImp / dailyHistory.length).toFixed(2)} kWh`, 'text-red'],
                    ['\uD83D\uDCB0 Ersparnis', `${(totalSavings / dailyHistory.length).toFixed(2)} \u20AC`, 'text-green'],
                    ['\uD83C\uDFE0 Autarkie', `${Math.round(avgAutarkie)}%`, 'text-blue'],
                  ].map(([label, val, color]) => (
                    <div key={label} className="flex justify-between items-center py-0.5">
                      <span className="text-[11px] font-mono text-text-muted">{label}</span>
                      <span className={`text-[11px] font-bold font-mono ${color}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </InfoModal>
      )}
    </>
  )
}
