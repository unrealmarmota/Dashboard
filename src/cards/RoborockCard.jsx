import { useState } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, InfoModal, Toggle } from '../atoms'
import { e, v, fmtTime, HA_BASE } from '../config'
const CAMERA_ID = 'camera.roborock_s6_maxv_map'

const VACUUM_ID = 'vacuum.roborock_s6_maxv'
const BATTERY_ID = 'sensor.roborock_s6_maxv_batterie'
const MAP_ID = 'sensor.roborock_s6_maxv_current_map_selected'
const ROOM_ID = 'sensor.roborock_s6_maxv_current_room'
const ERROR_ID = 'sensor.roborock_s6_maxv_current_error'
const LAST_START_ID = 'sensor.roborock_s6_maxv_last_clean_start'
const LAST_DURATION_ID = 'sensor.roborock_s6_maxv_last_clean_duration'
const LAST_AREA_ID = 'sensor.roborock_s6_maxv_last_clean_area'
const TOTAL_AREA_ID = 'sensor.roborock_s6_maxv_total_clean_area'
const TOTAL_COUNT_ID = 'sensor.roborock_s6_maxv_total_clean_count'
const TOTAL_DURATION_ID = 'sensor.roborock_s6_maxv_total_duration'
const WATER_BOX_ID = 'binary_sensor.roborock_s6_maxv_water_box_attached'
const MOP_INTENSITY_ID = 'select.roborock_s6_maxv_mop_intensity'
const DND_SWITCH_ID = 'switch.roborock_s6_maxv_dnd_switch'
const DND_START_ID = 'time.roborock_s6_maxv_dnd_start'
const DND_END_ID = 'time.roborock_s6_maxv_dnd_end'
const CHILD_LOCK_ID = 'switch.roborock_s6_maxv_child_lock'
const FILTER_LEFT_ID = 'sensor.roborock_s6_maxv_filter_left'
const MAIN_BRUSH_ID = 'sensor.roborock_s6_maxv_main_brush_left'
const SIDE_BRUSH_ID = 'sensor.roborock_s6_maxv_side_brush_left'
const SENSOR_LEFT_ID = 'sensor.roborock_s6_maxv_sensor_dirty_left'
const PROGRESS_ID = 'sensor.roborock_s6_maxv_cleaning_progress'

// ─── Raumkonfiguration ─────────────────────────────────────────────────
// Segment-IDs aus der Karte (Kamera-Entity: camera.roborock_s6_maxv_map)
// Aktuell bekannte Segmente: 16=Wohnzimmer, 17/18/19=unbekannt
const ROOMS = [
  { id: 16, label: 'Wohnzimmer', icon: '\uD83D\uDECB\uFE0F' },
  { id: 17, label: 'K\u00FCche',  icon: '\uD83C\uDF73' },
  { id: 18, label: 'Flur',       icon: '\uD83D\uDEAA' },
  { id: 19, label: 'Toilette',   icon: '\uD83D\uDEBD' },
]
// ───────────────────────────────────────────────────────────────────────

const STATE_DE = {
  cleaning: 'Saugt', paused: 'Pausiert', idle: 'Bereit',
  returning: 'F\u00E4hrt zur Station', docked: 'In Station',
  charging: 'L\u00E4dt', error: 'Fehler',
}
const STATE_ICON = {
  cleaning: '\uD83E\uDDF9', paused: '\u23F8\uFE0F', idle: '\u2705',
  returning: '\uD83C\uDFE0', docked: '\uD83D\uDD0C', charging: '\u26A1',
  error: '\u26A0\uFE0F',
}
const MOP_LEVELS = ['off', 'low', 'medium', 'high']
const MOP_DE = { off: 'Aus', low: 'Niedrig', medium: 'Mittel', high: 'Hoch' }
const FAN_LEVELS = ['quiet', 'balanced', 'turbo', 'max']
const FAN_DE = { quiet: 'Leise', balanced: 'Normal', turbo: 'Turbo', max: 'Max' }

function fmtDuration(seconds) {
  const s = parseInt(seconds)
  if (isNaN(s)) return '\u2013'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m} min`
}
function fmtHoursLeft(seconds) {
  const s = parseInt(seconds)
  if (isNaN(s)) return '\u2013'
  return `~${Math.floor(s / 3600)}h`
}

function ConsumableBar({ label, secondsLeft, maxSeconds }) {
  const left = parseInt(secondsLeft)
  if (isNaN(left)) return null
  const pct = Math.min(100, Math.max(0, (left / maxSeconds) * 100))
  const color = pct > 30 ? 'bg-teal' : pct > 10 ? 'bg-amber' : 'bg-red'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted font-sans w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-sm bg-dim">
        <div className={`h-full rounded-sm ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-text-muted font-sans w-10 text-right">{fmtHoursLeft(secondsLeft)}</span>
    </div>
  )
}

