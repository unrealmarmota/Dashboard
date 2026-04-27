import { useMemo } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, Toggle } from '../atoms'
import { v } from '../config'

export function PlugsCard({ title = 'Smarte Steckdosen' } = {}) {
  const { entities, callService } = useHA()

  // Auto-discover alle switch.steckdose_* (ohne child_lock)
  const plugs = useMemo(() => {
    const keys = Object.keys(entities).filter(
      id => id.startsWith('switch.steckdose_') && !id.includes('child_lock')
    )
    return keys.map(id => {
      const name = id.replace('switch.steckdose_', '')
      const powerSid = `sensor.steckdose_${name}_power`
      const hasPower = entities[powerSid] !== undefined
      const label = entities[id]?.attributes?.friendly_name?.replace(/^Steckdose\s*/i, '').trim() || name
      return { id, label, power: hasPower ? powerSid : undefined }
    }).sort((a, b) => a.label.localeCompare(b.label, 'de'))
  }, [Object.keys(entities).filter(id => id.startsWith('switch.steckdose_') && !id.includes('child_lock')).join()])

  return (
    <Card>
      <Label>{title}</Label>
      {plugs.map((p, i) => {
        const ent = entities[p.id]
        const isOn = ent?.state === 'on'
        const watts = p.power ? parseFloat(v(entities, p.power)) : null
        return (
          <div key={p.id} className={`flex items-center gap-2.5 py-2.5 ${i < plugs.length - 1 ? 'border-b border-border' : ''}`}>
            <span className="text-xl">{'\uD83D\uDD0C'}</span>
            <div className="flex-1">
              <div className={`text-base ${isOn ? 'text-text-primary' : 'text-text-muted'}`}>{p.label}</div>
              {p.power && isOn && watts != null && !isNaN(watts) && (
                <div className="text-[13px] text-amber font-mono mt-px">{'\u26A1'} {watts.toFixed(0)} W</div>
              )}
            </div>
            <Toggle on={isOn} onToggle={() => callService('switch', 'toggle', { entity_id: p.id })} />
          </div>
        )
      })}
    </Card>
  )
}
