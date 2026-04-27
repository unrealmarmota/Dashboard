import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ─── CONFIG ─────────────────────────────────────────────────────────
const HA_URL = 'ws://192.168.178.89:8123/api/websocket'
const HA_REST = 'http://192.168.178.89:8123/api'
const UPTIME_KUMA_URL = '/uptimekuma'
const UPTIME_KUMA_SLUG = 'overview'
const GLANCES_URL = '/glances'
const PIHOLE_URL = '/pihole'
const PIHOLE_PASSWORD = 'Jojo2510!'
const VVS_URL = '/vvs'
// Solar-Amortisierung: Zählerstände bei Anlagen-Installation (06.03.2026)
const SOLAR_OFFSET_BEZUG = 2510.08    // kWh Netzbezug bei Start
const SOLAR_OFFSET_EINSPEISUNG = 178.19 // kWh Einspeisung bei Start
const SOLAR_ANLAGENKOSTEN = 800        // EUR Gesamtkosten Avocado 22 Pro
const SOLAR_STROMPREIS = 0.32          // EUR/kWh Bezugspreis
const SOLAR_EINSPEISEVERGUETUNG = 0    // keine Einspeisevergütung
const SOLAR_INSTALL_DATE = '2026-03-06'
const HA_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmYzhlNTQ0MGNhZDk0NzE2YjdiOTVjMGQ2OTMzN2JkMiIsImlhdCI6MTc3MjcwMzExMCwiZXhwIjoyMDg4MDYzMTEwfQ.qqMmYjsl7Ovt2fYzHc38VaYdCpoIqCvQbny9vnk00uY'

// ─── DESIGN TOKENS ──────────────────────────────────────────────────
const c = {
  bg: "#07090f", surface: "#0d1117", card: "#0f1520", border: "#1a2535",
  text: "#e2e8f0", muted: "#94a3b8", dim: "#1e2d40",
  amber: "#f59e0b", amberDim: "rgba(245,158,11,0.1)", amberBorder: "rgba(245,158,11,0.22)",
  teal: "#14b8a6", tealDim: "rgba(20,184,166,0.1)", tealBorder: "rgba(20,184,166,0.22)",
  red: "#f87171", redDim: "rgba(248,113,113,0.1)", redBorder: "rgba(248,113,113,0.22)",
  blue: "#60a5fa", green: "#4ade80",
}

// ─── GLOBAL SLIDER STYLE ────────────────────────────────────────────
const sliderStyle = document.createElement("style")
sliderStyle.textContent = `
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
    background: #f59e0b; cursor: pointer; border: 2px solid #07090f;
    box-shadow: 0 0 6px rgba(245,158,11,0.5);
  }
  input[type=range]:disabled::-webkit-slider-thumb { background: #1e2d40; box-shadow: none; cursor: default; }
  input[type=range]::-moz-range-thumb {
    width: 16px; height: 16px; border-radius: 50%;
    background: #f59e0b; cursor: pointer; border: 2px solid #07090f;
  }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1a2535; border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
`
document.head.appendChild(sliderStyle)

// ─── HA WEBSOCKET CONTEXT ───────────────────────────────────────────
const HAContext = createContext(null)
const useHA = () => useContext(HAContext)

function HAProvider({ children }) {
  const [entities, setEntities] = useState({})
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const msgIdRef = useRef(1)
  const reconnectTimer = useRef(null)
  const pendingRef = useRef({})

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(HA_URL)
    wsRef.current = ws
    ws.onopen = () => {}
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }))
      if (msg.type === 'auth_ok') {
        setConnected(true)
        ws.send(JSON.stringify({ id: msgIdRef.current++, type: 'subscribe_events', event_type: 'state_changed' }))
        ws.send(JSON.stringify({ id: msgIdRef.current++, type: 'get_states' }))
      }
      if (msg.type === 'result' && msg.success && Array.isArray(msg.result)) {
        const m = {}; msg.result.forEach(e => { m[e.entity_id] = e }); setEntities(m)
      }
      if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
        const { entity_id, new_state } = msg.event.data
        if (new_state) setEntities(prev => ({ ...prev, [entity_id]: new_state }))
      }
      // Resolve pending sendMessage promises
      if (msg.id && pendingRef.current[msg.id]) {
        const { resolve, reject } = pendingRef.current[msg.id]
        delete pendingRef.current[msg.id]
        if (msg.success === false) reject(msg.error || msg)
        else resolve(msg.result)
      }
    }
    ws.onclose = () => { setConnected(false); reconnectTimer.current = setTimeout(connect, 5000) }
    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => { connect(); return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close() } }, [connect])

  const callService = useCallback((domain, service, data) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) { console.error('WS not connected'); return }
    ws.send(JSON.stringify({
      id: msgIdRef.current++,
      type: 'call_service',
      domain,
      service,
      service_data: data,
    }))
  }, [])

  const sendMessage = useCallback((msg) => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) { reject(new Error('WS not connected')); return }
      const id = msgIdRef.current++
      pendingRef.current[id] = { resolve, reject }
      ws.send(JSON.stringify({ ...msg, id }))
      setTimeout(() => {
        if (pendingRef.current[id]) {
          delete pendingRef.current[id]
          reject(new Error('WS timeout'))
        }
      }, 15000)
    })
  }, [])

  return <HAContext.Provider value={{ entities, connected, callService, sendMessage }}>{children}</HAContext.Provider>
}

// ─── HELPERS ────────────────────────────────────────────────────────
const e = (entities, id) => entities[id] || null
const v = (entities, id) => entities[id]?.state ?? '–'
const a = (entities, id, attr) => entities[id]?.attributes?.[attr] ?? null
const isHome = (state) => state?.toLowerCase() === 'home'
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'

const WEATHER_ICONS = {
  sunny: '☀️', 'clear-night': '🌙', partlycloudy: '⛅', cloudy: '☁️',
  rainy: '🌧️', pouring: '🌧️', snowy: '❄️', fog: '🌫️',
  lightning: '⚡', windy: '🌬️', exceptional: '⚠️',
}
const WEATHER_DE = {
  sunny: 'Sonnig', 'clear-night': 'Klar', partlycloudy: 'Teils bewölkt', cloudy: 'Bewölkt',
  rainy: 'Regen', pouring: 'Starkregen', snowy: 'Schnee', fog: 'Nebel',
  lightning: 'Gewitter', windy: 'Windig',
}

// ─── ATOMS ──────────────────────────────────────────────────────────
const Toggle = ({ on, onToggle }) => (
  <div onClick={ev => { ev.stopPropagation(); onToggle() }} style={{
    width: 42, height: 24, borderRadius: 12, cursor: "pointer",
    background: on ? c.amber : c.dim, position: "relative", transition: "background 0.25s", flexShrink: 0,
  }}>
    <div style={{
      position: "absolute", top: 4, width: 16, height: 16, borderRadius: "50%",
      background: on ? "#07090f" : "#64748b", left: on ? 22 : 4, transition: "left 0.2s",
    }} />
  </div>
)

const Pill = ({ children, color = "amber", small }) => (
  <span style={{
    padding: small ? "2px 7px" : "4px 10px", borderRadius: 20,
    fontSize: small ? 12 : 13, fontFamily: "'DM Mono', monospace", letterSpacing: 0.8,
    background: color === "amber" ? c.amberDim : color === "teal" ? c.tealDim : color === "green" ? "rgba(74,222,128,0.1)" : c.redDim,
    color: color === "amber" ? c.amber : color === "teal" ? c.teal : color === "green" ? c.green : c.red,
    border: `1px solid ${color === "amber" ? c.amberBorder : color === "teal" ? c.tealBorder : color === "green" ? "rgba(74,222,128,0.25)" : c.redBorder}`,
    flexShrink: 0,
  }}>{children}</span>
)

const Dot = ({ on, color }) => (
  <div style={{
    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
    background: on ? (color || c.teal) : c.dim,
    boxShadow: on ? `0 0 7px ${color || c.teal}99` : "none", transition: "all 0.3s",
  }} />
)

const Label = ({ children }) => (
  <div style={{ fontSize: 13, letterSpacing: 2, color: c.muted, fontFamily: "'DM Mono', monospace", marginBottom: 10, textTransform: "uppercase" }}>{children}</div>
)

const Card = ({ children, accent, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: c.card, border: `1px solid ${accent ? c.amberBorder : c.border}`,
    borderRadius: 14, padding: 16, position: "relative", overflow: "hidden",
    transition: "border-color 0.2s", cursor: onClick ? "pointer" : "default", ...style,
  }}>
    {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, ${c.amber}, transparent)` }} />}
    {children}
  </div>
)

// ─── DIMMER SLIDER ──────────────────────────────────────────────────
const DimmerSlider = ({ brightness, onChange, disabled }) => {
  const pct = Math.round((brightness / 255) * 100)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <span style={{ fontSize: 14, color: c.muted, minWidth: 14 }}>🌑</span>
      <div style={{ flex: 1, position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, background: c.dim }} />
        <div style={{ position: "absolute", left: 0, height: 4, borderRadius: 2, width: `${pct}%`, background: disabled ? c.dim : `linear-gradient(90deg, #d97706, ${c.amber})`, transition: "width 0.1s" }} />
        <input type="range" min={0} max={255} value={brightness} disabled={disabled}
          onChange={ev => onChange(parseInt(ev.target.value))} onClick={ev => ev.stopPropagation()}
          style={{ position: "absolute", left: 0, right: 0, width: "100%", appearance: "none", WebkitAppearance: "none", background: "transparent", cursor: disabled ? "default" : "pointer", height: 20, margin: 0, padding: 0 }}
        />
      </div>
      <span style={{ fontSize: 14, color: c.muted }}>☀️</span>
      <span style={{ fontSize: 13, color: disabled ? c.dim : c.amber, fontFamily: "'DM Mono', monospace", minWidth: 32, textAlign: "right" }}>
        {disabled ? "—" : `${pct}%`}
      </span>
    </div>
  )
}

// ─── GAUGE ──────────────────────────────────────────────────────────
const Gauge = ({ value, max, color, size = 68, label, unit }) => {
  const pct = Math.min(value / max, 1)
  const r = size / 2 - 7, circ = Math.PI * r, dash = pct * circ
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path d={`M 7,${size / 2} A ${r},${r} 0 0 1 ${size - 7},${size / 2}`} fill="none" stroke={c.dim} strokeWidth={5} strokeLinecap="round" />
        <path d={`M 7,${size / 2} A ${r},${r} 0 0 1 ${size - 7},${size / 2}`} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} style={{ transition: "stroke-dasharray 1s" }} />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" fill="white" fontSize={12} fontWeight="700" fontFamily="'DM Mono', monospace">{value}</text>
        <text x={size / 2} y={size / 2 + 11} textAnchor="middle" fill={c.muted} fontSize={7} fontFamily="'DM Mono', monospace">{unit}</text>
      </svg>
      <div style={{ fontSize: 9, color: c.muted, letterSpacing: 1, fontFamily: "'DM Mono', monospace" }}>{label}</div>
    </div>
  )
}

// ─── SUN ARC ────────────────────────────────────────────────────────
const SunArc = ({ sunriseISO, sunsetISO }) => {
  const now = new Date()
  const sunrise = sunriseISO ? new Date(sunriseISO) : null
  const sunset = sunsetISO ? new Date(sunsetISO) : null
  const sunriseStr = sunrise ? fmtTime(sunriseISO) : '–'
  const sunsetStr = sunset ? fmtTime(sunsetISO) : '–'

  let progress = 0
  if (sunrise && sunset) {
    // If next_rising is tomorrow, sun hasn't set yet — calculate from today's sunrise
    const riseToday = sunrise > sunset ? new Date(sunrise.getTime() - 86400000) : sunrise
    const dayLen = sunset.getTime() - riseToday.getTime()
    const elapsed = now.getTime() - riseToday.getTime()
    progress = Math.max(0, Math.min(1, elapsed / dayLen))
  }

  const W = 280, H = 110, cx = W / 2, cy = H - 10, rx = 110, ry = 90
  const toXY = (t) => ({ x: cx + rx * Math.cos(Math.PI - t * Math.PI), y: cy - ry * Math.sin(t * Math.PI) })
  const start = toXY(0), end = toXY(1), sun = toXY(progress)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", overflow: "visible" }}>
      <defs>
        <linearGradient id="arcgrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c.amber} stopOpacity="0.3" />
          <stop offset="50%" stopColor={c.amber} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path d={`M ${start.x},${start.y} A ${rx},${ry} 0 0 1 ${end.x},${end.y}`} fill="none" stroke={c.dim} strokeWidth={2} strokeDasharray="4 4" />
      {progress > 0 && progress < 1 && (
        <path d={`M ${start.x},${start.y} A ${rx},${ry} 0 0 1 ${sun.x},${sun.y}`} fill="none" stroke="url(#arcgrad)" strokeWidth={2.5} strokeLinecap="round" />
      )}
      <line x1={cx - rx - 10} y1={cy} x2={cx + rx + 10} y2={cy} stroke={c.border} strokeWidth={1} />
      <circle cx={start.x} cy={start.y} r={4} fill={c.amber} opacity={0.6} />
      <text x={start.x - 4} y={start.y + 16} fill={c.muted} fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="middle">🌅 {sunriseStr}</text>
      <circle cx={end.x} cy={end.y} r={4} fill="#f97316" opacity={0.6} />
      <text x={end.x + 4} y={end.y + 16} fill={c.muted} fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="middle">🌇 {sunsetStr}</text>
      {progress > 0 && progress < 1 && (<>
        <circle cx={sun.x} cy={sun.y} r={10} fill={c.amber} opacity={0.15} />
        <circle cx={sun.x} cy={sun.y} r={6} fill={c.amber} opacity={0.9} />
        <circle cx={sun.x} cy={sun.y} r={3} fill="white" opacity={0.8} />
      </>)}
      <text x={cx} y={cy - 28} fill={c.text} fontSize={13} fontFamily="'DM Mono', monospace" textAnchor="middle" fontWeight="500">
        {now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
      </text>
    </svg>
  )
}

