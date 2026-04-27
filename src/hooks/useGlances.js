import { useState, useEffect } from 'react'
import { GLANCES_URL } from '../config'

export function useGlances() {
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
        const ctrs = Array.isArray(containers) ? containers : (containers?.containers || [])
        const coreTemps = sensors.filter(s => s.type === 'temperature_core')
        const cpuTemp = coreTemps.find(s => s.label.includes('Package'))?.value
          ?? coreTemps.find(s => s.label === 'Core 0')?.value
          ?? coreTemps[0]?.value ?? null
        const cacheDisk = fs.find(d => d.mnt_point === '/rootfs/mnt/cache') || fs.find(d => d.fs_type === 'btrfs') || fs[0]
        // Array-Disks summieren (xfs Disks unter /rootfs/mnt/disk*)
        const arrayDisks = fs.filter(d => d.fs_type === 'xfs' && /^\/rootfs\/mnt\/disk\d+$/.test(d.mnt_point))
        const arrayUsed = arrayDisks.reduce((acc, d) => acc + (d.used || 0), 0)
        const arrayTotal = arrayDisks.reduce((acc, d) => acc + (d.size || 0), 0)
        const arrayPercent = arrayTotal > 0 ? (arrayUsed / arrayTotal) * 100 : 0
        setData({
          cpu: quicklook.cpu ?? 0,
          cpuName: quicklook.cpu_name ?? 'CPU',
          mem: mem.percent ?? 0,
          memUsed: mem.used ?? 0,
          memTotal: mem.total ?? 0,
          cpuTemp,
          containers: ctrs.sort((a, b) => (b.cpu?.total || 0) - (a.cpu?.total || 0)),
          diskPercent: cacheDisk?.percent ?? 0,
          diskUsed: cacheDisk?.used ?? 0,
          diskTotal: cacheDisk?.size ?? 0,
          arrayPercent, arrayUsed, arrayTotal, arrayDisks: arrayDisks.length,
          system: system.hr_name ?? 'Unraid',
          uptime: uptime?.replace(/"/g, '') ?? '\u2013',
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
