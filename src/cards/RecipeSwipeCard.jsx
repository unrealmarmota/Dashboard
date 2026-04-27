import { useState, useEffect, useRef, useCallback } from 'react'
import { TANDOOR_URL, TANDOOR_TOKEN } from '../config'

const headers = {
  Authorization: `Bearer ${TANDOOR_TOKEN}`,
  'Content-Type': 'application/json',
}

function proxyImageUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return `${TANDOOR_URL}${u.pathname}`
  } catch {
    return url?.startsWith('/') ? `${TANDOOR_URL}${url}` : url
  }
}

async function loadAllRecipes() {
  let results = []
  let page = 1
  while (true) {
    const res = await fetch(`${TANDOOR_URL}/api/recipe/?page_size=100&page=${page}`, { headers })
    if (!res.ok) break
    const data = await res.json()
    results = results.concat(data.results ?? [])
    if (!data.next) break
    page++
  }
  // Shuffle
  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [results[i], results[j]] = [results[j], results[i]]
  }
  return results.map(r => ({ ...r, image: proxyImageUrl(r.image) }))
}

function getWeekDays() {
  const now = new Date()
  const day = now.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)
  const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const todayStr = now.toLocaleDateString('sv-SE')
  const tomorrowStr = (() => { const d = new Date(now); d.setDate(d.getDate() + 1); return d.toLocaleDateString('sv-SE') })()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toLocaleDateString('sv-SE')
    const [, m, day2] = dateStr.split('-')
    const isToday = dateStr === todayStr
    const isTomorrow = dateStr === tomorrowStr
    return {
      label: isToday ? 'Heute' : isTomorrow ? 'Morgen' : labels[i],
      sub: `${day2}.${m}.`,
      date: dateStr,
      isToday,
    }
  })
}

export function RecipeSwipeCard({ onClose, onAdded }) {
  const [recipes, setRecipes] = useState([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [animDir, setAnimDir] = useState(null) // 'left' | 'right'
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedLabel, setSavedLabel] = useState(null)
  const touchStartX = useRef(null)
  const weekDays = getWeekDays()

  useEffect(() => {
    loadAllRecipes()
      .then(all => { setRecipes(all); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const current = recipes[idx] ?? null

  const advance = useCallback((dir) => {
    setAnimDir(dir)
    setTimeout(() => {
      setIdx(i => (i + 1) % Math.max(recipes.length, 1))
      setAnimDir(null)
      setShowDayPicker(false)
      setSavedLabel(null)
    }, 280)
  }, [recipes.length])

  async function addToDay(dateStr) {
    if (!current || saving) return
    setSaving(true)
    try {
      const res = await fetch(`${TANDOOR_URL}/api/meal-plan/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from_date: dateStr,
          to_date: dateStr,
          meal_type: { name: 'Abendessen' },
          recipe: { id: current.id, name: current.name },
          title: '',
          servings: 1,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const [, m, d] = dateStr.split('-')
      setSavedLabel(`✅ Eingetragen fuer ${d}.${m}.`)
      onAdded?.()
      setTimeout(() => advance('right'), 1300)
    } catch (err) {
      console.error('[RecipeSwipe] addToDay:', err)
      setSavedLabel('❌ Fehler beim Eintragen')
      setTimeout(() => setSavedLabel(null), 2000)
    } finally {
      setSaving(false)
    }
  }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 55) return
    if (dx < 0) advance('left')
    else setShowDayPicker(true)
  }

  return (
    <div className="rsc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rsc-modal">
        {/* Header */}
        <div className="rsc-header">
          <span className="rsc-title">🎲 Rezeptvorschlag</span>
          <button className="rsc-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="rsc-placeholder">Lade Rezepte…</div>
        ) : recipes.length === 0 ? (
          <div className="rsc-placeholder">Keine Rezepte in Tandoor gefunden.</div>
        ) : (
          <div
            className={`rsc-card${animDir === 'left' ? ' rsc-out-left' : animDir === 'right' ? ' rsc-out-right' : ''}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Bild */}
            {current?.image ? (
              <img src={current.image} alt={current.name} className="rsc-img" />
            ) : (
              <div className="rsc-noimg">🍽</div>
            )}

            {/* Name + Meta */}
            <div className="rsc-info">
              <h2 className="rsc-name">{current?.name}</h2>
              {current?.keywords?.length > 0 && (
                <div className="rsc-keywords">
                  {current.keywords.slice(0, 5).map(k => (
                    <span key={k.id} className="rsc-kw">{k.name}</span>
                  ))}
                </div>
              )}
              {current?.servings && (
                <p className="rsc-meta">{current.servings} Portionen</p>
              )}
            </div>

            {/* Saved-Meldung */}
            {savedLabel && <div className="rsc-saved">{savedLabel}</div>}

            {/* Aktionen */}
            {!savedLabel && (showDayPicker ? (
              <div className="rsc-daypicker">
                <p className="rsc-dp-label">Wann eintragen?</p>
                <div className="rsc-days">
                  {weekDays.map(d => (
                    <button
                      key={d.date}
                      className={`rsc-day${d.isToday ? ' rsc-day-today' : ''}`}
                      disabled={saving}
                      onClick={() => addToDay(d.date)}
                    >
                      <span className="rsc-day-label">{d.label}</span>
                      <span className="rsc-day-sub">{d.sub}</span>
                    </button>
                  ))}
                </div>
                <button className="rsc-back" onClick={() => setShowDayPicker(false)}>← Zurueck</button>
              </div>
            ) : (
              <div className="rsc-actions">
                <button className="rsc-btn rsc-skip" onClick={() => advance('left')}>
                  <span className="rsc-btn-icon">👎</span>
                  <span>Skip</span>
                </button>
                <button className="rsc-btn rsc-add" onClick={() => setShowDayPicker(true)}>
                  <span className="rsc-btn-icon">📅</span>
                  <span>Eintragen</span>
                </button>
                <button className="rsc-btn rsc-next" onClick={() => advance('right')}>
                  <span className="rsc-btn-icon">👍</span>
                  <span>Weiter</span>
                </button>
              </div>
            ))}

            {/* Hint + Zaehler */}
            {!showDayPicker && !savedLabel && (
              <p className="rsc-hint">← Skip &nbsp;|&nbsp; Eintragen →</p>
            )}
            <div className="rsc-counter">{idx + 1} / {recipes.length}</div>
          </div>
        )}
      </div>
    </div>
  )
}