// ─── UPTIME KUMA HOOK ───────────────────────────────────────────────
function useUptimeKuma() {
  const [monitors, setMonitors] = useState([])
  const [error, setError] = useState(null)
  useEffect(() => {
    let cancelled = false
    const fetchStatus = async () => {
      try {
        // Fetch monitor list and heartbeats separately (Uptime Kuma 2.x API)
        const [statusRes, hbRes] = await Promise.all([
          fetch(`${UPTIME_KUMA_URL}/api/status-page/${UPTIME_KUMA_SLUG}`),
          fetch(`${UPTIME_KUMA_URL}/api/status-page/heartbeat/${UPTIME_KUMA_SLUG}`),
        ])
        if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`)
        const data = await statusRes.json()
        const hbData = hbRes.ok ? await hbRes.json() : {}
        if (cancelled) return
        const hb = hbData.heartbeatList || {}
        const uptime = hbData.uptimeList || {}
        const all = []
        for (const group of (data.publicGroupList || [])) {
          for (const mon of (group.monitorList || [])) {
            const beats = hb[mon.id] || []
            const latest = beats[beats.length - 1]
            const uptimePct = uptime[mon.id + '_24'] ?? null
            all.push({
              id: mon.id, name: mon.name,
              up: latest ? latest.status === 1 : null,
              latency: latest?.ping ?? null,
              uptime: uptimePct !== null ? parseFloat(uptimePct).toFixed(1) : null,
            })
          }
        }
        setMonitors(all); setError(null)
      } catch (err) { if (!cancelled) setError(err.message) }
    }
    fetchStatus()
    const iv = setInterval(fetchStatus, 30000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])
  return { monitors, error }
}

// ─── GLANCES HOOK (Unraid direct) ──────────────────────────────────
function useGlances() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const [quicklook, mem, sensors, containers, fs, system, uptime] = await Promise.all([
          fetch(`${GLANCES_URL}/api/4/quicklook`).then(r => r.json()),
          fetch(`${GLANCES_URL}/api/4/mem`).then(r => r.json()),
          fetch(`${GLANCES_URL}/api/4/sensors`).then(r => r.json()),
          fetch(`${GLANCES_URL}/api/4/containers`).then(r => r.json()),
          fetch(`${GLANCES_URL}/api/4/fs`).then(r => r.json()),
          fetch(`${GLANCES_URL}/api/4/system`).then(r => r.json()),
          fetch(`${GLANCES_URL}/api/4/uptime`).then(r => r.text()),
        ])
        if (cancelled) return
        // Parse containers (may be array or object with containers key)
        const ctrs = Array.isArray(containers) ? containers : (containers?.containers || [])
        // Find CPU temp (prefer "Package id 0" or first core temp)
        const coreTemps = sensors.filter(s => s.type === 'temperature_core')
        const cpuTemp = coreTemps.find(s => s.label.includes('Package'))?.value
          ?? coreTemps.find(s => s.label === 'Core 0')?.value
          ?? coreTemps[0]?.value ?? null
        // NVMe disk (first btrfs or largest)
        const mainDisk = fs.find(d => d.fs_type === 'btrfs') || fs[0]
        setData({
          cpu: quicklook.cpu ?? 0,
          cpuName: quicklook.cpu_name ?? 'CPU',
          mem: mem.percent ?? 0,
          memUsed: mem.used ?? 0,
          memTotal: mem.total ?? 0,
          cpuTemp,
          containers: ctrs.sort((a, b) => (b.cpu?.total || 0) - (a.cpu?.total || 0)),
          diskPercent: mainDisk?.percent ?? 0,
          diskUsed: mainDisk?.used ?? 0,
          diskTotal: mainDisk?.size ?? 0,
          system: system.hr_name ?? 'Unraid',
          uptime: uptime?.replace(/"/g, '') ?? '–',
        })
        setError(null)
      } catch (err) { if (!cancelled) setError(err.message) }
    }
    fetchData()
    const iv = setInterval(fetchData, 10000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])
  return { data, error }
}

// ─── CLOCK ──────────────────────────────────────────────────────────
const ClockDisplay = () => {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv) }, [])
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "flex-end",
      padding: "4px 12px", borderRadius: 10,
      background: "rgba(245,158,11,0.06)", border: `1px solid ${c.amberBorder}`,
    }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 30, fontWeight: 500, color: c.amber, lineHeight: 1, letterSpacing: 2 }}>
        {now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style={{ fontSize: 11, color: c.muted, letterSpacing: 1.5, marginTop: 2 }}>
        {now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "short" })}
      </div>
    </div>
  )
}

// ─── RIBBON ─────────────────────────────────────────────────────────
function Ribbon() {
  const { entities } = useHA()
  const johannes = e(entities, 'person.johannes')
  const tanja = e(entities, 'person.tanja')
  const solar = v(entities, 'sensor.solakon_one_pv_leistung')
  const grid = v(entities, 'sensor.shellypro3em_total_active_power')
  const weather = e(entities, 'weather.forecast_stauferabby')
  const outsideTemp = weather?.attributes?.temperature ?? '–'
  const gridNum = parseFloat(grid)
  const balance = parseFloat(solar) - (isNaN(gridNum) ? 0 : Math.abs(gridNum))
  const solarNum = parseFloat(solar)

  const stateLabel = (s) => {
    if (!s || s === 'unknown') return '?'
    if (s.toLowerCase() === 'home') return null
    if (s === 'not_home') return 'Unterwegs'
    return s // Zone name (e.g. "Arbeit", "Gym")
  }
  const persons = [
    { name: "Johannes", state: johannes?.state, avatar: "👨", location: stateLabel(johannes?.state) },
    { name: "Tanja", state: tanja?.state, avatar: "👩", location: stateLabel(tanja?.state) },
  ]

  const energyItems = [
    { icon: "☀️", val: isNaN(solarNum) ? '–' : solarNum.toFixed(0), unit: "W", label: "Solar" },
    { icon: gridNum < 0 ? "↑" : "↓", val: isNaN(gridNum) ? '–' : Math.abs(gridNum).toFixed(0), unit: "W", label: gridNum < 0 ? "Einspeisung" : "Bezug" },
    { icon: "🌡️", val: outsideTemp, unit: "°C", label: "Außen" },
  ]

  return (
    <div style={{
      background: "rgba(7,9,15,0.97)", borderBottom: `1px solid ${c.border}`,
      padding: "10px 20px", display: "flex", alignItems: "center", gap: 10,
      flexWrap: "wrap", position: "sticky", top: 0, zIndex: 200, backdropFilter: "blur(16px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${c.amber}, #d97706)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
        <div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 16, color: "white", letterSpacing: 0.5, lineHeight: 1 }}>STAUFER<span style={{ color: c.amber }}>.</span>ABBY</div>
          <div style={{ fontSize: 12, color: c.muted, letterSpacing: 2 }}>WAIBLINGEN</div>
        </div>
      </div>
      <div style={{ width: 1, height: 32, background: c.border, margin: "0 4px" }} />
      {persons.map(p => (
        <div key={p.name} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20,
          background: isHome(p.state) ? c.tealDim : c.amberDim,
          border: `1px solid ${isHome(p.state) ? c.tealBorder : c.amberBorder}`,
        }}>
          <span style={{ fontSize: 15 }}>{p.avatar}</span>
          <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: isHome(p.state) ? c.teal : c.amber }}>{p.name}</span>
          {p.location && <span style={{ fontSize: 11, color: c.muted, fontFamily: "'DM Mono', monospace" }}>· {p.location}</span>}
          <Dot on={isHome(p.state)} />
        </div>
      ))}
      <div style={{ width: 1, height: 32, background: c.border, margin: "0 4px" }} />
      {energyItems.map(item => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "white", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
              {item.val}<span style={{ fontSize: 11, color: c.muted }}>{item.unit && ` ${item.unit}`}</span>
            </div>
            <div style={{ fontSize: 12, color: c.muted, letterSpacing: 0.8 }}>{item.label}</div>
          </div>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <ClockDisplay />
    </div>
  )
}

// ─── TAB BAR ────────────────────────────────────────────────────────
const TABS = [
  { id: "oben", label: "🏠  Oben" },
  { id: "unten", label: "🛏  Unten" },
  { id: "infos", label: "📊  Infos" },
]

function TabBar({ active, onChange }) {
  return (
    <div style={{
      background: "rgba(13,17,23,0.97)", borderBottom: `1px solid ${c.border}`,
      padding: "0 20px", display: "flex", gap: 2,
      position: "sticky", top: 62, zIndex: 190, backdropFilter: "blur(12px)",
    }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: "12px 22px", border: "none", background: "transparent", cursor: "pointer",
          fontSize: 16, fontFamily: "'Outfit', sans-serif", fontWeight: active === t.id ? 600 : 400,
          color: active === t.id ? c.amber : c.muted,
          borderBottom: `2px solid ${active === t.id ? c.amber : "transparent"}`,
          transition: "all 0.2s", letterSpacing: 0.3,
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ─── LIGHT GROUP CARD ───────────────────────────────────────────────
function LightGroupCard({ title, lights }) {
  const { entities, callService } = useHA()

  const toggleLight = (l) => {
    const domain = l.isSwitch ? 'switch' : 'light'
    callService(domain, 'toggle', { entity_id: l.id })
  }
  const setBrightness = (id, val) => callService('light', 'turn_on', { entity_id: id, brightness: val })

  return (
    <Card>
      <Label>{title}</Label>
      {lights.map((l, i) => {
        const ent = e(entities, l.id)
        const isOn = ent?.state === 'on'
        const brightness = ent?.attributes?.brightness ?? 0
        return (
          <div key={l.id} style={{ padding: "10px 0", borderBottom: i < lights.length - 1 ? `1px solid ${c.border}` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20, opacity: isOn ? 1 : 0.25, transition: "opacity 0.2s" }}>{l.icon || '💡'}</span>
              <span style={{ flex: 1, fontSize: 16, color: isOn ? c.text : c.muted }}>{l.label}</span>
              <Toggle on={isOn} onToggle={() => toggleLight(l)} />
            </div>
            {!l.isSwitch && <DimmerSlider brightness={isOn ? brightness : 0} disabled={!isOn} onChange={(val) => setBrightness(l.id, val)} />}
          </div>
        )
      })}
    </Card>
  )
}

// ─── LIGHT GRID CARD (Tab Unten style) ──────────────────────────────
function LightGridCard({ title, lights }) {
  const { entities, callService } = useHA()
  const toggleLight = (id) => callService('light', 'toggle', { entity_id: id })
  const setBrightness = (id, val) => callService('light', 'turn_on', { entity_id: id, brightness: val })

  return (
    <Card>
      <Label>{title}</Label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {lights.map(l => {
          const ent = e(entities, l.id)
          const isOn = ent?.state === 'on'
          const brightness = ent?.attributes?.brightness ?? 0
          return (
            <div key={l.id} style={{ padding: 12, borderRadius: 10, background: isOn ? c.amberDim : c.surface, border: `1px solid ${isOn ? c.amberBorder : c.border}`, transition: "all 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22, opacity: isOn ? 1 : 0.25 }}>{l.icon || '💡'}</span>
                <span style={{ flex: 1, fontSize: 16, color: isOn ? c.text : c.muted }}>{l.label}</span>
                <Toggle on={isOn} onToggle={() => toggleLight(l.id)} />
              </div>
              <DimmerSlider brightness={isOn ? brightness : 0} disabled={!isOn} onChange={(val) => setBrightness(l.id, val)} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── THERMOSTAT CARD ────────────────────────────────────────────────
function ThermostatCard({ entityId, name }) {
  const { entities, callService } = useHA()
  const ent = e(entities, entityId)
  const currentTemp = ent?.attributes?.current_temperature ?? '–'
  const targetTemp = ent?.attributes?.temperature ?? '–'
  const hvacAction = ent?.attributes?.hvac_action ?? ent?.state ?? 'off'

  const adjustTemp = (delta) => {
    const cur = parseFloat(targetTemp)
    if (isNaN(cur)) return
    callService('climate', 'set_temperature', { entity_id: entityId, temperature: cur + delta })
  }

  const tempNum = parseFloat(currentTemp)
  const barPct = isNaN(tempNum) ? 0 : ((tempNum - 15) / 12) * 100

  return (
    <Card>
      <Label>{name}</Label>
      <div style={{ textAlign: "center", padding: "4px 0 10px" }}>
        <div style={{ fontSize: 52, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "white", lineHeight: 1 }}>
          {currentTemp}<span style={{ fontSize: 18, color: c.muted }}>°C</span>
        </div>
        {hvacAction === 'heating' && <Pill color="red" small>HEIZT</Pill>}
        {hvacAction === 'idle' && <Pill color="teal" small>IDLE</Pill>}
        <div style={{ fontSize: 14, color: c.muted, margin: "8px 0 12px", fontFamily: "'DM Mono', monospace" }}>
          Ziel: <span style={{ color: c.amber, fontWeight: 600 }}>{targetTemp}°C</span>
        </div>
        <div style={{ height: 4, background: c.dim, borderRadius: 2, marginBottom: 14 }}>
          <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, barPct))}%`, background: `linear-gradient(90deg, ${c.teal}, ${c.amber})`, borderRadius: 2, transition: "width 0.5s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
          <button onClick={() => adjustTemp(-0.5)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.border}`, background: c.surface, color: c.muted, cursor: "pointer", fontSize: 20 }}>−</button>
          <button onClick={() => adjustTemp(0.5)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.amberBorder}`, background: c.amberDim, color: c.amber, cursor: "pointer", fontSize: 20 }}>+</button>
        </div>
      </div>
    </Card>
  )
}

// ─── WEATHER CARD ───────────────────────────────────────────────────
function WeatherCard() {
  const { entities, sendMessage, connected } = useHA()
  const [forecast, setForecast] = useState([])
  const weather = e(entities, 'weather.forecast_stauferabby')
  const sun = e(entities, 'sun.sun')

  // Fetch 3-day forecast via WS
  useEffect(() => {
    if (!connected) return
    const fetchForecast = async () => {
      try {
        const result = await sendMessage({
          type: 'call_service',
          domain: 'weather',
          service: 'get_forecasts',
          service_data: { type: 'daily' },
          target: { entity_id: 'weather.forecast_stauferabby' },
          return_response: true,
        })
        const fc = result?.response?.['weather.forecast_stauferabby']?.forecast || []
        setForecast(fc.slice(0, 3))
      } catch (err) {
        console.warn('Forecast fetch failed:', err)
      }
    }
    fetchForecast()
    const iv = setInterval(fetchForecast, 1800000) // every 30 min
    return () => clearInterval(iv)
  }, [connected, sendMessage])

  if (!weather) return null

  const state = weather.state
  const attrs = weather.attributes || {}
  const icon = WEATHER_ICONS[state] || '☁️'
  const desc = WEATHER_DE[state] || state
  const sunAttrs = sun?.attributes || {}

  const dayName = (iso) => {
    const d = new Date(iso)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Heute'
    if (d.toDateString() === tomorrow.toDateString()) return 'Morgen'
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
  }

  return (
    <Card accent>
      <Label>Wetter · StauferAbby</Label>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 44 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 44, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "white", lineHeight: 1 }}>
            {typeof attrs.temperature === 'number' ? attrs.temperature.toFixed(1) : '–'}°
          </div>
          <div style={{ fontSize: 15, color: c.muted, marginTop: 2 }}>{desc}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: c.text }}>💧 {attrs.humidity ?? '–'}%</span>
            <span style={{ fontSize: 14, color: c.text }}>🌬️ {typeof attrs.wind_speed === 'number' ? Math.round(attrs.wind_speed) : '–'} km/h</span>
            <span style={{ fontSize: 14, color: c.text }}>☁️ {typeof attrs.cloud_coverage === 'number' ? Math.round(attrs.cloud_coverage) : '–'}%</span>
          </div>
        </div>
      </div>
      <SunArc sunriseISO={sunAttrs.next_rising} sunsetISO={sunAttrs.next_setting} />
      {/* 3-Day Forecast */}
      {forecast.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${c.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>Vorhersage</div>
          <div style={{ display: "flex", gap: 8 }}>
            {forecast.map((fc, i) => {
              const fcIcon = WEATHER_ICONS[fc.condition] || '☁️'
              const hi = typeof fc.temperature === 'number' ? Math.round(fc.temperature) : '–'
              const lo = typeof fc.templow === 'number' ? Math.round(fc.templow) : null
              const rain = typeof fc.precipitation === 'number' ? fc.precipitation : null
              return (
                <div key={i} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10, background: c.surface,
                  border: `1px solid ${c.border}`, textAlign: "center",
                }}>
                  <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>
                    {dayName(fc.datetime)}
                  </div>
                  <div style={{ fontSize: 26, marginBottom: 4 }}>{fcIcon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "white", fontFamily: "'DM Mono', monospace" }}>
                    {hi}°
                  </div>
                  {lo !== null && (
                    <div style={{ fontSize: 13, color: c.muted, fontFamily: "'DM Mono', monospace" }}>
                      {lo}°
                    </div>
                  )}
                  {rain !== null && rain > 0 && (
                    <div style={{ fontSize: 11, color: c.blue, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                      🌧 {rain} mm
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── CAR IMAGE (from HA entity_picture) ─────────────────────────────
const EnyaqImage = () => {
  const { entities } = useHA()
  const [imgError, setImgError] = useState(false)
  // Get entity_picture from device_tracker (real car render in actual color)
  const tracker = e(entities, 'device_tracker.skoda_enyaq_standort')
  const imgUrl = tracker?.attributes?.entity_picture
  return (!imgUrl || imgError) ? (
    <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
      <span style={{ fontSize: 48 }}>🚗</span>
      <span style={{ fontSize: 11, color: c.amber, fontFamily: "'DM Mono', monospace", marginLeft: 8 }}>ENYAQ iV</span>
    </div>
  ) : (
    <img
      src={imgUrl}
      alt="Škoda Enyaq"
      onError={() => setImgError(true)}
      style={{ width: "100%", maxWidth: 300, height: "auto", borderRadius: 10, display: "block", margin: "0 auto 12px", objectFit: "cover", background: c.surface }}
    />
  )
}

// ─── CAR CARD ───────────────────────────────────────────────────────
function CarCard() {
  const { entities, callService } = useHA()
  const battery = v(entities, 'sensor.skoda_enyaq_batteriestand')
  const range = v(entities, 'sensor.skoda_enyaq_reichweite')
  const chargeStatus = v(entities, 'sensor.skoda_enyaq_ladestatus')
  const km = v(entities, 'sensor.skoda_enyaq_kilometerstand')
  const outTemp = v(entities, 'sensor.skoda_enyaq_aussentemperatur')
  const remainingTime = v(entities, 'sensor.skoda_enyaq_verbleibende_ladezeit')
  const chargePower = v(entities, 'sensor.skoda_enyaq_ladeleistung')
  const chargeRate = v(entities, 'sensor.skoda_enyaq_laderate')
  const soc = parseFloat(battery) || 0
  const isCharging = chargeStatus === 'charging'
  const remainingMin = parseInt(remainingTime) || 0
  const remainingStr = remainingMin >= 60 ? `${Math.floor(remainingMin/60)}h ${remainingMin%60}min` : `${remainingMin} min`

  const statusMap = { connect_cable: 'Kabel verbinden', charging: 'Lädt', ready: 'Bereit', ready_for_charging: 'Ladebereit', not_charging: 'Nicht laden', conservation: 'Erhaltung', target_reached: 'Ziel erreicht' }

  return (
    <Card>
      <Label>Škoda Enyaq · E-Auto</Label>
      <EnyaqImage />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: c.muted, fontFamily: "'DM Mono', monospace" }}>AKKU</span>
        <span style={{ fontSize: 15, fontFamily: "'DM Mono', monospace", color: "white" }}>{battery}%</span>
      </div>
      <div style={{ height: 6, background: c.dim, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${soc}%`, background: isCharging ? `linear-gradient(90deg, ${c.teal}, #06b6d4)` : soc > 50 ? c.green : soc > 20 ? c.amber : c.red, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: isCharging ? 4 : 8, flexWrap: "wrap" }}>
        {isCharging ? <Pill color="teal">⚡ LADEN</Pill> : <Pill color="amber">{statusMap[chargeStatus] || chargeStatus}</Pill>}
        <span style={{ fontSize: 14, color: c.muted, fontFamily: "'DM Mono', monospace" }}>{range} km Reichweite</span>
      </div>
      {isCharging && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: c.tealDim, border: `1px solid ${c.tealBorder}`, fontSize: 13, fontFamily: "'DM Mono', monospace", color: c.teal }}>
          <span>⏱ {remainingStr}</span>
          <span style={{ color: c.muted }}>·</span>
          <span>{chargePower} kW</span>
          <span style={{ color: c.muted }}>·</span>
          <span>{chargeRate} km/h</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 16, fontSize: 14, color: c.muted, fontFamily: "'DM Mono', monospace" }}>
        <span>🛣️ {km} km</span>
        <span>🌡️ {outTemp}°C außen</span>
      </div>
      {(parseFloat(outTemp) < 5 || parseFloat(outTemp) > 28) && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: parseFloat(outTemp) < 5 ? "rgba(96,165,250,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${parseFloat(outTemp) < 5 ? "rgba(96,165,250,0.2)" : "rgba(248,113,113,0.2)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: parseFloat(outTemp) < 5 ? c.blue : c.red }}>
            {parseFloat(outTemp) < 5 ? "❄️ Vorheizen" : "🌡️ Vorkühlen"}
          </span>
          <button onClick={() => callService('climate', 'turn_on', { entity_id: 'climate.skoda_enyaq_klimaanlage' })} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${parseFloat(outTemp) < 5 ? "rgba(96,165,250,0.4)" : "rgba(248,113,113,0.4)"}`, background: parseFloat(outTemp) < 5 ? "rgba(96,165,250,0.15)" : "rgba(248,113,113,0.15)", color: parseFloat(outTemp) < 5 ? c.blue : c.red, cursor: "pointer", fontSize: 13 }}>Starten</button>
        </div>
      )}
    </Card>
  )
}

// ─── CALENDAR CARD ──────────────────────────────────────────────────
function CalendarCard() {
  const { entities } = useHA()
  const awido = e(entities, 'calendar.awido_online_2')
  const radarr = e(entities, 'calendar.radarr')
  const events = []
  if (awido?.state === 'on' && awido?.attributes?.message) events.push({ time: "Heute", title: awido.attributes.message, color: c.green })
  if (radarr?.state === 'on' && radarr?.attributes?.message) events.push({ time: "Heute", title: radarr.attributes.message, color: c.amber })

  return (
    <Card>
      <Label>Kalender</Label>
      {events.length > 0 ? events.map((ev, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 10px", borderRadius: 9, background: c.surface, borderLeft: `3px solid ${ev.color}`, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 13, color: c.muted, fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>{ev.time}</div>
            <div style={{ fontSize: 16, color: c.text }}>{ev.title}</div>
          </div>
        </div>
      )) : (
        <div style={{ fontSize: 15, color: c.muted, padding: "8px 0" }}>Keine Termine heute</div>
      )}
      <div style={{ fontSize: 13, color: c.muted, marginTop: 6, fontStyle: "italic" }}>Google Kalender Integration hinzufügen für mehr Termine.</div>
    </Card>
  )
}

// ─── PLUGS CARD ─────────────────────────────────────────────────────
function PlugsCard() {
  const { entities, callService } = useHA()
  const plugs = [
    { id: 'switch.steckdose_entertainment', label: 'Entertainment', power: 'sensor.steckdose_entertainment_power' },
    { id: 'switch.steckdose_server', label: 'Server', power: 'sensor.steckdose_server_power' },
    { id: 'switch.steckdose_aq_gesamt', label: 'Aquarium Gesamt', power: 'sensor.steckdose_aq_gesamt_power' },
    { id: 'switch.steckdose_aq_licht', label: 'Aquarium Licht' },
    { id: 'switch.steckdose_aq_heizung', label: 'Aquarium Heizung', power: 'sensor.steckdose_aq_heizung_power' },
  ]

  return (
    <Card>
      <Label>Smarte Steckdosen</Label>
      {plugs.map((p, i) => {
        const ent = e(entities, p.id)
        const isOn = ent?.state === 'on'
        const watts = p.power ? parseFloat(v(entities, p.power)) : null
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < plugs.length - 1 ? `1px solid ${c.border}` : "none" }}>
            <span style={{ fontSize: 20 }}>🔌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, color: isOn ? c.text : c.muted }}>{p.label}</div>
              {p.power && isOn && watts != null && !isNaN(watts) && (
                <div style={{ fontSize: 13, color: c.amber, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
                  ⚡ {watts.toFixed(0)} W
                </div>
              )}
            </div>
            <Toggle on={isOn} onToggle={() => callService('switch', 'toggle', { entity_id: p.id })} />
          </div>
        )
      })}
    </Card>
  )
}

// ─── DENON CARD ─────────────────────────────────────────────────────
function DenonCard() {
  const { entities, callService, sendMessage } = useHA()
  // AVR receiver entity (always available when network is up)
  const avr = e(entities, 'media_player.denon')
  const avrId = 'media_player.denon'
  // HEOS streaming entity (for media info when playing)
  const heos = e(entities, 'media_player.denon_2')
  const heosId = 'media_player.denon_2'

  const avrState = avr?.state ?? 'unavailable'
  const isOn = avrState !== 'unavailable' && avrState !== 'off'
  const avrAttrs = avr?.attributes || {}
  const sources = avrAttrs.source_list || []
  const currentSource = avrAttrs.source ?? '–'
  const soundModes = avrAttrs.sound_mode_list || []
  const currentMode = avrAttrs.sound_mode ?? '–'
  const volume = avrAttrs.volume_level ?? 0
  const isMuted = avrAttrs.is_volume_muted ?? false

  // HEOS media info (when streaming via HEOS)
  const heosState = heos?.state
  const heosAvail = heosState && heosState !== 'unavailable'
  const heosAttrs = heos?.attributes || {}
  const title = heosAttrs.media_title ?? ''
  const artist = heosAttrs.media_artist ?? ''
  const album = heosAttrs.media_album_name ?? ''
  const heosSource = heosAttrs.source ?? ''
  const entityPicture = heosAttrs.entity_picture_local || heosAttrs.entity_picture || null
  const hasMediaInfo = heosAvail && (title || artist)

  const selectSource = (src) => callService('media_player', 'select_source', { entity_id: avrId, source: src })
  const setVolume = (val) => callService('media_player', 'volume_set', { entity_id: avrId, volume_level: val })
  const toggleMute = () => callService('media_player', 'volume_mute', { entity_id: avrId, is_volume_muted: !isMuted })

  // Favorite sources (show as quick-select buttons)
  const favSources = ['HEOS Music', 'TV Audio', 'Bluetooth', 'Tuner', 'Game']

  // Quick-start: turn on + select HEOS Music (for Deezer)
  const startDeezer = () => {
    if (!isOn) callService('media_player', 'turn_on', { entity_id: avrId })
    setTimeout(() => selectSource('HEOS Music'), isOn ? 100 : 3000)
  }

  // --- Media Browser ---
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserItems, setBrowserItems] = useState([])
  const [browserPath, setBrowserPath] = useState([]) // breadcrumb [{title, type, id}]
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState(null)

  const browseMedia = async (contentType, contentId, title) => {
    setBrowserLoading(true)
    setBrowserError(null)
    try {
      const msg = { type: 'media_player/browse_media', entity_id: heosId }
      if (contentType && contentId) {
        msg.media_content_type = contentType
        msg.media_content_id = contentId
      }
      const result = await sendMessage(msg)
      if (result?.children) {
        setBrowserItems(result.children)
      } else if (result?.media_content_id) {
        // Leaf node (no children) - this is playable
        setBrowserItems([])
      } else {
        setBrowserItems([])
      }
      if (contentType && contentId && title) {
        setBrowserPath(prev => [...prev, { title, type: contentType, id: contentId }])
      } else {
        setBrowserPath([])
      }
    } catch (err) {
      setBrowserError(err?.message || 'Fehler beim Laden')
      setBrowserItems([])
    }
    setBrowserLoading(false)
  }

  const openBrowser = () => {
    setBrowserOpen(true)
    browseMedia(null, null, null)
  }

  const closeBrowser = () => {
    setBrowserOpen(false)
    setBrowserItems([])
    setBrowserPath([])
    setBrowserError(null)
  }

  const navigateTo = (item) => {
    if (item.can_expand) {
      browseMedia(item.media_content_type, item.media_content_id, item.title)
    } else if (item.can_play) {
      playItem(item)
    }
  }

  const playItem = (item) => {
    // Ensure AVR is on and on HEOS source
    if (!isOn) {
      callService('media_player', 'turn_on', { entity_id: avrId })
      setTimeout(() => selectSource('HEOS Music'), 2000)
      setTimeout(() => {
        callService('media_player', 'play_media', {
          entity_id: heosId,
          media_content_type: item.media_content_type,
          media_content_id: item.media_content_id,
        })
      }, 3500)
    } else {
      if (currentSource !== 'HEOS Music' && currentSource !== 'NET') {
        selectSource('HEOS Music')
        setTimeout(() => {
          callService('media_player', 'play_media', {
            entity_id: heosId,
            media_content_type: item.media_content_type,
            media_content_id: item.media_content_id,
          })
        }, 1000)
      } else {
        callService('media_player', 'play_media', {
          entity_id: heosId,
          media_content_type: item.media_content_type,
          media_content_id: item.media_content_id,
        })
      }
    }
    closeBrowser()
  }

  const goBack = () => {
    if (browserPath.length <= 1) {
      browseMedia(null, null, null)
    } else {
      const newPath = browserPath.slice(0, -2)
      const target = browserPath[browserPath.length - 2]
      setBrowserPath(newPath)
      browseMedia(target.type, target.id, target.title)
    }
  }

  return (
    <Card accent={isOn}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Label>Denon AVR · Receiver</Label>
        <button onClick={() => callService('media_player', isOn ? 'turn_off' : 'turn_on', { entity_id: avrId })} style={{
          padding: "5px 14px", borderRadius: 8, border: `1px solid ${isOn ? c.redBorder : c.tealBorder}`,
          background: isOn ? c.redDim : c.tealDim, color: isOn ? c.red : c.teal,
          cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono', monospace",
        }}>{isOn ? "⏻ Aus" : "⏻ Ein"}</button>
      </div>

      {isOn ? (
        <>
          {/* Current source + mode info */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: hasMediaInfo ? 8 : 12, padding: "8px 10px", borderRadius: 8, background: c.surface }}>
            <span style={{ fontSize: 16 }}>🔊</span>
            <span style={{ fontSize: 14, color: c.text }}>Quelle: <span style={{ color: c.amber, fontWeight: 600 }}>{currentSource}</span></span>
            {currentMode !== '–' && <span style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace" }}>· {currentMode}</span>}
            {heosAvail && <span style={{ fontSize: 11, color: heosState === 'playing' ? c.green : heosState === 'paused' ? c.amber : c.muted, fontFamily: "'DM Mono', monospace", marginLeft: "auto" }}>
              {heosState === 'playing' ? '● Playing' : heosState === 'paused' ? '● Paused' : heosState === 'idle' ? '● Idle' : ''}
            </span>}
          </div>

          {/* Now Playing (from HEOS) – show when media info available */}
          {hasMediaInfo && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, padding: 10, borderRadius: 10, background: c.surface, border: `1px solid ${c.border}` }}>
              {entityPicture ? (
                <img src={entityPicture} alt="" style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0, objectFit: "cover", border: `1px solid ${c.border}` }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg, #1a1a2e, #16213e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `1px solid ${c.border}` }}>
                  {heosState === 'playing' ? '🎵' : heosState === 'paused' ? '⏸' : '🎶'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {title || 'Unbekannt'}
                </div>
                {artist && <div style={{ fontSize: 13, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artist}</div>}
                {album && <div style={{ fontSize: 12, color: c.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album}</div>}
              </div>
            </div>
          )}

          {/* Playback Controls (show when HEOS is available) */}
          {heosAvail && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
              {[
                { icon: '⏮', action: () => callService('media_player', 'media_previous_track', { entity_id: heosId }), accent: false },
                { icon: heosState === 'playing' ? '⏸' : '▶', action: () => callService('media_player', heosState === 'playing' ? 'media_pause' : 'media_play', { entity_id: heosId }), accent: true },
                { icon: '⏭', action: () => callService('media_player', 'media_next_track', { entity_id: heosId }), accent: false },
              ].map((btn, i) => (
                <button key={i} onClick={btn.action} style={{
                  padding: btn.accent ? "8px 20px" : "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 16,
                  border: `1px solid ${btn.accent ? c.amberBorder : c.border}`,
                  background: btn.accent ? c.amberDim : "transparent",
                  color: btn.accent ? c.amber : c.muted,
                  transition: "all 0.2s",
                }}>{btn.icon}</button>
              ))}
            </div>
          )}

          {/* Media Browser */}
          {browserOpen && (
            <div style={{ marginBottom: 12, borderRadius: 10, border: `1px solid ${c.border}`, background: c.surface, overflow: "hidden" }}>
              {/* Browser Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${c.border}`, background: c.card }}>
                {browserPath.length > 0 && (
                  <button onClick={goBack} style={{ padding: "2px 8px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.muted, cursor: "pointer", fontSize: 14 }}>←</button>
                )}
                <span style={{ fontSize: 13, color: c.text, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {browserPath.length > 0 ? browserPath[browserPath.length - 1].title : '📂 Medien durchsuchen'}
                </span>
                <button onClick={closeBrowser} style={{ padding: "2px 8px", borderRadius: 6, border: `1px solid ${c.border}`, background: "transparent", color: c.muted, cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
              {/* Browser Content */}
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {browserLoading ? (
                  <div style={{ padding: 20, textAlign: "center", color: c.muted, fontSize: 13 }}>Lade...</div>
                ) : browserError ? (
                  <div style={{ padding: 14, textAlign: "center", color: c.red, fontSize: 13 }}>{browserError}</div>
                ) : browserItems.length === 0 ? (
                  <div style={{ padding: 14, textAlign: "center", color: c.muted, fontSize: 13 }}>Keine Einträge</div>
                ) : (
                  browserItems.map((item, i) => (
                    <div key={item.media_content_id || i}
                      onClick={() => navigateTo(item)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer",
                        borderBottom: i < browserItems.length - 1 ? `1px solid ${c.dim}` : "none",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={ev => ev.currentTarget.style.background = c.dim}
                      onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
                    >
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0, background: c.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                          {item.can_expand ? '📁' : '🎵'}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                        {item.media_content_type && <div style={{ fontSize: 11, color: c.muted }}>{item.media_content_type}</div>}
                      </div>
                      {item.can_play && (
                        <button onClick={(ev) => { ev.stopPropagation(); playItem(item) }} style={{
                          padding: "3px 10px", borderRadius: 6, border: `1px solid ${c.tealBorder}`, background: c.tealDim,
                          color: c.teal, cursor: "pointer", fontSize: 12, flexShrink: 0,
                        }}>▶</button>
                      )}
                      {item.can_expand && <span style={{ color: c.muted, fontSize: 14, flexShrink: 0 }}>›</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Source Selection */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>Quelle wählen</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {/* Media Browser button */}
              <button onClick={browserOpen ? closeBrowser : openBrowser} style={{
                padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 600,
                background: browserOpen ? "linear-gradient(135deg, rgba(163,55,253,0.2), rgba(239,56,181,0.2))" : "linear-gradient(135deg, rgba(163,55,253,0.08), rgba(239,56,181,0.08))",
                border: `1px solid ${browserOpen ? "rgba(163,55,253,0.4)" : "rgba(163,55,253,0.2)"}`,
                color: browserOpen ? "#c084fc" : "#a78bfa",
              }}>🎵 Musik</button>
              {favSources.filter(s => sources.includes(s) && s !== 'HEOS Music').map(src => (
                <button key={src} onClick={() => selectSource(src)} style={{
                  padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace",
                  background: currentSource === src ? c.amberDim : "transparent",
                  border: `1px solid ${currentSource === src ? c.amberBorder : c.border}`,
                  color: currentSource === src ? c.amber : c.muted,
                  fontWeight: currentSource === src ? 600 : 400, transition: "all 0.2s",
                }}>{src}</button>
              ))}
              {/* Dropdown for all sources */}
              <select value={currentSource} onChange={ev => selectSource(ev.target.value)} style={{
                padding: "6px 8px", borderRadius: 8, fontSize: 12, fontFamily: "'DM Mono', monospace",
                background: c.surface, border: `1px solid ${c.border}`, color: c.muted, cursor: "pointer",
                appearance: "auto",
              }}>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Volume */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggleMute} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, padding: 0 }}>
              {isMuted ? '🔇' : volume > 0.5 ? '🔊' : volume > 0 ? '🔉' : '🔈'}
            </button>
            <div style={{ flex: 1, position: "relative", height: 20, display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, background: c.dim }} />
              <div style={{ position: "absolute", left: 0, height: 4, borderRadius: 2, width: `${Math.round(volume * 100)}%`, background: isMuted ? c.dim : `linear-gradient(90deg, #d97706, ${c.amber})`, transition: "width 0.1s" }} />
              <input type="range" min={0} max={100} value={Math.round(volume * 100)}
                onChange={ev => setVolume(parseInt(ev.target.value) / 100)}
                style={{ position: "absolute", left: 0, right: 0, width: "100%", appearance: "none", WebkitAppearance: "none", background: "transparent", cursor: "pointer", height: 20, margin: 0, padding: 0 }}
              />
            </div>
            <span style={{ fontSize: 13, color: isMuted ? c.dim : c.amber, fontFamily: "'DM Mono', monospace", minWidth: 32, textAlign: "right" }}>
              {isMuted ? "MUTE" : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔇</div>
          <div style={{ fontSize: 14, color: c.muted, marginBottom: 12 }}>Receiver aus</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => { startDeezer(); setTimeout(() => { setBrowserOpen(true); browseMedia(null, null, null) }, 3500) }} style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
              fontFamily: "'DM Mono', monospace", fontWeight: 600,
              background: "linear-gradient(135deg, rgba(163,55,253,0.15), rgba(239,56,181,0.15))",
              border: "1px solid rgba(163,55,253,0.3)", color: "#c084fc",
            }}>🎵 Musik</button>
            <button onClick={() => { if (!isOn) callService('media_player', 'turn_on', { entity_id: avrId }); setTimeout(() => selectSource('TV Audio'), isOn ? 100 : 3000) }} style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              background: c.surface, border: `1px solid ${c.border}`, color: c.muted,
            }}>📺 TV Audio</button>
            <button onClick={() => { if (!isOn) callService('media_player', 'turn_on', { entity_id: avrId }); setTimeout(() => selectSource('Bluetooth'), isOn ? 100 : 3000) }} style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              background: c.surface, border: `1px solid ${c.border}`, color: c.muted,
            }}>🔵 Bluetooth</button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── ROBOROCK CARD ──────────────────────────────────────────────────

// ─── UPTIME KUMA WIDGET ─────────────────────────────────────────────
function UptimeKumaWidget() {
  const { monitors, error } = useUptimeKuma()
  const up = monitors.filter(m => m.up).length
  const total = monitors.length

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Label>Uptime Kuma · Services</Label>
        {total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Dot on={up === total} color={c.green} />
            <span style={{ fontSize: 14, fontFamily: "'DM Mono', monospace", color: up === total ? c.green : c.amber }}>{up}/{total} online</span>
          </div>
        )}
      </div>
      {error && <div style={{ fontSize: 13, color: c.amber, marginBottom: 8 }}>Verbindung fehlgeschlagen: {error} — Prüfe Slug "{UPTIME_KUMA_SLUG}"</div>}
      {monitors.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
          {monitors.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: c.surface, border: `1px solid ${m.up === false ? c.redBorder : c.border}` }}>
              <Dot on={m.up} color={m.up ? c.green : c.red} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: m.up ? c.text : c.red, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace" }}>
                  {m.up ? `${m.latency}ms` : "DOWN"}
                  {m.up && m.uptime && <span style={{ marginLeft: 4, color: c.green, opacity: 0.7 }}>· {m.uptime}%</span>}
                </div>
              </div>
              <Pill small color={m.up ? "green" : "red"}>{m.up ? "UP" : "DOWN"}</Pill>
            </div>
          ))}
        </div>
      ) : !error ? (
        <div style={{ fontSize: 13, color: c.muted }}>Lade Monitore...</div>
      ) : null}
    </Card>
  )
}

