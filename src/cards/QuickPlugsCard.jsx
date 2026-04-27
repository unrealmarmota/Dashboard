import { useHA } from '../context/HAContext'
import { Card, Label } from '../atoms'
import { v } from '../config'

const PLUGS = [
  { id: 'switch.steckdose_entertainment', label: 'Entertainment', icon: '\uD83C\uDFAE', power: 'sensor.steckdose_entertainment_power' },
  { id: 'switch.steckdose_kaffee', label: 'Kaffee', icon: '\u2615', power: 'sensor.steckdose_kaffee_power' },
]

export function QuickPlugsCard() {
  const { entities, callService } = useHA()

  return (
    <Card>
      <Label>{'\uD83D\uDD0C'} Steckdosen</Label>
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        {PLUGS.map(p => {
          const isOn = entities[p.id]?.state === 'on'
          const watts = parseFloat(v(entities, p.power))
          const hasWatts = isOn && !isNaN(watts)
          return (
            <button key={p.id}
              onClick={() => callService('switch', 'toggle', { entity_id: p.id })}
              className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                isOn
                  ? 'bg-amber/[0.12] border-amber/40 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                  : 'bg-surface border-border hover:border-text-muted'
              }`}>
              <span className="text-3xl">{p.icon}</span>
              <span className={`text-xs font-sans font-medium ${isOn ? 'text-amber' : 'text-text-muted'}`}>
                {p.label}
              </span>
              {hasWatts && (
                <span className="text-[10px] font-mono text-amber/70">{watts.toFixed(0)} W</span>
              )}
              {!isOn && (
                <span className="text-[10px] font-mono text-text-muted">Aus</span>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
