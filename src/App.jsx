import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ─── CONFIG ─────────────────────────────────────────────────────────
const HA_URL = 'ws://192.168.178.89:8123/api/websocket'
const HA_REST = 'http://192.168.178.89:8123/api'
const UPTIME_KUMA_URL = '/uptimekuma'
const UPTIME_KUMA_SLUG = 'default'
const HA_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmYzhlNTQ0MGNhZDk0NzE2YjdiOTVjMGQ2OTMzN2JkMiIsImlhdCI6MTc3MjcwMzExMCwiZXhwIjoyMDg4MDYzMTEwfQ.qqMmYjsl7Ovt2fYzHc38VaYdCpoIqCvQbny9vnk00uY'

// ─── DESIGN TOKENS ──────────────────────────────────────────────────
const c = {
  bg: "#07090f", surface: "#0d1117", card: "#0f1520", border: "#1a2535",
  text: "#e2e8f0", muted: "#64748b", dim: "#1e2d40",
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
    }
    ws.onclose = () => { setConnected(false); reconnectTimer.current = setTimeout(connect, 5000) }
    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => { connect(); return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close() } }, [connect])

  const callService = useCallback(async (domain, service, data) => {
    try {
      await fetch(`${HA_REST}/services/${domain}/${service}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch (err) { console.error('Service call failed:', err) }
  }, [])

  return <HAContext.Provider value={{ entities, connected, callService }}>{children}</HAContext.Provider>
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
    width: 36, height: 20, borderRadius: 10, cursor: "pointer",
    background: on ? c.amber : c.dim, position: "relative", transition: "background 0.25s", flexShrink: 0,
  }}>
    <div style={{
      position: "absolute", top: 3, width: 14, height: 14, borderRadius: "50%",
      background: on ? "#07090f" : "#64748b", left: on ? 19 : 3, transition: "left 0.2s",
    }} />
  </div>
)

const Pill = ({ children, color = "amber", small }) => (
  <span style={{
    padding: small ? "2px 7px" : "3px 9px", borderRadius: 20,
    fontSize: small ? 9 : 10, fontFamily: "'DM Mono', monospace", letterSpacing: 0.8,
    background: color === "amber" ? c.amberDim : color === "teal" ? c.tealDim : color === "green" ? "rgba(74,222,128,0.1)" : c.redDim,
    color: color === "amber" ? c.amber : color === "teal" ? c.teal : color === "green" ? c.green : c.red,
    border: `1px solid ${color === "amber" ? c.amberBorder : color === "teal" ? c.tealBorder : color === "green" ? "rgba(74,222,128,0.25)" : c.redBorder}`,
    flexShrink: 0,
  }}>{children}</span>
)

const Dot = ({ on, color }) => (
  <div style={{
    width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
    background: on ? (color || c.teal) : c.dim,
    boxShadow: on ? `0 0 7px ${color || c.teal}99` : "none", transition: "all 0.3s",
  }} />
)

const Label = ({ children }) => (
  <div style={{ fontSize: 9, letterSpacing: 2.2, color: c.muted, fontFamily: "'DM Mono', monospace", marginBottom: 10, textTransform: "uppercase" }}>{children}</div>
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
      <span style={{ fontSize: 10, color: c.muted, minWidth: 14 }}>🌑</span>
      <div style={{ flex: 1, position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, background: c.dim }} />
        <div style={{ position: "absolute", left: 0, height: 4, borderRadius: 2, width: `${pct}%`, background: disabled ? c.dim : `linear-gradient(90deg, #d97706, ${c.amber})`, transition: "width 0.1s" }} />
        <input type="range" min={0} max={255} value={brightness} disabled={disabled}
          onChange={ev => onChange(parseInt(ev.target.value))} onClick={ev => ev.stopPropagation()}
          style={{ position: "absolute", left: 0, right: 0, width: "100%", appearance: "none", WebkitAppearance: "none", background: "transparent", cursor: disabled ? "default" : "pointer", height: 20, margin: 0, padding: 0 }}
        />
      </div>
      <span style={{ fontSize: 10, color: c.muted }}>☀️</span>
      <span style={{ fontSize: 9, color: disabled ? c.dim : c.amber, fontFamily: "'DM Mono', monospace", minWidth: 28, textAlign: "right" }}>
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
      <text x={start.x - 4} y={start.y + 16} fill={c.muted} fontSize={8} fontFamily="'DM Mono', monospace" textAnchor="middle">🌅 {sunriseStr}</text>
      <circle cx={end.x} cy={end.y} r={4} fill="#f97316" opacity={0.6} />
      <text x={end.x + 4} y={end.y + 16} fill={c.muted} fontSize={8} fontFamily="'DM Mono', monospace" textAnchor="middle">🌇 {sunsetStr}</text>
      {progress > 0 && progress < 1 && (<>
        <circle cx={sun.x} cy={sun.y} r={10} fill={c.amber} opacity={0.15} />
        <circle cx={sun.x} cy={sun.y} r={6} fill={c.amber} opacity={0.9} />
        <circle cx={sun.x} cy={sun.y} r={3} fill="white" opacity={0.8} />
      </>)}
      <text x={cx} y={cy - 28} fill={c.text} fontSize={11} fontFamily="'DM Mono', monospace" textAnchor="middle" fontWeight="500">
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
        const res = await fetch(`${UPTIME_KUMA_URL}/api/status-page/${UPTIME_KUMA_SLUG}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        const all = []
        const hb = data.heartbeatList || {}
        for (const group of (data.publicGroupList || [])) {
          for (const mon of (group.monitorList || [])) {
            const beats = hb[mon.id] || []
            const latest = beats[beats.length - 1]
            all.push({ id: mon.id, name: mon.name, up: latest ? latest.status === 1 : null, latency: latest?.ping ?? null })
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
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, fontWeight: 500, color: c.amber, lineHeight: 1, letterSpacing: 2 }}>
        {now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style={{ fontSize: 9, color: c.muted, letterSpacing: 1.5, marginTop: 2 }}>
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
  const solar = v(entities, 'sensor.solaranlage_leistung')
  const grid = v(entities, 'sensor.shellypro3em_total_active_power')
  const weather = e(entities, 'weather.forecast_stauferabby')
  const outsideTemp = weather?.attributes?.temperature ?? '–'
  const gridNum = parseFloat(grid)
  const balance = parseFloat(solar) - (isNaN(gridNum) ? 0 : Math.abs(gridNum))
  const solarNum = parseFloat(solar)

  const persons = [
    { name: "Johannes", state: johannes?.state, avatar: "👨" },
    { name: "Tanja", state: tanja?.state, avatar: "👩" },
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
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 14, color: "white", letterSpacing: 0.5, lineHeight: 1 }}>STAUFER<span style={{ color: c.amber }}>.</span>HOME</div>
          <div style={{ fontSize: 8, color: c.muted, letterSpacing: 2 }}>WAIBLINGEN</div>
        </div>
      </div>
      <div style={{ width: 1, height: 32, background: c.border, margin: "0 4px" }} />
      {persons.map(p => (
        <div key={p.name} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20,
          background: isHome(p.state) ? c.tealDim : c.amberDim,
          border: `1px solid ${isHome(p.state) ? c.tealBorder : c.amberBorder}`,
        }}>
          <span style={{ fontSize: 13 }}>{p.avatar}</span>
          <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: isHome(p.state) ? c.teal : c.amber }}>{p.name}</span>
          <Dot on={isHome(p.state)} />
        </div>
      ))}
      <div style={{ width: 1, height: 32, background: c.border, margin: "0 4px" }} />
      {energyItems.map(item => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white", fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
              {item.val}<span style={{ fontSize: 9, color: c.muted }}>{item.unit && ` ${item.unit}`}</span>
            </div>
            <div style={{ fontSize: 8, color: c.muted, letterSpacing: 0.8 }}>{item.label}</div>
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
          fontSize: 13, fontFamily: "'Outfit', sans-serif", fontWeight: active === t.id ? 600 : 400,
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

  const toggleLight = (id) => callService('light', 'toggle', { entity_id: id })
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
              <span style={{ fontSize: 20, opacity: isOn ? 1 : 0.25, transition: "opacity 0.2s" }}>💡</span>
              <span style={{ flex: 1, fontSize: 13, color: isOn ? c.text : c.muted }}>{l.label}</span>
              <Toggle on={isOn} onToggle={() => toggleLight(l.id)} />
            </div>
            <DimmerSlider brightness={isOn ? brightness : 0} disabled={!isOn} onChange={(val) => setBrightness(l.id, val)} />
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
                <span style={{ fontSize: 22, opacity: isOn ? 1 : 0.25 }}>💡</span>
                <span style={{ flex: 1, fontSize: 13, color: isOn ? c.text : c.muted }}>{l.label}</span>
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
        <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "white", lineHeight: 1 }}>
          {currentTemp}<span style={{ fontSize: 16, color: c.muted }}>°C</span>
        </div>
        {hvacAction === 'heating' && <Pill color="red" small>HEIZT</Pill>}
        {hvacAction === 'idle' && <Pill color="teal" small>IDLE</Pill>}
        <div style={{ fontSize: 10, color: c.muted, margin: "8px 0 12px", fontFamily: "'DM Mono', monospace" }}>
          Ziel: <span style={{ color: c.amber, fontWeight: 600 }}>{targetTemp}°C</span>
        </div>
        <div style={{ height: 4, background: c.dim, borderRadius: 2, marginBottom: 14 }}>
          <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, barPct))}%`, background: `linear-gradient(90deg, ${c.teal}, ${c.amber})`, borderRadius: 2, transition: "width 0.5s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
          <button onClick={() => adjustTemp(-0.5)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.border}`, background: c.surface, color: c.muted, cursor: "pointer", fontSize: 18 }}>−</button>
          <button onClick={() => adjustTemp(0.5)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.amberBorder}`, background: c.amberDim, color: c.amber, cursor: "pointer", fontSize: 18 }}>+</button>
        </div>
      </div>
    </Card>
  )
}

// ─── WEATHER CARD ───────────────────────────────────────────────────
function WeatherCard() {
  const { entities } = useHA()
  const weather = e(entities, 'weather.forecast_stauferabby')
  const sun = e(entities, 'sun.sun')
  if (!weather) return null

  const state = weather.state
  const attrs = weather.attributes || {}
  const icon = WEATHER_ICONS[state] || '☁️'
  const desc = WEATHER_DE[state] || state
  const sunAttrs = sun?.attributes || {}

  return (
    <Card accent>
      <Label>Wetter · StauferAbby</Label>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 40 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "white", lineHeight: 1 }}>{attrs.temperature ?? '–'}°</div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: c.muted }}>💧 {attrs.humidity ?? '–'}%</span>
            <span style={{ fontSize: 11, color: c.muted }}>🌬️ {attrs.wind_speed ?? '–'} km/h</span>
            <span style={{ fontSize: 11, color: c.muted }}>☁️ {attrs.cloud_coverage ?? '–'}%</span>
          </div>
        </div>
      </div>
      <SunArc sunriseISO={sunAttrs.next_rising} sunsetISO={sunAttrs.next_setting} />
    </Card>
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
  const soc = parseFloat(battery) || 0
  const isCharging = chargeStatus === 'charging'

  const statusMap = { connect_cable: 'Kabel verbinden', charging: 'Lädt', ready: 'Bereit', not_charging: 'Nicht laden' }

  return (
    <Card>
      <Label>Škoda Enyaq · E-Auto</Label>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace" }}>AKKU</span>
        <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: "white" }}>{battery}%</span>
      </div>
      <div style={{ height: 6, background: c.dim, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${soc}%`, background: isCharging ? `linear-gradient(90deg, ${c.teal}, #06b6d4)` : soc > 50 ? c.green : soc > 20 ? c.amber : c.red, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        {isCharging ? <Pill color="teal">⚡ LADEN</Pill> : <Pill color="amber">{statusMap[chargeStatus] || chargeStatus}</Pill>}
        <span style={{ fontSize: 11, color: c.muted, fontFamily: "'DM Mono', monospace" }}>{range} km Reichweite</span>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: c.muted, fontFamily: "'DM Mono', monospace" }}>
        <span>🛣️ {km} km</span>
        <span>🌡️ {outTemp}°C außen</span>
      </div>
      {parseFloat(outTemp) < 5 && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: c.blue }}>❄️ Vorklimatisierung</span>
          <button onClick={() => callService('climate', 'turn_on', { entity_id: 'climate.skoda_enyaq_klimaanlage' })} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(96,165,250,0.4)", background: "rgba(96,165,250,0.15)", color: c.blue, cursor: "pointer", fontSize: 10 }}>Starten</button>
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
            <div style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>{ev.time}</div>
            <div style={{ fontSize: 13, color: c.text }}>{ev.title}</div>
          </div>
        </div>
      )) : (
        <div style={{ fontSize: 12, color: c.muted, padding: "8px 0" }}>Keine Termine heute</div>
      )}
      <div style={{ fontSize: 10, color: c.muted, marginTop: 6, fontStyle: "italic" }}>Google Kalender Integration hinzufügen für mehr Termine.</div>
    </Card>
  )
}