// ─── AUTARKIE GAUGE ─────────────────────────────────────────────────
const AutarkieGauge = ({ value, size = 90 }) => {
  const pct = Math.max(0, Math.min(100, value))
  const r = size / 2 - 8, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const gaugeColor = pct > 80 ? c.green : pct > 40 ? c.amber : c.red
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c.dim} strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={gaugeColor} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dasharray 1s, stroke 0.5s" }} />
        <text x={size/2} y={size/2 - 4} textAnchor="middle" fill="white" fontSize={22} fontWeight="800" fontFamily="'Outfit', sans-serif">
          {Math.round(pct)}%
        </text>
        <text x={size/2} y={size/2 + 10} textAnchor="middle" fill={c.muted} fontSize={9} fontFamily="'DM Mono', monospace">
          AUTARKIE
        </text>
      </svg>
    </div>
  )
}

// ─── PV ERTRAG (Heute/Woche/Monat) ─────────────────────────────────
function PvErtrag() {
  const { entities, connected, sendMessage } = useHA()
  const [mode, setMode] = useState('today') // today | week | month
  const [offset, setOffset] = useState(0) // 0 = aktuell, -1 = letzte Woche/Monat, etc.
  const [statsValue, setStatsValue] = useState(null)
  const [loading, setLoading] = useState(false)
  const todayPv = parseFloat(v(entities, 'sensor.solakon_one_pv_energie')) || 0

  // Stats fuer Woche/Monat laden
  useEffect(() => {
    if (mode === 'today' && offset === 0) { setStatsValue(null); return }
    if (!connected) return
    setLoading(true)
    const now = new Date()
    let start, end
    if (mode === 'today') {
      const d = new Date(now); d.setDate(d.getDate() + offset); d.setHours(0, 0, 0, 0)
      start = d
      end = new Date(d); end.setDate(end.getDate() + 1)
    } else if (mode === 'week') {
      const d = new Date(now)
      const day = d.getDay() || 7 // Montag = 1
      d.setDate(d.getDate() - day + 1 + (offset * 7)); d.setHours(0, 0, 0, 0)
      start = new Date(d)
      end = new Date(d); end.setDate(end.getDate() + 7)
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      start = new Date(d)
      end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    // Wenn Zeitraum heute einschliesst, end = gestern 23:59:59 (heute kommt live)
    const includestoday = end > now && start <= now
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const queryEnd = includestoday ? new Date(todayMidnight.getTime() - 1) : end
    if (queryEnd <= start) {
      // Zeitraum ist komplett heute → nur Live-Wert
      setStatsValue(0); setLoading(false); return
    }
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      end_time: queryEnd.toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_energie'],
      period: 'day',
      types: ['change'],
    }).then(result => {
      const stats = result?.['sensor.solakon_one_pv_energie'] || []
      const sum = stats.reduce((acc, e) => acc + (e.change || 0), 0)
      setStatsValue(sum)
    }).catch(() => setStatsValue(null)).finally(() => setLoading(false))
  }, [mode, offset, connected])

  const cycleMode = () => {
    const next = mode === 'today' ? 'week' : mode === 'week' ? 'month' : 'today'
    setMode(next); setOffset(0)
  }

  // Angezeigte Werte berechnen
  const now = new Date()
  let displayValue, periodLabel
  if (mode === 'today' && offset === 0) {
    displayValue = todayPv; periodLabel = 'Heute'
  } else if (mode === 'today') {
    displayValue = statsValue ?? 0
    const d = new Date(now); d.setDate(d.getDate() + offset)
    periodLabel = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
  } else if (mode === 'week') {
    const d = new Date(now); const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1 + (offset * 7))
    const endD = new Date(d); endD.setDate(endD.getDate() + 6)
    const includestoday = offset === 0
    displayValue = (statsValue ?? 0) + (includestoday ? todayPv : 0)
    periodLabel = offset === 0 ? 'Diese Woche'
      : offset === -1 ? 'Letzte Woche'
      : `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${endD.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`
  } else {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const includestoday = offset === 0
    displayValue = (statsValue ?? 0) + (includestoday ? todayPv : 0)
    periodLabel = offset === 0 ? 'Dieser Monat'
      : offset === -1 ? 'Letzter Monat'
      : d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }

  const canGoForward = offset < 0
  const mono = "'DM Mono', monospace"
  return (
    <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: c.surface, border: `1px solid ${c.border}`, cursor: "pointer", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={cycleMode}>
          <span style={{ fontSize: 15 }}>☀️</span>
          <span style={{ fontSize: 12, color: c.muted, fontFamily: mono }}>PV-ERTRAG</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: c.amberDim, color: c.amber, fontFamily: mono, border: `1px solid ${c.amberBorder}` }}>
            {mode === 'today' ? 'Tag' : mode === 'week' ? 'Woche' : 'Monat'}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span onClick={(e) => { e.stopPropagation(); setOffset(o => o - 1) }}
            style={{ fontSize: 16, color: c.muted, padding: "0 4px", cursor: "pointer" }}>‹</span>
          <span style={{ fontSize: 11, color: c.muted, fontFamily: mono, minWidth: 90, textAlign: "center" }}>{periodLabel}</span>
          <span onClick={(e) => { e.stopPropagation(); if (canGoForward) setOffset(o => o + 1) }}
            style={{ fontSize: 16, color: canGoForward ? c.muted : c.dim, padding: "0 4px", cursor: canGoForward ? "pointer" : "default" }}>›</span>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: c.amber }}>
          {loading ? '...' : displayValue.toFixed(1)}
        </span>
        <span style={{ fontSize: 13, color: c.muted, fontFamily: mono }}> kWh</span>
      </div>
    </div>
  )
}

