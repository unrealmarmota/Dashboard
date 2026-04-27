import { LightCard } from '../cards/LightCard'
import { ThermostatCard } from '../cards/ThermostatCard'
import { WasteCard } from '../cards/WasteCard'
import { WeatherStationCard } from '../cards/WeatherStationCard'
import { CalendarCard } from '../cards/CalendarCard'
import { BusDeparturesCard } from '../cards/BusDeparturesCard'
import { CarCard } from '../cards/CarCard'
import { DishwasherCard } from '../cards/DishwasherCard'
import { DenonCard } from '../cards/DenonCard'
import { WeatherCard } from '../cards/WeatherCard'
import { QuickPlugsCard } from '../cards/QuickPlugsCard'
import { ClimateOverview } from '../cards/ClimateOverview'
import { MediaCard } from '../cards/MediaCard'

export function TabOben() {
  return (
    <div className="flex flex-col gap-2">
      <WeatherStationCard />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
        <LightCard title={'Licht \u00B7 Wohnbereich'} lights={[
          { id: 'light.wohnzimmer_7', label: 'Wohnzimmer', icon: '\uD83D\uDECB\uFE0F' },
          { id: 'light.esstisch_hue', label: 'Esstisch', icon: '\uD83C\uDF7D\uFE0F' },
          { id: 'light.eingangsflut_hue', label: 'Eingangsflur', icon: '\uD83D\uDEAA' },
          { id: 'light.treppenlicht_hue', label: 'Treppenlicht', icon: '\uFA7E' },
          { id: 'switch.steckdose_stern', label: 'Stern', icon: '\u2B50', isSwitch: true },
        ]} />
        <WeatherCard />
        <QuickPlugsCard />
        <WasteCard compact />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2">
        <CalendarCard />
        <BusDeparturesCard />
        <CarCard />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2">
        <DishwasherCard />
        <ThermostatCard entityId="climate.thermostat_wohnzimmer" name={'Heizung \u00B7 Wohnzimmer'} />
        <DenonCard />
      </div>
      <ClimateOverview />
      <MediaCard />
    </div>
  )
}
