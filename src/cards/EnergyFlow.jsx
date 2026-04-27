import { useState, useEffect, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useHA } from '../context/HAContext'
import { Card, Label, Pill, InfoModal } from '../atoms'
import { v } from '../config'

function FlowLine({ x1, y1, x2, y2, active, color, speed = 2 }) {
  if (!active) return null
  const mx = (x1 + x2) / 2
  const pathD = y1 === y2 ? `M ${x1},${y1} L ${x2},${y2}`
    : x1 === x2 ? `M ${x1},${y1} L ${x2},${y2}`
    : `M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`
  return <>
    <path d={pathD} fill="none" stroke={color} strokeWidth={2} opacity={0.2} />
    {[0, 0.33, 0.66].map(d => (
      <circle key={d} r={4} fill={color} opacity={0.85} style={{
        offsetPath: `path('${pathD}')`,
        animation: `flowAnim ${speed}s linear infinite`,
        animationDelay: `${d * speed}s`,
      }} />
    ))}
  </>
}

function Node({ cx, cy, icon, value, label, color, sub }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={34} fill="none" stroke={color} strokeWidth={2} opacity={0.3} />
      <circle cx={cx} cy={cy} r={33} fill={`${color}15`} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={20}>{icon}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={12} fill={color} fontFamily="var(--font-mono)" fontWeight={700}>{value}</text>
      {sub && <text x={cx} y={cy + 24} textAnchor="middle" fontSize={9} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">{sub}</text>}
      <text x={cx} y={cy + 50} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)" fontWeight={500} fontFamily="var(--font-sans)">{label}</text>
    </g>
  )
}