// ─── ENERGY KPIs ────────────────────────────────────────────────────
function EnergyKPIs() {
  const { entities, connected, sendMessage } = useHA()
  const solarPower = v(entities, 'sensor.solakon_one_pv_leistung')
  const gridPower = v(entities, 'sensor.shellypro3em_total_active_power')
  const todayForecast = v(entities, 'sensor.energy_production_today')
  const tomorrowForecast = v(entities, 'sensor.energy_production_tomorrow')
  const solarEnergy = v(entities, 'sensor.solakon_one_pv_energie')
  const batterySoc = v(entities, 'sensor.solakon_one_batterie_ladestand')
  const batteryPower = v(entities, 'sensor.solakon_one_batterie_leistung_2')
  const gridNum = parseFloat(gridPower)
  const solarNum = parseFloat(solarPower) || 0
  const batNum = parseFloat(batteryPower) || 0

  // Peak Solar seit Mitternacht – aus HA History laden, dann live weiter tracken
  const [peakSolar, setPeakSolar] = useState(0)
  const peakFetchedRef = useRef(null) // speichert Datum des letzten Fetchs
  useEffect(() => {
    const today = new Date().toDateString()
    if (!connected || peakFetchedRef.current === today) return
    peakFetchedRef.current = today
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
    sendMessage({
      type: 'history/history_during_period',
      start_time: midnight.toISOString(),
      end_time: new Date().toISOString(),
      entity_ids: ['sensor.solakon_one_pv_leistung'],
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    }).then(result => {
      const hist = result?.['sensor.solakon_one_pv_leistung'] || []
      let max = 0
      for (const entry of hist) {
        const val = parseFloat(entry.s ?? entry.state)
        if (!isNaN(val) && val > max) max = val
      }
      setPeakSolar(max)
    }).catch(() => {})
  }, [connected])
  // Live-Update: aktuellen Wert gegen Peak pruefen
  useEffect(() => {
    if (solarNum > 0 && solarNum > peakSolar) setPeakSolar(solarNum)
  }, [solarNum])

  // Restladezeit Batterie – Kapazitaet live aus HA
  const batteryCapacity = parseFloat(v(entities, 'sensor.solakon_one_batteriekapazitat')) || 2.24
  const BATTERY_CAPACITY_WH = batteryCapacity * 1000
  const socNum = parseFloat(batterySoc) || 0
  const chargeW = Math.max(0, -batNum) // negativ = laden
  const remainingWh = (100 - socNum) / 100 * BATTERY_CAPACITY_WH
  const chargeTimeMin = chargeW > 10 ? Math.round(remainingWh / chargeW * 60) : null
  const chargeTimeStr = chargeTimeMin != null
    ? chargeTimeMin >= 60 ? `${Math.floor(chargeTimeMin / 60)}h ${chargeTimeMin % 60}m` : `${chargeTimeMin}m`
    : socNum >= 100 ? 'Voll' : '–'
  // Batterie: negativ = laden, positiv = entladen
  // Verbrauch = Solar + Grid + Batterie (Vorzeichen natürlich: neg. Bat = Laden zieht ab, pos. Bat = Entladen addiert)
  const consumption = Math.max(0, solarNum + gridNum + batNum)
  const feedIn = isNaN(gridNum) ? '–' : gridNum < 0 ? Math.abs(gridNum).toFixed(0) : '0'
  const gridBuy = isNaN(gridNum) ? '–' : gridNum > 0 ? gridNum.toFixed(0) : '0'

  // Autarkie
  const totalConsumption = Math.max(1, consumption)
  const netzbezug = Math.max(0, gridNum)
  const autarkie = ((totalConsumption - netzbezug) / totalConsumption) * 100

  const gridExportNum = Math.max(0, -gridNum) || 0
  const batChargeNum = Math.max(0, -batNum)    // Batterie-Ladeleistung (positiver Wert)
  const batDischargeNum = Math.max(0, batNum)  // Batterie-Entladeleistung (positiver Wert)
  const eigenverbrauch = Math.max(0, solarNum - gridExportNum)

  // Amortisierung: kumulative Werte aus HA Statistics + heutiger Tageswert
  const [statsHist, setStatsHist] = useState({ pv: 0, export: 0 })
  const statsFetchedRef = useRef(false)
  useEffect(() => {
    if (!connected || statsFetchedRef.current) return
    statsFetchedRef.current = true
    const beforeToday = new Date(); beforeToday.setHours(0, 0, 0, 0)
    beforeToday.setTime(beforeToday.getTime() - 1) // gestern 23:59:59.999
    sendMessage({
      type: 'recorder/statistics_during_period',
      start_time: `${SOLAR_INSTALL_DATE}T00:00:00`,
      end_time: beforeToday.toISOString(),
      statistic_ids: ['sensor.solakon_one_pv_energie', 'sensor.solakon_one_netz_exportenergie'],
      period: 'day',
      types: ['change'],
    }).then(result => {
      const pvStats = result?.['sensor.solakon_one_pv_energie'] || []
      const exportStats = result?.['sensor.solakon_one_netz_exportenergie'] || []
      setStatsHist({
        pv: pvStats.reduce((acc, e) => acc + (e.change || 0), 0),
        export: exportStats.reduce((acc, e) => acc + (e.change || 0), 0),
      })
    }).catch(() => {})
  }, [connected])
  // Gesamt = vergangene Tage (Statistics) + heute (Live-Sensoren)
  const pvGesamt = statsHist.pv + (parseFloat(v(entities, 'sensor.solakon_one_pv_energie')) || 0)
  const einspeisungGesamt = statsHist.export + (parseFloat(v(entities, 'sensor.solakon_one_netz_exportenergie')) || 0)
  const eigenverbrauchKwh = Math.max(0, pvGesamt - einspeisungGesamt)
  const totalSavings = (eigenverbrauchKwh * SOLAR_STROMPREIS) + (einspeisungGesamt * SOLAR_EINSPEISEVERGUETUNG)
  const amortPct = SOLAR_ANLAGENKOSTEN > 0 ? Math.min(100, (totalSavings / SOLAR_ANLAGENKOSTEN) * 100) : 0
  const daysSinceInstall = Math.max(1, Math.floor((Date.now() - new Date(SOLAR_INSTALL_DATE).getTime()) / 86400000))

  // Saisonale Hochrechnung: Monatsfaktoren Sueddeutschland (Anteil am Jahresertrag)
  const MONTH_FACTORS = [0.025, 0.045, 0.08, 0.11, 0.135, 0.14, 0.14, 0.12, 0.095, 0.065, 0.03, 0.02]
  const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const payoffEstimate = (() => {
    if (totalSavings <= 0 || daysSinceInstall < 1) return null
    if (totalSavings >= SOLAR_ANLAGENKOSTEN) return 'Amortisiert!'
    const now = new Date()
    const curMonth = now.getMonth()
    const curFactor = MONTH_FACTORS[curMonth]
    const daysInMonth = new Date(now.getFullYear(), curMonth + 1, 0).getDate()
    const dailySavings = totalSavings / daysSinceInstall
    // Geschaetzter Jahresersparniss aus aktuellem Tagesdurchschnitt + Saisonfaktor
    const monthProjected = dailySavings * daysInMonth
    const annualEstimate = curFactor > 0 ? monthProjected / curFactor : 0
    if (annualEstimate <= 0) return null
    // Monat fuer Monat vorwaerts rechnen bis amortisiert
    const remaining = SOLAR_ANLAGENKOSTEN - totalSavings
    let cumulative = 0
    let m = curMonth
    // Restanteil aktueller Monat
    const dayOfMonth = now.getDate()
    cumulative += annualEstimate * MONTH_FACTORS[m] * ((daysInMonth - dayOfMonth) / daysInMonth)
    let monthsFromNow = 1
    m = (m + 1) % 12
    while (cumulative < remaining && monthsFromNow < 240) {
      cumulative += annualEstimate * MONTH_FACTORS[m]
      m = (m + 1) % 12
      monthsFromNow++
    }
    const payoffDate = new Date(now)
    payoffDate.setMonth(payoffDate.getMonth() + monthsFromNow)
    const years = Math.floor(monthsFromNow / 12)
    const months = monthsFromNow % 12
    const durationStr = years > 0 ? `~${years}J ${months}M` : `~${months} Monate`
    return `${MONTH_NAMES[payoffDate.getMonth()]} ${payoffDate.getFullYear()} (${durationStr})`
  })()

  const fmtInt = (val) => { const n = parseFloat(val); return isNaN(n) ? '–' : Math.round(n).toString() }

  const kpis = [
    { icon: "☀️", label: "Solar aktuell", val: fmtInt(solarPower), unit: "W" },
    { icon: "⚡", label: "Peak heute", val: peakSolar > 0 ? Math.round(peakSolar).toString() : '–', unit: "W" },
    { icon: "🔋", label: "Batterie", val: batterySoc ?? '–', unit: "%" },
    { icon: "⏱", label: "Restladezeit", val: chargeTimeStr, unit: "" },
    { icon: "🏠", label: "Verbrauch", val: Math.max(0, consumption).toFixed(0), unit: "W" },
    { icon: "↑", label: "Einspeisung", val: feedIn, unit: "W" },
    { icon: "↓", label: "Netzbezug", val: gridBuy, unit: "W" },
    { icon: "📊", label: "Prognose", val: fmtInt(todayForecast), unit: "kWh" },
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Autarkie + Eigenverbrauch Header */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <AutarkieGauge value={autarkie} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: c.muted, fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>Eigenverbrauch</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "white" }}>
            {eigenverbrauch.toFixed(0)}<span style={{ fontSize: 13, color: c.muted }}> W</span>
          </div>
          <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
            {solarNum > 0 ? `${solarNum.toFixed(0)}W Solar → ${consumption.toFixed(0)}W Haus${batChargeNum > 5 ? ` + ${batChargeNum.toFixed(0)}W Akku` : ''}${gridExportNum > 5 ? ` + ${feedIn}W Netz` : ''}` : batDischargeNum > 5 ? `${batDischargeNum.toFixed(0)}W Akku → Haus` : "Kein Solarertrag"}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ textAlign: "center", padding: "10px 4px", borderRadius: 10, background: c.surface, border: `1px solid ${c.border}` }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{k.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "white", lineHeight: 1 }}>
              {k.val}<span style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace" }}> {k.unit}</span>
            </div>
            <div style={{ fontSize: 9, color: c.muted, letterSpacing: 1, marginTop: 3, fontFamily: "'DM Mono', monospace" }}>{k.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <PvErtrag />

      {/* Amortisierung */}
      <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: c.surface, border: `1px solid ${c.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.text, fontFamily: "'DM Mono', monospace" }}>💰 Amortisierung</span>
          <span style={{ fontSize: 11, color: c.muted, fontFamily: "'DM Mono', monospace" }}>Tag {daysSinceInstall} seit Installation</span>
        </div>
        <div style={{ height: 6, background: c.dim, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${amortPct}%`, background: `linear-gradient(90deg, ${c.green}, ${c.teal})`, borderRadius: 3, transition: "width 1s" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: c.green }}>{totalSavings.toFixed(2)} €</div>
            <div style={{ fontSize: 9, color: c.muted }}>ERSPARNIS</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: c.text }}>{eigenverbrauchKwh.toFixed(1)} kWh</div>
            <div style={{ fontSize: 9, color: c.muted }}>EIGENVERBRAUCH</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: c.amber }}>{SOLAR_ANLAGENKOSTEN} €</div>
            <div style={{ fontSize: 9, color: c.muted }}>KOSTEN</div>
          </div>
        </div>
        {payoffEstimate && (
          <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: "rgba(20,184,166,0.08)", border: `1px solid rgba(20,184,166,0.15)`, textAlign: "center" }}>
            <span style={{ fontSize: 11, color: c.teal, fontFamily: "'DM Mono', monospace" }}>
              Prognose: amortisiert {payoffEstimate}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ENERGY FLOW DIAGRAM ────────────────────────────────────────────
