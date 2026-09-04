import { useState, useEffect, useCallback } from 'react'
import { CHORES_URL } from '../config'

const api = (path, opts = {}) =>
  fetch(`${CHORES_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then(r => {
    if (!r.ok) throw new Error(`Chores API ${r.status}`)
    return r.json()
  })

export function useChores(enabled = true) {
  const [todayData, setTodayData] = useState(null)
  const [weekData, setWeekData] = useState(null)
  const [stats, setStats] = useState(null)
  const [tasks, setTasks] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchToday = useCallback(async () => {
    try {
      const data = await api('/today')
      setTodayData(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const data = await api('/stats')
      setStats(data)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const fetchWeek = useCallback(async () => {
    try {
      const data = await api('/week')
      setWeekData(data)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api('/tasks')
      setTasks(data)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  // Initial + polling
  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      await fetchToday()
      await fetchStats()
    }
    poll()
    const iv = setInterval(poll, 30_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [enabled, fetchToday, fetchStats])

  // ─── Mutations ─────────────────────────────────────────────────────

  const completeTask = useCallback(async (taskId, date, completedBy) => {
    await api('/complete', {
      method: 'POST',
      body: JSON.stringify({ taskId, date, completedBy }),
    })
    await fetchToday()
    await fetchStats()
  }, [fetchToday, fetchStats])

  const uncompleteTask = useCallback(async (taskId, date) => {
    await api('/complete', {
      method: 'DELETE',
      body: JSON.stringify({ taskId, date }),
    })
    await fetchToday()
    await fetchStats()
  }, [fetchToday, fetchStats])

  const createTask = useCallback(async (data) => {
    await api('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await fetchToday()
    await fetchTasks()
  }, [fetchToday, fetchTasks])

  const updateTask = useCallback(async (id, data) => {
    await api(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    await fetchToday()
    await fetchTasks()
  }, [fetchToday, fetchTasks])

  const deleteTask = useCallback(async (id) => {
    await api(`/tasks/${id}`, { method: 'DELETE' })
    await fetchToday()
    await fetchTasks()
  }, [fetchToday, fetchTasks])

  return {
    todayData,
    weekData,
    stats,
    tasks,
    loading,
    error,
    fetchWeek,
    fetchTasks,
    fetchStats,
    completeTask,
    uncompleteTask,
    createTask,
    updateTask,
    deleteTask,
  }
}
