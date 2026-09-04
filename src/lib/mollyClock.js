// ─── Molly-Weasley-Uhr ──────────────────────────────────────────────
// Leitet den Aufenthaltsort einer Person automatisch aus Home-Assistant-
// Entitaeten ab. Reine Logik ohne React – bewusst getrennt, damit die
// Regeln an einer Stelle stehen und leicht erweiterbar sind.
//
// Datenquellen (alle optional ausser `entity`):
//   entity     person.xyz            – Zustand: home | not_home | <Zonenname>
//   proximity  proximity.xyz_zuhause – Entfernung + Bewegungsrichtung
//   calendar   calendar.xyz          – laufender Termin (Urlaub-Erkennung)
//   override   input_select.xyz      – manuelle Uebersteuerung ("Auto" = aus)
//   peril      binary_sensor/input_boolean – "Lebensgefahr" (on = Alarm)

// Reihenfolge = Anordnung im Uhrzeigersinn, Index 0 liegt auf 12 Uhr.
export const SECTORS = [
  { id: 'home',     label: 'Zuhause',     icon: '🏠' },
  { id: 'work',     label: 'Arbeit',      icon: '💼' },
  { id: 'school',   label: 'Schule',      icon: '🎓' },
  { id: 'shopping', label: 'Einkauf',     icon: '🛒' },
  { id: 'visiting', label: 'Besuch',      icon: '👪' },
  { id: 'holiday',  label: 'Urlaub',      icon: '🏖️' },
  { id: 'travel',   label: 'Unterwegs',   icon: '🚗' },
  { id: 'lost',     label: 'Verschollen', icon: '❓' },
  { id: 'peril',    label: 'Gefahr',      icon: '⚡' },
  { id: 'homeward', label: 'Heimweg',     icon: '🧭' },
]

export const SECTOR_STEP = 360 / SECTORS.length

export const sectorIndex = (id) => {
  const i = SECTORS.findIndex(s => s.id === id)
  return i < 0 ? SECTORS.findIndex(s => s.id === 'lost') : i
}

export const sectorAngle = (id) => sectorIndex(id) * SECTOR_STEP

export const sectorById = (id) => SECTORS[sectorIndex(id)]

// Zonennamen -> Sektor. Erstes Stichwort das im Namen vorkommt gewinnt.
const ZONE_RULES = [
  { sector: 'work',     words: ['arbeit', 'work', 'buero', 'office', 'firma', 'job', 'praxis', 'klinik', 'werkstatt'] },
  { sector: 'school',   words: ['schule', 'school', 'kita', 'kindergarten', 'hort', 'uni', 'hochschule', 'studium'] },
  { sector: 'shopping', words: ['einkauf', 'markt', 'rewe', 'aldi', 'lidl', 'edeka', 'kaufland', 'dm', 'baumarkt', 'shopping', 'laden'] },
  { sector: 'holiday',  words: ['urlaub', 'ferien', 'hotel', 'camping', 'strand', 'reise'] },
  { sector: 'visiting', words: ['oma', 'opa', 'eltern', 'schwieger', 'freunde', 'besuch', 'verein', 'sport'] },
  { sector: 'travel',   words: ['bahn', 'bahnhof', 'zug', 'flughafen', 'autobahn', 'unterwegs'] },
]

const HOLIDAY_RE = /urlaub|ferien|reise|abwesend/i

const norm = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')

const UNAVAILABLE = ['unknown', 'unavailable', 'none', '']

const st = (entities, id) => (id ? entities?.[id]?.state : undefined)
const at = (entities, id, key) => (id ? entities?.[id]?.attributes?.[key] : undefined)
const isOn = (s) => ['on', 'true', 'home', 'triggered'].includes(String(s ?? '').toLowerCase())

// Zonenname -> Sektor-Id (Fallback: Besuch, denn es ist ein *benannter* Ort)
export function zoneToSector(zoneName) {
  const n = norm(zoneName)
  for (const rule of ZONE_RULES) {
    if (rule.words.some(w => n.includes(w))) return rule.sector
  }
  return 'visiting'
}