function EnergyFlow() {
  const { entities } = useHA()
  const gridPower = parseFloat(v(entities, 'sensor.shellypro3em_total_active_power')) || 0
  const solar = parseFloat(v(entities, 'sensor.solakon_one_pv_leistung')) || 0
  const batterySoc = parseFloat(v(entities, 'sensor.solakon_one_batterie_ladestand')) || 0
  const batteryPower = parseFloat(v(entities, 'sensor.solakon_one_batterie_leistung_2')) || 0
  const batteryHealth = v(entities, 'sensor.solakon_one_batterie_gesundheitszustand')
  const pvEnergy = v(entities, 'sensor.solakon_one_pv_energie')
  const inverterTemp = v(entities, 'sensor.solakon_one_wechselrichter_temperatur')
  // Batterie: negativ = laden (Strom fließt IN Batterie), positiv = entladen (Strom fließt AUS Batterie)
  const batteryCharging = batteryPower < -5
  const batteryDischarging = batteryPower > 5

  const gridImport = Math.max(0, gridPower)
  const gridExport = Math.max(0, -gridPower)
  // Verbrauch = Solar + Batterie-Entladung + Netzbezug - Batterie-Ladung - Einspeisung
  const house = Math.max(0, solar + batteryPower + gridPower)

  // Spülmaschine
  const solarAktiv = entities?.['input_boolean.spulmaschine_solar_aktiv']?.state === 'on'
  const dishState = v(entities, 'sensor.geschirrspuler_betriebszustand')
  const dishProgress = v(entities, 'sensor.geschirrspuler_programm_fortschritt')
  const dishDoor = v(entities, 'sensor.geschirrspuler_tur')
  const fernstart = entities?.['binary_sensor.geschirrspuler_fernstart']?.state === 'on'
  const schwelle = parseFloat(v(entities, 'input_number.solar_einspeiseschwelle')) || 50
  const stateMap = { ready: 'Bereit', run: 'Läuft', finished: 'Fertig', pause: 'Pause', inactive: 'Inaktiv', delayed_start: 'Wartet' }
  const dishLabel = stateMap[dishState] || dishState || '–'

  const fmt = (w) => w >= 1000 ? `${(w/1000).toFixed(1)} kW` : `${Math.round(w)} W`
  const batColor = batterySoc > 60 ? '#4db6ac' : batterySoc > 20 ? '#ff9800' : '#f44336'

  // HA official colors
  const colSolar = '#ff9800'
  const colGridIn = '#488fc2'
  const colGridOut = '#8353d1'
  const colBatIn = '#f06292'
  const colBatOut = '#4db6ac'
  const colHome = '#488fc2'

  // Flow line component with animated dots (HA style)
  const FlowLine = ({ x1, y1, x2, y2, active, color, speed = 2 }) => {
    if (!active) return null
    const mx = (x1 + x2) / 2
    const pathD = y1 === y2
      ? `M ${x1},${y1} L ${x2},${y2}`
      : x1 === x2
        ? `M ${x1},${y1} L ${x2},${y2}`
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

  // Circle node component (HA style)
  const Node = ({ cx, cy, icon, value, label, color, sub }) => (
    <g>
      <circle cx={cx} cy={cy} r={34} fill="none" stroke={color} strokeWidth={2} opacity={0.3} />
      <circle cx={cx} cy={cy} r={33} fill={`${color}15`} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={20}>{icon}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={12} fill={color} fontFamily="'DM Mono', monospace" fontWeight={700}>{value}</text>
      {sub && <text x={cx} y={cy + 24} textAnchor="middle" fontSize={9} fill={c.muted} fontFamily="'DM Mono', monospace">{sub}</text>}
      <text x={cx} y={cy + 50} textAnchor="middle" fontSize={10} fill={c.muted} fontWeight={500} fontFamily="'Outfit', sans-serif">{label}</text>
    </g>
  )

  return (
    <Card>
      <Label>Energiefluss</Label>
      <style>{`@keyframes flowAnim { 0% { offset-distance: 0% } 100% { offset-distance: 100% } }`}</style>

      {/* HA-style cross layout SVG */}
      <svg viewBox="0 0 300 260" style={{ width: "100%", maxWidth: 440, margin: "0 auto", display: "block" }}>
        {/* Flow lines */}
        <FlowLine x1={150} y1={55} x2={50} y2={130} active={gridExport > 5} color={colGridOut} />
        <FlowLine x1={50} y1={130} x2={150} y2={195} active={gridImport > 5} color={colGridIn} />
        <FlowLine x1={150} y1={55} x2={150} y2={195} active={solar > 5 && house > 5} color={colSolar} speed={1.5} />
        <FlowLine x1={150} y1={55} x2={250} y2={130} active={batteryCharging} color={colBatIn} />
        <FlowLine x1={250} y1={130} x2={150} y2={195} active={batteryDischarging} color={colBatOut} />

        {/* Nodes */}
        <Node cx={150} cy={40} icon="☀️" value={fmt(solar)} label="Solar" color={colSolar} />
        <Node cx={50} cy={130} icon="⚡" value={gridExport > 5 ? fmt(gridExport) : fmt(gridImport)} label={gridExport > 5 ? 'Einspeisung' : 'Netz'} color={gridExport > 5 ? colGridOut : colGridIn} sub={gridExport > 5 ? '↑ Export' : gridImport > 5 ? '↓ Import' : ''} />
        <Node cx={250} cy={130} icon="🔋" value={`${batterySoc}%`} label="Batterie" color={batColor} sub={batteryPower !== 0 ? `${batteryCharging ? '⬆' : '⬇'} ${fmt(Math.abs(batteryPower))}` : ''} />
        <Node cx={150} cy={195} icon="🏠" value={fmt(Math.max(0, house))} label="Verbrauch" color={colHome} />
      </svg>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
        {[
          { icon: "🔋", val: `${batterySoc}%`, label: "SoC" },
          { icon: "❤️", val: `${batteryHealth}%`, label: "SoH" },
          { icon: "🌡️", val: `${inverterTemp}°C`, label: "Temp" },
          { icon: "☀️", val: `${pvEnergy} kWh`, label: "Heute" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center", padding: "6px 2px", borderRadius: 8, background: c.surface }}>
            <div style={{ fontSize: 13 }}>{s.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, fontFamily: "'DM Mono', monospace" }}>{s.val}</div>
            <div style={{ fontSize: 9, color: c.muted, fontFamily: "'DM Mono', monospace" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Dishwasher Solar Status */}
      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: c.surface, border: `1px solid ${c.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: solarAktiv || dishState === 'run' ? 8 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>🍽️</span>
            <span style={{ fontSize: 13, color: c.text, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>Spülmaschine</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Pill color={dishState === 'run' ? 'teal' : 'amber'}>{dishLabel}</Pill>
            {dishDoor === 'open' && <span style={{ fontSize: 11, color: c.muted }}>🚪 offen</span>}
          </div>
        </div>
        {dishState === 'run' && dishProgress && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ height: 4, background: c.dim, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${dishProgress}%`, background: `linear-gradient(90deg, ${c.teal}, #06b6d4)`, borderRadius: 2, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 11, color: c.muted, fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{dishProgress}% abgeschlossen</div>
          </div>
        )}
        {solarAktiv && dishState !== 'run' && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.15)` }}>
            <span style={{ fontSize: 13 }}>☀️</span>
            <span style={{ fontSize: 12, color: c.amber, fontFamily: "'DM Mono', monospace" }}>
              Solar-Warten ({schwelle}W){fernstart ? ' · Fernstart ✓' : ' · Fernstart ✗'}
            </span>
          </div>
        )}
        {!solarAktiv && dishState !== 'run' && (
          <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
            Solar-Start {fernstart ? 'bereit' : 'nicht aktiv'} · Tür {dishDoor || '–'}
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── ENERGY CHART (48h History) ─────────────────────────────────────
function EnergyChart() {
  const { entities, connected, sendMessage } = useHA()
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  // Fetch 48h history via HA WebSocket API
  useEffect(() => {
    if (!connected || fetchedRef.current) return
    fetchedRef.current = true
    const fetchHistory = async () => {
      try {
        const now = new Date()
        const start = new Date(now.getTime() - 48 * 3600 * 1000)
        const result = await sendMessage({
          type: 'history/history_during_period',
          start_time: start.toISOString(),
          end_time: now.toISOString(),
          entity_ids: ['sensor.solakon_one_pv_leistung', 'sensor.shellypro3em_total_active_power'],
          minimal_response: true,
          no_attributes: true,
          significant_changes_only: false,
        })
        if (!result) { setLoading(false); return }
        const solarHist = result['sensor.solakon_one_pv_leistung'] || []
        const gridHist = result['sensor.shellypro3em_total_active_power'] || []
        // Bucket into hourly intervals
        const buckets = {}
        const addToBucket = (entries, key) => {
          for (const entry of entries) {
            // lu is Unix timestamp in seconds (minimal_response), last_changed is ISO string
            const raw = entry.lu ?? entry.last_changed ?? entry.last_updated
            const ts = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
            const bucketKey = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')}T${String(ts.getHours()).padStart(2,'0')}`
            if (!buckets[bucketKey]) buckets[bucketKey] = { solar: [], grid: [] }
            const val = parseFloat(entry.s ?? entry.state)
            if (!isNaN(val)) buckets[bucketKey][key].push(val)
          }
        }
        addToBucket(solarHist, 'solar')
        addToBucket(gridHist, 'grid')
        const sorted = Object.keys(buckets).sort()
        const data = sorted.map(key => {
          const b = buckets[key]
          const solarAvg = b.solar.length > 0 ? b.solar.reduce((a, v) => a + v, 0) / b.solar.length : 0
          const gridAvg = b.grid.length > 0 ? b.grid.reduce((a, v) => a + v, 0) / b.grid.length : 0
          const hour = key.slice(11, 13)
          const day = key.slice(8, 10)
          const month = key.slice(5, 7)
          return {
            time: `${day}.${month} ${hour}h`,
            solar: Math.round(solarAvg),
            verbrauch: Math.max(0, Math.round(solarAvg + gridAvg)),
          }
        })
        setChartData(data)
      } catch (err) {
        console.warn('History fetch failed, falling back to realtime:', err)
      }
      setLoading(false)
    }
    fetchHistory()
    // Refresh every 5 minutes
    const iv = setInterval(() => { fetchedRef.current = false }, 300000)
    return () => clearInterval(iv)
  }, [connected, sendMessage])

  // Fallback: add realtime data point if history fetch failed
  const lastRef = useRef(0)
  useEffect(() => {
    if (chartData.length > 0 || loading) return
    const now = Date.now()
    if (now - lastRef.current < 60000) return
    lastRef.current = now
    const solarW = parseFloat(v(entities, 'sensor.solakon_one_pv_leistung')) || 0
    const gridW = parseFloat(v(entities, 'sensor.shellypro3em_total_active_power')) || 0
    const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    setChartData(prev => {
      const next = [...prev, { time, solar: Math.round(solarW), verbrauch: Math.max(0, Math.round(solarW + gridW)) }]
      return next.length > 120 ? next.slice(-120) : next
    })
  }, [entities, chartData.length, loading])

  return (
    <Card accent>
      <Label>48h Verlauf · Solar vs. Verbrauch</Label>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {[{ col: c.amber, l: "Solar" }, { col: c.teal, l: "Verbrauch" }].map(i => (
          <div key={i.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 14, height: 2, background: i.col, borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: c.muted, fontFamily: "'DM Mono', monospace" }}>{i.l}</span>
          </div>
        ))}
        {loading && <span style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace", marginLeft: "auto" }}>Lade Historie...</span>}
      </div>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c.amber} stopOpacity={0.3} />
                <stop offset="95%" stopColor={c.amber} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c.teal} stopOpacity={0.3} />
                <stop offset="95%" stopColor={c.teal} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" stroke={c.muted} fontSize={8} tickLine={false} fontFamily="'DM Mono', monospace" interval="preserveStartEnd" />
            <YAxis stroke={c.muted} fontSize={9} tickLine={false} unit=" W" fontFamily="'DM Mono', monospace" />
            <Tooltip contentStyle={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 11, fontFamily: "'DM Mono', monospace" }} labelStyle={{ color: c.muted }} />
            <Area type="monotone" dataKey="solar" stroke={c.amber} fill="url(#sg)" strokeWidth={1.5} name="Solar (W)" />
            <Area type="monotone" dataKey="verbrauch" stroke={c.teal} fill="url(#cg)" strokeWidth={1.5} name="Verbrauch (W)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ─── PROXMOX STATUS ─────────────────────────────────────────────────
