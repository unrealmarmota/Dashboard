import { BringCard } from '../cards/BringCard'
import { MealPlanCard } from '../cards/MealPlanCard'
import { ChoresCard } from '../cards/ChoresCard'
import { CalendarCard } from '../cards/CalendarCard'
import { CountdownCard } from '../cards/CountdownCard'

export function TabFamilie() {
  return (
    <div className="familie-tab space-y-3">
      {/* Essensplan: volle Breite, horizontal */}
      <MealPlanCard horizontal />

      {/* Aufgaben + Einkauf + Kalender + Countdown darunter */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3 items-start">
        <ChoresCard />
        <BringCard />
        <CalendarCard />
        <CountdownCard />
      </div>
    </div>
  )
}