export function RoborockCard() {
  const { entities, callService } = useHA()
  const [showDetail, setShowDetail] = useState(false)
  const [selectedRooms, setSelectedRooms] = useState([])

  const vacuum = e(entities, VACUUM_ID)
  const state = vacuum?.state || 'unavailable'
  const attrs = vacuum?.attributes || {}
  const battery = parseFloat(v(entities, BATTERY_ID))
  const fanSpeed = attrs.fan_speed
  const status = STATE_DE[state] || state
  const currentRoom = v(entities, ROOM_ID)
  const currentMap = v(entities, MAP_ID)
  const error = v(entities, ERROR_ID)
  const progress = v(entities, PROGRESS_ID)
  const waterBox = e(entities, WATER_BOX_ID)?.state === 'on'
  const mopIntensity = v(entities, MOP_INTENSITY_ID)
  const dndOn = e(entities, DND_SWITCH_ID)?.state === 'on'
  const dndStart = v(entities, DND_START_ID)
  const dndEnd = v(entities, DND_END_ID)
  const childLock = e(entities, CHILD_LOCK_ID)?.state === 'on'

  const isActive = state === 'cleaning' || state === 'returning'
  const isDocked = state === 'docked' || state === 'charging'
  const hasError = state === 'error' || (error !== '\u2013' && error !== 'none')

  const lastStart = e(entities, LAST_START_ID)?.state
  const lastDuration = v(entities, LAST_DURATION_ID)
  const lastArea = v(entities, LAST_AREA_ID)

  const cameraEnt = e(entities, CAMERA_ID)
  const mapUrl = cameraEnt?.attributes?.entity_picture
    ? `${HA_BASE}${cameraEnt.attributes.entity_picture}`
    : null

  const cmd = (service, data) => callService('vacuum', service, { entity_id: VACUUM_ID, ...data })
  const toggleSwitch = (id) => {
    const on = e(entities, id)?.state === 'on'
    callService('switch', on ? 'turn_off' : 'turn_on', { entity_id: id })
  }
  const setMop = (val) => callService('select', 'select_option', { entity_id: MOP_INTENSITY_ID, option: val })
  const setFan = (val) => callService('vacuum', 'set_fan_speed', { entity_id: VACUUM_ID, fan_speed: val })

  const toggleRoom = (id) => setSelectedRooms(prev =>
    prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
  )

  const startRooms = () => {
    if (selectedRooms.length === 0) return
    callService('vacuum', 'send_command', {
      entity_id: VACUUM_ID,
      command: 'app_segment_clean',
      params: [{ segments: selectedRooms, repeat: 1 }],
    })
    setSelectedRooms([])
  }

  if (!vacuum) {
    return (
      <Card>
        <Label>{'\uD83E\uDD16'} Roborock S6 MaxV</Label>
        <div className="py-6 text-center">
          <div className="text-3xl mb-3">{'\uD83E\uDD16'}</div>
          <div className="text-sm text-text-muted font-sans">Verbinde mit Roborock...</div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <Label>{'\uD83E\uDD16'} Roborock S6 MaxV</Label>

        {/* Status Row */}
        <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => setShowDetail(true)}>
          <span className="text-3xl">{STATE_ICON[state] || '\uD83E\uDD16'}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-lg font-semibold font-sans ${hasError ? 'text-red' : isActive ? 'text-teal' : 'text-text-primary'}`}>
              {status}
              {isActive && progress !== '\u2013' && progress !== 'unknown' && (
                <span className="text-sm font-normal text-text-muted ml-1.5">{progress}%</span>
              )}
            </div>
            <div className="text-xs text-text-muted font-sans truncate">
              {isActive && currentRoom !== '\u2013' ? `Raum: ${currentRoom}` :
               currentMap !== '\u2013' ? `Karte: ${currentMap}` : null}
              {fanSpeed && <span> {'\u00B7'} {FAN_DE[fanSpeed] || fanSpeed}</span>}
            </div>
          </div>
          {!isNaN(battery) && (
            <div className="text-right shrink-0">
              <div className={`text-lg font-bold font-sans ${battery <= 20 ? 'text-red' : battery <= 50 ? 'text-amber' : 'text-green'}`}>
                {battery}%
              </div>
              <div className="text-[11px] text-text-muted font-sans">Akku</div>
            </div>
          )}
        </div>

        {/* Error */}
        {hasError && error !== 'none' && error !== '\u2013' && (
          <div className="mb-3 p-2 rounded-lg bg-red-dim border border-red-border text-red text-xs font-sans">
            {'\u26A0\uFE0F'} {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 mb-3">
          {isDocked || state === 'idle' ? (
            <button onClick={() => cmd('start')}
              className="flex-1 py-2 rounded-lg bg-teal-dim border border-teal-border text-teal text-sm font-sans cursor-pointer hover:bg-teal/20 transition-colors">
              {'\u25B6'} Alles saugen
            </button>
          ) : state === 'paused' ? (
            <>
              <button onClick={() => cmd('start')}
                className="flex-1 py-2 rounded-lg bg-teal-dim border border-teal-border text-teal text-sm font-sans cursor-pointer hover:bg-teal/20 transition-colors">
                {'\u25B6'} Weiter
              </button>
              <button onClick={() => cmd('return_to_base')}
                className="flex-1 py-2 rounded-lg bg-surface border border-border text-text-muted text-sm font-sans cursor-pointer hover:bg-dim transition-colors">
                {'\uD83C\uDFE0'} Station
              </button>
            </>
          ) : isActive ? (
            <>
              <button onClick={() => cmd('pause')}
                className="flex-1 py-2 rounded-lg bg-amber-dim border border-amber-border text-amber text-sm font-sans cursor-pointer hover:bg-amber/20 transition-colors">
                {'\u23F8'} Pause
              </button>
              <button onClick={() => cmd('return_to_base')}
                className="flex-1 py-2 rounded-lg bg-surface border border-border text-text-muted text-sm font-sans cursor-pointer hover:bg-dim transition-colors">
                {'\uD83C\uDFE0'} Station
              </button>
            </>
          ) : null}
        </div>

        {/* ─── Raumauswahl ─── */}
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-text-muted font-sans mb-2">{'R\u00E4ume ausw\u00E4hlen'}</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {ROOMS.map(room => {
              const isSelected = selectedRooms.includes(room.id)
              const isCurrentRoom = isActive && currentRoom && room.label.toLowerCase().includes(currentRoom.toLowerCase())
              return (
                <button
                  key={room.id}
                  onClick={() => !isActive && toggleRoom(room.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-sans border cursor-pointer transition-all text-left ${
                    isCurrentRoom
                      ? 'bg-teal-dim border-teal-border text-teal'
                      : isSelected
                      ? 'bg-amber-dim border-amber-border text-amber'
                      : 'bg-surface border-border text-text-primary hover:bg-dim'
                  } ${isActive ? 'opacity-60 cursor-default' : ''}`}
                >
                  <span className="text-xl">{room.icon}</span>
                  <span className="flex-1 truncate font-medium">{room.label}</span>
                  {isCurrentRoom && <span className="text-sm">{'\uD83E\uDDF9'}</span>}
                  {isSelected && !isCurrentRoom && <span className="text-sm text-amber font-bold">{'\u2713'}</span>}
                </button>
              )
            })}
          </div>
          {selectedRooms.length > 0 && (
            <button onClick={startRooms}
              className="w-full py-2 rounded-lg bg-teal-dim border border-teal-border text-teal text-sm font-sans cursor-pointer hover:bg-teal/20 transition-colors">
              {'\uD83E\uDDF9'} {selectedRooms.length === 1 ? '1 Raum' : `${selectedRooms.length} R\u00E4ume`} saugen
            </button>
          )}
        </div>

        {/* Karte */}
        {mapUrl && (
          <div className="mt-3 pt-3 border-t border-border cursor-pointer" onClick={() => setShowDetail(true)}>
            <div className="text-[11px] text-text-muted mb-1.5">Karte</div>
            <div className="rounded-xl overflow-hidden border border-border bg-surface" style={{ height: '200px' }}>
              <img src={mapUrl} alt="Roborock Karte"
                className="w-full h-full object-cover object-center"
                style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        )}

        {/* Quick Info Badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {waterBox && (
            <span className="px-2 py-0.5 text-[11px] font-sans rounded-md bg-blue/10 border border-blue/20 text-blue">
              {'\uD83D\uDCA7'} Wassertank
            </span>
          )}
          {mopIntensity && mopIntensity !== '\u2013' && mopIntensity !== 'off' && (
            <span className="px-2 py-0.5 text-[11px] font-sans rounded-md bg-teal-dim border border-teal-border text-teal">
              Wischen: {MOP_DE[mopIntensity] || mopIntensity}
            </span>
          )}
          {dndOn && (
            <span className="px-2 py-0.5 text-[11px] font-sans rounded-md bg-surface border border-border text-text-muted">
              {'\uD83C\uDF19'} DND {dndStart?.slice(0,5)}{'\u2013'}{dndEnd?.slice(0,5)}
            </span>
          )}
          {childLock && (
            <span className="px-2 py-0.5 text-[11px] font-sans rounded-md bg-surface border border-border text-text-muted">
              {'\uD83D\uDD12'} Kindersicherung
            </span>
          )}
        </div>

        {/* Letzte Reinigung */}
        {lastStart && lastStart !== 'unknown' && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[11px] text-text-muted font-sans mb-1">Letzte Reinigung</div>
            <div className="flex gap-3 text-xs font-sans">
              <span className="text-text-primary">{fmtTime(lastStart)}</span>
              <span className="text-text-muted">{fmtDuration(lastDuration)}</span>
              <span className="text-text-muted">{lastArea} m{'\u00B2'}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {showDetail && (
        <InfoModal onClose={() => setShowDetail(false)} wide>
          <div className="text-center mb-3">
            <div className="text-base font-semibold text-text-primary font-sans">Roborock S6 MaxV</div>
            <div className={`text-sm font-sans ${hasError ? 'text-red' : isActive ? 'text-teal' : 'text-text-muted'}`}>
              {status}
            </div>
          </div>

          {/* Karte gross */}
          {mapUrl && (
            <div className="rounded-xl overflow-hidden border border-border bg-surface mb-4" style={{ height: '320px' }}>
              <img src={mapUrl} alt="Roborock Karte"
                className="w-full h-full object-cover object-center"
                style={{ imageRendering: 'pixelated' }} />
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-2 rounded-lg bg-surface border border-border text-center">
              <div className="text-lg font-bold font-sans text-text-primary">{v(entities, TOTAL_COUNT_ID)}</div>
              <div className="text-[11px] text-text-muted font-sans">Reinigungen</div>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-border text-center">
              <div className="text-lg font-bold font-sans text-text-primary">{v(entities, TOTAL_AREA_ID)} m{'\u00B2'}</div>
              <div className="text-[11px] text-text-muted font-sans">{'Gesamtfl\u00E4che'}</div>
            </div>
            <div className="p-2 rounded-lg bg-surface border border-border text-center">
              <div className="text-lg font-bold font-sans text-text-primary">{fmtDuration(v(entities, TOTAL_DURATION_ID))}</div>
              <div className="text-[11px] text-text-muted font-sans">Gesamtzeit</div>
            </div>
          </div>

          {/* Fan Speed */}
          <div className="mb-4">
            <div className="text-xs text-text-muted font-sans mb-1.5">Saugkraft</div>
            <div className="flex gap-1.5">
              {FAN_LEVELS.map(lvl => (
                <button key={lvl} onClick={() => setFan(lvl)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-sans cursor-pointer border transition-colors ${
                    fanSpeed === lvl
                      ? 'bg-teal-dim border-teal-border text-teal'
                      : 'bg-surface border-border text-text-muted hover:bg-dim'
                  }`}>
                  {FAN_DE[lvl]}
                </button>
              ))}
            </div>
          </div>

          {/* Mop Intensity */}
          <div className="mb-4">
            <div className="text-xs text-text-muted font-sans mb-1.5">{'Wisch-Intensit\u00E4t'}</div>
            <div className="flex gap-1.5">
              {MOP_LEVELS.map(lvl => (
                <button key={lvl} onClick={() => setMop(lvl)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-sans cursor-pointer border transition-colors ${
                    mopIntensity === lvl
                      ? 'bg-teal-dim border-teal-border text-teal'
                      : 'bg-surface border-border text-text-muted hover:bg-dim'
                  }`}>
                  {MOP_DE[lvl]}
                </button>
              ))}
            </div>
          </div>

          {/* Switches */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
              <span className="text-xs font-sans text-text-primary">{'\uD83C\uDF19'}{' Nicht st\u00F6ren ('}{dndStart?.slice(0,5)}{'\u2013'}{dndEnd?.slice(0,5)}{')'}</span>
              <Toggle on={dndOn} onToggle={() => toggleSwitch(DND_SWITCH_ID)} />
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
              <span className="text-xs font-sans text-text-primary">{'\uD83D\uDD12'} Kindersicherung</span>
              <Toggle on={childLock} onToggle={() => toggleSwitch(CHILD_LOCK_ID)} />
            </div>
          </div>

          {/* Consumables */}
          <div>
            <div className="text-xs text-text-muted font-sans mb-2">{'Verschlei\u00DFteile'}</div>
            <div className="flex flex-col gap-1.5">
              <ConsumableBar label="Filter" secondsLeft={v(entities, FILTER_LEFT_ID)} maxSeconds={150 * 3600} />
              <ConsumableBar label="Hauptb\u00FCrste" secondsLeft={v(entities, MAIN_BRUSH_ID)} maxSeconds={300 * 3600} />
              <ConsumableBar label="Seitenb\u00FCrste" secondsLeft={v(entities, SIDE_BRUSH_ID)} maxSeconds={200 * 3600} />
              <ConsumableBar label="Sensoren" secondsLeft={v(entities, SENSOR_LEFT_ID)} maxSeconds={30 * 3600} />
            </div>
          </div>
        </InfoModal>
      )}
    </>
  )
}
