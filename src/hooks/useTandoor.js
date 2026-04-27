import { useState, useEffect, useCallback } from 'react'
import { TANDOOR_URL, TANDOOR_TOKEN } from '../config'

const headers = { Authorization: `Bearer ${TANDOOR_TOKEN}` }

const MEAL_TYPE_MAP = { breakfast: 1, lunch: 2, dinner: 3, side: 4 }
const MEAL_TYPE_REVERSE = { 1: 'breakfast', 2: 'lunch', 3: 'dinner', 4: 'side' }

// Tandoor returns absolute image URLs like http://host/media/... — rewrite to go through our proxy
function proxyImageUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return `${TANDOOR_URL}${u.pathname}`
  } catch {
    return url.startsWith('/') ? `${TANDOOR_URL}${url}` : url
  }
}

function getWeekRange() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    monday,
  }
}

function normalizeEntry(entry) {
  return {
    ...entry,
    date: entry.from_date?.slice(0, 10),
    entryType: MEAL_TYPE_REVERSE[entry.meal_type?.id] || 'dinner',
    recipe: entry.recipe ? { ...entry.recipe, image: proxyImageUrl(entry.recipe.image) } : null,
  }
}

function groupByDate(entries) {
  const map = {}
  for (const entry of entries) {
    const key = entry.date
    if (!map[key]) map[key] = []
    map[key].push(entry)
  }
  return map
}

export function useTandoor() {
  const [mealPlan, setMealPlan] = useState({})
  const [weekRange, setWeekRange] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPlan = useCallback(async () => {
    try {
      const range = getWeekRange()
      const res = await fetch(
        `${TANDOOR_URL}/api/meal-plan/?from_date=${range.start}&to_date=${range.end}&page_size=100`,
        { headers }
      )
      if (!res.ok) throw new Error(`Tandoor ${res.status}`)
      const data = await res.json()
      const items = (data.results ?? data ?? []).map(normalizeEntry)
      setMealPlan(groupByDate(items))
      setWeekRange(range)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      await fetchPlan()
    }
    poll()
    const iv = setInterval(poll, 300_000) // 5 Min
    return () => { cancelled = true; clearInterval(iv) }
  }, [fetchPlan])

  const getRecipe = useCallback(async (id) => {
    const res = await fetch(`${TANDOOR_URL}/api/recipe/${id}/`, { headers })
    if (!res.ok) throw new Error(`Recipe ${res.status}`)
    const recipe = await res.json()
    recipe.image = proxyImageUrl(recipe.image)
    // Normalize: flatten ingredients + instructions for downstream consumers
    recipe.recipeIngredient = (recipe.steps || []).flatMap(s =>
      (s.ingredients || []).map(ing => ({
        display: [ing.amount ? ing.amount : '', ing.unit?.name || '', ing.food?.name || ''].filter(Boolean).join(' ').trim(),
        food: ing.food?.name || '',
        amount: ing.amount,
        unit: ing.unit?.name || '',
      }))
    )
    recipe.recipeInstructions = (recipe.steps || [])
      .filter(s => s.instruction)
      .map(s => ({ text: s.instruction }))
    return recipe
  }, [])

  const addMealPlanEntry = useCallback(async (date, title, entryType = 'dinner', recipeId = null) => {
    const mealTypeId = MEAL_TYPE_MAP[entryType] || 3
    const body = recipeId
      ? { from_date: date, to_date: date, meal_type: { name: 'Abendessen' }, recipe: { id: recipeId }, title: '', servings: 1 }
      : { from_date: date, to_date: date, meal_type: { name: 'Abendessen' }, title, note: '', servings: 1 }
    const res = await fetch(`${TANDOOR_URL}/api/meal-plan/`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Tandoor create ${res.status}`)
    await fetchPlan()
    return res.json()
  }, [fetchPlan])

  const moveMealPlanEntry = useCallback(async (entry, newDate) => {
    const res = await fetch(`${TANDOOR_URL}/api/meal-plan/${entry.id}/`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_date: newDate, to_date: newDate }),
    })
    if (!res.ok) throw new Error(`Tandoor move ${res.status}`)
    await fetchPlan()
  }, [fetchPlan])

  const searchRecipes = useCallback(async (query) => {
    if (!query || query.length < 2) return []
    const res = await fetch(
      `${TANDOOR_URL}/api/recipe/?query=${encodeURIComponent(query)}&page_size=5`,
      { headers }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? data ?? []).map(r => ({ ...r, image: proxyImageUrl(r.image) }))
  }, [])

  const deleteMealPlanEntry = useCallback(async (id) => {
    const res = await fetch(`${TANDOOR_URL}/api/meal-plan/${id}/`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) throw new Error(`Tandoor delete ${res.status}`)
    await fetchPlan()
  }, [fetchPlan])

  return { mealPlan, weekRange, loading, error, getRecipe, addMealPlanEntry, deleteMealPlanEntry, moveMealPlanEntry, searchRecipes, fetchPlan }
}
