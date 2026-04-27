import { LightCard } from '../cards/LightCard'
import { ThermostatCard } from '../cards/ThermostatCard'
import { PlugsCard } from '../cards/PlugsCard'

export function TabUnten() {
  return (
    <div className="flex flex-col gap-3">
      <LightCard title={'Licht \u00B7 Unten'} mode="grid" lights={[
        { id: 'light.shelly_kinderzimmer', label: 'Kinderzimmer', icon: '\uD83E\uDDD2' },
        { id: 'light.buro', label: 'B\u00FCro', icon: '\uD83D\uDCBB' },
        { id: 'light.kinderbett_strip_unten', label: 'Kinderbett Strip', icon: '\uD83D\uDECF\uFE0F' },
        { id: 'light.led_band_johannes_bett', label: 'LED Bett Johannes', icon: '\uD83D\uDCA4' },
      ]} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <ThermostatCard entityId="climate.thermostat_schlafzimmer" name="Schlafzimmer" />
        <ThermostatCard entityId="climate.thermostat_badezimmer" name="Badezimmer" />
        <ThermostatCard entityId="climate.thermostat_buro" name={'B\u00FCro'} />
        <ThermostatCard entityId="climate.kinderzimmer" name="Kinderzimmer" />
      </div>
      <PlugsCard title="Steckdosen \u00B7 Unten" plugs={[
        { id: 'switch.steckdose_warhammer', label: 'Warhammer' },
      ]} />
    </div>
  )
}
