// ─── ICS PARSER ─────────────────────────────────────────────────────
// Parst Google Calendar iCal-Feeds ohne externe Abhaengigkeiten.
// Unterstuetzt: VEVENT, DTSTART/DTEND (ganztaegig + Uhrzeit + UTC),
// RRULE (DAILY/WEEKLY/MONTHLY/YEARLY), EXDATE, RECURRENCE-ID.

const DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

// ── Helpers ──────────────────────────────────────────────────────────

function unescapeICS(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\')
    .replace(/\\;/g, ';')
}

function parseICSDate(raw) {
  // raw kann sein: "20260312", "20260312T140000Z", "20260312T140000"
  // oder mit TZID-Prefix (schon entfernt vom Caller)
  const v = raw.trim()
  if (v.length === 8) {
    return { date: new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)), allDay: true }
  }
  if (v.endsWith('Z')) {
    return {
      date: new Date(Date.UTC(
        +v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8),
        +v.slice(9, 11), +v.slice(11, 13), +v.slice(13, 15) || 0
      )),
      allDay: false,
    }
  }
  // Lokale Zeit (TZID=Europe/Berlin o.ae.) -> als Lokalzeit behandeln
  return {
    date: new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8),
      +v.slice(9, 11), +v.slice(11, 13), +v.slice(13, 15) || 0),
    allDay: false,
  }
}

function parseDateProp(line) {
  // "DTSTART;VALUE=DATE:20260312" oder "DTSTART;TZID=Europe/Berlin:20260312T090000"
  const colonIdx = line.indexOf(':')
  const params = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1)
  const allDay = params.includes('VALUE=DATE')
  if (allDay) return { date: parseICSDate(value).date, allDay: true }
  return parseICSDate(value)
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── RRULE Expansion ──────────────────────────────────────────────────

function parseRRule(str) {
  const parts = {}
  for (const seg of str.split(';')) {
    const [k, val] = seg.split('=')
    parts[k] = val
  }
  return {
    freq: parts.FREQ,
    interval: +(parts.INTERVAL || 1),
    until: parts.UNTIL ? parseICSDate(parts.UNTIL).date : null,
    count: parts.COUNT ? +parts.COUNT : null,
    byday: parts.BYDAY ? parts.BYDAY.split(',') : null,
    bymonthday: parts.BYMONTHDAY ? parts.BYMONTHDAY.split(',').map(Number) : null,
    bymonth: parts.BYMONTH ? parts.BYMONTH.split(',').map(Number) : null,
    wkst: parts.WKST || 'MO',
  }
}

function nthWeekdayOfMonth(year, month, weekday, nth) {
  // nth kann 1-5 oder -1 sein
  if (nth > 0) {
    const first = new Date(year, month, 1)
    let diff = (weekday - first.getDay() + 7) % 7
    const day = 1 + diff + (nth - 1) * 7
    const d = new Date(year, month, day)
    return d.getMonth() === month ? d : null
  }
  if (nth === -1) {
    const last = new Date(year, month + 1, 0)
    let diff = (last.getDay() - weekday + 7) % 7
    return new Date(year, month, last.getDate() - diff)
  }
  return null
}

function expandRRule(rule, dtstart, duration, rangeStart, rangeEnd, exdateSet) {
  const occurrences = []
  const MAX = 366
  let count = 0

  const addOccurrence = (d) => {
    if (rule.count !== null && count >= rule.count) return false
    if (rule.until && d > rule.until) return false
    if (d > rangeEnd) return false
    count++
    if (d >= rangeStart && !exdateSet.has(dateKey(d)) && !exdateSet.has(d.toISOString())) {
      occurrences.push({ start: new Date(d), end: new Date(d.getTime() + duration) })
    }
    return true
  }

  if (rule.freq === 'DAILY') {
    let cur = new Date(dtstart)
    while (cur <= rangeEnd && count < MAX) {
      if (!addOccurrence(cur)) break
      cur = new Date(cur)
      cur.setDate(cur.getDate() + rule.interval)
    }
  } else if (rule.freq === 'WEEKLY') {
    const days = rule.byday ? rule.byday.map(d => DAY_MAP[d]) : [dtstart.getDay()]
    let weekStart = new Date(dtstart)
    // Zurueck zum Wochenstart
    while (weekStart <= rangeEnd && count < MAX) {
      for (const day of days.sort((a, b) => a - b)) {
        const d = new Date(weekStart)
        const diff = (day - d.getDay() + 7) % 7
        d.setDate(d.getDate() + diff)
        if (d < dtstart) continue
        if (!addOccurrence(d)) break
      }
      weekStart.setDate(weekStart.getDate() + 7 * rule.interval)
    }
  } else if (rule.freq === 'MONTHLY') {
    let cur = new Date(dtstart)
    while (cur <= rangeEnd && count < MAX) {
      if (rule.byday) {
        // z.B. "2TU" = 2. Dienstag, "-1FR" = letzter Freitag
        for (const bd of rule.byday) {
          const match = bd.match(/^(-?\d+)?([A-Z]{2})$/)
          if (!match) continue
          const nth = match[1] ? +match[1] : 1
          const wd = DAY_MAP[match[2]]
          const d = nthWeekdayOfMonth(cur.getFullYear(), cur.getMonth(), wd, nth)
          if (d) {
            d.setHours(dtstart.getHours(), dtstart.getMinutes(), dtstart.getSeconds())
            if (d >= dtstart && !addOccurrence(d)) break
          }
        }
      } else {
        const days = rule.bymonthday || [dtstart.getDate()]
        for (const day of days) {
          const d = new Date(cur.getFullYear(), cur.getMonth(), day,
            dtstart.getHours(), dtstart.getMinutes(), dtstart.getSeconds())
          if (d.getMonth() === cur.getMonth() && d >= dtstart) {
            if (!addOccurrence(d)) break
          }
        }
      }
      cur.setMonth(cur.getMonth() + rule.interval)
    }
  } else if (rule.freq === 'YEARLY') {
    let cur = new Date(dtstart)
    while (cur <= rangeEnd && count < MAX) {
      if (cur >= dtstart) {
        if (!addOccurrence(new Date(cur))) break
      }
      cur.setFullYear(cur.getFullYear() + rule.interval)
    }
  }

  return occurrences
}

