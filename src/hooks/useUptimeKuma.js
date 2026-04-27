import { useState, useEffect } from 'react'
import { UPTIME_KUMA_URL, UPTIME_KUMA_SLUG } from '../config'

export function useUptimeKuma() {
  const [monitors, setMonitors] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const fetchStatus = async () => {
      try {
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