// Manuelle Uebersteuerung: Wert darf Sektor-Id oder Sektor-Label sein.
function overrideSector(value) {
  const n = norm(value)
  if (!n || UNAVAILABLE.includes(n) || n === 'auto' || n === 'automatisch') return null
  const hit = SECTORS.find(s => norm(s.id) === n || norm(s.label) === n)
  return hit ? hit.id : null
}

// Laeuft gerade ein Urlaubs-Termin im Kalender?
function hasHolidayEvent(entities, calendarId, now) {
  if (!calendarId || !entities?.[calendarId]) return false
  const cal = entities[calendarId]
  if (String(cal.state).toLowerCase() !== 'on') return false
  const msg = cal.attributes?.message ?? ''
  if (!HOLIDAY_RE.test(msg)) return false
  const start = Date.parse(cal.attributes?.start_time ?? '')
  const end = Date.parse(cal.attributes?.end_time ?? '')
  if (isNaN(start) || isNaN(end)) return true
  return start <= now && now <= end
}

// Entfernung aus proximity: HA liefert Meter oder Kilometer (Attribut unit_of_measurement)
function proximityInfo(entities, proximityId) {
  if (!proximityId || !entities?.[proximityId]) return null
  const ent = entities[proximityId]
  const raw = parseFloat(ent.state)
  const unit = ent.attributes?.unit_of_measurement ?? 'm'
  const dir = String(ent.attributes?.dir_of_travel ?? '').toLowerCase()
  const km = isNaN(raw) ? null : (unit === 'km' ? raw : raw / 1000)
  return { km, dir }
}

const fmtDistance = (km) => {
  if (km == null) return null
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`
}

const fmtSince = (iso) => {
  const t = Date.parse(iso ?? '')
  if (isNaN(t)) return null
  const mins = Math.floor((Date.now() - t) / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `seit ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `seit ${hrs} h`
  const days = Math.floor(hrs / 24)
  return `seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
}

/**
 * Ermittelt Sektor + Beschriftung fuer eine Person.
 * Reihenfolge der Regeln = Prioritaet (oben schlaegt unten).
 * @returns {{sector: string, label: string, detail: string|null, reason: string, since: string|null}}
 */
export function resolvePerson(entities, cfg, now = Date.now()) {
  const state = st(entities, cfg.entity)
  const since = fmtSince(entities?.[cfg.entity]?.last_changed)
  const prox = proximityInfo(entities, cfg.proximity)
  const distance = fmtDistance(prox?.km)
  const out = (sector, label, detail, reason) => ({
    sector, label: label ?? sectorById(sector).label, detail: detail ?? since, reason, since,
  })

  // 1. Lebensgefahr sticht alles
  if (cfg.peril && isOn(st(entities, cfg.peril))) return out('peril', null, 'Alarm ausgeloest', 'peril')

  // 2. Manuelle Uebersteuerung
  const manual = overrideSector(st(entities, cfg.override))
  if (manual) return out(manual, null, 'manuell gesetzt', 'override')

  // 3. Kein Signal -> verschollen
  if (state == null || UNAVAILABLE.includes(String(state).toLowerCase())) {
    return out('lost', null, 'kein Standortsignal', 'unavailable')
  }

  // 4. Daheim
  if (norm(state) === 'home') return out('home', null, since, 'zone-home')

  // 5. Benannte Zone (HA liefert den Zonen-Namen als State)
  if (norm(state) !== 'not_home') {
    return out(zoneToSector(state), state, since, 'zone')
  }

  // 6. Urlaub laut Kalender
  if (hasHolidayEvent(entities, cfg.calendar, now)) {
    return out('holiday', null, at(entities, cfg.calendar, 'message') ?? since, 'calendar')
  }

  // 7. Auf dem Heimweg (proximity naehert sich)
  if (prox?.dir === 'towards') {
    return out('homeward', null, distance ? `noch ${distance}` : since, 'proximity')
  }

  // 8. Sonst unterwegs
  return out('travel', null, distance ? `${distance} entfernt` : since, 'not_home')
}
