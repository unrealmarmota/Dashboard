import { useState, useEffect } from 'react'
import { Card, Label } from '../atoms'
import { VVS_URL } from '../config'

const STATIONS = [
  { id: '5003685', name: 'Bajastrasse' },
  { id: '5003688', name: 'Finkenberg' },
]

export function BusDeparturesCard() {
  const [departures, setDepartures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDepartures = async () => {
    try {
      const allDeps = []
      for (const station of STATIONS) {
        const url = `${VVS_URL}/XML_DM_REQUEST?locationServerActive=1&stateless=1&language=de&depArr=departure&type_dm=any&name_dm=${station.id}&mode=direct&useRealtime=1&outputFormat=json&limit=10`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`VVS API ${res.status}`)
        const text = await res.text()
        let data
        try { data = JSON.parse(text) } catch { throw new Error('VVS-Antwort ist kein g\u00FCltiges JSON') }
        for (const d of (data.departureList || [])) {
          const line      = d.servingLine?.number
          const direction = d.servingLine?.direction || ''
          const isEndersbach = line === '209' && direction.toLowerCase().includes('endersbach')
          if ((line === '207' || line === '209') && !isEndersbach) {
            const scheduled = d.dateTime ? `${String(d.dateTime.hour).padStart(2, '0')}:${String(d.dateTime.minute).padStart(2, '0')}` : ''
            const real = d.realDateTime ? `${String(d.realDateTime.hour).padStart(2, '0')}:${String(d.realDateTime.minute).padStart(2, '0')}` : scheduled
            allDeps.push({ line, station: station.name, direction: d.servingLine?.direction || '', scheduled, real, delay: parseInt(d.servingLine?.delay) || 0, countdown: parseInt(d.countdown) || 0 })
          }
        }
      }
      allDeps.sort((a, b) => a.countdown - b.countdown)
      const limited = [], countPerLine = {}
      for (const d of allDeps) {
        countPerLine[d.line] = (countPerLine[d.line] || 0) + 1
        if (countPerLine[d.line] <= 2) limited.push(d)
      }
      limited.sort((a, b) => a.countdown - b.countdown)
      setDepartures(limited); setError(null)
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  useEffect(() => { fetchDepartures(); const iv = setInterval(fetchDepartures, 30000); return () => clearInterval(iv) }, [])

  return (
    <Card>
      <Label>{'\uD83D\uDE8C'} Bus {'\u00B7'} Waiblingen</Label>
      {loading ? <div className="text-xs text-text-muted font-mono p-2">Lade Abfahrten...</div>
        : error ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red/[0.08] border border-red/[0.2]">
            <span className="text-base">{'\u26A0\uFE0F'}</span>
            <div>
              <div className="text-[12px] text-red font-mono font-semibold">Abfahrten nicht verf{'\u00FC'}gbar</div>
              <div className="text-[10px] text-text-muted font-mono">{error}</div>
            </div>
          </div>
        )
        : departures.length === 0 ? <div className="text-xs text-text-muted font-mono p-2">Keine Abfahrten gefunden</div>
        : (
          <div className="flex flex-col gap-1.5">
            {departures.map((d, i) => (
              <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${i === 0 ? 'bg-blue/[0.06]' : ''} ${i < departures.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="min-w-[38px] text-center px-1.5 py-[3px] rounded-md text-white text-[13px] font-bold font-mono"
                  style={{ background: d.line === '207' ? '#3b82f6' : '#8b5cf6' }}>{d.line}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-text-primary font-medium truncate">{'\u2192'} {d.direction}</div>
                  <div className="text-[10px] text-text-muted font-mono">ab {d.station}</div>
                </div>
                <div className="text-right min-w-[50px]">
                  <div className={`text-base font-extrabold font-sans ${d.countdown <= 5 ? 'text-amber' : 'text-text-primary'}`}>
                    {d.countdown}<span className="text-[10px] text-text-muted"> min</span>
                  </div>
                  <div className={`text-[10px] font-mono ${d.delay > 0 ? 'text-red' : 'text-text-muted'}`}>
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
