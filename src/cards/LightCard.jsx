import { useState, useRef, useCallback } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, Toggle, DimmerSlider, InfoModal } from '../atoms'
import { e } from '../config'

function ColorTempModal({ light, entity, onClose, callService }) {
  const attrs = entity?.attributes || {}
  const minMireds = attrs.min_color_temp_kelvin ? Math.round(1000000 / attrs.min_color_temp_kelvin) : attrs.min_mireds || 153
  const maxMireds = attrs.max_color_temp_kelvin ? Math.round(1000000 / attrs.max_color_temp_kelvin) : attrs.max_mireds || 500
  const currentMireds = attrs.color_temp || Math.round((minMireds + maxMireds) / 2)
  const [mireds, setMireds] = useState(currentMireds)
  const kelvin = Math.round(1000000 / mireds)

  const apply = (val) => {
    setMireds(val)
    callService('light', 'turn_on', { entity_id: light.id, color_temp: val })
  }

  return (
    <InfoModal onClose={onClose}>
      <div className="text-center mb-4">
        <span className="text-2xl">{light.icon || '\uD83D\uDCA1'}</span>
        <div className="text-base font-semibold text-text-primary font-mono mt-1">{light.label}</div>
        <div className="text-[11px] text-text-muted font-mono">Farbtemperatur</div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-amber font-mono">Warm</span>
        <div className="flex-1 relative h-6 flex items-center">
          <div className="absolute inset-x-0 h-2 rounded-sm" style={{ background: 'linear-gradient(90deg, #ff9329, #fff5e6, #a8c8ff)' }} />
          <input type="range" min={minMireds} max={maxMireds} value={mireds}
            onChange={ev => apply(parseInt(ev.target.value))}
            className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-6 m-0 p-0" />
        </div>
        <span className="text-xs text-blue font-mono">Kalt</span>
      </div>
      <div className="text-center text-[13px] font-mono text-text-primary font-bold">{kelvin} K</div>
    </InfoModal>
  )
}

// Vereint LightGroupCard + LightGridCard - mode 'list' oder 'grid'
export function LightCard({ title, lights, mode = 'list' }) {
  const { entities, callService } = useHA()
  const [colorTempLight, setColorTempLight] = useState(null)
  const longPressRef = useRef(null)

  const supportsColorTemp = (l) => {
    const ent = e(entities, l.id)
    const modes = ent?.attributes?.supported_color_modes || []
    return !l.isSwitch && modes.some(m => m === 'color_temp')
  }

  const onLongPressStart = useCallback((l) => {
    if (!supportsColorTemp(l)) return
    longPressRef.current = setTimeout(() => setColorTempLight(l), 500)
  }, [entities])

  const onLongPressEnd = useCallback(() => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
  }, [])

  const toggleLight = (l) => {
    const domain = l.isSwitch ? 'switch' : 'light'
    callService(domain, 'toggle', { entity_id: l.id })
  }
  const setBrightness = (id, val) => {
    if (val > 0) callService('light', 'turn_on', { entity_id: id, brightness: val })
    else callService('light', 'turn_off', { entity_id: id })
  }

  if (mode === 'grid') {
    return (
      <Card>
        <Label>{title}</Label>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
          {lights.map(l => {
            const ent = e(entities, l.id)
            const isOn = ent?.state === 'on'
            const brightness = ent?.attributes?.brightness ?? 0
            return (
              <div key={l.id} className={`p-3 rounded-[10px] border transition-all ${isOn ? 'bg-amber-dim border-amber-border' : 'bg-surface border-border'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[22px] ${isOn ? 'opacity-100' : 'opacity-25'}`}>{l.icon || '\uD83D\uDCA1'}</span>
                  <span className={`flex-1 text-base ${isOn ? 'text-text-primary' : 'text-text-muted'}`}>{l.label}</span>
                  <Toggle on={isOn} onToggle={() => toggleLight(l)} />
                </div>
                <DimmerSlider brightness={isOn ? brightness : 0} dimmed={!isOn} onChange={val => setBrightness(l.id, val)} />
              </div>
            )
          })}
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <Label>{title}</Label>
        {lights.map((l, i) => {
          const ent = e(entities, l.id)
          const isOn = ent?.state === 'on'
          const brightness = ent?.attributes?.brightness ?? 0
          return (
            <div key={l.id} className={`py-2.5 ${i < lights.length - 1 ? 'border-b border-border' : ''}`}
              onTouchStart={() => onLongPressStart(l)} onTouchEnd={onLongPressEnd} onTouchCancel={onLongPressEnd}
              onContextMenu={ev => { if (supportsColorTemp(l)) { ev.preventDefault(); setColorTempLight(l) } }}>
              <div className="flex items-center gap-2.5">
                <span className={`text-xl transition-opacity ${isOn ? 'opacity-100' : 'opacity-25'}`}>{l.icon || '\uD83D\uDCA1'}</span>
                <span className={`flex-1 text-base ${isOn ? 'text-text-primary' : 'text-text-muted'}`}>{l.label}</span>
                <Toggle on={isOn} onToggle={() => toggleLight(l)} />
              </div>
              {!l.isSwitch && <DimmerSlider brightness={isOn ? brightness : 0} dimmed={!isOn} onChange={val => setBrightness(l.id, val)} />}
            </div>
          )
        })}
      </Card>
      {colorTempLight && <ColorTempModal light={colorTempLight} entity={e(entities, colorTempLight.id)} onClose={() => setColorTempLight(null)} callService={callService} />}
    </>
  )
}
