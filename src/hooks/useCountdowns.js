import { useState, useEffect, useCallback, useRef } from 'react'
import { CHORES_URL } from '../config'

const API = `${CHORES_URL}/api/countdowns`
const LEGACY_KEY = 'ha_countdowns'

const calcDays = (dateStr) => {
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / 86400000)
}

// Shared state across hook consumers
let _items = null
const _listeners = new Set()
let _fetchPromise = null
let _migrated = false

async function _fetchAll() {
  try {
    const res = await fetch(API)
    if (!res.ok) throw new Error(`countdowns ${res.status}`)
    const data = await res.json()
    _items = Array.isArray(data) ? data : []
  } catch {
    _items = _items || []
  }
  _listeners.forEach(fn => fn(_items))
  return _items
}

async function _migrateLegacy() {
  if (_migrated) return
  _migrated = true
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const legacy = JSON.parse(raw)
    if (!Array.isArray(legacy) || legacy.length === 0) {
      localStorage.removeItem(LEGACY_KEY)
      return
    }
    // Push legacy items to server (only new ones)
    for (const item of legacy) {
      try {
        await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: item.label, date: item.date, emoji: item.emoji }),
        })
      } catch { /* ignore */ }
    }
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* ignore */ }
}

async function _ensureLoaded() {
  if (_items !== null) return _items
  if (!_fetchPromise) {
    _fetchPromise = (async () => {
      await _migrateLegacy()
      return _fetchAll()
    })()
  }
  return _fetchPromise
}

export function useCountdowns() {
  const [items, setItems] = useState(_items || [])
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const listener = (next) => {
      if (mountedRef.current) setItems(next || [])
    }
    _listeners.add(listener)
    _ensureLoaded().then(listener)
    // Refresh every 2 minutes to sync across devices
    const iv = setInterval(() => _fetchAll(), 120_000)
    return () => {
      mountedRef.current = false
      _listeners.delete(listener)
      clearInterval(iv)
    }
  }, [])

  const enrich = useCallback((list) =>
    list
      .map(c => ({ ...c, daysLeft: calcDays(c.date) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
  , [])

  const getAll = useCallback(() => enrich(items), [items, enrich])
  const getNext = useCallback(() => enrich(items).find(c => c.daysLeft >= 0) ?? null, [items, enrich])

  const add = useCallback(async (label, date, emoji) => {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, date, emoji }),
      })
      if (!res.ok) throw new Error(`add ${res.status}`)
      await _fetchAll()
    } catch { /* ignore */ }
  }, [])

  const remove = useCallback(async (id) => {
    try {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`delete ${res.status}`)
      await _fetchAll()
    } catch { /* ignore */ }
  }, [])

  return { getAll, getNext, add, remove, items }
}
