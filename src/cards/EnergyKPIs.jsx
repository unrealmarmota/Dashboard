import { useState, useEffect, useRef } from 'react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { useHA } from '../context/HAContext'
import { useSettings } from '../context/SettingsContext'
import { Card, AutarkieGauge, InfoModal } from '../atoms'
import { v, SOLAR_PEAK_WP, SOLAR_INSTALL_DATE, MONTH_FACTORS, MONTH_NAMES } from '../config'
import { PvErtrag } from './PvErtrag'

export function EnergyKPIs() {
  const { entities, connected, sendMessage, callService } = useHA()
  const { settings, updateSetting } = useSettings()

  // Auto-refresh alle 5 Minuten
  const [refreshTick, setRefreshTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setRefreshTick(t => t + 1), 300000)
    return () => clearInterval(iv)
  }, [])
  const solarPower = v(entities, 'sensor.solakon_one_pv_leistung')
  const gridPower = v(entities, 'sensor.shellypro3em_total_active_power')
  const todayForecast = v(entities, 'sensor.energy_production_today')
  const todayRemaining = v(entities, 'sensor.energy_production_today_remaining')
  const tomorrowForecast = v(entities, 'sensor.energy_production_tomorrow')
  const batterySoc = v(entities, 'sensor.solakon_one_batterie_ladestand')
  const batteryPower = v(entities, 'sensor.solakon_one_batterie_leistung_2')
  const gridRaw = parseFloat(gridPower)
  const gridNum = gridRaw || 0
  const gridAvail = !isNaN(gridRaw)
  const solarNum = parseFloat(solarPower) || 0
  const batNum = parseFloat(batteryPower) || 0

  // Peak Solar seit Mitternacht (Statistics API max + Live-Tracking)
  const [peakSolar, setPeakSolar] = useState(0)
  useEffect(() => {
    if (!connected) return
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: midnight.toISOString(), end_time: new Date().toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_leistung'],
      period: '5minute', types: ['max'],
    }).then(result => {
      const entries = result?.['sensor.solakon_one_pv_leistung'] || []
      let max = 0
      for (const e of entries) { const val = e.max ?? 0; if (val > max) max = val }
      setPeakSolar(max)
    }).catch(() => {})
  }, [connected, refreshTick])
  useEffect(() => { if (solarNum > 0 && solarNum > peakSolar) setPeakSolar(solarNum) }, [solarNum])

  // Peak-Verlauf der letzten 30 Tage (fuer Woche/Monat-Ansicht)
  const [peakHistory, setPeakHistory] = useState([])
  const [peakView, setPeakView] = useState('7')
  useEffect(() => {
    if (!connected) return
    const end = new Date(); end.setHours(0, 0, 0, 0)
    const start = new Date(end); start.setDate(start.getDate() - 29) // 30 Tage
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(), end_time: new Date().toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_leistung'],
      period: 'day', types: ['max'],
    }).then(result => {
      const entries = result?.['sensor.solakon_one_pv_leistung'] || []
      const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      const hist = entries.map(e => {
        const d = new Date(e.start)
        const isToday = d.toDateString() === new Date().toDateString()
        return { day: isToday ? 'Heute' : `${dayNames[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`, shortDay: isToday ? 'H' : dayNames[d.getDay()], value: Math.round(e.max || 0), date: d }
      }).filter(e => e.value > 0)
      // Heutigen Peak aus Live-Tracking nehmen falls hoeher
      if (hist.length > 0) {
        const last = hist[hist.length - 1]
        if (last.day === 'Heute' && peakSolar > last.value) last.value = Math.round(peakSolar)
      }
      setPeakHistory(hist)
    }).catch(() => {})
  }, [connected, refreshTick])

  // Batterie-Zeit (dynamisch: Laden oder Entladen)
  const batteryCapacity = parseFloat(v(entities, 'sensor.solakon_one_batteriekapazitat')) || 2.24
  const socNum = parseFloat(batterySoc) || 0
  const minSoc = parseFloat(v(entities, 'number.solakon_one_minimaler_ladestand')) || 15
  const chargeW = Math.max(0, -batNum)
  const dischargeW = Math.max(0, batNum)
  const isCharging = chargeW > 10
  const isDischarging = dischargeW > 10

  let batteryTimeStr, batteryTimeLabel
  if (isCharging) {
    const remainWh = (100 - socNum) / 100 * batteryCapacity * 1000
    const mins = Math.round(remainWh / chargeW * 60)
    batteryTimeStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
    batteryTimeLabel = 'Voll in'
  } else if (isDischarging) {
    const remainWh = Math.max(0, (socNum - minSoc)) / 100 * batteryCapacity * 1000
    const mins = Math.round(remainWh / dischargeW * 60)
    batteryTimeStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
    batteryTimeLabel = 'Leer in'
  } else {
    batteryTimeStr = socNum >= 100 ? 'Voll' : socNum <= minSoc ? 'Min' : '\u2013'
    batteryTimeLabel = 'Akku-Zeit'
  }

  const consumption = Math.max(0, solarNum + gridNum + batNum)
  const feedIn = !gridAvail ? '\u2013' : gridNum < 0 ? Math.abs(gridNum).toFixed(0) : '0'
  const gridBuy = !gridAvail ? '\u2013' : gridNum > 0 ? gridNum.toFixed(0) : '0'
  const autarkie = Math.max(0, Math.min(100, ((Math.max(1, consumption) - Math.max(0, gridNum)) / Math.max(1, consumption)) * 100))
  const gridExportNum = Math.max(0, -gridNum) || 0
  const batChargeNum = Math.max(0, -batNum)
  const batDischargeNum = Math.max(0, batNum)
  const eigenverbrauch = Math.max(0, solarNum - gridExportNum)

  // Tages-Energiewerte via Statistics API
  const [todayPvEnergy, setTodayPvEnergy] = useState(null)
  const [todayGridImport, setTodayGridImport] = useState(null)
  const [todayGridExport, setTodayGridExport] = useState(null)
  const [todayBatDischarge, setTodayBatDischarge] = useState(null)
  const [todayBatCharge, setTodayBatCharge] = useState(null)
  useEffect(() => {
    if (!connected) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: todayStart.toISOString(), end_time: new Date().toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_energie', 'sensor.netzbezug_tag', 'sensor.einspeisung_tag', 'sensor.shellypro3em_total_active_energy', 'sensor.solakon_one_batterie_entladeenergie', 'sensor.solakon_one_batterie_ladeenergie'],
      period: 'hour', types: ['change'],
    }).then(result => {
      const sum = (arr) => (arr || []).reduce((acc, e) => acc + (e.change || 0), 0)
      setTodayPvEnergy(sum(result?.['sensor.solakon_one_pv_energie']))
      const pvEntries = result?.['sensor.solakon_one_pv_energie'] || []
      const bezugEntries = result?.['sensor.netzbezug_tag'] || []
      setTodayGridImport(bezugEntries.length >= pvEntries.length ? sum(bezugEntries) : sum(result?.['sensor.shellypro3em_total_active_energy']))
      setTodayGridExport(sum(result?.['sensor.einspeisung_tag']) * 24) // kWd -> kWh
      setTodayBatDischarge(sum(result?.['sensor.solakon_one_batterie_entladeenergie']))
      setTodayBatCharge(sum(result?.['sensor.solakon_one_batterie_ladeenergie']))
    }).catch(() => {})
  }, [connected, refreshTick])

  // History-Kurven fuer Batterie-SoC, Solar-Leistung und Verbrauch
  const [socHistory, setSocHistory] = useState([])
  const [solarHistory, setSolarHistory] = useState([])
  const [consumptionHistory, setConsumptionHistory] = useState([])
  const [gridHistory, setGridHistory] = useState([])
  const [batteryPowerHistory, setBatteryPowerHistory] = useState([])
  const [eigenverbrauchHistory, setEigenverbrauchHistory] = useState([])
  const histFetchRef = useRef(null)
  useEffect(() => {
    if (!connected) return
    const key = `${refreshTick}`
    if (histFetchRef.current === key) return
    histFetchRef.current = key
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    sendMessage({
      type: 'history/history_during_period',
      start_time: todayStart.toISOString(), end_time: new Date().toISOString(),
      entity_ids: ['sensor.solakon_one_batterie_ladestand', 'sensor.solakon_one_pv_leistung', 'sensor.shellypro3em_total_active_power', 'sensor.solakon_one_batterie_leistung_2'],
      minimal_response: true, no_attributes: true, significant_changes_only: false,
    }).then(result => {
      if (!result) return
      const bucket = (entries, mode = 'avg') => {
        const b = {}
        for (const e of entries) {
          const raw = e.lu ?? e.last_changed ?? e.last_updated
          const ts = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
          const hh = String(ts.getHours()).padStart(2, '0')
          const m = ts.getMinutes()
          const mm = String(m < 10 ? 0 : m < 20 ? 10 : m < 30 ? 20 : m < 40 ? 30 : m < 50 ? 40 : 50).padStart(2, '0')
          const k = `${hh}:${mm}`
          const val = parseFloat(e.s ?? e.state)
          if (!isNaN(val)) { if (!b[k]) b[k] = []; b[k].push(val) }
        }
        return Object.keys(b).sort().map(k => ({
          time: k,
          value: Math.round(mode === 'max' ? Math.max(...b[k]) : b[k].reduce((a, x) => a + x, 0) / b[k].length)
        }))
      }
      setSocHistory(bucket(result['sensor.solakon_one_batterie_ladestand'] || [], 'avg'))
      setSolarHistory(bucket(result['sensor.solakon_one_pv_leistung'] || [], 'max'))
      // Verbrauch = Solar + Grid + Batterie (pro 10-min Bucket, AVG)
      const gridHist = bucket(result['sensor.shellypro3em_total_active_power'] || [], 'avg')
      const solarHist = bucket(result['sensor.solakon_one_pv_leistung'] || [], 'avg')
      const batHist = bucket(result['sensor.solakon_one_batterie_leistung_2'] || [], 'avg')
      const timeMap = {}
      for (const e of solarHist) timeMap[e.time] = { s: e.value, g: 0, b: 0 }
      for (const e of gridHist) { if (!timeMap[e.time]) timeMap[e.time] = { s: 0, g: 0, b: 0 }; timeMap[e.time].g = e.value }
      for (const e of batHist) { if (timeMap[e.time]) timeMap[e.time].b = e.value }
      setConsumptionHistory(Object.keys(timeMap).sort().map(t => ({
        time: t,
        value: Math.max(0, Math.round(timeMap[t].s + timeMap[t].g + timeMap[t].b))
      })))
      setGridHistory(gridHist)
      setBatteryPowerHistory(batHist)
      // Eigenverbrauch = Solar - Export (Export = max(0, -Grid))
      setEigenverbrauchHistory(Object.keys(timeMap).sort().map(t => ({
        time: t,
        value: Math.max(0, Math.round(timeMap[t].s - Math.max(0, -timeMap[t].g)))
      })))
    }).catch(() => {})
  }, [connected, refreshTick])

  // Amortisierung via HA Statistics
  const [statsHist, setStatsHist] = useState({ pv: 0, export: 0 })
  useEffect(() => {
    if (!connected) return
    // Query bis JETZT (nicht gestern), da Shelly-Sensor kumulativ ist und wir
    // keine Live-Sensorwerte addieren koennen (Shelly = Gesamtzaehler, Solakon = Daily-Reset)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: `${SOLAR_INSTALL_DATE}T00:00:00`, end_time: new Date().toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_energie', 'sensor.einspeisung_tag'],
      period: 'day', types: ['change'],
    }).then(result => {
      const pvStats = result?.['sensor.solakon_one_pv_energie'] || []
      const exportStats = result?.['sensor.einspeisung_tag'] || []
      setStatsHist({
        pv: pvStats.reduce((acc, e) => acc + (e.change || 0), 0),
        export: exportStats.reduce((acc, e) => acc + (e.change || 0), 0) * 24, // kWd -> kWh
      })
    }).catch(() => {})
  }, [connected, refreshTick])

  // Stats gehen bis JETZT → heute ist bereits enthalten, keine Live-Werte addieren
  const pvGesamt = statsHist.pv
  const einspeisungGesamt = statsHist.export
  const eigenverbrauchKwh = Math.max(0, pvGesamt - einspeisungGesamt)
  const totalSavings = (eigenverbrauchKwh * settings.strompreis) + (einspeisungGesamt * settings.einspeiseverguetung)
  const amortPct = settings.anlagenkosten > 0 ? Math.min(100, (totalSavings / settings.anlagenkosten) * 100) : 0
  const daysSinceInstall = Math.max(1, Math.floor((Date.now() - new Date(SOLAR_INSTALL_DATE).getTime()) / 86400000))

  // Saisonale Hochrechnung
  const payoffEstimate = (() => {
    if (totalSavings <= 0 || daysSinceInstall < 1) return null
    if (totalSavings >= settings.anlagenkosten) return 'Amortisiert!'
    const now = new Date(), curMonth = now.getMonth()
    const dailySavings = totalSavings / daysSinceInstall
    const daysInMonth = new Date(now.getFullYear(), curMonth + 1, 0).getDate()
    const annualEstimate = MONTH_FACTORS[curMonth] > 0 ? (dailySavings * daysInMonth) / MONTH_FACTORS[curMonth] : 0
    if (annualEstimate <= 0) return null
    const remaining = settings.anlagenkosten - totalSavings
    let cumulative = annualEstimate * MONTH_FACTORS[curMonth] * ((daysInMonth - now.getDate()) / daysInMonth)
    let monthsFromNow = 1, m = (curMonth + 1) % 12
    while (cumulative < remaining && monthsFromNow < 240) { cumulative += annualEstimate * MONTH_FACTORS[m]; m = (m + 1) % 12; monthsFromNow++ }
    const payoffDate = new Date(now); payoffDate.setMonth(payoffDate.getMonth() + monthsFromNow)
    const years = Math.floor(monthsFromNow / 12), months = monthsFromNow % 12
    return `${MONTH_NAMES[payoffDate.getMonth()]} ${payoffDate.getFullYear()} (${years > 0 ? `~${years}J ${months}M` : `~${months} Monate`})`
  })()

  const [openKpi, setOpenKpi] = useState(null)
  const [showAmort, setShowAmort] = useState(false)

  const fmtInt = (val) => { const n = parseFloat(val); return isNaN(n) ? '\u2013' : Math.round(n).toString() }
  const todayForecastNum = parseFloat(todayForecast) || 0
  const todayEigenverbrauchKwh = todayPvEnergy !== null && todayGridExport !== null ? Math.max(0, todayPvEnergy - todayGridExport) : null
  const todayVerbrauchKwh = todayEigenverbrauchKwh !== null && todayGridImport !== null
    ? Math.max(0, todayEigenverbrauchKwh + todayGridImport + (todayBatDischarge ?? 0) - (todayBatCharge ?? 0))
    : null
  const todayAutarkiePct = todayVerbrauchKwh && todayVerbrauchKwh > 0 ? Math.round((todayEigenverbrauchKwh / todayVerbrauchKwh) * 100) : null

  const kpis = [
    { icon: '\u2600\uFE0F', label: 'Solar aktuell', val: fmtInt(solarPower), unit: 'W', details: [
      { label: 'Peak heute', val: `${peakSolar > 0 ? Math.round(peakSolar) : '\u2013'} W`, color: 'text-amber' },
      { label: 'Autarkie', val: `${Math.round(autarkie)}%`, color: 'text-green' },
      { label: 'Eigenverbrauch', val: `${eigenverbrauch.toFixed(0)} W`, color: 'text-teal' },
    ]},
    { icon: '\u26A1', label: 'Peak heute', val: peakSolar > 0 ? Math.round(peakSolar).toString() : '\u2013', unit: 'W', details: [
      { label: 'Aktuell', val: `${fmtInt(solarPower)} W`, color: 'text-amber' },
      { label: `% von ${SOLAR_PEAK_WP}Wp`, val: `${peakSolar > 0 ? Math.round(peakSolar / SOLAR_PEAK_WP * 100) : 0}%`, color: 'text-teal' },
    ]},
    { icon: '\uD83D\uDD0B', label: 'Batterie', val: batterySoc ?? '\u2013', unit: '%', hasMinSoc: true, details: [
      { label: 'Leistung', val: `${isCharging ? '\u2B06' : isDischarging ? '\u2B07' : '\u2013'} ${Math.abs(batNum).toFixed(0)} W`, color: isCharging ? 'text-teal' : isDischarging ? 'text-amber' : 'text-text-muted' },
      { label: 'Kapazit\u00E4t', val: `${batteryCapacity} kWh`, color: 'text-text-primary' },
      { label: 'Min-SoC', val: `${minSoc}%`, color: 'text-text-muted' },
    ]},
    { icon: isCharging ? '\u23F1' : isDischarging ? '\u23F3' : '\u23F1', label: batteryTimeLabel, val: batteryTimeStr, unit: '', hasBatteryPower: true, details: [
      { label: 'Leistung', val: `${isCharging ? chargeW.toFixed(0) : isDischarging ? dischargeW.toFixed(0) : '0'} W`, color: 'text-amber' },
      { label: 'Verbleibend', val: `${(Math.max(0, isCharging ? (100 - socNum) : (socNum - minSoc)) / 100 * batteryCapacity * 1000).toFixed(0)} Wh`, color: 'text-teal' },
      { label: 'SoC', val: `${socNum}%`, color: 'text-text-primary' },
    ]},
    { icon: '\uD83C\uDFE0', label: 'Verbrauch', val: Math.max(0, consumption).toFixed(0), unit: 'W', details: [
      { label: 'Solar', val: `${Math.max(0, eigenverbrauch).toFixed(0)} W`, color: 'text-amber' },
      { label: 'Batterie', val: `${batDischargeNum > 5 ? batDischargeNum.toFixed(0) : '0'} W`, color: 'text-teal' },
      { label: 'Netz', val: `${gridBuy} W`, color: 'text-blue' },
      { label: 'Heute gesamt', val: todayVerbrauchKwh !== null ? `${todayVerbrauchKwh.toFixed(2)} kWh` : '\u2013', color: 'text-text-primary' },
    ]},
    { icon: '\uD83C\uDF3F', label: 'Eigenverbr.', val: todayEigenverbrauchKwh !== null ? todayEigenverbrauchKwh.toFixed(2) : '\u2013', unit: 'kWh', details: [
      { label: 'Aktuell', val: `${eigenverbrauch.toFixed(0)} W`, color: 'text-teal' },
      { label: 'PV heute', val: todayPvEnergy !== null ? `${todayPvEnergy.toFixed(2)} kWh` : '\u2013', color: 'text-amber' },
      { label: 'Einspeisung', val: todayGridExport !== null ? `${todayGridExport.toFixed(2)} kWh` : '\u2013', color: 'text-text-muted' },
      { label: 'Eigenquote', val: todayPvEnergy && todayPvEnergy > 0 && todayEigenverbrauchKwh !== null ? `${Math.round(todayEigenverbrauchKwh / todayPvEnergy * 100)}%` : '\u2013', color: 'text-green' },
    ]},
    { icon: '\u2193', label: 'Netzbezug', val: todayGridImport !== null ? todayGridImport.toFixed(2) : '\u2013', unit: 'kWh', details: [
      { label: 'Aktuell', val: `${gridBuy} W`, color: 'text-blue' },
      { label: 'Kosten heute', val: todayGridImport !== null ? `${(todayGridImport * settings.strompreis).toFixed(2)} \u20AC` : '\u2013', color: 'text-red' },
      { label: 'Strompreis', val: `${settings.strompreis.toFixed(2)} \u20AC/kWh`, color: 'text-text-muted' },
      { label: 'Autarkie heute', val: todayAutarkiePct !== null ? `${todayAutarkiePct}%` : '\u2013', color: 'text-green' },
    ]},
    { icon: '\uD83D\uDCCA', label: 'Prognose', val: fmtInt(todayForecast), unit: 'kWh', hasPrognose: true, details: [
      { label: 'Ertrag heute', val: `${todayPvEnergy !== null ? todayPvEnergy.toFixed(2) : '\u2013'} kWh`, color: 'text-amber' },
      { label: 'Erreicht', val: todayForecastNum > 0 && todayPvEnergy !== null ? `${Math.round(todayPvEnergy / todayForecastNum * 100)}%` : '\u2013', color: 'text-green' },
      { label: 'Rest heute', val: `${parseFloat(todayRemaining) >= 0 ? parseFloat(todayRemaining).toFixed(2) : '\u2013'} kWh`, color: 'text-teal' },
      { label: 'Morgen', val: `${parseFloat(tomorrowForecast) > 0 ? parseFloat(tomorrowForecast).toFixed(2) : '\u2013'} kWh`, color: 'text-blue' },
    ]},
  ]

  return (
    <Card>
      {/* Autarkie + Eigenverbrauch */}
      <div className="flex gap-3 items-center mb-3">
        <AutarkieGauge value={autarkie} />
        <div className="flex-1">
          <div className="text-sm text-text-muted font-mono mb-1">Eigenverbrauch</div>
          <div className="text-[28px] font-extrabold font-sans text-white">
            {eigenverbrauch.toFixed(0)}<span className="text-[13px] text-text-muted"> W</span>
          </div>
          <div className="text-xs text-text-muted font-mono mt-1">
            {solarNum > 0 ? `${solarNum.toFixed(0)}W Solar \u2192 ${consumption.toFixed(0)}W Haus${batChargeNum > 5 ? ` + ${batChargeNum.toFixed(0)}W Akku` : ''}${gridExportNum > 5 ? ` + ${feedIn}W Netz` : ''}` : batDischargeNum > 5 ? `${batDischargeNum.toFixed(0)}W Akku \u2192 Haus` : 'Kein Solarertrag'}
          </div>
        </div>
      </div>

      {/* KPI Grid — 4 Spalten */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-1.5">
        {kpis.map(k => (
          <div key={k.label} onClick={() => setOpenKpi(k)}
            className="text-center py-2 px-0.5 rounded-lg bg-surface border border-border cursor-pointer active:scale-95 transition-transform">
            <div className="text-base mb-0.5">{k.icon}</div>
            <div className="text-lg font-extrabold font-sans text-white leading-none">
              {k.val}<span className="text-[9px] text-text-muted font-mono"> {k.unit}</span>
            </div>
            <div className="text-[8px] text-text-muted tracking-wider mt-[2px] font-mono">{k.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
      {openKpi && (
        <InfoModal onClose={() => setOpenKpi(null)}>
          <div className="text-center pt-4">
            <div className="text-3xl mb-2">{openKpi.icon}</div>
            <div className="text-[42px] font-extrabold font-sans text-white">{openKpi.val}<span className="text-lg text-text-muted font-mono"> {openKpi.unit}</span></div>
            <div className="text-sm text-text-muted font-mono mt-2">{openKpi.label}</div>
          </div>
          {openKpi.details && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {openKpi.details.map(d => (
                <div key={d.label} className="p-2 rounded-lg bg-surface text-center">
                  <div className={`text-lg font-bold font-mono ${d.color}`}>{d.val}</div>
                  <div className="text-text-muted text-xs font-mono">{d.label}</div>
                </div>
              ))}
            </div>
          )}
          {openKpi.label === 'Batterie' && socHistory.length > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Ladestand heute</div>
              <div style={{ width: '100%', height: 130 }}>
                <ResponsiveContainer>
                  <AreaChart data={socHistory}>
                    <defs>
                      <linearGradient id="socGradKpi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-teal)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-teal)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} fontFamily="var(--font-mono)" interval="preserveStartEnd" />
                    <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} unit="%" fontFamily="var(--font-mono)" width={36} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(val) => [`${val}%`, 'SoC']} />
                    <Area type="monotone" dataKey="value" stroke="var(--color-teal)" fill="url(#socGradKpi)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {openKpi.label === 'Peak heute' && peakHistory.length > 1 && (() => {
            const peakData = peakView === '7' ? peakHistory.slice(-7) : peakHistory
            const peakMax = peakData.length > 0 ? Math.max(...peakData.map(e => e.value)) : 0
            const peakAvg = peakData.length > 0 ? Math.round(peakData.reduce((s, e) => s + e.value, 0) / peakData.length) : 0
            return (
              <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Peak-Verlauf</div>
                  <div className="flex gap-1">
                    {[['7', '7 Tage'], ['30', '30 Tage']].map(([key, label]) => (
                      <button key={key} onClick={e => { e.stopPropagation(); setPeakView(key) }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer border transition-colors ${peakView === key ? 'bg-amber/10 border-amber text-amber' : 'border-border text-text-muted bg-transparent'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ width: '100%', height: 150 }}>
                  <ResponsiveContainer>
                    <BarChart data={peakData} barSize={peakData.length > 14 ? 10 : 18}>
                      <XAxis dataKey="shortDay" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} fontFamily="var(--font-mono)" />
                      <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} unit=" W" fontFamily="var(--font-mono)" width={44} />
                      <ReferenceLine y={peakAvg} stroke="var(--color-teal)" strokeDasharray="3 3" strokeOpacity={0.6} />
                      <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                        formatter={(val) => [`${val} W (${Math.round(val / SOLAR_PEAK_WP * 100)}%)`, 'Peak']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.day || ''}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {peakData.map((e, i) => (
                          <Cell key={i} fill={e.value >= peakMax && peakMax > 0 ? 'var(--color-green)' : 'var(--color-amber)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between mt-1 px-1">
                  <span className="text-[9px] text-teal font-mono">{'\u2500\u2500'} {'\u00D8'} {peakAvg} W</span>
                  <span className="text-[9px] text-green font-mono">{'\u2588'} = Rekord ({peakMax} W)</span>
                </div>
              </div>
            )
          })()}
          {openKpi.label === 'Solar aktuell' && solarHistory.length > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Leistungsverlauf heute</div>
              <div style={{ width: '100%', height: 130 }}>
                <ResponsiveContainer>
                  <AreaChart data={solarHistory}>
                    <defs>
                      <linearGradient id="solarGradKpi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-amber)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-amber)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} fontFamily="var(--font-mono)" interval="preserveStartEnd" />
                    <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} unit=" W" fontFamily="var(--font-mono)" width={40} />
                    <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(val) => [`${val} W`, 'Solar']} />
                    <Area type="monotone" dataKey="value" stroke="var(--color-amber)" fill="url(#solarGradKpi)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {openKpi.label === 'Verbrauch' && consumptionHistory.length > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Verbrauchsverlauf heute</div>
              <div style={{ width: '100%', height: 130 }}>
                <ResponsiveContainer>
                  <AreaChart data={consumptionHistory}>
                    <defs>
                      <linearGradient id="consGradKpi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-blue)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-blue)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} fontFamily="var(--font-mono)" interval="preserveStartEnd" />
                    <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} unit=" W" fontFamily="var(--font-mono)" width={40} />
                    <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(val) => [`${val} W`, 'Verbrauch']} />
                    <Area type="monotone" dataKey="value" stroke="var(--color-blue)" fill="url(#consGradKpi)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {openKpi.label === 'Netzbezug' && gridHistory.length > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Netzleistung heute</div>
              <div style={{ width: '100%', height: 130 }}>
                <ResponsiveContainer>
                  <LineChart data={gridHistory}>
                    <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} fontFamily="var(--font-mono)" interval="preserveStartEnd" />
                    <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} unit=" W" fontFamily="var(--font-mono)" width={44} />
                    <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(val) => [`${val} W`, val >= 0 ? 'Bezug' : 'Einspeisung']} />
                    <Line type="monotone" dataKey="value" stroke="var(--color-red)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-text-muted font-mono">{'\u2191'} Bezug = positiv</span>
                <span className="text-[9px] text-text-muted font-mono">{'\u2193'} Einspeisung = negativ</span>
              </div>
            </div>
          )}
          {openKpi.label === 'Eigenverbr.' && eigenverbrauchHistory.length > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Eigenverbrauch heute</div>
              <div style={{ width: '100%', height: 130 }}>
                <ResponsiveContainer>
                  <AreaChart data={eigenverbrauchHistory}>
                    <defs>
                      <linearGradient id="eigenGradKpi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-green)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-green)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} fontFamily="var(--font-mono)" interval="preserveStartEnd" />
                    <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} unit=" W" fontFamily="var(--font-mono)" width={40} />
                    <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(val) => [`${val} W`, 'Eigenverbr.']} />
                    <Area type="monotone" dataKey="value" stroke="var(--color-green)" fill="url(#eigenGradKpi)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {openKpi.hasBatteryPower && batteryPowerHistory.length > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Batterie-Leistung heute</div>
              <div style={{ width: '100%', height: 130 }}>
                <ResponsiveContainer>
                  <LineChart data={batteryPowerHistory}>
                    <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} fontFamily="var(--font-mono)" interval="preserveStartEnd" />
                    <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} unit=" W" fontFamily="var(--font-mono)" width={44} />
                    <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(val) => [`${val} W`, val >= 0 ? 'Entladen' : 'Laden']} />
                    <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-text-muted font-mono">{'\u2B06'} Entladen = positiv</span>
                <span className="text-[9px] text-text-muted font-mono">{'\u2B07'} Laden = negativ</span>
              </div>
            </div>
          )}
          {openKpi.hasPrognose && todayForecastNum > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-text-muted font-mono">Fortschritt heute</span>
                <span className="text-xs font-bold font-mono text-green">{todayPvEnergy !== null ? `${Math.round(todayPvEnergy / todayForecastNum * 100)}%` : '\u2013'}</span>
              </div>
              <div className="h-2 bg-dim rounded-sm overflow-hidden">
                <div className="h-full rounded-sm transition-[width] duration-500" style={{ width: `${todayPvEnergy !== null ? Math.min(100, todayPvEnergy / todayForecastNum * 100) : 0}%`, background: 'linear-gradient(90deg, var(--color-amber), var(--color-green))' }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-text-muted font-mono">{todayPvEnergy !== null ? todayPvEnergy.toFixed(2) : '0'} kWh</span>
                <span className="text-[10px] text-text-muted font-mono">{todayForecastNum.toFixed(2)} kWh</span>
              </div>
            </div>
          )}
          {openKpi.hasMinSoc && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-text-muted font-mono">Min-SoC einstellen</span>
                <span className="text-sm font-bold font-mono text-amber">{Math.round(minSoc)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(ev) => { ev.stopPropagation(); callService('number', 'set_value', { entity_id: 'number.solakon_one_minimaler_ladestand', value: Math.max(0, Math.round(minSoc) - 5) }) }}
                  className="w-7 h-7 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm font-bold">{'\u2212'}</button>
                <div className="flex-1 relative h-5 flex items-center">
                  <div className="absolute inset-x-0 h-1.5 rounded-sm bg-dim" />
                  <div className="absolute left-0 h-1.5 rounded-sm" style={{ width: `${minSoc}%`, background: 'linear-gradient(90deg, #d97706, var(--color-amber))' }} />
                  <input type="range" min={0} max={100} step={5} value={Math.round(minSoc)}
                    onChange={ev => { ev.stopPropagation(); callService('number', 'set_value', { entity_id: 'number.solakon_one_minimaler_ladestand', value: parseInt(ev.target.value) }) }}
                    onClick={ev => ev.stopPropagation()}
                    className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-5 m-0 p-0" />
                </div>
                <button onClick={(ev) => { ev.stopPropagation(); callService('number', 'set_value', { entity_id: 'number.solakon_one_minimaler_ladestand', value: Math.min(100, Math.round(minSoc) + 5) }) }}
                  className="w-7 h-7 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm font-bold">+</button>
              </div>
            </div>
          )}
        </InfoModal>
      )}

      <PvErtrag />

      {/* Amortisierung — kompakt */}
      <div className="mt-2 p-2 px-3 rounded-[10px] bg-surface border border-border cursor-pointer active:scale-95 transition-transform"
        onClick={() => setShowAmort(true)}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-semibold text-text-primary font-mono">{'\uD83D\uDCB0'} Amortisierung</span>
          <span className="text-[10px] text-text-muted font-mono">Tag {daysSinceInstall}</span>
        </div>
        <div className="h-1 bg-dim rounded-sm overflow-hidden mb-1.5">
          <div className="h-full rounded-sm transition-[width] duration-1000" style={{ width: `${amortPct}%`, background: 'linear-gradient(90deg, var(--color-green), var(--color-teal))' }} />
        </div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-green font-bold">{totalSavings.toFixed(2)} {'\u20AC'}</span>
          <span className="text-text-muted">{eigenverbrauchKwh.toFixed(1)} kWh</span>
          <span className="text-amber font-bold">{settings.anlagenkosten} {'\u20AC'}</span>
        </div>
        {payoffEstimate && (
          <div className="mt-1.5 p-1 px-2 rounded-md bg-teal/[0.08] border border-teal/[0.15] text-center">
            <span className="text-[10px] text-teal font-mono">{payoffEstimate}</span>
          </div>
        )}
      </div>
      {showAmort && (
        <InfoModal onClose={() => setShowAmort(false)} wide>
          <div className="pt-2">
            <div className="text-center mb-4">
              <div className="text-3xl mb-1">{'\uD83D\uDCB0'}</div>
              <div className="text-lg font-semibold text-text-primary font-mono">Amortisierung</div>
              <div className="text-xs text-text-muted font-mono">Tag {daysSinceInstall} seit Installation</div>
            </div>
            <div className="h-3 bg-dim rounded-md overflow-hidden mb-3">
              <div className="h-full rounded-md transition-[width] duration-1000" style={{ width: `${amortPct}%`, background: 'linear-gradient(90deg, var(--color-green), var(--color-teal))' }} />
            </div>
            <div className="text-center text-2xl font-extrabold font-sans text-green mb-3">{amortPct.toFixed(1)}%</div>
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              <div className="p-2 rounded-lg bg-surface text-center">
                <div className="text-green text-lg font-bold">{totalSavings.toFixed(2)} {'\u20AC'}</div>
                <div className="text-text-muted text-xs">Gespart</div>
              </div>
              <div className="p-2 rounded-lg bg-surface text-center">
                <div className="text-amber text-lg font-bold">{settings.anlagenkosten} {'\u20AC'}</div>
                <div className="text-text-muted text-xs">Anlagenkosten</div>
              </div>
              <div className="p-2 rounded-lg bg-surface text-center">
                <div className="text-teal text-lg font-bold">{eigenverbrauchKwh.toFixed(1)} kWh</div>
                <div className="text-text-muted text-xs">Eigenverbrauch</div>
              </div>
              <div className="p-2 rounded-lg bg-surface text-center">
                <div className="text-text-primary text-lg font-bold">{einspeisungGesamt.toFixed(1)} kWh</div>
                <div className="text-text-muted text-xs">Einspeisung</div>
              </div>
            </div>
            {payoffEstimate && (
              <div className="mt-3 p-2 px-3 rounded-md bg-teal/[0.08] border border-teal/[0.15] text-center">
                <span className="text-sm text-teal font-mono">{payoffEstimate}</span>
              </div>
            )}

            {/* Berechnungsgrundlage */}
            <div className="mt-4 pt-3 border-t border-border">
              <div className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-3">Berechnungsgrundlage</div>
              <div className="flex flex-col gap-3">
                {/* Strompreis */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] text-text-primary font-mono">{'\u26A1'} Strompreis</span>
                    <span className="text-[12px] font-bold font-mono text-amber">{settings.strompreis.toFixed(2)} {'\u20AC'}/kWh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateSetting('strompreis', Math.max(0, +(settings.strompreis - 0.01).toFixed(2)))}
                      className="w-7 h-7 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm font-bold">{'\u2212'}</button>
                    <div className="flex-1 relative h-4 flex items-center">
                      <div className="absolute inset-x-0 h-1 rounded-sm bg-dim" />
                      <div className="absolute left-0 h-1 rounded-sm" style={{ width: `${Math.min(100, (settings.strompreis / 0.60) * 100)}%`, background: 'linear-gradient(90deg, #d97706, var(--color-amber))' }} />
                      <input type="range" min={0} max={60} step={1} value={Math.round(settings.strompreis * 100)}
                        onChange={ev => updateSetting('strompreis', parseInt(ev.target.value) / 100)}
                        className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-4 m-0 p-0" />
                    </div>
                    <button onClick={() => updateSetting('strompreis', Math.min(0.60, +(settings.strompreis + 0.01).toFixed(2)))}
                      className="w-7 h-7 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm font-bold">+</button>
                  </div>
                </div>
                {/* Einspeiseverguetung */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] text-text-primary font-mono">{'\u2191'} Einspeiseverg{'\u00FC'}tung</span>
                    <span className="text-[12px] font-bold font-mono text-teal">{settings.einspeiseverguetung.toFixed(2)} {'\u20AC'}/kWh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateSetting('einspeiseverguetung', Math.max(0, +(settings.einspeiseverguetung - 0.01).toFixed(2)))}
                      className="w-7 h-7 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm font-bold">{'\u2212'}</button>
                    <div className="flex-1 relative h-4 flex items-center">
                      <div className="absolute inset-x-0 h-1 rounded-sm bg-dim" />
                      <div className="absolute left-0 h-1 rounded-sm" style={{ width: `${Math.min(100, (settings.einspeiseverguetung / 0.20) * 100)}%`, background: 'linear-gradient(90deg, #0d9488, var(--color-teal))' }} />
                      <input type="range" min={0} max={20} step={1} value={Math.round(settings.einspeiseverguetung * 100)}
                        onChange={ev => updateSetting('einspeiseverguetung', parseInt(ev.target.value) / 100)}
                        className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-4 m-0 p-0" />
                    </div>
                    <button onClick={() => updateSetting('einspeiseverguetung', Math.min(0.20, +(settings.einspeiseverguetung + 0.01).toFixed(2)))}
                      className="w-7 h-7 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm font-bold">+</button>
                  </div>
                </div>
                {/* Anlagenkosten */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] text-text-primary font-mono">{'\uD83D\uDCB0'} Anlagenkosten</span>
                    <span className="text-[12px] font-bold font-mono text-green">{settings.anlagenkosten} {'\u20AC'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateSetting('anlagenkosten', Math.max(0, settings.anlagenkosten - 50))}
                      className="w-7 h-7 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm font-bold">{'\u2212'}</button>
                    <div className="flex-1 relative h-4 flex items-center">
                      <div className="absolute inset-x-0 h-1 rounded-sm bg-dim" />
                      <div className="absolute left-0 h-1 rounded-sm" style={{ width: `${Math.min(100, (settings.anlagenkosten / 5000) * 100)}%`, background: 'linear-gradient(90deg, #16a34a, var(--color-green))' }} />
                      <input type="range" min={0} max={5000} step={50} value={settings.anlagenkosten}
                        onChange={ev => updateSetting('anlagenkosten', parseInt(ev.target.value))}
                        className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-4 m-0 p-0" />
                    </div>
                    <button onClick={() => updateSetting('anlagenkosten', Math.min(5000, settings.anlagenkosten + 50))}
                      className="w-7 h-7 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm font-bold">+</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </InfoModal>
      )}

    </Card>
  )
}
