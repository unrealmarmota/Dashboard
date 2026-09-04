// ─── CONFIG ─────────────────────────────────────────────────────────
// HA laeuft komplett ueber nginx Reverse Proxy — funktioniert lokal + Tailscale identisch
const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
export const HA_URL = `${wsProto}//${window.location.host}/ha-ws`
export const HA_REST = `${window.location.origin}/ha-api`
export const HA_BASE = `${window.location.origin}/ha`
export const UPTIME_KUMA_URL = '/uptimekuma'
export const UPTIME_KUMA_SLUG = 'overview'
export const GLANCES_URL = '/glances'
export const PIHOLE_URL = '/pihole'
export const PIHOLE_PASSWORD = 'Jojo2510!'
export const VVS_URL = '/vvs'
export const GCAL_URL = '/gcal'
export const GCAL_CALENDARS = [
  { name: 'Johannes', url: '/gcal/johannes', color: 'var(--color-blue)' },
  { name: 'Tanja',    url: '/gcal/tanja',    color: 'var(--color-teal)' },
]
export const SOLAR_ANLAGENKOSTEN = 800
export const SOLAR_PEAK_WP = 1000
export const SOLAR_STROMPREIS = 0.32
export const SOLAR_EINSPEISEVERGUETUNG = 0
export const SOLAR_INSTALL_DATE = '2026-03-06'
export const TANDOOR_URL = '/tandoor'
export const TANDOOR_TOKEN = 'tda_d9b9bac2_4b45_4cc9_9f6c_9fa548e553ce'
export const BRING_ENTITY = 'todo.einkaufszettel'
export const CHORES_URL = '/chores'
// ─── Molly-Weasley-Uhr ──────────────────────────────────────────────
// Pro Person nur `entity` noetig, alles Weitere ist optional und wird
// ignoriert, solange die Entitaet in HA nicht existiert:
//   proximity – proximity-Integration Richtung Zuhause (erkennt "Heimweg")
//   place     – "places"-Integration (HACS): Reverse-Geocoding via OpenStreetMap,
//               kategorisiert unbekannte Orte automatisch (Supermarkt, Praxis, Hotel ...)
//   calendar  – laufender Termin mit "Urlaub"/"Ferien" -> Sektor Urlaub
//   override  – input_select zum manuellen Setzen ("Auto" = Automatik)
//   peril     – binary_sensor/input_boolean fuer "Lebensgefahr"
export const MOLLY_PERSONS = [
  {
    key: 'johannes', name: 'Johannes', initial: 'J',
    entity: 'person.johannes',
    proximity: 'proximity.johannes_zuhause',
    place: 'sensor.johannes_place',
    calendar: 'calendar.johannes',
    override: 'input_select.molly_johannes',
    peril: 'binary_sensor.molly_johannes_gefahr',
    color: 'var(--color-teal)',
  },
  {
    key: 'tanja', name: 'Tanja', initial: 'T',
    entity: 'person.tanja',
    proximity: 'proximity.tanja_zuhause',
    place: 'sensor.tanja_place',
    calendar: 'calendar.tanja',
    override: 'input_select.molly_tanja',
    peril: 'binary_sensor.molly_tanja_gefahr',
    color: 'var(--color-amber)',
  },
]

export const HA_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmYzhlNTQ0MGNhZDk0NzE2YjdiOTVjMGQ2OTMzN2JkMiIsImlhdCI6MTc3MjcwMzExMCwiZXhwIjoyMDg4MDYzMTEwfQ.qqMmYjsl7Ovt2fYzHc38VaYdCpoIqCvQbny9vnk00uY'

// ─── HELPERS ────────────────────────────────────────────────────────
export const e = (entities, id) => entities[id] ?? null
export const v = (entities, id) => entities[id]?.state ?? '\u2013'
export const a = (entities, id, attr) => entities[id]?.attributes?.[attr] ?? null
export const isHome = (state) => state?.toLowerCase() === 'home'
export const fmtTime = (iso) => {
  if (!iso) return '\u2013'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '\u2013' : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export const WEATHER_ICONS = {
  sunny: '\u2600\uFE0F', 'clear-night': '\uD83C\uDF19', partlycloudy: '\u26C5', cloudy: '\u2601\uFE0F',
  rainy: '\uD83C\uDF27\uFE0F', pouring: '\uD83C\uDF27\uFE0F', snowy: '\u2744\uFE0F', fog: '\uD83C\uDF2B\uFE0F',
  lightning: '\u26A1', windy: '\uD83C\uDF2C\uFE0F', exceptional: '\u26A0\uFE0F',
}
export const WEATHER_DE = {
  sunny: 'Sonnig', 'clear-night': 'Klar', partlycloudy: 'Teils bew\u00F6lkt', cloudy: 'Bew\u00F6lkt',
  rainy: 'Regen', pouring: 'Starkregen', snowy: 'Schnee', fog: 'Nebel',
  lightning: 'Gewitter', windy: 'Windig',
}

// Saisonale Ertragsfaktoren Sueddeutschland (Anteil am Jahresertrag pro Monat)
export const MONTH_FACTORS = [0.025, 0.045, 0.08, 0.11, 0.135, 0.14, 0.135, 0.12, 0.095, 0.065, 0.03, 0.02]
export const MONTH_NAMES = ['Jan', 'Feb', 'M\u00E4r', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
