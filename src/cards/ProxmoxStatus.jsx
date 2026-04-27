import { useState } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, Dot, Pill, Gauge, InfoModal } from '../atoms'
import { v } from '../config'

const VMS = [
  { name: 'HomeAssistant', id: 'homeassisstantfresh' },
  { name: 'Dashboard', id: 'dashboard' },
  { name: 'Pi-hole', id: 'pihole' },
  { name: 'AdGuard', id: 'adguard' },
  { name: 'Node-RED', id: 'node_red' },
  { name: 'Cloudflared', id: 'cloudflared' },
  { name: 'Ghost', id: 'ghost' },
  { name: 'Overseerr', id: 'overseerr' },
  { name: 'PostgreSQL', id: 'postgresql' },
  { name: 'WordPress', id: 'turnkey_wordpress' },
]

export function ProxmoxStatus() {
  const { entities } = useHA()
  const [showAll, setShowAll] = useState(false)
  const [openGauge, setOpenGauge] = useState(null)

  // PVE Host Stats
  const cpuPct = parseFloat(v(entities, 'sensor.pve_cpu_auslastung')) || 0
  const cpuCores = parseFloat(v(entities, 'sensor.pve_maximale_cpu_leistung')) || 4
  const ramUsed = parseFloat(v(entities, 'sensor.pve_arbeitsspeicher_auslastung')) || 0
  const ramTotal = parseFloat(v(entities, 'sensor.pve_maximale_arbeitsspeicher_auslastung')) || 1
  const ramPct = ramTotal > 0 ? (ramUsed / ramTotal) * 100 : 0
  const diskUsed = parseFloat(v(entities, 'sensor.pve_massenspeicher_auslastung')) || 0
  const diskTotal = parseFloat(v(entities, 'sensor.pve_maximale_massenspeicher_auslastung')) || 1
  const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0
  const pveOnline = v(entities, 'sensor.pve_status') === 'online'

  // VM/LXC list with stats
  const vmList = VMS.map(vm => {
    const status = v(entities, `sensor.${vm.id}_status`)
    const running = status === 'running'
    const cpu = parseFloat(v(entities, `sensor.${vm.id}_cpu_auslastung`)) || 0
    const ram = parseFloat(v(entities, `sensor.${vm.id}_arbeitsspeicher_auslastung`)) || 0
    return { ...vm, status, running, cpu, ram }
  })

  const runningCount = vmList.filter(vm => vm.running).length
  const visibleVms = showAll ? vmList : vmList.slice(0, 5)

  const gauges = [
    { value: Math.round(cpuPct), max: 100, color: cpuPct > 80 ? 'var(--color-red)' : cpuPct > 50 ? 'var(--color-amber)' : 'var(--color-teal)', label: 'CPU', unit: '%', detail: `${cpuPct.toFixed(1)}% (${cpuCores} Cores)` },
    { value: Math.round(ramPct), max: 100, color: ramPct > 80 ? 'var(--color-red)' : ramPct > 60 ? 'var(--color-amber)' : 'var(--color-teal)', label: 'RAM', unit: '%', detail: `${ramUsed.toFixed(1)} / ${ramTotal.toFixed(1)} GiB` },
    { value: Math.round(diskPct), max: 100, color: diskPct > 80 ? 'var(--color-red)' : diskPct > 60 ? 'var(--color-amber)' : 'var(--color-green)', label: 'Disk', unit: '%', detail: `${diskUsed.toFixed(1)} / ${diskTotal.toFixed(1)} GiB` },
  ]

  return (
    <Card>
      <div className="flex justify-between items-start mb-2.5">
        <div>
          <Label>Proxmox {'\u00B7'} Beelink</Label>
          <div className="text-xs text-text-muted font-mono -mt-1.5 mb-1.5">
            {pveOnline ? `${runningCount}/${vmList.length} VMs/LXCs` : 'Offline'}
          </div>
        </div>
        <Pill color={pveOnline ? 'teal' : 'red'} small>{pveOnline ? 'Online' : 'Offline'}</Pill>
      </div>

      {/* Gauges */}
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

      <div className="flex gap-2 mb-3 text-xs text-text-muted font-mono flex-wrap">
        <span>RAM: {ramUsed.toFixed(1)}/{ramTotal.toFixed(1)} GiB</span>
        <span>{'\u00B7'} Disk: {diskUsed.toFixed(1)}/{diskTotal.toFixed(1)} GiB</span>
      </div>

      {/* VM/LXC List */}
      <div className="border-t border-border pt-2.5">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs text-text-muted font-mono tracking-[1.5px] uppercase">VMs / LXCs</div>
          {vmList.length > 5 && (
            <button onClick={() => setShowAll(!showAll)}
              className="border border-border bg-transparent text-text-muted px-2 py-0.5 rounded-md cursor-pointer text-[11px] font-mono">
              {showAll ? 'Weniger' : `Alle ${vmList.length}`}
            </button>
          )}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1">
          {visibleVms.map(vm => (
            <div key={vm.id} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-surface border ${vm.running ? 'border-border' : 'border-red-border'}`}>
              <Dot on={vm.running} color={vm.running ? 'var(--color-green)' : 'var(--color-red)'} />
              <span className={`flex-1 text-xs truncate ${vm.running ? 'text-text-primary' : 'text-red'}`}>{vm.name}</span>
              {vm.running && (
                <span className="text-[10px] text-text-muted font-mono whitespace-nowrap">
                  {vm.cpu.toFixed(0)}% {'\u00B7'} {vm.ram.toFixed(1)}G
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
