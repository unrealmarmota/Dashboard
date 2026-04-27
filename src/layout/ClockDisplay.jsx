import { useState, useEffect } from 'react'

export function ClockDisplay() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv) }, [])
  return (
    <div className="flex flex-col items-end px-3 py-1 rounded-[10px] bg-amber/[0.06] border border-amber-border">
      <div className="font-mono text-[30px] font-medium text-amber leading-none tracking-wider">
        {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-[11px] text-text-muted tracking-[1.5px] mt-0.5">
        {now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'short' })}
      </div>
    </div>
  )
}
