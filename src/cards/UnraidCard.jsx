import { useState } from 'react'
import { useGlances } from '../hooks/useGlances'
import { Card, Label, Gauge, Pill, Dot, InfoModal } from '../atoms'

export function UnraidCard() {
  const { data, error } = useGlances()
  const [showContainers, setShowContainers] = useState(false)
  const [openGauge, setOpenGauge] = useState(null)

  if (error) return <Card><Label>Unraid {'\u00B7'} N100</Label><div className="text-[13px] text-red">Glances: {error}</div></Card>
  if (!data) return <Card><Label>Unraid {'\u00B7'} N100</Label><div className="text-[13px] text-text-muted">Lade Glances...</div></Card>

  const fmtGB = (bytes) => (bytes / 1024 / 1024 / 1024).toFixed(1)
  const fmtTB = (bytes) => (bytes / 1024 / 1024 / 1024 / 1024).toFixed(1)
  const fmtMB = (bytes) => Math.round(bytes / 1024 / 1024)
  const running = data.containers.filter(ct => ct.status === 'running' || ct.status === 'healthy').length
  const topContainers = data.containers.slice(0, showContainers ? 20 : 5)

  return (
    <Card>
      <div className="flex justify-between items-start mb-2.5">
        <div>
          <Label>Unraid {'\u00B7'} N100</Label>
          <div className="text-xs text-text-muted font-mono -mt-1.5 mb-1.5">{data.system} {'\u00B7'} Uptime: {data.uptime}</div>
        </div>
        <Pill color="teal" small>{running} Container</Pill>
      </div>

      {(() => {
        const gauges = [
          { value: Math.round(data.cpu), max: 100, color: data.cpu > 80 ? 'var(--color-red)' : data.cpu > 50 ? 'var(--color-amber)' : 'var(--color-teal)', label: 'CPU', unit: '%', detail: `${data.cpu.toFixed(1)}%` },
          { value: Math.round(data.mem), max: 100, color: data.mem > 80 ? 'var(--color-red)' : data.mem > 60 ? 'var(--color-amber)' : 'var(--color-teal)', label: 'RAM', unit: '%', detail: `${fmtGB(data.memUsed)} / ${fmtGB(data.memTotal)} GB` },
          { value: data.cpuTemp ?? 0, max: 100, color: data.cpuTemp > 80 ? 'var(--color-red)' : data.cpuTemp > 60 ? 'var(--color-amber)' : 'var(--color-blue)', label: 'TEMP', unit: '\u00B0C', detail: `${data.cpuTemp ?? 0}\u00B0C` },
          { value: Math.round(data.arrayPercent), max: 100, color: data.arrayPercent > 80 ? 'var(--color-red)' : data.arrayPercent > 60 ? 'var(--color-amber)' : 'var(--color-green)', label: 'Array', unit: '%', detail: `${fmtTB(data.arrayUsed)} / ${fmtTB(data.arrayTotal)} TB (${data.arrayDisks} Disks)` },
        ]
        return <>
          <div className="flex justify-around mb-3">
            {gauges.map(g => (
              <div key={g.label} onClick={() => setOpenGauge(g)} className="cursor-pointer active:scale-95 transition-transform">
                <Gauge value={g.value} max={g.max} color={g.color} size={72} label={g.label} unit={g.unit} />
              </div>
            ))}
          </div>
          {openGauge && (
            <InfoModal onClose={() => setOpenGauge(null)}>
              <div className="flex flex-col items-center pt-4">
                <Gauge value={openGauge.value} max={openGauge.max} color={openGauge.color} size={160} label={openGauge.label} unit={openGauge.unit} />
                <div className="text-sm text-text-muted font-mono mt-3">{openGauge.detail}</div>
              </div>
            </InfoModal>
          )}
        </>
      })()}

      <div className="flex gap-2 mb-3 text-xs text-text-muted font-mono flex-wrap">
        <span>Array: {fmtTB(data.arrayUsed)}/{fmtTB(data.arrayTotal)} TB</span>
        <span>{'\u00B7'} Cache: {fmtGB(data.diskUsed)}/{fmtGB(data.diskTotal)} GB</span>
      </div>

      <div className="border-t border-border pt-2.5">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs text-text-muted font-mono tracking-[1.5px] uppercase">Docker Container</div>
          <button onClick={() => setShowContainers(!showContainers)}
            className="border border-border bg-transparent text-text-muted px-2 py-0.5 rounded-md cursor-pointer text-[11px] font-mono">
            {showContainers ? 'Weniger' : `Alle ${data.containers.length}`}
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1">
          {topContainers.map(ct => {
            const healthy = ct.status === 'running' || ct.status === 'healthy'
            return (
              <div key={ct.name} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-surface border ${healthy ? 'border-border' : 'border-red-border'}`}>
                <Dot on={healthy} color={healthy ? 'var(--color-green)' : 'var(--color-red)'} />
                <span className={`flex-1 text-xs truncate ${healthy ? 'text-text-primary' : 'text-red'}`}>{ct.name}</span>
                <span className="text-[10px] text-text-muted font-mono whitespace-nowrap">{(ct.cpu?.total ?? 0).toFixed(0)}% {'\u00B7'} {fmtMB(ct.memory?.usage ?? 0)}MB</span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