function ProxmoxStatus() {
  const { entities } = useHA()
  const vms = [
    { name: "Beelink Proxmox", id: "device_tracker.beelinkproxmox" },
    { name: "Home Assistant VM", id: "device_tracker.homeassistant_2" },
  ]
  return (
    <Card>
      <Label>Proxmox · VMs / LXC</Label>
      {vms.map((vm, i) => {
        const ent = e(entities, vm.id)
        const running = ent?.state === 'home'
        return (
          <div key={vm.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < vms.length - 1 ? `1px solid ${c.border}` : "none" }}>
            <Dot on={running} />
            <div style={{ flex: 1, fontSize: 15, color: c.text }}>{vm.name}</div>
            <Pill small color={running ? "teal" : "red"}>{running ? "running" : "offline"}</Pill>
          </div>
        )
      })}
    </Card>
  )
}

// ─── PI-HOLE ────────────────────────────────────────────────────────
function PiHoleCard() {
  const [stats, setStats] = useState(null)
  const [dnsUp, setDnsUp] = useState(null)
  const [error, setError] = useState(null)
  const sidRef = useRef(null)

  const authenticate = async () => {
    if (!PIHOLE_PASSWORD) return null
    try {
      const res = await fetch(`${PIHOLE_URL}/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: PIHOLE_PASSWORD })
      })
      const data = await res.json()
      if (data.session?.valid) { sidRef.current = data.session.sid; return data.session.sid }
    } catch (e) { console.warn('Pi-hole auth failed:', e) }
    return null
  }

  const fetchStats = async () => {
    try {
      // Always check DNS status (no auth needed)
      const loginRes = await fetch(`${PIHOLE_URL}/info/login`)
      const loginData = await loginRes.json()
      setDnsUp(loginData.dns)

      // Try to get stats with auth
      let sid = sidRef.current
      if (!sid && PIHOLE_PASSWORD) sid = await authenticate()
      if (!sid) { setStats(null); return }

      const res = await fetch(`${PIHOLE_URL}/stats/summary`, { headers: { 'sid': sid } })
      if (res.status === 401) {
        sidRef.current = null
        const newSid = await authenticate()
        if (!newSid) return
        const retry = await fetch(`${PIHOLE_URL}/stats/summary`, { headers: { 'sid': newSid } })
        const data = await retry.json()
        setStats(data)
      } else {
        const data = await res.json()
        setStats(data)
      }
      setError(null)
    } catch (err) { setError(err.message) }
  }

  useEffect(() => {
    fetchStats()
    const iv = setInterval(fetchStats, 30000)
    return () => clearInterval(iv)
  }, [])

  const total = stats?.queries?.total
  const blocked = stats?.queries?.blocked
  const pct = stats?.queries?.percent_blocked
  const clients = stats?.clients?.active
  const domains = stats?.gravity?.domains_being_blocked

  const fmtNum = (n) => n != null ? n.toLocaleString('de-DE') : '–'

  return (
    <Card>
      <Label>Pi-hole · DNS</Label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Dot on={dnsUp === true} color={c.green} />
        <span style={{ fontSize: 15, color: c.text, fontWeight: 600 }}>Pi-hole</span>
        <Pill small color={dnsUp === true ? "green" : dnsUp === false ? "red" : "amber"}>
          {dnsUp === true ? "AKTIV" : dnsUp === false ? "OFFLINE" : "..."}
        </Pill>
      </div>
      {stats ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: c.redDim, border: `1px solid ${c.redBorder}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.red, fontFamily: "'Outfit', sans-serif" }}>{pct != null ? pct.toFixed(1) : '–'}%</div>
            <div style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace" }}>BLOCKIERT</div>
          </div>
          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: c.tealDim, border: `1px solid ${c.tealBorder}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.teal, fontFamily: "'Outfit', sans-serif" }}>{fmtNum(total)}</div>
            <div style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace" }}>ANFRAGEN</div>
          </div>
          <div style={{ textAlign: "center", padding: 6, borderRadius: 8, background: c.surface }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{fmtNum(blocked)}</div>
            <div style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace" }}>Geblockt</div>
          </div>
          <div style={{ textAlign: "center", padding: 6, borderRadius: 8, background: c.surface }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{clients ?? '–'}</div>
            <div style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace" }}>Clients</div>
          </div>
        </div>
      ) : !PIHOLE_PASSWORD ? (
        <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", padding: "4px 0" }}>
          PIHOLE_PASSWORD in Config setzen für Stats
        </div>
      ) : error ? (
        <div style={{ fontSize: 12, color: c.red, fontFamily: "'DM Mono', monospace" }}>{error}</div>
      ) : null}
    </Card>
  )
}

// ─── BUS DEPARTURES (VVS) ───────────────────────────────────────────
function BusDeparturesCard() {
  const [departures, setDepartures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const stations = [
    { id: '5003685', name: 'Bajastraße' },
    { id: '5003688', name: 'Finkenberg' },
  ]

  const fetchDepartures = async () => {
    try {
      const allDeps = []
      for (const station of stations) {
        const url = `${VVS_URL}/XML_DM_REQUEST?locationServerActive=1&stateless=1&language=de&depArr=departure&type_dm=any&name_dm=${station.id}&mode=direct&useRealtime=1&outputFormat=json&limit=10`
        const res = await fetch(url)
        const data = await res.json()
        const deps = data.departureList || []
        deps.forEach(d => {
          const line = d.servingLine?.number
          if (line === '207' || line === '209') {
            const scheduled = d.dateTime ? `${String(d.dateTime.hour).padStart(2,'0')}:${String(d.dateTime.minute).padStart(2,'0')}` : ''
            const real = d.realDateTime ? `${String(d.realDateTime.hour).padStart(2,'0')}:${String(d.realDateTime.minute).padStart(2,'0')}` : scheduled
            const delay = parseInt(d.servingLine?.delay) || 0
            allDeps.push({
              line, station: station.name,
              direction: d.servingLine?.direction || '',
              scheduled, real, delay,
              countdown: parseInt(d.countdown) || 0,
              realtime: d.servingLine?.realtime === '1',
            })
          }
        })
      }
      allDeps.sort((a, b) => a.countdown - b.countdown)
      // Max 2 pro Linie
      const limited = []
      const countPerLine = {}
      for (const d of allDeps) {
        countPerLine[d.line] = (countPerLine[d.line] || 0) + 1
        if (countPerLine[d.line] <= 2) limited.push(d)
      }
      limited.sort((a, b) => a.countdown - b.countdown)
      setDepartures(limited)
      setError(null)
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  useEffect(() => {
    fetchDepartures()
    const iv = setInterval(fetchDepartures, 30000)
    return () => clearInterval(iv)
  }, [])

  const lineColor = (line) => line === '207' ? '#3b82f6' : '#8b5cf6'

  return (
    <Card>
      <Label>🚌 Bus · Waiblingen</Label>
      {loading ? (
        <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", padding: 8 }}>Lade Abfahrten...</div>
      ) : error ? (
        <div style={{ fontSize: 12, color: c.red, fontFamily: "'DM Mono', monospace" }}>{error}</div>
      ) : departures.length === 0 ? (
        <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", padding: 8 }}>Keine Abfahrten gefunden</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {departures.map((d, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
              borderRadius: 8, background: i === 0 ? "rgba(59,130,246,0.06)" : "transparent",
              borderBottom: i < departures.length - 1 ? `1px solid ${c.border}` : 'none'
            }}>
              <div style={{
                minWidth: 38, textAlign: "center", padding: "3px 6px", borderRadius: 6,
                background: lineColor(d.line), color: "white",
                fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace"
              }}>{d.line}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: c.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  → {d.direction}
                </div>
                <div style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace" }}>
                  ab {d.station}
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: 50 }}>
                <div style={{
                  fontSize: 16, fontWeight: 800, fontFamily: "'Outfit', sans-serif",
                  color: d.countdown <= 5 ? c.amber : c.text
                }}>
                  {d.countdown}<span style={{ fontSize: 10, color: c.muted }}> min</span>
                </div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: d.delay > 0 ? c.red : c.muted }}>
                  {d.real}{d.delay > 0 ? ` +${d.delay}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── WASTE CARD ─────────────────────────────────────────────────────
function WasteCard() {
  const { entities } = useHA()
  const items = [
    { icon: "🟢", text: v(entities, 'sensor.biotonne') },
    { icon: "🟡", text: v(entities, 'sensor.nachste_abholung') },
    { icon: "🔵", text: v(entities, 'sensor.papiertonne_container') },
  ]

  return (
    <Card>
      <Label>Müllabfuhr · Nächste Leerung</Label>
      {items.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i < items.length - 1 ? `1px solid ${c.border}` : "none" }}>
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <div style={{ fontSize: 15, color: c.text }}>{t.text}</div>
        </div>
      ))}
    </Card>
  )
}