// ─── PLUGS CARD ─────────────────────────────────────────────────────
function PlugsCard() {
  const { entities, callService } = useHA()
  const plugs = [
    { id: 'switch.steckdose_stern', label: 'Stern' },
    { id: 'switch.steckdose_entertainment', label: 'Entertainment' },
    { id: 'switch.steckdose_server', label: 'Server' },
    { id: 'switch.steckdose_aq_gesamt', label: 'Aquarium Gesamt' },
    { id: 'switch.steckdose_aq_licht', label: 'Aquarium Licht' },
    { id: 'switch.steckdose_aq_heizung', label: 'Aquarium Heizung' },
  ]

  return (
    <Card>
      <Label>Smarte Steckdosen</Label>
      {plugs.map((p, i) => {
        const ent = e(entities, p.id)
        const isOn = ent?.state === 'on'
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < plugs.length - 1 ? `1px solid ${c.border}` : "none" }}>
            <span style={{ fontSize: 20 }}>🔌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: isOn ? c.text : c.muted }}>{p.label}</div>
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
  const { entities, callService } = useHA()
  const ent = e(entities, 'media_player.denon_3')
  const state = ent?.state ?? 'unavailable'
  const source = ent?.attributes?.source ?? '–'
  const title = ent?.attributes?.media_title ?? '–'
  const artist = ent?.attributes?.media_artist ?? ''
  const volume = ent?.attributes?.volume_level ?? 0
  const isOn = state !== 'unavailable' && state !== 'off'

  return (
    <Card accent={isOn}>
      <Label>Denon · Media</Label>
      {isOn ? (
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, #1a1a2e, #16213e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: `1px solid ${c.border}` }}>🎵</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Outfit', sans-serif", color: "white", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
            <div style={{ fontSize: 11, color: c.muted, marginBottom: 10 }}>{artist}{source !== '–' ? ` · ${source}` : ''}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {["⏮", state === 'playing' ? "⏸" : "▶", "⏭"].map((btn, i) => (
                <button key={i} onClick={() => {
                  if (i === 0) callService('media_player', 'media_previous_track', { entity_id: 'media_player.denon_3' })
                  if (i === 1) callService('media_player', state === 'playing' ? 'media_pause' : 'media_play', { entity_id: 'media_player.denon_3' })
                  if (i === 2) callService('media_player', 'media_next_track', { entity_id: 'media_player.denon_3' })
                }} style={{ padding: "5px 11px", borderRadius: 6, border: `1px solid ${i === 1 ? c.amberBorder : c.border}`, background: i === 1 ? c.amberDim : "transparent", color: i === 1 ? c.amber : c.muted, cursor: "pointer", fontSize: 13 }}>{btn}</button>
              ))}
              <div style={{ flex: 1, height: 4, background: c.dim, borderRadius: 2, marginLeft: 4 }}>
                <div style={{ height: "100%", width: `${Math.round(volume * 100)}%`, background: c.amber, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 10, color: c.muted, fontFamily: "'DM Mono', monospace" }}>{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>
      ) : <div style={{ textAlign: "center", padding: "20px 0", color: c.muted }}>🔇 Aus</div>}
    </Card>
  )
}

// ─── ROBOROCK CARD ──────────────────────────────────────────────────
function RoborockCard() {
  const { entities } = useHA()
  const tracker = e(entities, 'device_tracker.roborock')
  const atHome = tracker?.state === 'home'

  return (
    <Card>
      <Label>Roborock · Saugroboter</Label>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ fontSize: 40 }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <Pill color={atHome ? "teal" : "amber"}>{atHome ? "DOCKED" : tracker?.state ?? '–'}</Pill>
          </div>
          <div style={{ fontSize: 10, color: c.muted, fontStyle: "italic" }}>Roborock Sensoren nicht in HA. Integration einrichten für Details.</div>
        </div>
      </div>
    </Card>
  )
}

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
            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: up === total ? c.green : c.amber }}>{up}/{total} online</span>
          </div>
        )}
      </div>
      {error && <div style={{ fontSize: 11, color: c.amber, marginBottom: 8 }}>Verbindung fehlgeschlagen: {error} — Prüfe Slug "{UPTIME_KUMA_SLUG}"</div>}
      {monitors.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
          {monitors.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: c.surface, border: `1px solid ${m.up === false ? c.redBorder : c.border}` }}>
              <Dot on={m.up} color={m.up ? c.green : c.red} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: m.up ? c.text : c.red, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                <div style={{ fontSize: 9, color: c.muted, fontFamily: "'DM Mono', monospace" }}>{m.up ? `${m.latency}ms` : "DOWN"}</div>
              </div>
              <Pill small color={m.up ? "green" : "red"}>{m.up ? "UP" : "DOWN"}</Pill>
            </div>
          ))}
        </div>
      ) : !error ? (
        <div style={{ fontSize: 11, color: c.muted }}>Lade Monitore...</div>
      ) : null}
    </Card>
  )
}

