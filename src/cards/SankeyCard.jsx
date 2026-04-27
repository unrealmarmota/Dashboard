import { useState, useEffect, useRef, useMemo } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label } from '../atoms'
import { InfoModal } from '../atoms/InfoModal'

const E_IDS = [
  'sensor.solakon_one_pv_energie',
  'sensor.netzbezug_tag',
  'sensor.einspeisung_tag',
]
const KWD = 24
const PLUG_COLORS = ['#818cf8', '#f472b6', '#22d3ee', '#fb923c', '#a78bfa', '#f97316', '#34d399', '#e879f9']
const PLUG_ICONS  = ['\uD83D\uDD0C', '\uD83D\uDDA5\uFE0F', '\uD83D\uDC1F', '\u2615', '\uD83C\uDFAE', '\uD83E\uDDF5', '\u26A1', '\uD83D\uDCA1']

const PERIODS = [
  { key: 'jetzt', label: 'Jetzt' },
  { key: 'today', label: 'Heute' },
  { key: 'week',  label: '7 Tage' },
  { key: 'month', label: '30 Tage' },
]

function bandPath(x1, y1t, y1b, x2, y2t, y2b) {
  const mx = (x1 + x2) / 2
  return `M${x1},${y1t} C${mx},${y1t} ${mx},${y2t} ${x2},${y2t} L${x2},${y2b} C${mx},${y2b} ${mx},${y1b} ${x1},${y1b}Z`
}

function fmtVal(v, isLive) {
  if (isLive) {
    if (!v || v < 0.5) return '0 W'
    if (v >= 1000) return `${(v / 1000).toFixed(2)} kW`
    return `${Math.round(v)} W`
  }
  if (!v || v < 0.001) return '0 Wh'
  if (v < 1) return `${(v * 1000).toFixed(0)} Wh`
  return `${v.toFixed(2)} kWh`
}

function sumChange(entries, isKwd) {
  const s = (entries || []).reduce((acc, e) => acc + (e.change || 0), 0)
  return Math.max(0, isKwd ? s * KWD : s)
}

function plugKwh(hourE, dayE, nDays) {
  if (nDays <= 1) return (hourE || []).reduce((s, e) => s + (e.mean || 0), 0) / 1000
  return (dayE || []).slice(-nDays).reduce((s, e) => s + (e.mean || 0) * 24, 0) / 1000
}

