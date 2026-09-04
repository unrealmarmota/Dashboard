import { useState, useEffect } from 'react'
import { GCAL_CALENDARS } from '../config'
import { parseICS } from '../lib/parseICS'

export function useGoogleCalendar(daysAhead = 7, enabled = true) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let cancelled = false

    const fetchCalendars = async () => {
      try {
        const rangeStart = new Date()
        rangeStart.setHours(0, 0, 0, 0)
        const rangeEnd = new Date(rangeStart)
        rangeEnd.setDate(rangeEnd.getDate() + daysAhead)

        const results = await Promise.all(
          GCAL_CALENDARS.map(async (cal) => {
            const res = await fetch(cal.url)
            if (!res.ok) return []
            const icsText = await res.text()
            const parsed = parseICS(icsText, rangeStart, rangeEnd)
            return parsed.map(ev => ({ ...ev, calendar: cal.name, color: cal.color }))
          })
        )

        if (cancelled) return
        const merged = results.flat().sort((a, b) => {
          // Gleicher Tag: ganztaegig zuerst
          const dayA = a.start.toDateString(), dayB = b.start.toDateString()
          if (dayA === dayB && a.allDay !== b.allDay) return a.allDay ? -1 : 1
          return a.start - b.start
        })

        setEvents(merged)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCalendars()
    const iv = setInterval(fetchCalendars, 300_000) // 5 Min
    return () => { cancelled = true; clearInterval(iv) }
  }, [daysAhead, enabled])

  return { events, loading, error }
}