// ── Haupt-Parser ─────────────────────────────────────────────────────

export function parseICS(icsText, rangeStart, rangeEnd) {
  // 1. Line unfolding (RFC 5545)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  // 2. VEVENT-Bloecke extrahieren
  const vevents = []
  let current = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = []; continue }
    if (line === 'END:VEVENT' && current) { vevents.push(current); current = null; continue }
    if (current) current.push(line)
  }

  // 3. Events parsen
  const masters = []    // Events mit RRULE
  const singles = []    // Einzel-Events
  const overrides = new Map() // RECURRENCE-ID -> Event

  for (const lines of vevents) {
    const ev = { summary: '', location: null, description: null, uid: '', rrule: null, exdates: [] }
    let recurrenceId = null

    for (const line of lines) {
      const prop = line.split(':')[0].split(';')[0]
      switch (prop) {
        case 'DTSTART': { const p = parseDateProp(line); ev.start = p.date; ev.allDay = p.allDay; break }
        case 'DTEND': { const p = parseDateProp(line); ev.end = p.date; break }
        case 'SUMMARY': ev.summary = unescapeICS(line.slice(line.indexOf(':') + 1)); break
        case 'LOCATION': ev.location = unescapeICS(line.slice(line.indexOf(':') + 1)) || null; break
        case 'DESCRIPTION': ev.description = unescapeICS(line.slice(line.indexOf(':') + 1)) || null; break
        case 'UID': ev.uid = line.slice(4); break
        case 'RRULE': ev.rrule = line.slice(6); break
        case 'EXDATE': {
          const val = line.slice(line.indexOf(':') + 1)
          for (const d of val.split(',')) {
            const p = parseICSDate(d.trim())
            ev.exdates.push(p.allDay ? dateKey(p.date) : p.date.toISOString())
          }
          break
        }
        case 'RECURRENCE-ID': { recurrenceId = parseDateProp(line); break }
      }
    }

    if (!ev.start) continue

    // Default-Ende: bei ganztaegig = naechster Tag, sonst = Start
    if (!ev.end) {
      ev.end = ev.allDay
        ? new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate() + 1)
        : new Date(ev.start)
    }

    if (recurrenceId) {
      const key = `${ev.uid}|${recurrenceId.allDay ? dateKey(recurrenceId.date) : recurrenceId.date.toISOString()}`
      overrides.set(key, ev)
    } else if (ev.rrule) {
      masters.push(ev)
    } else {
      singles.push(ev)
    }
  }

  // 4. Ergebnis aufbauen
  const results = []

  // Einzel-Events im Bereich
  for (const ev of singles) {
    if (ev.end > rangeStart && ev.start < rangeEnd) {
      results.push({
        summary: ev.summary,
        start: ev.start,
        end: ev.end,
        allDay: ev.allDay,
        location: ev.location,
        description: ev.description,
        uid: ev.uid,
      })
    }
  }

  // Recurring Events expandieren
  for (const ev of masters) {
    const rule = parseRRule(ev.rrule)
    const duration = ev.end.getTime() - ev.start.getTime()
    const exdateSet = new Set(ev.exdates)
    const occurrences = expandRRule(rule, ev.start, duration, rangeStart, rangeEnd, exdateSet)

    for (const occ of occurrences) {
      // Pruefen ob Override existiert
      const key = `${ev.uid}|${ev.allDay ? dateKey(occ.start) : occ.start.toISOString()}`
      const override = overrides.get(key)
      if (override) {
        results.push({
          summary: override.summary,
          start: override.start,
          end: override.end,
          allDay: override.allDay,
          location: override.location,
          description: override.description,
          uid: override.uid,
        })
      } else {
        results.push({
          summary: ev.summary,
          start: occ.start,
          end: occ.end,
          allDay: ev.allDay,
          location: ev.location,
          description: ev.description,
          uid: ev.uid,
        })
      }
    }
  }

  return results.sort((a, b) => a.start - b.start)
}
