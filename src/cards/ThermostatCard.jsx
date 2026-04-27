import { useHA } from '../context/HAContext'
import { Card, Label, Pill } from '../atoms'
import { e } from '../config'

export function ThermostatCard({ entityId, name }) {
  const { entities, callService } = useHA()
  const ent = e(entities, entityId)
  const currentTemp = ent?.attributes?.current_temperature ?? '\u2013'
  const targetTemp = ent?.attributes?.temperature ?? '\u2013'
  const hvacAction = ent?.attributes?.hvac_action ?? ent?.state ?? 'off'

  const adjustTemp = (delta) => {
    const cur = parseFloat(targetTemp)
    if (isNaN(cur)) return
    callService('climate', 'set_temperature', { entity_id: entityId, temperature: cur + delta })
  }

  const tempNum = parseFloat(currentTemp)
  const barPct = isNaN(tempNum) ? 0 : ((tempNum - 15) / 12) * 100

  return (
    <Card>
      <Label>{name}</Label>
      <div className="text-center py-1 pb-2.5">
        <div className="text-[52px] font-extrabold font-sans text-white leading-none">
          {currentTemp}<span className="text-lg text-text-muted">{'\u00B0'}C</span>
        </div>
        {hvacAction === 'heating' && <Pill color="red" small>HEIZT</Pill>}
        {hvacAction === 'idle' && <Pill color="teal" small>IDLE</Pill>}
        <div className="text-sm text-text-muted my-2 mb-3 font-mono">
          Ziel: <span className="text-amber font-semibold">{targetTemp}{'\u00B0'}C</span>
        </div>
        <div className="h-1 bg-dim rounded-sm mb-3.5">
          <div className="h-full rounded-sm transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, barPct))}%`, background: 'linear-gradient(90deg, var(--color-teal), var(--color-amber))' }} />
        </div>
        <div className="flex justify-center gap-2.5">
          <button onClick={() => adjustTemp(-0.5)}
            className="w-9 h-9 rounded-lg border border-border bg-surface text-text-muted cursor-pointer text-xl">{'\u2212'}</button>
          <button onClick={() => adjustTemp(0.5)}
            className="w-9 h-9 rounded-lg border border-amber-border bg-amber-dim text-amber cursor-pointer text-xl">+</button>
        </div>
      </div>
    </Card>
  )
}
