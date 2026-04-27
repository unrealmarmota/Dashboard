import { useState, useCallback } from 'react'
import { BringCard } from '../cards/BringCard'
import { MealPlanCard } from '../cards/MealPlanCard'
import { ChoresCard } from '../cards/ChoresCard'
import { CalendarCard } from '../cards/CalendarCard'
import { CountdownCard } from '../cards/CountdownCard'
import { RecipeSwipeCard } from '../cards/RecipeSwipeCard'

export function TabFamilie() {
  const [showSwipe, setShowSwipe] = useState(false)
  const [mealPlanKey, setMealPlanKey] = useState(0)

  // Nach Eintragen MealPlanCard zum Refresh animieren (Key-Change loest re-mount aus)
  const handleAdded = useCallback(() => {
    setMealPlanKey(k => k + 1)
  }, [])

  return (
    <div className="familie-tab space-y-3">
      {/* Essensplan: volle Breite, horizontal */}
      <MealPlanCard key={mealPlanKey} horizontal />

      {/* Aufgaben + Einkauf + Kalender + Countdown darunter */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3 items-start">
        <ChoresCard />
        <BringCard />
        <CalendarCard />
        <CountdownCard />
      </div>

      {/* FAB: Rezeptvorschlag */}
      <button className="rsc-fab" onClick={() => setShowSwipe(true)} title="Rezeptvorschlag">
        🎲
      </button>

      {showSwipe && (
        <RecipeSwipeCard
          onClose={() => setShowSwipe(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