// ─── ENERGY KPIs ────────────────────────────────────────────────────
function EnergyKPIs() {
  const { entities } = useHA()
  const solarPower = v(entities, 'sensor.solaranlage_leistung')
  const gridPower = v(entities, 'sensor.shellypro3em_total_active_power')
  const todayForecast = v(entities, 'sensor.energy_production_today')
  const solarEnergy = v(entities, 'sensor.solaranlage_energie')
  const gridNum = parseFloat(gridPower)
  const solarNum = parseFloat(solarPower)
  const consumption = isNaN(gridNum) || isNaN(solarNum) ? '–' : (solarNum + gridNum).toFixed(0)
  const feedIn = isNaN(gridNum) ? '–' : gridNum < 0 ? Math.abs(gridNum).toFixed(0) : '0'
  const gridBuy = isNaN(gridNum) ? '–' : gridNum > 0 ? gridNum.toFixed(0) : '0'

  const kpis = [
    { icon: "☀️", label: "Solar aktuell", val: solarPower, unit: "W" },
    { icon: "🏠", label: "Verbrauch", val: consumption, unit: "W" },
    { icon: "↑", label: "Einspeisung", val: feedIn, unit: "W" },
    { icon: "↓", label: "Netzbezug", val: gridBuy, unit: "W" },
    { icon: "📊", label: "Prognose heute", val: todayForecast, unit: "kWh" },
    { icon: "∑", label: "Gesamt Ertrag", val: solarEnergy, unit: "kWh" },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
      {kpis.map(k => (
        <Card key={k.label} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "white", lineHeight: 1 }}>
            {k.val}<span style={{ fontSize: 11, color: c.muted, fontFamily: "'DM Mono', monospace" }}> {k.unit}</span>
          </div>
          <div style={{ fontSize: 9, color: c.muted, letterSpacing: 1.5, marginTop: 6, fontFamily: "'DM Mono', monospace" }}>{k.label.toUpperCase()}</div>
        </Card>
      ))}
    </div>
  )
}