export function EnergyFlow() {
  const { entities, connected, sendMessage, callService } = useHA()

  // Auto-refresh alle 5 Minuten
  const [refreshTick, setRefreshTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setRefreshTick(t => t + 1), 300000)
    return () => clearInterval(iv)
  }, [])
  const gridPower = parseFloat(v(entities, 'sensor.shellypro3em_total_active_power')) || 0
  const solar = parseFloat(v(entities, 'sensor.solakon_one_pv_leistung')) || 0
  const batterySoc = parseFloat(v(entities, 'sensor.solakon_one_batterie_ladestand')) || 0
  const batteryPower = parseFloat(v(entities, 'sensor.solakon_one_batterie_leistung_2')) || 0
  const batteryHealth = v(entities, 'sensor.solakon_one_batterie_gesundheitszustand')
  const batteryTemp = v(entities, 'sensor.solakon_one_batterie_max_temperatur')

  // Min-SoC-Limit
  const minSoc = parseFloat(entities?.['number.solakon_one_minimaler_ladestand']?.state) || 0
  const adjustMinSoc = (delta) => {
    const newVal = Math.max(0, Math.min(100, minSoc + delta))
    callService('number', 'set_value', { entity_id: 'number.solakon_one_minimaler_ladestand', value: newVal })
  }

  // Tageshoechststand SoC
  const [dailyPeakSoc, setDailyPeakSoc] = useState(null)
  useEffect(() => {
    if (!connected) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: todayStart.toISOString(), end_time: new Date().toISOString(),
      statistic_ids: ['sensor.solakon_one_batterie_ladestand'],
      period: 'hour', types: ['max'],
    }).then(result => {
      const stats = result?.['sensor.solakon_one_batterie_ladestand'] || []
      const peak = Math.max(...stats.map(s => s.max || 0))
      setDailyPeakSoc(peak > 0 ? Math.round(peak) : null)
    }).catch(() => {})
  }, [connected, refreshTick])

  // PV-Energie heute via Statistics API (Sensor ist total_increasing, kein daily reset)
  const [todayPvEnergy, setTodayPvEnergy] = useState(null)
  useEffect(() => {
    if (!connected) return
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: todayStart.toISOString(), end_time: new Date().toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_energie'],
      period: 'hour', types: ['change'],
    }).then(result => {
      const stats = result?.['sensor.solakon_one_pv_energie'] || []
      setTodayPvEnergy(stats.reduce((acc, e) => acc + (e.change || 0), 0))
    }).catch(() => {})
  }, [connected, refreshTick])

  // Akku-Temperatur 48h History
  const [tempHistory, setTempHistory] = useState([])
  const tempFetchRef = useRef(null)
  useEffect(() => {
    if (!connected) return
    const key = `${refreshTick}`
    if (tempFetchRef.current === key) return
    tempFetchRef.current = key
    const start = new Date(); start.setHours(start.getHours() - 48)
    sendMessage({
      type: 'history/history_during_period',
      start_time: start.toISOString(), end_time: new Date().toISOString(),
      entity_ids: ['sensor.solakon_one_batterie_min_temperatur', 'sensor.solakon_one_batterie_max_temperatur'],
      minimal_response: true, no_attributes: true, significant_changes_only: false,
    }).then(result => {
      if (!result) return
      const bucket = (entries) => {
        const b = {}
        for (const e of entries) {
          const raw = e.lu ?? e.last_changed ?? e.last_updated
          const ts = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
          const hh = String(ts.getHours()).padStart(2, '0')
          const day = ts.getDate()
          const k = `${day}.${hh}`
          const val = parseFloat(e.s ?? e.state)
          if (!isNaN(val)) { if (!b[k]) b[k] = []; b[k].push(val) }
        }
        return Object.keys(b).sort((a, b2) => {
          const [dA, hA] = a.split('.').map(Number)
          const [dB, hB] = b2.split('.').map(Number)
          return dA !== dB ? dA - dB : hA - hB
        }).map(k => ({
          time: k.split('.')[1] + ':00',
          values: b[k],
        }))
      }
      const minBuckets = bucket(result['sensor.solakon_one_batterie_min_temperatur'] || [])
      const maxBuckets = bucket(result['sensor.solakon_one_batterie_max_temperatur'] || [])
      const merged = minBuckets.map((b, i) => ({
        time: b.time,
        min: +(Math.min(...b.values).toFixed(1)),
        max: maxBuckets[i] ? +(Math.max(...maxBuckets[i].values).toFixed(1)) : +(Math.max(...b.values).toFixed(1)),
      }))
      setTempHistory(merged)
    }).catch(() => {})
  }, [connected, refreshTick])

  const inverterPower = parseFloat(v(entities, 'sensor.solakon_one_leistung')) || 0
  const batteryCharging = batteryPower < -5
  const batteryDischarging = batteryPower > 5
  const gridImport = Math.max(0, gridPower)
  const gridExport = Math.max(0, -gridPower)
  const house = Math.max(0, solar + batteryPower + gridPower)

  // Netzladung: Inverter zieht aus dem Netz (negativ) UND Akku laedt
  const gridChargingBattery = inverterPower < -5 && batteryCharging
  // Solar laedt Akku nur wenn PV tatsaechlich nennenswert beitraegt
  const solarChargingBattery = batteryCharging && solar > 10 && !gridChargingBattery

  const fmt = (w) => w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`
  const batColor = batterySoc > 60 ? '#4db6ac' : batterySoc > 20 ? '#ff9800' : '#f44336'

  // Spülmaschine
  const solarAktiv = entities?.['input_boolean.spulmaschine_solar_aktiv']?.state === 'on'
  const dishState = v(entities, 'sensor.geschirrspuler_betriebszustand')
  const dishProgress = v(entities, 'sensor.geschirrspuler_programm_fortschritt')
  const dishDoor = v(entities, 'sensor.geschirrspuler_tur')
  const fernstart = entities?.['binary_sensor.geschirrspuler_fernstart']?.state === 'on'
  const schwelle = parseFloat(v(entities, 'input_number.solar_einspeiseschwelle')) || 50
  const stateMap = { ready: 'Bereit', run: 'Läuft', finished: 'Fertig', pause: 'Pause', inactive: 'Inaktiv', delayed_start: 'Wartet' }
  const [openStat, setOpenStat] = useState(null)

  const flowStats = [
    { icon: '\uD83D\uDD0B', val: `${batterySoc}%`, label: 'SoC', sub: 'State of Charge', color: 'text-teal' },
    { icon: '\u2764\uFE0F', val: `${batteryHealth}%`, label: 'SoH', sub: 'State of Health', color: 'text-green' },
    { icon: '\uD83C\uDF21\uFE0F', val: `${batteryTemp}\u00B0C`, label: 'Temp', sub: 'Akku-Temperatur', color: 'text-amber' },
    { icon: '\u2600\uFE0F', val: `${todayPvEnergy !== null ? todayPvEnergy.toFixed(1) : '\u2013'} kWh`, label: 'Heute', sub: 'PV-Ertrag heute', color: 'text-amber' },
  ]

  return (
    <Card>
      <Label>Energiefluss</Label>
      <svg viewBox="0 0 300 260" className="w-full max-w-[440px] mx-auto block">
        <FlowLine x1={150} y1={55} x2={50} y2={130} active={gridExport > 5} color="var(--color-grid-out)" />
        <FlowLine x1={50} y1={130} x2={150} y2={195} active={gridImport > 5} color="var(--color-grid-in)" />
        <FlowLine x1={150} y1={55} x2={150} y2={195} active={solar > 5 && house > 5} color="var(--color-solar)" speed={1.5} />
        <FlowLine x1={150} y1={55} x2={250} y2={130} active={solarChargingBattery} color="var(--color-bat-in)" />
        <FlowLine x1={50} y1={130} x2={250} y2={130} active={gridChargingBattery} color="var(--color-grid-in)" speed={2.5} />
        <FlowLine x1={250} y1={130} x2={150} y2={195} active={batteryDischarging} color="var(--color-bat-out)" />
        <Node cx={150} cy={40} icon={'\u2600\uFE0F'} value={fmt(solar)} label="Solar" color="var(--color-solar)" />
        <Node cx={50} cy={130} icon={'\u26A1'} value={gridExport > 5 ? fmt(gridExport) : fmt(gridImport)} label={gridExport > 5 ? 'Einspeisung' : 'Netz'} color={gridExport > 5 ? 'var(--color-grid-out)' : 'var(--color-grid-in)'} sub={gridExport > 5 ? '\u2191 Export' : gridImport > 5 ? '\u2193 Import' : ''} />
        <Node cx={250} cy={130} icon={'\uD83D\uDD0B'} value={`${batterySoc}%`} label="Batterie" color={batColor} sub={batteryPower !== 0 ? `${batteryCharging ? '\u2B06' : '\u2B07'} ${fmt(Math.abs(batteryPower))}${gridChargingBattery ? ' (Netz)' : ''}` : ''} />
        <Node cx={150} cy={195} icon={'\uD83C\uDFE0'} value={fmt(Math.max(0, house))} label="Verbrauch" color="var(--color-grid-in)" />
      </svg>

      {/* Grid charging banner */}
      {gridChargingBattery && (
        <div className="flex items-center gap-2 p-2 px-2.5 rounded-lg bg-red/[0.1] border border-red/[0.2] mt-1 mb-1">
          <span className="text-sm">{'\u26A0\uFE0F'}</span>
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-red font-mono">Netzladung aktiv</div>
            <div className="text-[11px] text-text-muted font-mono">
              SOC {batterySoc}% &lt; Min. {parseFloat(entities?.['number.solakon_one_minimaler_ladestand_netzbetrieb']?.state) || 20}% {'\u00B7'} {fmt(Math.abs(inverterPower))} aus Netz
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-1.5 mt-2">
        {flowStats.map(s => (
          <div key={s.label} onClick={() => setOpenStat(s)}
            className="text-center py-1.5 px-0.5 rounded-lg bg-surface cursor-pointer active:scale-95 transition-transform">
            <div className="text-[13px]">{s.icon}</div>
            <div className="text-[13px] font-bold text-text-primary font-mono">{s.val}</div>
            <div className="text-[9px] text-text-muted font-mono">{s.label}</div>
          </div>
        ))}
      </div>
      {openStat && openStat.label === 'SoC' ? (
        <InfoModal onClose={() => setOpenStat(null)}>
          <div className="text-center pt-4">
            <div className="text-[36px] mb-2">{'\uD83D\uDD0B'}</div>
            <div className="text-[48px] font-extrabold font-sans text-teal">{batterySoc}%</div>
            <div className="text-sm text-text-muted font-mono mt-1">State of Charge</div>
            {dailyPeakSoc != null && (
              <div className="mt-4 p-2.5 rounded-lg bg-surface border border-border">
                <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1">Tageshoechststand</div>
                <div className="text-[28px] font-bold font-mono text-green">{dailyPeakSoc}%</div>
              </div>
            )}
            <div className="mt-3 p-2.5 rounded-lg bg-surface border border-border">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Min. Ladestand</div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => adjustMinSoc(-5)}
                  className="w-9 h-9 rounded-lg bg-dim border border-border text-text-primary text-sm font-bold cursor-pointer active:scale-95 transition-transform">{'\u22125'}</button>
                <button onClick={() => adjustMinSoc(-1)}
                  className="w-9 h-9 rounded-lg bg-dim border border-border text-text-primary text-sm font-bold cursor-pointer active:scale-95 transition-transform">{'\u22121'}</button>
                <span className="text-[24px] font-bold font-mono text-amber min-w-[60px]">{minSoc}%</span>
                <button onClick={() => adjustMinSoc(1)}
                  className="w-9 h-9 rounded-lg bg-dim border border-border text-text-primary text-sm font-bold cursor-pointer active:scale-95 transition-transform">+1</button>
                <button onClick={() => adjustMinSoc(5)}
                  className="w-9 h-9 rounded-lg bg-dim border border-border text-text-primary text-lg font-bold cursor-pointer active:scale-95 transition-transform">+5</button>
              </div>
            </div>
          </div>
        </InfoModal>
      ) : openStat && openStat.label === 'Temp' ? (
        <InfoModal onClose={() => setOpenStat(null)}>
          <div className="text-center pt-4">
            <div className="text-[36px] mb-2">{'\uD83C\uDF21\uFE0F'}</div>
            <div className="text-[48px] font-extrabold font-sans text-amber">{batteryTemp}&deg;C</div>
            <div className="text-sm text-text-muted font-mono mt-1">Akku-Temperatur (max)</div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="p-2 rounded-lg bg-surface text-center">
                <div className="text-lg font-bold font-mono text-blue">{v(entities, 'sensor.solakon_one_batterie_min_temperatur')}&deg;C</div>
                <div className="text-text-muted text-xs font-mono">Min. Zelle</div>
              </div>
              <div className="p-2 rounded-lg bg-surface text-center">
                <div className="text-lg font-bold font-mono text-amber">{v(entities, 'sensor.solakon_one_wechselrichter_temperatur')}&deg;C</div>
                <div className="text-text-muted text-xs font-mono">Wechselrichter</div>
              </div>
            </div>
          </div>
          {tempHistory.length > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Temperaturverlauf 48h</div>
              <div style={{ width: '100%', height: 150 }}>
                <ResponsiveContainer>
                  <AreaChart data={tempHistory}>
                    <defs>
                      <linearGradient id="tempGradMin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-blue)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-blue)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="tempGradMax" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-amber)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-amber)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} fontFamily="var(--font-mono)" interval={5} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} unit="°" fontFamily="var(--font-mono)" width={30} />
                    <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }} formatter={(val, name) => [`${val}°C`, name === 'max' ? 'Max' : 'Min']} />
                    <Area type="monotone" dataKey="max" stroke="var(--color-amber)" fill="url(#tempGradMax)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="min" stroke="var(--color-blue)" fill="url(#tempGradMin)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-1">
                <span className="text-[10px] font-mono text-amber">— Max</span>
                <span className="text-[10px] font-mono text-blue">— Min</span>
              </div>
            </div>
          )}
        </InfoModal>
      ) : openStat && (
        <InfoModal onClose={() => setOpenStat(null)}>
          <div className="text-center pt-4">
            <div className="text-[36px] mb-2">{openStat.icon}</div>
            <div className={`text-[48px] font-extrabold font-sans ${openStat.color}`}>{openStat.val}</div>
            <div className="text-sm text-text-muted font-mono mt-2">{openStat.sub}</div>
          </div>
        </InfoModal>
      )}

      {/* Dishwasher Solar Status */}
      <div className="mt-3 p-2.5 px-3 rounded-[10px] bg-surface border border-border">
        <div className={`flex items-center justify-between ${solarAktiv || dishState === 'run' ? 'mb-2' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{'\uD83C\uDF7D\uFE0F'}</span>
            <span className="text-[13px] text-text-primary font-mono font-semibold">Spülmaschine</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Pill color={dishState === 'run' ? 'teal' : 'amber'}>{stateMap[dishState] || dishState || '\u2013'}</Pill>
            {dishDoor === 'open' && <span className="text-[11px] text-text-muted">{'\uD83D\uDEAA'} offen</span>}
          </div>
        </div>
        {dishState === 'run' && dishProgress && (
          <div className="mb-1.5">
            <div className="h-1 bg-dim rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-[width] duration-500" style={{ width: `${dishProgress}%`, background: 'linear-gradient(90deg, var(--color-teal), #06b6d4)' }} />
            </div>
            <div className="text-[11px] text-text-muted font-mono mt-[3px]">{dishProgress}% abgeschlossen</div>
          </div>
        )}
        {solarAktiv && dishState !== 'run' && (
          <div className="flex items-center gap-1.5 p-1.5 px-2 rounded-md bg-amber/[0.08] border border-amber/[0.15]">
            <span className="text-[13px]">{'\u2600\uFE0F'}</span>
            <span className="text-xs text-amber font-mono">Solar-Warten ({schwelle}W){fernstart ? ' \u00B7 Fernstart \u2713' : ' \u00B7 Fernstart \u2717'}</span>
          </div>
        )}
        {!solarAktiv && dishState !== 'run' && (
          <div className="text-xs text-text-muted font-mono mt-0.5">Solar-Start {fernstart ? 'bereit' : 'nicht aktiv'} {'\u00B7'} Tür {dishDoor || '\u2013'}</div>
        )}
      </div>
    </Card>
  )
}