// ─── UNRAID SERVER (via Glances) ────────────────────────────────────
function UnraidCard() {
  const { data, error } = useGlances()
  const [showContainers, setShowContainers] = useState(false)

  if (error) return (
    <Card>
      <Label>Unraid · N100</Label>
      <div style={{ fontSize: 13, color: c.red }}>Glances: {error}</div>
    </Card>
  )
  if (!data) return (
    <Card>
      <Label>Unraid · N100</Label>
      <div style={{ fontSize: 13, color: c.muted }}>Lade Glances...</div>
    </Card>
  )

  const fmtGB = (bytes) => (bytes / 1024 / 1024 / 1024).toFixed(1)
  const fmtMB = (bytes) => Math.round(bytes / 1024 / 1024)
  const running = data.containers.filter(ct => ct.status === 'running' || ct.status === 'healthy').length
  const topContainers = data.containers.slice(0, showContainers ? 20 : 5)

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <Label>Unraid · N100</Label>
          <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", marginTop: -6, marginBottom: 6 }}>
            {data.system} · Uptime: {data.uptime}
          </div>
        </div>
        <Pill color="teal" small>{running} Container</Pill>
      </div>

      {/* Gauges */}
      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 12 }}>
        <Gauge value={Math.round(data.cpu)} max={100} color={data.cpu > 80 ? c.red : data.cpu > 50 ? c.amber : c.teal} size={72} label="CPU" unit="%" />
        <Gauge value={Math.round(data.mem)} max={100} color={data.mem > 80 ? c.red : data.mem > 60 ? c.amber : c.teal} size={72} label="RAM" unit="%" />
        <Gauge value={data.cpuTemp ?? 0} max={100} color={data.cpuTemp > 80 ? c.red : data.cpuTemp > 60 ? c.amber : c.blue} size={72} label="TEMP" unit="°C" />
        <Gauge value={Math.round(data.diskPercent)} max={100} color={data.diskPercent > 80 ? c.red : data.diskPercent > 60 ? c.amber : c.green} size={72} label="NVMe" unit="%" />
      </div>

      {/* Quick Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", flexWrap: "wrap" }}>
        <span>RAM: {fmtGB(data.memUsed)}/{fmtGB(data.memTotal)} GB</span>
        <span>· NVMe: {fmtGB(data.diskUsed)}/{fmtGB(data.diskTotal)} GB</span>
      </div>

      {/* Docker Containers */}
      <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, textTransform: "uppercase" }}>Docker Container</div>
          <button onClick={() => setShowContainers(!showContainers)} style={{
            border: `1px solid ${c.border}`, background: "transparent", color: c.muted,
            padding: "2px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace",
          }}>{showContainers ? 'Weniger' : `Alle ${data.containers.length}`}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 4 }}>
          {topContainers.map(ct => {
            const healthy = ct.status === 'running' || ct.status === 'healthy'
            const cpuPct = ct.cpu?.total ?? 0
            const memMB = fmtMB(ct.memory?.usage ?? 0)
            return (
              <div key={ct.name} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 6,
                background: c.surface, border: `1px solid ${healthy ? c.border : c.redBorder}`,
              }}>
                <Dot on={healthy} color={healthy ? c.green : c.red} />
                <span style={{ flex: 1, fontSize: 12, color: healthy ? c.text : c.red, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ct.name}</span>
                <span style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
                  {cpuPct.toFixed(0)}% · {memMB}MB
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// ─── DISHWASHER CARD ────────────────────────────────────────────────
function DishwasherCard() {
  const { entities, callService } = useHA()
  const opState = v(entities, 'sensor.geschirrspuler_betriebszustand')
  const progress = v(entities, 'sensor.geschirrspuler_programm_fortschritt')
  const endTime = v(entities, 'sensor.geschirrspuler_programm_endzeit')
  const door = v(entities, 'sensor.geschirrspuler_tur')
  const solarActive = e(entities, 'input_boolean.spulmaschine_solar_aktiv')
  const isSolarOn = solarActive?.state === 'on'
  const program = v(entities, 'input_select.spulmaschine_programm')
  const fallbackTime = v(entities, 'input_datetime.spulmaschine_fallback_uhrzeit')
  const remoteControl = e(entities, 'binary_sensor.geschirrspuler_fernsteuerung')
  const remoteStart = e(entities, 'binary_sensor.geschirrspuler_fernstart')

  const stateDE = {
    inactive: 'Inaktiv', ready: 'Bereit', delayedstart: 'Verzögert',
    run: 'Läuft', pause: 'Pause', actionrequired: 'Aktion nötig',
    finished: 'Fertig', error: 'Fehler', aborting: 'Abbruch',
  }
  const stateColor = {
    run: 'teal', finished: 'green', ready: 'amber', error: 'red',
    pause: 'amber', actionrequired: 'red', inactive: 'amber',
  }

  const isRunning = opState === 'run'
  const pctNum = parseFloat(progress) || 0
  const programDE = {
    dishcare_dishwasher_program_eco_50: 'Eco 50°',
    dishcare_dishwasher_program_auto_1: 'Auto',
    dishcare_dishwasher_program_intensiv_70: 'Intensiv 70°',
    dishcare_dishwasher_program_quick_45: 'Schnell 45°',
  }

  return (
    <Card accent={isRunning}>
      <Label>Spülmaschine · Solar-Automation</Label>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>🍽️</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
            <Pill color={stateColor[opState] || 'amber'}>{stateDE[opState] || opState}</Pill>
            {door === 'open' && <Pill color="red" small>TÜR OFFEN</Pill>}
            {remoteControl?.state === 'on' && <Pill color="teal" small>REMOTE</Pill>}
          </div>
          {isRunning && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace" }}>
                  {programDE[program] || program?.replace(/dishcare_dishwasher_program_/g, '').replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: 12, color: c.teal, fontFamily: "'DM Mono', monospace" }}>{progress}%</span>
              </div>
              <div style={{ height: 4, background: c.dim, borderRadius: 2, marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${pctNum}%`, background: `linear-gradient(90deg, ${c.teal}, #06b6d4)`, borderRadius: 2, transition: "width 1s" }} />
              </div>
              <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace" }}>
                Fertig ca. {endTime !== '–' ? fmtTime(endTime) : '–'}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Program Selector */}
      {!isRunning && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: c.surface, border: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>Programm wählen</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { value: 'dishcare_dishwasher_program_eco_50', label: 'Eco 50°' },
              { value: 'dishcare_dishwasher_program_auto_2', label: 'Auto' },
            ].map(opt => (
              <button key={opt.value} onClick={() => callService('input_select', 'select_option', { entity_id: 'input_select.spulmaschine_programm', option: opt.value })}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                  fontFamily: "'DM Mono', monospace", transition: "all 0.2s",
                  background: program === opt.value ? c.amberDim : "transparent",
                  border: `1px solid ${program === opt.value ? c.amberBorder : c.border}`,
                  color: program === opt.value ? c.amber : c.muted,
                  fontWeight: program === opt.value ? 600 : 400,
                }}>{opt.label}</button>
            ))}
          </div>
        </div>
      )}
      {/* Solar Automation */}
      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: isSolarOn ? c.tealDim : c.surface, border: `1px solid ${isSolarOn ? c.tealBorder : c.border}`, transition: "all 0.2s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isSolarOn ? 8 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>☀️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: isSolarOn ? c.teal : c.muted }}>Solar-Modus</span>
          </div>
          <Toggle on={isSolarOn} onToggle={() => callService('input_boolean', 'toggle', { entity_id: 'input_boolean.spulmaschine_solar_aktiv' })} />
        </div>
        {isSolarOn && (
          <div style={{ fontSize: 12, color: c.muted, fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
            Startet bei Solar-Überschuss · Fallback: <span style={{ color: c.amber }}>{fallbackTime}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── TAB OBEN ───────────────────────────────────────────────────────
function TabOben() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <LightGroupCard title="Licht · Wohnbereich" lights={[
          { id: 'light.wohnzimmer_7', label: 'Wohnzimmer', icon: '🛋️' },
          { id: 'light.esstisch_hue', label: 'Esstisch', icon: '🍽️' },
          { id: 'light.eingangsflut_hue', label: 'Eingangsflur', icon: '🚪' },
          { id: 'light.treppenlicht_hue', label: 'Treppenlicht', icon: '🪜' },
          { id: 'switch.steckdose_stern', label: 'Stern', icon: '⭐', isSwitch: true },
        ]} />
        <ThermostatCard entityId="climate.thermostat_wohnzimmer" name="Heizung · Wohnzimmer" />
        <WeatherCard />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <CalendarCard />
        <BusDeparturesCard />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <CarCard />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <DishwasherCard />
        <DenonCard />
      </div>
      <PlugsCard />
    </div>
  )
}

// ─── TAB UNTEN ──────────────────────────────────────────────────────
function TabUnten() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <LightGridCard title="Licht · Unten" lights={[
        { id: 'light.shelly_kinderzimmer', label: 'Kinderzimmer', icon: '🧒' },
        { id: 'light.buro', label: 'Büro', icon: '💻' },
        { id: 'light.kinderbett_strip_unten', label: 'Kinderbett Strip', icon: '🛏️' },
        { id: 'light.led_band_johannes_bett', label: 'LED Bett Johannes', icon: '💤' },
      ]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <ThermostatCard entityId="climate.thermostat_schlafzimmer" name="Schlafzimmer" />
        <ThermostatCard entityId="climate.thermostat_badezimmer" name="Badezimmer" />
        <ThermostatCard entityId="climate.thermostat_buro" name="Büro" />
        <ThermostatCard entityId="climate.kinderzimmer" name="Kinderzimmer" />
      </div>
    </div>
  )
}

// ─── TAB INFOS ──────────────────────────────────────────────────────
function TabInfos() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <EnergyFlow />
        <div><EnergyKPIs /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <EnergyChart />
        <UnraidCard />
      </div>
      <UptimeKumaWidget />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <ProxmoxStatus />
        <PiHoleCard />
        <WasteCard />
      </div>
    </div>
  )
}

// ─── MAIN APP ───────────────────────────────────────────────────────
function Dashboard() {
  const { connected, entities } = useHA()
  const [tab, setTab] = useState('oben')
  const hasEntities = Object.keys(entities).length > 0

  if (!hasEntities) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, background: c.bg }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${c.border}`, borderTopColor: c.amber, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <div style={{ fontFamily: "'DM Mono', monospace", color: c.muted }}>
          {connected ? 'Lade Entities...' : 'Verbinde mit Home Assistant...'}
        </div>
        <div style={{ fontSize: 11, color: c.dim }}>{HA_URL}</div>
      </div>
    )
  }

  return (
    <div style={{ background: c.bg, minHeight: "100vh", color: c.text, fontFamily: "'Outfit', sans-serif" }}>
      <Ribbon />
      <TabBar active={tab} onChange={setTab} />
      <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
        {tab === "oben" && <TabOben />}
        {tab === "unten" && <TabUnten />}
        {tab === "infos" && <TabInfos />}
      </div>
      {!connected && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(248,113,113,0.9)", color: "white", textAlign: "center", padding: 6, fontSize: 14, zIndex: 200 }}>
          Verbindung unterbrochen – Reconnect...
        </div>
      )}
    </div>
  )
}

export default function App() {
  return <HAProvider><Dashboard /></HAProvider>
}
