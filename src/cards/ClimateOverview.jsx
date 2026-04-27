import { useHA } from '../context/HAContext'
import { Card, Label } from '../atoms'
import { v } from '../config'

const ROOMS = [
  { name: 'Kinderzimmer', icon: '\uD83E\uDDD2', temp: 'sensor.temperatursensor_kinderzimmer', hum: 'sensor.temperatursensor_kinderzimmer_luftfeuchtigkeit' },
  { name: 'Schlafzimmer', icon: '\uD83D\uDECF\uFE0F', temp: 'sensor.temperatursensor_schlafzimmer_temperature', hum: 'sensor.temperatursensor_schlafzimmer_humidity' },
  { name: 'Bad', icon: '\uD83D\uDEC1', temp: 'sensor.temperatursensor_bad_temperature', hum: 'sensor.temperatursensor_bad_humidity' },
  { name: 'Balkon', icon: '\uD83C\uDF3F', temp: 'sensor.temperatursensor_balkon_temperature', hum: 'sensor.temperatursensor_balkon_humidity' },
  { name: 'Flur', icon: '\uD83D\uDEB6', temp: 'sensor.bewegungsmelder_flur_hue_temperature', hum: null },
  { name: 'Treppe', icon: '\uFA7E', temp: 'sensor.bewegungsmelder_treppe_hue_temperature', hum: 'sensor.treppe_presence_aqara_humidity' },
  { name: 'Meter E908', icon: '\uD83C\uDF21\uFE0F', temp: 'sensor.indoor_outdoor_meter_e908', hum: 'sensor.indoor_outdoor_meter_e908_luftfeuchtigkeit' },
  { name: 'Meter CDAD', icon: '\uD83C\uDFE0', temp: 'sensor.indoor_outdoor_meter_cdad', hum: 'sensor.indoor_outdoor_meter_cdad_luftfeuchtigkeit' },
]

const tempColor = (t) => {
  if (t < 18) return 'text-blue'
  if (t <= 24) return 'text-teal'
  return 'text-amber'
}

const humColor = (h) => {
  if (h < 30) return 'text-amber'
  if (h <= 60) return 'text-teal'
  return 'text-blue'
}

export function ClimateOverview() {
  const { entities } = useHA()

  return (
    <Card>
      <Label>Klima {'\u00B7'} Alle Raeume</Label>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
        {ROOMS.map(room => {
          const tempVal = parseFloat(v(entities, room.temp))
          const humVal = room.hum ? parseFloat(v(entities, room.hum)) : NaN
          const tempStr = isNaN(tempVal) ? '\u2013' : tempVal.toFixed(1)
          const humStr = isNaN(humVal) ? null : Math.round(humVal)

          return (
            <div key={room.name} className="p-2.5 rounded-[10px] bg-surface border border-border text-center">
              <div className="text-lg mb-1">{room.icon}</div>
              <div className="text-[11px] text-text-muted font-mono tracking-wide mb-1">{room.name}</div>
              <div className={`text-xl font-extrabold font-sans leading-none ${isNaN(tempVal) ? 'text-text-muted' : tempColor(tempVal)}`}>
                {tempStr}<span className="text-[11px] text-text-muted">{'\u00B0'}C</span>
              </div>
              {humStr != null && (
                <div className={`text-xs font-mono mt-1 ${humColor(humVal)}`}>
                  {'\uD83D\uDCA7'} {humStr}%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
