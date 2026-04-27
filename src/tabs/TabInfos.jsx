import { EnergyFlow } from '../cards/EnergyFlow'
import { EnergyKPIs } from '../cards/EnergyKPIs'
import { EnergyStatsCard } from '../cards/EnergyStatsCard'
import { EnergyChart } from '../cards/EnergyChart'
import { PlugsStatsCard } from '../cards/PlugsStatsCard'
import { SankeyCard } from '../cards/SankeyCard'
import { UnraidCard } from '../cards/UnraidCard'
import { UptimeKumaWidget } from '../cards/UptimeKumaWidget'
import { ProxmoxStatus } from '../cards/ProxmoxStatus'
import { PiHoleCard } from '../cards/PiHoleCard'
import { FlightradarCard } from '../cards/FlightradarCard'

export function TabInfos() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3 items-start">
        <EnergyFlow />
        <div className="flex flex-col gap-3">
          <EnergyKPIs />
          <EnergyStatsCard />
        </div>
      </div>
      <EnergyChart />
      <div className="text-[11px] text-text-muted font-mono px-1 pt-1">{'\uD83D\uDD0C'} Steckdosen &amp; Energiefluss</div>
      <PlugsStatsCard />
      <SankeyCard />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-3 items-start">
        <UnraidCard />
        <ProxmoxStatus />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 items-start">
        <UptimeKumaWidget compact />
        <PiHoleCard />
        <FlightradarCard />
      </div>
    </div>
  )
}