// ─── ENERGY CHART ───────────────────────────────────────────────────
function EnergyChart() {
  const { entities } = useHA()
  const [chartData, setChartData] = useState([])
  const lastRef = useRef(0)

  useEffect(() => {
    const now = Date.now()
    if (now - lastRef.current < 60000) return
    lastRef.current = now
    const solarW = parseFloat(v(entities, 'sensor.solaranlage_leistung')) || 0
    const gridW = parseFloat(v(entities, 'sensor.shellypro3em_total_active_power')) || 0
    const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    setChartData(prev => {
      const next = [...prev, { time, solar: solarW, verbrauch: Math.max(0, solarW + gridW) }]
      return next.length > 120 ? next.slice(-120) : next
    })
  }, [entities])

  return (
    <Card accent>
      <Label>Tagesverlauf · Solar vs. Verbrauch</Label>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {[{ col: c.amber, l: "Solar" }, { col: c.teal, l: "Verbrauch" }].map(i => (
          <div key={i.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 14, height: 2, background: i.col, borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: c.muted, fontFamily: "'DM Mono', monospace" }}>{i.l}</span>
          </div>
        ))}
      </div>
      <div style={{ width: "100%", height: 180 }}>
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
            <XAxis dataKey="time" stroke={c.muted} fontSize={9} tickLine={false} fontFamily="'DM Mono', monospace" />
            <YAxis stroke={c.muted} fontSize={9} tickLine={false} unit=" W" fontFamily="'DM Mono', monospace" />
            <Tooltip contentStyle={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 11, fontFamily: "'DM Mono', monospace" }} labelStyle={{ color: c.muted }} />
            <Area type="monotone" dataKey="solar" stroke={c.amber} fill="url(#sg)" strokeWidth={1.5} name="Solar" />
            <Area type="monotone" dataKey="verbrauch" stroke={c.teal} fill="url(#cg)" strokeWidth={1.5} name="Verbrauch" />
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
            <div style={{ flex: 1, fontSize: 12, color: c.text }}>{vm.name}</div>
            <Pill small color={running ? "teal" : "red"}>{running ? "running" : "offline"}</Pill>
          </div>
        )
      })}
    </Card>
  )
}