export function SankeyCard() {
  const { entities, connected, sendMessage } = useHA()
  const [period, setPeriod] = useState('jetzt')
  const [stats,  setStats]  = useState(null)
  const [live,   setLive]   = useState(null)
  const [modal,  setModal]  = useState(false)
  const [tick,   setTick]   = useState(0)

  // Auto-discover alle sensor.steckdose_*_power
  const PLUGS = useMemo(() => {
    const keys = Object.keys(entities).filter(id => /^sensor\.steckdose_.*_power$/.test(id))
    return keys.map((sid, i) => {
      const label = entities[sid]?.attributes?.friendly_name?.replace(/^Steckdose\s*/i, '').replace(/\s*Leistung$/i, '').trim() || sid
      return { sid, label, icon: PLUG_ICONS[i % PLUG_ICONS.length], color: PLUG_COLORS[i % PLUG_COLORS.length] }
    }).sort((a, b) => a.label.localeCompare(b.label, 'de'))
  }, [Object.keys(entities).filter(id => /^sensor\.steckdose_.*_power$/.test(id)).join()])
  const PLUG_IDS = useMemo(() => PLUGS.map(p => p.sid), [PLUGS])

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 300000)
    return () => clearInterval(iv)
  }, [])

  // Live-Polling alle 10 s
  useEffect(() => {
    if (!connected) return
    let alive = true
    const fetchLive = () => {
      sendMessage({ type: 'get_states' }).then(states => {
        if (!alive || !Array.isArray(states)) return
        const get = id => {
          const v = parseFloat(states.find(x => x.entity_id === id)?.state)
          return isNaN(v) ? 0 : v
        }
        const pv      = Math.max(0, get('sensor.solakon_one_pv_leistung'))
        const gridImp = Math.max(0, get('sensor.netzbezug'))
        const gridExp = Math.max(0, get('sensor.einspeisung'))
        const batRaw  = get('sensor.solakon_one_batterie_leistung')
        const batCha  = Math.max(0,  batRaw)
        const batDis  = Math.max(0, -batRaw)
        const plugs   = PLUGS.map(p => ({ ...p, value: Math.max(0, get(p.sid)) }))
        const knownW  = plugs.reduce((s, p) => s + p.value, 0)
        const haus    = Math.max(0, pv + gridImp + batDis - gridExp - batCha)
        setLive({ pv, gridImp, gridExp, batDis, batCha, haus, knownW, plugs })
      }).catch(() => {})
    }
    fetchLive()
    const iv = setInterval(fetchLive, 10000)
    return () => { alive = false; clearInterval(iv) }
  }, [connected, PLUGS])

  // Statistiken
  useEffect(() => {
    if (!connected || PLUG_IDS.length === 0) return
    const now    = new Date()
    const today0 = new Date(); today0.setHours(0, 0, 0, 0)
    const month0 = new Date(); month0.setDate(month0.getDate() - 29); month0.setHours(0, 0, 0, 0)
    Promise.all([
      sendMessage({ type: 'recorder/statistics_during_period',
        start_time: today0.toISOString(), end_time: now.toISOString(),
        statistic_ids: E_IDS, period: 'hour', types: ['change'] }),
      sendMessage({ type: 'recorder/statistics_during_period',
        start_time: month0.toISOString(), end_time: now.toISOString(),
        statistic_ids: E_IDS, period: 'day', types: ['change'] }),
      sendMessage({ type: 'recorder/statistics_during_period',
        start_time: today0.toISOString(), end_time: now.toISOString(),
        statistic_ids: PLUG_IDS, period: 'hour', types: ['mean'] }),
      sendMessage({ type: 'recorder/statistics_during_period',
        start_time: month0.toISOString(), end_time: now.toISOString(),
        statistic_ids: PLUG_IDS, period: 'day', types: ['mean'] }),
    ]).then(([eH, eD, pH, pD]) => {
      const mk = (eR, nDays) => {
        const sl  = arr => nDays ? (arr || []).slice(-nDays) : (arr || [])
        const pv  = sumChange(sl(eR?.[E_IDS[0]]), false)
        const gi  = sumChange(sl(eR?.[E_IDS[1]]), false)
        const ge  = sumChange(sl(eR?.[E_IDS[2]]), true)
        const plugs = PLUGS.map(p => ({ ...p, value: plugKwh(pH?.[p.sid], pD?.[p.sid], nDays ?? 1) }))
        const kn  = plugs.reduce((s, p) => s + p.value, 0)
        const haus = Math.max(0, pv - ge) + gi
        return { pv, gridImp: gi, gridExp: ge, batDis: 0, batCha: 0, haus, knownW: kn, plugs }
      }
      setStats({ today: mk(eH, null), week: mk(eD, 7), month: mk(eD, 30) })
    }).catch(() => {})
  }, [connected, tick, PLUG_IDS.join()])

  const d = period === 'jetzt' ? live : stats?.[period]

  return (
    <>
      <Card onClick={() => setModal(true)} style={{ cursor: 'pointer' }}>
        <div className="flex items-center justify-between mb-2"
             onClick={e => e.stopPropagation()}>
          <Label>{'\u26A1'} Energiefluss</Label>
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors border ${
                  period === p.key
                    ? 'bg-teal/10 border-teal text-teal'
                    : 'border-border text-text-muted bg-transparent'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <SankeyDiagram data={d} isLive={period === 'jetzt'} maxH={200} />
        <p className="text-[10px] text-text-muted font-mono text-right mt-1 opacity-40">
          Tippen fuer Detailansicht
        </p>
      </Card>

      {modal && (
        <InfoModal extraWide onClose={() => setModal(false)}>
          <div className="mb-3 flex items-center justify-between pr-8">
            <Label>{'\u26A1'} Energiefluss</Label>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors border ${
                    period === p.key
                      ? 'bg-teal/10 border-teal text-teal'
                      : 'border-border text-text-muted bg-transparent'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <SankeyDiagram data={d} isLive={period === 'jetzt'} maxH={500} isModal />
        </InfoModal>
      )}
    </>
  )
}

// ── SVG-Diagramm mit ResizeObserver ──────────────────────────────────────────
// viewBox = echte Pixel → Schriften immer lesbar, Hoehe per maxH gedeckelt
function SankeyDiagram({ data, isLive, maxH, isModal }) {
  const wrapRef = useRef(null)
  const [W, setW] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setW(el.clientWidth || el.offsetWidth || 0)
    const obs = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Hoehe proportional zur Breite, aber gedeckelt
  const H     = W > 0 ? Math.min(Math.round(W * 0.32), maxH) : maxH
  const NW    = Math.max(10, Math.round(H * 0.055))
  const PADY  = Math.max(10, Math.round(H * 0.06))
  const AVAIL = H - PADY * 2

  // X-Positionen: Prozent der Breite
  // Rechts 38% Platz fuer Labels (DST_X bei 62%)
  const SRC_X = Math.round(W * 0.21)
  const CTR_X = Math.round(W * 0.44)
  const DST_X = Math.round(W * 0.62)
  const FS1   = Math.max(10, Math.round(H * 0.065))  // Label-Schrift
  const FS2   = Math.max(8,  Math.round(H * 0.052))  // Wert-Schrift

  if (!data || W === 0) {
    return (
      <div ref={wrapRef} style={{ width: '100%', height: `${maxH}px` }}
           className="flex items-center justify-center">
        <span className="text-text-muted font-mono text-sm">
          {!data ? 'Lade\u2026' : 'Keine Daten'}
        </span>
      </div>
    )
  }

  const { pv, gridImp, gridExp, batDis, batCha, haus, knownW, plugs } = data
  const total = Math.max(pv + gridImp + batDis, 0.001)
  const sc    = v => (Math.max(0, v) / total) * AVAIL

  const eigen = Math.max(0, pv - gridExp)
  const sH    = sc(eigen)
  const expH  = sc(gridExp)
  const gH    = sc(gridImp)
  const bDH   = sc(batDis)

  const sonstige = Math.max(0, haus - knownW)
  const cons = [
    ...plugs.map(p => ({ ...p, value: p.value || 0 })),
    { sid: 'sons',   label: 'Sonstige',    icon: '\uD83C\uDFE0', color: '#9ca3af', value: sonstige },
    ...(batCha > (isLive ? 5 : 0.001)
      ? [{ sid: 'bat', label: 'Akku laden', icon: '\uD83D\uDD0B', color: '#34d399', value: batCha }]
      : []),
    { sid: 'exp', label: 'Einspeisung', icon: '\u2191', color: '#f59e0b', value: gridExp, isExport: true },
  ]

  let cy = PADY
  const items = cons.map(c => { const h = sc(c.value); const y = cy; cy += h; return { ...c, h, y } })
  const hausItems  = items.filter(c => !c.isExport)
  const exportItem = items.find(c => c.isExport)

  let crY = PADY
  const cRights = hausItems.map(c => { const y = crY; crY += c.h; return y })

  const fmt = v => fmtVal(v, isLive)
  const solH = sH + expH
  const gridY = PADY + solH
  const batY  = gridY + gH
  const cH    = AVAIL - expH  // Mittelknoten-Hoehe

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      {W > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`}
             style={{ display: 'block', width: '100%', height: 'auto' }}>

          {/* Flows: Quellen → Mitte */}
          {sH > 0.5 && (
            <path d={bandPath(SRC_X + NW, PADY, PADY + sH, CTR_X, PADY, PADY + sH)}
              fill="var(--color-amber)" fillOpacity={0.18} />
          )}
          {gH > 0.5 && (
            <path d={bandPath(SRC_X + NW, gridY, gridY + gH, CTR_X, PADY + sH, PADY + sH + gH)}
              fill="#f87171" fillOpacity={0.18} />
          )}
          {bDH > 1 && (
            <path d={bandPath(SRC_X + NW, batY, batY + bDH, CTR_X, PADY + sH + gH, PADY + sH + gH + bDH)}
              fill="#34d399" fillOpacity={0.18} />
          )}

          {/* Flows: Mitte → Verbraucher */}
          {hausItems.map((c, i) => cRights[i] !== undefined && c.h > 0.5 ? (
            <path key={`fl-${c.sid}`}
              d={bandPath(CTR_X + NW, cRights[i], cRights[i] + c.h, DST_X, c.y, c.y + c.h)}
              fill={c.color} fillOpacity={0.22} />
          ) : null)}

          {/* Einspeisung-Bypass (Solar → direkt → Export, gestrichelt) */}
          {exportItem && expH > 0.5 && (
            <path
              d={bandPath(SRC_X + NW, PADY + sH, PADY + solH, DST_X, exportItem.y, exportItem.y + exportItem.h)}
              fill="#f59e0b" fillOpacity={0.13}
              stroke="#f59e0b" strokeWidth="0.6" strokeOpacity={0.35} strokeDasharray="4 3" />
          )}

          {/* Quell-Knoten */}
          {solH > 1 && <rect x={SRC_X} y={PADY}  width={NW} height={solH} fill="var(--color-amber)" rx="2" />}
          {gH   > 1 && <rect x={SRC_X} y={gridY} width={NW} height={gH}   fill="#f87171"             rx="2" />}
          {bDH  > 1 && <rect x={SRC_X} y={batY}  width={NW} height={bDH}  fill="#34d399"             rx="2" />}

          {/* Trennlinie Solar-Balken (Eigen / Einspeisung) */}
          {sH > 0.5 && expH > 0.5 && (
            <line x1={SRC_X} y1={PADY + expH} x2={SRC_X + NW} y2={PADY + expH}
              stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          )}

          {/* Mittel-Knoten */}
          <rect x={CTR_X} y={PADY} width={NW} height={cH}
            fill="rgba(255,255,255,0.07)" rx="2" />

          {/* Verbraucher-Knoten */}
          {items.map(c => c.h > 1 ? (
            <rect key={`nd-${c.sid}`} x={DST_X} y={c.y} width={NW} height={c.h}
              fill={c.color} rx="2" opacity={c.isExport ? 0.55 : 1} />
          ) : null)}

          {/* === Labels links (Quellen) === */}
          {solH > 2 && <>
            <text x={SRC_X - 6} y={PADY + solH / 2 - FS1 * 0.4}
              textAnchor="end" fontSize={FS1} fontWeight="bold"
              fill="var(--color-amber)" fontFamily="ui-monospace,monospace">
              {'\u2600\uFE0F'} Solar
            </text>
            <text x={SRC_X - 6} y={PADY + solH / 2 + FS2 * 1.1}
              textAnchor="end" fontSize={FS2}
              fill="rgba(255,255,255,0.45)" fontFamily="ui-monospace,monospace">
              {fmt(pv)}
            </text>
          </>}
          {gH > 2 && <>
            <text x={SRC_X - 6} y={gridY + gH / 2 - FS1 * 0.4}
              textAnchor="end" fontSize={FS1} fontWeight="bold"
              fill="#f87171" fontFamily="ui-monospace,monospace">
              {'\uD83D\uDD0C'} Netz
            </text>
            <text x={SRC_X - 6} y={gridY + gH / 2 + FS2 * 1.1}
              textAnchor="end" fontSize={FS2}
              fill="rgba(255,255,255,0.45)" fontFamily="ui-monospace,monospace">
              {fmt(gridImp)}
            </text>
          </>}
          {bDH > 4 && <>
            <text x={SRC_X - 6} y={batY + bDH / 2 - FS1 * 0.4}
              textAnchor="end" fontSize={FS1} fontWeight="bold"
              fill="#34d399" fontFamily="ui-monospace,monospace">
              {'\uD83D\uDD0B'} Akku
            </text>
            <text x={SRC_X - 6} y={batY + bDH / 2 + FS2 * 1.1}
              textAnchor="end" fontSize={FS2}
              fill="rgba(255,255,255,0.45)" fontFamily="ui-monospace,monospace">
              {fmt(batDis)}
            </text>
          </>}

          {/* Label Mitte */}
          <text x={CTR_X + NW / 2} y={PADY + cH / 2 - FS1 * 0.4}
            textAnchor="middle" fontSize={FS1}
            fill="rgba(255,255,255,0.4)" fontFamily="ui-monospace,monospace">
            {'\uD83C\uDFE0'}
          </text>
          <text x={CTR_X + NW / 2} y={PADY + cH / 2 + FS2 * 1.1}
            textAnchor="middle" fontSize={FS2 - 1}
            fill="rgba(255,255,255,0.25)" fontFamily="ui-monospace,monospace">
            {fmt(haus)}
          </text>

          {/* Labels rechts — Force-Separation verhindert Ueberlappungen */}
          {(() => {
            // Nur sichtbare Balken (h > 0.5)
            const vis = items.filter(c => c.h > 0.5)
            // Labelhoehe: zweizeilig wenn genug Platz, sonst einzeilig
            const lbls = vis.map(c => {
              const twoLine = c.h >= FS1 * 2.2
              const lh = twoLine ? (FS1 + FS2 + 5) : (FS2 + 4)
              return { c, twoLine, lh, idealY: c.y + c.h / 2, labelY: c.y + c.h / 2 }
            })
            // Vorwaerts: Ueberlappung nach unten schieben
            for (let i = 1; i < lbls.length; i++) {
              const p = lbls[i - 1], q = lbls[i]
              const minY = p.labelY + p.lh / 2 + 3
              if (q.labelY - q.lh / 2 < minY) q.labelY = minY + q.lh / 2
            }
            // Rueckwaerts: Elemente die unten herauslaufen nach oben schieben
            let ceiling = PADY + AVAIL - 4
            for (let i = lbls.length - 1; i >= 0; i--) {
              const q = lbls[i]
              if (q.labelY + q.lh / 2 > ceiling) {
                q.labelY = ceiling - q.lh / 2
                ceiling = q.labelY - q.lh / 2 - 3
              }
            }
            return lbls.map(({ c, twoLine, lh, idealY, labelY }) => {
              const displaced = Math.abs(labelY - idealY) > 2
              const tx = DST_X + NW + 8
              const opacity = c.isExport ? 0.8 : 1
              return (
                <g key={`lb-${c.sid}`}>
                  {/* Verbindungslinie wenn Label verschoben */}
                  {displaced && (
                    <polyline
                      points={`${DST_X + NW + 1},${idealY} ${DST_X + NW + 5},${idealY} ${DST_X + NW + 5},${labelY}`}
                      fill="none" stroke={c.color} strokeWidth="0.7" strokeOpacity={0.4}
                    />
                  )}
                  {twoLine ? (
                    <>
                      <text x={tx} y={labelY - FS1 * 0.4}
                        textAnchor="start" fontSize={FS1} fontWeight="bold"
                        fill={c.color} fontFamily="ui-monospace,monospace" opacity={opacity}>
                        {c.icon} {c.label}
                      </text>
                      <text x={tx} y={labelY + FS2 * 1.2}
                        textAnchor="start" fontSize={FS2}
                        fill="rgba(255,255,255,0.4)" fontFamily="ui-monospace,monospace">
                        {fmt(c.value)} {'\u00B7'} {Math.round(c.value / total * 100)}%
                      </text>
                    </>
                  ) : (
                    <text x={tx} y={labelY + FS2 * 0.38}
                      textAnchor="start" fontSize={FS2} fontWeight="bold"
                      fill={c.color} fontFamily="ui-monospace,monospace" opacity={opacity}>
                      {c.icon} {c.label} {'\u00B7'} {fmt(c.value)}
                    </text>
                  )}
                </g>
              )
            })
          })()}

          {/* Pulsierender Live-Punkt */}
          {isLive && (
            <circle cx={W - 10} cy={10} r={4} fill="#22c55e">
              <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
      )}
      {/* Legend (nur Modal): alle Elemente auch wenn Bar zu klein */}
      {isModal && W > 0 && data && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            {/* Quellen */}
            {/* Nur echte Quellen (Akku laden ist Verbraucher, nicht Quelle) */}
            {[
              { color: 'var(--color-amber)', icon: '\u2600\uFE0F', label: 'Solar',         value: pv },
              { color: '#f87171',            icon: '\uD83D\uDD0C', label: 'Netzbezug',     value: gridImp },
              ...(batDis > (isLive ? 1 : 0.001)
                ? [{ color: '#34d399', icon: '\uD83D\uDD0B', label: 'Akku entladen', value: batDis }] : []),
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: s.color }} />
                <span style={{ color: s.color }} className="font-semibold">{s.label}</span>
                <span className="text-text-muted ml-auto">{fmtVal(s.value, isLive)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-border/50 pt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            {/* Verbraucher (alle, auch kleine) */}
            {cons.map(c => (
              <div key={c.sid} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: c.color, opacity: c.isExport ? 0.6 : 1 }} />
                <span style={{ color: c.color, opacity: c.isExport ? 0.8 : 1 }}
                      className="font-semibold">{c.icon} {c.label}</span>
                <span className="text-text-muted ml-auto">
                  {fmtVal(c.value, isLive)}
                  {total > 0 ? ` \u00B7 ${Math.round(c.value / total * 100)}%` : ''}
                </span>
              </div>
            ))}
          </div>
          {/* Zusammenfassung */}
          <div className="mt-3 flex gap-4 font-mono text-[11px] text-text-muted border-t border-border/50 pt-2">
            <span>Gesamt: <span className="text-text-primary">{fmtVal(total, isLive)}</span></span>
            {gridImp + (isLive ? pv : pv) > 0 && (
              <span>Autarkie: <span className="text-teal font-semibold">
                {Math.round((1 - gridImp / (haus || 0.001)) * 100)}%
              </span></span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
