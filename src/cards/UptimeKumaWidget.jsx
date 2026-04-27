import { useUptimeKuma } from '../hooks/useUptimeKuma'
import { Card, Label, Dot, Pill } from '../atoms'
import { UPTIME_KUMA_SLUG } from '../config'

export function UptimeKumaWidget({ compact }) {
  const { monitors, error } = useUptimeKuma()
  const up = monitors.filter(m => m.up).length
  const total = monitors.length
  const down = monitors.filter(m => m.up === false)

  if (compact) {
    return (
      <Card>
        <div className="flex justify-between items-center mb-2">
          <Label>Uptime Kuma</Label>
          <Pill small color={up === total && total > 0 ? 'green' : total === 0 ? 'gray' : 'red'}>{up}/{total}</Pill>
        </div>
        {error && <div className="text-[11px] text-amber mb-1.5 truncate">Fehler: {error}</div>}
        {down.length > 0 && (
          <div className="flex flex-col gap-1 mb-1.5">
            {down.map(m => (
              <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-red-border">
                <Dot on={false} color="var(--color-red)" />
                <span className="text-xs text-red truncate">{m.name}</span>
                <span className="text-[10px] text-red font-mono ml-auto">DOWN</span>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1">
          {monitors.filter(m => m.up).map(m => (
            <div key={m.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-surface border border-border">
              <Dot on={true} color="var(--color-green)" />
              <span className="text-[11px] text-text-primary truncate flex-1">{m.name}</span>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <Label>Uptime Kuma {'\u00B7'} Services</Label>
        {total > 0 && (
          <div className="flex items-center gap-1.5">
            <Dot on={up === total} color="var(--color-green)" />
            <span className={`text-sm font-mono ${up === total ? 'text-green' : 'text-amber'}`}>{up}/{total} online</span>
          </div>
        )}
      </div>
      {error && <div className="text-[13px] text-amber mb-2">Verbindung fehlgeschlagen: {error} \u2014 Pruefe Slug "{UPTIME_KUMA_SLUG}"</div>}
      {monitors.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-1.5">
          {monitors.map(m => (
            <div key={m.id} className={`flex items-center gap-2 px-2.5 py-[7px] rounded-lg bg-surface border ${m.up === false ? 'border-red-border' : 'border-border'}`}>
              <Dot on={m.up} color={m.up ? 'var(--color-green)' : 'var(--color-red)'} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm truncate ${m.up ? 'text-text-primary' : 'text-red'}`}>{m.name}</div>
                <div className="text-xs text-text-muted font-mono">
                  {m.up ? `${m.latency}ms` : 'DOWN'}
                  {m.up && m.uptime && <span className="ml-1 text-green opacity-70">{'\u00B7'} {m.uptime}%</span>}
                </div>
              </div>
              <Pill small color={m.up ? 'green' : 'red'}>{m.up ? 'UP' : 'DOWN'}</Pill>
            </div>
          ))}
        </div>
      ) : !error ? <div className="text-[13px] text-text-muted">Lade Monitore...</div> : null}
    </Card>
  )
}