// ─── NETWORK ────────────────────────────────────────────────────────
function NetworkCard() {
  const { entities } = useHA()
  const adguard = e(entities, 'device_tracker.adguard')

  return (
    <Card>
      <Label>Netzwerk · AdGuard</Label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <Dot on={adguard?.state === 'home'} color={c.green} />
        <span style={{ fontSize: 12, color: c.text }}>AdGuard DNS</span>
        <Pill small color={adguard?.state === 'home' ? "green" : "red"}>{adguard?.state === 'home' ? "ONLINE" : "OFFLINE"}</Pill>
      </div>
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
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <div style={{ fontSize: 12, color: c.text }}>{t.text}</div>
        </div>
      ))}
    </Card>
  )
}

// ─── SERVER GAUGES ──────────────────────────────────────────────────
function ServerGauges() {
  return (
    <Card>
      <Label>Unraid Server · N100</Label>
      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 8 }}>
        <Gauge value={0} max={100} color={c.amber} size={68} label="CPU" unit="%" />
        <Gauge value={0} max={100} color={c.teal} size={68} label="RAM" unit="%" />
        <Gauge value={0} max={100} color={c.blue} size={68} label="TEMP" unit="°C" />
      </div>
      <div style={{ fontSize: 10, color: c.muted, textAlign: "center", fontStyle: "italic" }}>SNMP/Glances Integration einrichten</div>
    </Card>
  )
}

