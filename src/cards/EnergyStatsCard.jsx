import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useHA } from '../context/HAContext'
import { useSettings } from '../context/SettingsContext'
import { Card, Label, AutarkieGauge } from '../atoms'
import { SOLAR_INSTALL_DATE } from '../config'

// Saldierte Sensoren: Shelly per-Phase-Zaehler ueberzaehlen bei Saldierung
// einspeisung_tag = saldierter Export (Riemann-Summe, Einheit kWd → *24 = kWh)
// netzbezug_tag   = saldierter Import (Riemann-Summe, Einheit kWh)
const STAT_IDS = [
  'sensor.solakon_one_pv_energie',
  'sensor.netzbezug_tag',
  'sensor.einspeisung_tag',
  'sensor.solakon_one_batterie_entladeenergie',
  'sensor.solakon_one_batterie_ladeenergie',
]
// Fallback: per-Phase Bezug fuer Zeitraeume ohne saldierte Daten (netzbezug_tag neu erstellt)
const BEZUG_FALLBACK = 'sensor.shellypro3em_total_active_energy'
const KWD_TO_KWH = 24

function PeriodNav({ mode, offset, onCycleMode, onPrev, onNext }) {
  const now = new Date()
  let periodLabel
  if (mode === 'today' && offset === 0) {
    periodLabel = 'Heute'
  } else if (mode === 'today') {
    const d = new Date(now); d.setDate(d.getDate() + offset)
    periodLabel = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
  } else if (mode === 'week') {
    if (offset === 0) periodLabel = 'Diese Woche'
    else if (offset === -1) periodLabel = 'Letzte Woche'
    else {
      const d = new Date(now); const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1 + (offset * 7))
      const endD = new Date(d); endD.setDate(endD.getDate() + 6)
      periodLabel = `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} \u2013 ${endD.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`
    }
  } else {
    if (offset === 0) periodLabel = 'Dieser Monat'
    else if (offset === -1) periodLabel = 'Letzter Monat'
    else {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      periodLabel = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    }
  }
  const canGoForward = offset < 0

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 cursor-pointer" onClick={onCycleMode}>
        <span className="text-xs text-text-muted font-mono">ENERGIE-BILANZ</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-dim text-amber font-mono border border-amber-border">
          {mode === 'today' ? 'Tag' : mode === 'week' ? 'Woche' : 'Monat'}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span onClick={e => { e.stopPropagation(); onPrev() }}
          className="text-base text-text-muted px-1 cursor-pointer select-none">{'\u2039'}</span>
        <span className="text-[11px] text-text-muted font-mono min-w-[100px] text-center">{periodLabel}</span>
        <span onClick={e => { e.stopPropagation(); if (canGoForward) onNext() }}
          className={`text-base px-1 select-none ${canGoForward ? 'text-text-muted cursor-pointer' : 'text-dim cursor-default'}`}>{'\u203A'}</span>
      </div>
    </div>
  )
}

