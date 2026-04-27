import { useState, useEffect, useRef } from 'react'
import { Card, Label, Dot, Pill, InfoModal } from '../atoms'
import { PIHOLE_URL, PIHOLE_PASSWORD } from '../config'

export function PiHoleCard() {
  const [stats, setStats] = useState(null)
  const [dnsUp, setDnsUp] = useState(null)
  const [openStat, setOpenStat] = useState(null)
  const [error, setError] = useState(null)
  const sidRef = useRef(null)

  const authenticate = async () => {
    if (!PIHOLE_PASSWORD) return null
    try {
      const res = await fetch(`${PIHOLE_URL}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PIHOLE_PASSWORD }) })
      const data = await res.json()
      if (data.session?.valid) { sidRef.current = data.session.sid; return data.session.sid }
    } catch (e) { console.warn('Pi-hole auth failed:', e) }
    return null
  }

  const fetchStats = async () => {
    try {
      const loginRes = await fetch(`${PIHOLE_URL}/info/login`)
      setDnsUp((await loginRes.json()).dns)
      let sid = sidRef.current
      if (!sid && PIHOLE_PASSWORD) sid = await authenticate()
      if (!sid) { setStats(null); return }
      const res = await fetch(`${PIHOLE_URL}/stats/summary`, { headers: { sid } })
      if (res.status === 401) {
        sidRef.current = null
        const newSid = await authenticate()
        if (!newSid) return
        setStats(await (await fetch(`${PIHOLE_URL}/stats/summary`, { headers: { sid: newSid } })).json())
      } else setStats(await res.json())
      setError(null)
    } catch (err) { setError(err.message) }
  }

  useEffect(() => { fetchStats(); const iv = setInterval(fetchStats, 30000); return () => clearInterval(iv) }, [])

  const fmtNum = (n) => n != null ? n.toLocaleString('de-DE') : '\u2013'

  return (
    <Card>
      <Label>Pi-hole {'\u00B7'} DNS</Label>
      <div className="flex items-center gap-2 mb-2.5">
        <Dot on={dnsUp === true} color="var(--color-green)" />
        <span className="text-[15px] text-text-primary font-semibold">Pi-hole</span>
        <Pill small color={dnsUp === true ? 'green' : dnsUp === false ? 'red' : 'amber'}>
          {dnsUp === true ? 'AKTIV' : dnsUp === false ? 'OFFLINE' : '...'}
        </Pill>
      </div>
      {stats ? (<>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'BLOCKIERT', val: `${stats.queries?.percent_blocked?.toFixed(1) ?? '\u2013'}%`, bg: 'bg-red-dim border border-red-border', color: 'text-red', large: true },
            { label: 'ANFRAGEN', val: fmtNum(stats.queries?.total), bg: 'bg-teal-dim border border-teal-border', color: 'text-teal', large: true },
            { label: 'Geblockt', val: fmtNum(stats.queries?.blocked), bg: 'bg-surface', color: 'text-text-primary', large: false },
            { label: 'Clients', val: `${stats.clients?.active ?? '\u2013'}`, bg: 'bg-surface', color: 'text-text-primary', large: false },
          ].map(s => (
            <div key={s.label} onClick={() => setOpenStat(s)}
              className={`text-center ${s.large ? 'p-2' : 'p-1.5'} rounded-lg ${s.bg} cursor-pointer active:scale-95 transition-transform`}>
              <div className={`${s.large ? 'text-[22px]' : 'text-[15px]'} font-extrabold ${s.color} font-sans`}>{s.val}</div>
              <div className="text-[10px] text-text-muted font-mono">{s.label}</div>
            </div>
          ))}
        </div>
        {openStat && (
          <InfoModal onClose={() => setOpenStat(null)}>
            <div className="text-center pt-4">
              <div className={`text-[48px] font-extrabold font-sans ${openStat.color}`}>{openStat.val}</div>
              <div className="text-sm text-text-muted font-mono mt-2">{openStat.label}</div>
            </div>
          </InfoModal>
        )}
      </>
      ) : !PIHOLE_PASSWORD ? (
        <div className="text-xs text-text-muted font-mono py-1">PIHOLE_PASSWORD in Config setzen für Stats</div>
      ) : error ? (
        <div className="text-xs text-red font-mono">{error}</div>
      ) : null}
    </Card>
  )
}