// ─── TAB OBEN ───────────────────────────────────────────────────────
function TabOben() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <LightGroupCard title="Licht · Wohnbereich" lights={[
          { id: 'light.wohnzimmer_7', label: 'Wohnzimmer' },
          { id: 'light.esstisch_hue', label: 'Esstisch' },
          { id: 'light.eingangsflut_hue', label: 'Eingangsflur' },
          { id: 'light.treppenlicht_hue', label: 'Treppenlicht' },
        ]} />
        <ThermostatCard entityId="climate.thermostat_wohnzimmer" name="Heizung · Wohnzimmer" />
        <WeatherCard />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <CalendarCard />
        <CarCard />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <PlugsCard />
        <DenonCard />
      </div>
    </div>
  )
}

// ─── TAB UNTEN ──────────────────────────────────────────────────────
function TabUnten() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <LightGridCard title="Licht · Unten" lights={[
        { id: 'light.shelly_kinderzimmer', label: 'Kinderzimmer' },
        { id: 'light.buro', label: 'Büro' },
        { id: 'light.kinderbett_strip_unten', label: 'Kinderbett Strip' },
        { id: 'light.led_band_johannes_bett', label: 'LED Bett Johannes' },
      ]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <ThermostatCard entityId="climate.thermostat_schlafzimmer" name="Schlafzimmer" />
        <ThermostatCard entityId="climate.thermostat_badezimmer" name="Badezimmer" />
        <ThermostatCard entityId="climate.thermostat_buro" name="Büro" />
      </div>
      <RoborockCard />
    </div>
  )
}

// ─── TAB INFOS ──────────────────────────────────────────────────────
function TabInfos() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <EnergyKPIs />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <EnergyChart />
        <ServerGauges />
      </div>
      <UptimeKumaWidget />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <ProxmoxStatus />
        <NetworkCard />
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
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(248,113,113,0.9)", color: "white", textAlign: "center", padding: 6, fontSize: 12, zIndex: 200 }}>
          Verbindung unterbrochen – Reconnect...
        </div>
      )}
    </div>
  )
}

export default function App() {
  return <HAProvider><Dashboard /></HAProvider>
}
