import { useHA } from '../context/HAContext'
import { Card, Label, Pill, Toggle } from '../atoms'
import { e, v, fmtTime } from '../config'

const STATE_DE = { inactive: 'Inaktiv', ready: 'Bereit', delayedstart: 'Verzögert', run: 'Läuft', pause: 'Pause', actionrequired: 'Aktion nötig', finished: 'Fertig', error: 'Fehler', aborting: 'Abbruch' }
const STATE_COLOR = { run: 'teal', finished: 'green', ready: 'amber', error: 'red', pause: 'amber', actionrequired: 'red', inactive: 'amber' }
const PROGRAM_DE = { dishcare_dishwasher_program_eco_50: 'Eco 50\u00B0', dishcare_dishwasher_program_auto_1: 'Auto', dishcare_dishwasher_program_intensiv_70: 'Intensiv 70\u00B0', dishcare_dishwasher_program_quick_45: 'Schnell 45\u00B0' }

export function DishwasherCard() {
  const { entities, callService } = useHA()
  const opState = v(entities, 'sensor.geschirrspuler_betriebszustand')
  const progress = v(entities, 'sensor.geschirrspuler_programm_fortschritt')
  const endTime = v(entities, 'sensor.geschirrspuler_programm_endzeit')
  const door = v(entities, 'sensor.geschirrspuler_tur')
  const solarActive = e(entities, 'input_boolean.spulmaschine_solar_aktiv')
  const isSolarOn = solarActive?.state === 'on'
  const program = v(entities, 'input_select.spulmaschine_programm')
  const fallbackTime = v(entities, 'input_datetime.spulmaschine_fallback_uhrzeit')
  const remoteControl = e(entities, 'binary_sensor.geschirrspuler_fernsteuerung')
  const remoteStart = e(entities, 'binary_sensor.geschirrspuler_fernstart')
  const fernstart = remoteStart?.state === 'on'
  const isRunning = opState === 'run'
  const pctNum = parseFloat(progress) || 0

  return (
    <Card accent={isRunning}>
      <div className="flex flex-col gap-4">
        <Label>Spülmaschine {'\u00B7'} Solar-Automation</Label>

        <div className="flex gap-4 items-start">
          <div className="text-[40px] leading-none">{'\uD83C\uDF7D\uFE0F'}</div>
          <div className="flex-1">
            <div className="flex gap-2 flex-wrap mb-1 items-center">
              <Pill color={STATE_COLOR[opState] || 'amber'}>{STATE_DE[opState] || opState}</Pill>
              {door === 'open' && <Pill color="red" small>TÜR OFFEN</Pill>}
              {remoteControl?.state === 'on' && <Pill color="teal" small>REMOTE</Pill>}
            </div>
            {isRunning && (<>
              <div className="flex justify-between mb-1 mt-2">
                <span className="text-xs text-text-muted font-mono">
                  {PROGRAM_DE[program] || program?.replace(/dishcare_dishwasher_program_/g, '').replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-teal font-mono">{progress}%</span>
              </div>
              <div className="h-1 bg-dim rounded-sm mb-1.5">
                <div className="h-full rounded-sm transition-[width] duration-1000" style={{ width: `${pctNum}%`, background: 'linear-gradient(90deg, var(--color-teal), #06b6d4)' }} />
              </div>
              <div className="text-xs text-text-muted font-mono">Fertig ca. {endTime !== '\u2013' ? fmtTime(endTime) : '\u2013'}</div>
            </>)}
          </div>
        </div>

        {/* Program Selector */}
        {!isRunning && (
          <div className="p-3.5 px-4 rounded-[10px] bg-surface border border-border">
            <div className="text-xs text-text-muted font-mono mb-2.5">Programm wählen</div>
            <div className="flex gap-2">
              {[
                { value: 'dishcare_dishwasher_program_eco_50', label: 'Eco 50\u00B0' },
                { value: 'dishcare_dishwasher_program_auto_2', label: 'Auto' },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => callService('input_select', 'select_option', { entity_id: 'input_select.spulmaschine_programm', option: opt.value })}
                  className={`flex-1 px-3 py-2.5 rounded-lg cursor-pointer text-xs font-mono transition-all border ${program === opt.value ? 'bg-amber-dim border-amber-border text-amber font-semibold' : 'bg-transparent border-border text-text-muted'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Solar Automation */}
        <div className={`p-3.5 px-4 rounded-[10px] border transition-all ${isSolarOn ? 'bg-teal-dim border-teal-border' : 'bg-surface border-border'}`}>
          <div className={`flex justify-between items-center ${isSolarOn ? 'mb-2.5' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{'\u2600\uFE0F'}</span>
              <span className={`text-[13px] font-semibold ${isSolarOn ? 'text-teal' : 'text-text-muted'}`}>Solar-Modus</span>
            </div>
            <Toggle on={isSolarOn} onToggle={() => callService('input_boolean', 'toggle', { entity_id: 'input_boolean.spulmaschine_solar_aktiv' })} />
          </div>
          {isSolarOn && (
            <div className="text-xs text-text-muted font-mono leading-relaxed">
              Startet bei Solar-Überschuss {'\u00B7'} Fallback: <span className="text-amber">{fallbackTime}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