function DailyChart({ dailyPv, dailyBezug, dailyExport, todayPv, todayBezug, todayExport, includestoday, mode }) {
  const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

  const entries = (dailyPv || []).map((entry, i) => {
    const d = new Date(entry.start)
    const label = mode === 'week'
      ? DAY_NAMES[d.getDay()]
      : String(d.getDate())
    return {
      label,
      pv: Math.max(0, entry.change || 0),
      bezug: Math.max(0, dailyBezug?.[i]?.change || 0),
      einspeisung: Math.max(0, (dailyExport?.[i]?.change || 0) * KWD_TO_KWH),
    }
  })

  if (includestoday) {
    const now = new Date()
    entries.push({
      label: mode === 'week' ? DAY_NAMES[now.getDay()] : String(now.getDate()),
      pv: Math.max(0, todayPv || 0),
      bezug: Math.max(0, todayBezug || 0),
      einspeisung: Math.max(0, todayExport || 0),
      isToday: true,
    })
  }

  if (!entries.length) return null

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border border-border rounded-lg p-2 text-[11px] font-mono">
        <div className="font-bold text-text mb-1">{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value.toFixed(2)} kWh</div>
        ))}
      </div>
    )
  }

  // Ticks auduennen bei Monat (alle 5 Tage)
  const tickFormatter = mode === 'month'
    ? (val, i) => (i % 5 === 0 ? val : '')
    : val => val

  return (
    <div className="mt-4">
      <div className="text-[9px] text-text-muted font-mono tracking-wider mb-2">TAGESVERLAUG kWh</div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={entries} barCategoryGap="20%" barGap={2}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--color-text-muted)', fontFamily: 'monospace' }} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="pv" name="PV" radius={[3, 3, 0, 0]}>
            {entries.map((e, i) => (
              <Cell key={i} fill={e.isToday ? 'var(--color-amber)' : 'var(--color-amber-dim, color-mix(in srgb, var(--color-amber) 50%, transparent))'} opacity={e.isToday ? 1 : 0.7} />
            ))}
          </Bar>
          <Bar dataKey="bezug" name="Netzbezug" radius={[3, 3, 0, 0]}>
            {entries.map((e, i) => (
              <Cell key={i} fill={e.isToday ? 'var(--color-blue)' : 'var(--color-blue-dim, color-mix(in srgb, var(--color-blue) 50%, transparent))'} opacity={e.isToday ? 1 : 0.5} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 justify-center mt-1">
        <span className="text-[9px] font-mono text-amber">&#9646; PV-Ertrag</span>
        <span className="text-[9px] font-mono text-blue">&#9646; Netzbezug</span>
      </div>
    </div>
  )
}

function DetailModal({ stats, mode, offset, dailyData, todayStats, includestoday, onClose, onCycleMode, onPrev, onNext }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl p-4 sm:p-5 w-full max-w-[520px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-text-muted text-xl bg-transparent border-none cursor-pointer">{'\u2715'}</button>

        <PeriodNav mode={mode} offset={offset} onCycleMode={onCycleMode} onPrev={onPrev} onNext={onNext} />

        {/* Grosser Autarkie-Gauge */}
        <div className="flex justify-center mb-4">
          <AutarkieGauge value={stats.autarkiePct} size={140} />
        </div>

        {/* Detaillierte Metriken */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '\u2600\uFE0F', label: 'PV-Ertrag', val: stats.pvKwh.toFixed(2), unit: 'kWh', color: 'text-amber' },
            { icon: '\uD83C\uDFE0', label: 'Verbrauch', val: stats.verbrauchKwh.toFixed(2), unit: 'kWh', color: 'text-teal' },
            { icon: '\u2600\uFE0F\u2192\uD83C\uDFE0', label: 'Eigenverbrauch', val: stats.eigenverbrauchKwh.toFixed(2), unit: 'kWh', color: 'text-green' },
            { icon: '\u2193', label: 'Netzbezug', val: stats.bezugKwh.toFixed(2), unit: 'kWh', color: 'text-blue' },
            { icon: '\u2191', label: 'Einspeisung', val: stats.einspeisungKwh.toFixed(2), unit: 'kWh', color: 'text-red' },
            { icon: '\uD83D\uDCB0', label: 'Ersparnis', val: stats.savings.toFixed(2), unit: '\u20AC', color: 'text-green' },
          ].map(m => (
            <div key={m.label} className="p-2.5 rounded-[10px] bg-surface border border-border text-center">
              <div className="text-[13px] mb-0.5">{m.icon}</div>
              <div className={`text-lg font-extrabold font-sans leading-none ${m.color}`}>
                {m.val}<span className="text-[10px] text-text-muted font-mono"> {m.unit}</span>
              </div>
              <div className="text-[9px] text-text-muted tracking-wider mt-1 font-mono">{m.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Tages-Balkendiagramm fuer Wochen- und Monatsansicht */}
        {mode !== 'today' && (
          <DailyChart
            dailyPv={dailyData?.dailyPv}
            dailyBezug={dailyData?.dailyBezug}
            dailyExport={dailyData?.dailyExport}
            todayPv={todayStats?.pv}
            todayBezug={todayStats?.bezug}
            todayExport={todayStats?.export}
            includestoday={includestoday}
            mode={mode}
          />
        )}

        {/* Einspeisung-Hinweis */}
        {stats.einspeisungKwh > 0.01 && (
          <div className="mt-3 p-2 px-2.5 rounded-md bg-red-dim border border-red-border text-center">
            <span className="text-[11px] text-red font-mono">
              {stats.einspeisungKwh.toFixed(2)} kWh ungenutzt eingespeist ({((stats.einspeisungKwh / Math.max(0.01, stats.pvKwh)) * 100).toFixed(0)}% vom PV-Ertrag)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function EnergyStatsCard() {
  const { connected, sendMessage } = useHA()
  const { settings } = useSettings()

  // Auto-refresh alle 5 Minuten
  const [refreshTick, setRefreshTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setRefreshTick(t => t + 1), 300000)
    return () => clearInterval(iv)
  }, [])
  const [mode, setMode] = useState('month')
  const [offset, setOffset] = useState(0)
  const [statsData, setStatsData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  // todayStats wird unten per Statistics API abgefragt (alle Sensoren sind total_increasing)

  useEffect(() => {
    if (mode === 'today' && offset === 0) { setStatsData(null); return }
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
    // Zeitraum auf BKW-Installationsdatum begrenzen (davor: anderes System)
    const installDate = new Date(`${SOLAR_INSTALL_DATE}T00:00:00`)
    if (start < installDate) start = new Date(installDate)
    const includestoday = end > now && start <= now
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    // IMMER -1ms von end_time: HA Statistics inkludiert Eintraege bei exakter Grenze (Double-Counting)
    const queryEnd = includestoday ? new Date(todayMidnight.getTime() - 1) : new Date(end.getTime() - 1)
    if (queryEnd <= start) { setStatsData({ pv: 0, bezug: 0, export: 0 }); setLoading(false); return }
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(), end_time: queryEnd.toISOString(),
      statistic_ids: [...STAT_IDS, BEZUG_FALLBACK], period: 'day', types: ['change'],
    }).then(result => {
      const sum = (id) => (result?.[id] || []).reduce((acc, e) => acc + (e.change || 0), 0)
      const pvEntries = result?.[STAT_IDS[0]] || []
      const bezugEntries = result?.[STAT_IDS[1]] || []
      const exportEntries = result?.[STAT_IDS[2]] || []
      // Fallback auf per-Phase Shelly wenn saldierter Sensor noch keine volle Abdeckung hat
      const useSaldiert = bezugEntries.length >= pvEntries.length
      const bezug = useSaldiert ? sum(STAT_IDS[1]) : sum(BEZUG_FALLBACK)
      const bezugEntriesToUse = useSaldiert ? bezugEntries : (result?.[BEZUG_FALLBACK] || [])
      setStatsData({
        pv: sum(STAT_IDS[0]), bezug, export: sum(STAT_IDS[2]) * KWD_TO_KWH,
        batDischarge: sum(STAT_IDS[3]), batCharge: sum(STAT_IDS[4]),
        dailyPv: pvEntries, dailyBezug: bezugEntriesToUse, dailyExport: exportEntries,
      })
    }).catch(() => setStatsData(null)).finally(() => setLoading(false))
  }, [mode, offset, connected])

  const cycleMode = () => { setMode(m => m === 'today' ? 'week' : m === 'week' ? 'month' : 'today'); setOffset(0) }
  const prev = () => setOffset(o => o - 1)
  const next = () => { if (offset < 0) setOffset(o => o + 1) }

  // Werte berechnen: includestoday = ob der aktuelle Zeitraum "heute" enthaelt
  const includestoday = (() => {
    const now = new Date()
    if (mode === 'today') return offset === 0
    if (mode === 'week') {
      const d = new Date(now); const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1 + (offset * 7)); d.setHours(0, 0, 0, 0)
      const end = new Date(d); end.setDate(end.getDate() + 7)
      return end > now && d <= now
    }
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return end > now && d <= now
  })()

  // Alle Sensoren sind total_increasing → Stats API für heutige Werte
  const [todayStats, setTodayStats] = useState(null)
  useEffect(() => {
    if (!connected) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: todayStart.toISOString(), end_time: new Date().toISOString(),
      statistic_ids: [...STAT_IDS, BEZUG_FALLBACK], period: 'hour', types: ['change'],
    }).then(result => {
      const sum = (id) => (result?.[id] || []).reduce((acc, e) => acc + (e.change || 0), 0)
      const pvEntries = result?.[STAT_IDS[0]] || []
      const bezugEntries = result?.[STAT_IDS[1]] || []
      const bezug = bezugEntries.length >= pvEntries.length ? sum(STAT_IDS[1]) : sum(BEZUG_FALLBACK)
      setTodayStats({ pv: sum(STAT_IDS[0]), bezug, export: sum(STAT_IDS[2]) * KWD_TO_KWH, batDischarge: sum(STAT_IDS[3]), batCharge: sum(STAT_IDS[4]) })
    }).catch(() => {})
  }, [connected, refreshTick])

  // Finale Werte: Stats-Daten + heutige Stats (alle Sensoren via Statistics API)
  const todayPv = todayStats?.pv ?? 0
  const todayBezug = todayStats?.bezug ?? 0
  const todayExport = todayStats?.export ?? 0
  const todayBatDischarge = todayStats?.batDischarge ?? 0
  const todayBatCharge = todayStats?.batCharge ?? 0
  const finalPv = mode === 'today' && offset === 0 ? todayPv : (statsData?.pv ?? 0) + (includestoday ? todayPv : 0)
  const finalBezug = mode === 'today' && offset === 0 ? todayBezug : (statsData?.bezug ?? 0) + (includestoday ? todayBezug : 0)
  const finalEinspeisung = mode === 'today' && offset === 0 ? todayExport : (statsData?.export ?? 0) + (includestoday ? todayExport : 0)
  const finalBatDischarge = mode === 'today' && offset === 0 ? todayBatDischarge : (statsData?.batDischarge ?? 0) + (includestoday ? todayBatDischarge : 0)
  const finalBatCharge = mode === 'today' && offset === 0 ? todayBatCharge : (statsData?.batCharge ?? 0) + (includestoday ? todayBatCharge : 0)
  const finalVerbrauch = Math.max(0, finalPv + finalBezug - finalEinspeisung + finalBatDischarge - finalBatCharge)
  const finalEigenverbrauch = Math.max(0, finalPv - finalEinspeisung)
  const finalAutarkie = finalVerbrauch > 0 ? Math.min(100, (finalEigenverbrauch / finalVerbrauch) * 100) : 0
  const finalSavings = (finalEigenverbrauch * settings.strompreis) + (finalEinspeisung * settings.einspeiseverguetung)

  const stats = {
    pvKwh: finalPv, bezugKwh: finalBezug, einspeisungKwh: finalEinspeisung,
    verbrauchKwh: finalVerbrauch, eigenverbrauchKwh: finalEigenverbrauch,
    autarkiePct: finalAutarkie, savings: finalSavings,
  }

  return (
    <>
      <Card style={{ cursor: 'pointer' }} onClick={() => setShowDetail(true)}>
        <PeriodNav mode={mode} offset={offset} onCycleMode={cycleMode} onPrev={prev} onNext={next} />

        <div className="flex items-center gap-4">
          {/* Autarkie Gauge */}
          <AutarkieGauge value={loading ? 0 : finalAutarkie} />

          {/* Metriken */}
          <div className="flex-1 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
            <div className="text-center">
              <div className="text-lg font-extrabold font-sans text-amber leading-none">
                {loading ? '...' : finalPv.toFixed(1)}
              </div>
              <div className="text-[9px] text-text-muted font-mono tracking-wider mt-0.5">{'\u2600\uFE0F'} SOLAR kWh</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-extrabold font-sans text-teal leading-none">
                {loading ? '...' : finalVerbrauch.toFixed(1)}
              </div>
              <div className="text-[9px] text-text-muted font-mono tracking-wider mt-0.5">{'\uD83C\uDFE0'} VERBR. kWh</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-extrabold font-sans text-red leading-none">
                {loading ? '...' : finalEinspeisung.toFixed(1)}
              </div>
              <div className="text-[9px] text-text-muted font-mono tracking-wider mt-0.5">{'\u2191'} EINSP. kWh</div>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-text-muted font-mono text-center mt-2 opacity-60">Antippen für Details</div>
      </Card>

      {showDetail && (
        <DetailModal
          stats={stats} mode={mode} offset={offset}
          dailyData={statsData} todayStats={todayStats} includestoday={includestoday}
          onClose={() => setShowDetail(false)}
          onCycleMode={cycleMode} onPrev={prev} onNext={next}
        />
      )}
    </>
  )
}
