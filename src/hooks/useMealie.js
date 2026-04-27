import { useState, useEffect, useCallback } from 'react'
import { MEALIE_URL, MEALIE_TOKEN } from '../config'

const headers = { Authorization: `Bearer ${MEALIE_TOKEN}` }

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

function groupByDate(entries) {
  const map = {}
  for (const entry of entries) {
    const key = entry.date
    if (!map[key]) map[key] = []
    map[key].push(entry)
  }
  return map
}

export function useMealie() {
  const [mealPlan, setMealPlan] = useState({})
  const [weekRange, setWeekRange] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPlan = useCallback(async () => {
    try {
      const range = getWeekRange()
      const res = await fetch(
        `${MEALIE_URL}/api/households/mealplans?start_date=${range.start}&end_date=${range.end}`,
        { headers }
      )
      if (!res.ok) throw new Error(`Mealie ${res.status}`)
      const data = await res.json()
      const items = Array.isArray(data) ? data : (data.items ?? [])
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

  const getRecipe = useCallback(async (slug) => {
    const res = await fetch(`${MEALIE_URL}/api/recipes/${slug}`, { headers })
    if (!res.ok) throw new Error(`Recipe ${res.status}`)
    return res.json()
  }, [])

  const addMealPlanEntry = useCallback(async (date, title, entryType = 'dinner', recipeId = null) => {
    const body = recipeId
      ? { date, entryType, title: '', text: '', recipeId }
      : { date, entryType, title, text: '' }
    const res = await fetch(`${MEALIE_URL}/api/households/mealplans`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Mealie create ${res.status}`)
    await fetchPlan()
    return res.json()
  }, [fetchPlan])

  const moveMealPlanEntry = useCallback(async (entry, newDate) => {
    const res = await fetch(`${MEALIE_URL}/api/households/mealplans/${entry.id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        groupId: entry.groupId,
        userId: entry.userId,
        householdId: entry.householdId,
        date: newDate,
        entryType: entry.entryType || 'dinner',
        title: entry.title || '',
        text: entry.text || '',
        recipeId: entry.recipeId || null,
      }),
    })
    if (!res.ok) throw new Error(`Mealie move ${res.status}`)
    await fetchPlan()
  }, [fetchPlan])

  const searchRecipes = useCallback(async (query) => {
    if (!query || query.length < 2) return []
    const res = await fetch(
      `${MEALIE_URL}/api/recipes?search=${encodeURIComponent(query)}&perPage=5&page=1`,
      { headers }
    )
    if (!res.ok) return []
    const data = await res.json()
    const items = Array.isArray(data) ? data : (data.items ?? [])
    return items
  }, [])

  const deleteMealPlanEntry = useCallback(async (id) => {
    const res = await fetch(`${MEALIE_URL}/api/households/mealplans/${id}`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) throw new Error(`Mealie delete ${res.status}`)
    await fetchPlan()
  }, [fetchPlan])

  return { mealPlan, weekRange, loading, error, getRecipe, addMealPlanEntry, deleteMealPlanEntry, moveMealPlanEntry, searchRecipes, fetchPlan }
}
