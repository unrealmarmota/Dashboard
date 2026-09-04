import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Card, Label, Pill, InfoModal } from '../atoms'
import { useHA } from '../context/HAContext'
import { useTandoor } from '../hooks/useTandoor'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import { useChores } from '../hooks/useChores'
import { BRING_ENTITY } from '../config'

// ── Helpers ──────────────────────────────────────────────────────────

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

function getWeekDates(weekRange) {
  if (!weekRange) return []
  const dates = []
  const d = new Date(weekRange.monday)
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function isToday(date) {
  const today = new Date()
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
}

function fmtDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`
}

function dateKey(date) {
  // toLocaleDateString('sv-SE') liefert YYYY-MM-DD in lokaler Zeitzone (nicht UTC)
  // → verhindert +1-Tag-Versatz in CEST (UTC+2)
  return date.toLocaleDateString('sv-SE')
}

function recipeImageUrl(entry) {
  return entry.recipe?.image || null
}

// ── Entry Type Labels ───────────────────────────────────────────────

const ENTRY_TYPE_LABELS = {
  breakfast: 'Fruehstueck',
  lunch: 'Mittag',
  dinner: 'Abend',
  side: 'Beilage',
}

// ── Recipe Modal ────────────────────────────────────────────────────

function RecipeModal({ entry, onClose, getRecipe, onAddToBring }) {
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bringStatus, setBringStatus] = useState(null) // null | 'adding' | 'done' | 'error'

  useState(() => {
    if (!entry.recipe?.id) { setLoading(false); return }
    getRecipe(entry.recipe.id)
      .then(r => { setRecipe(r); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  })

  const imgUrl = recipe?.image || null

  return (
    <InfoModal onClose={onClose} wide>
      {loading && <div className="text-sm text-text-muted font-mono py-4">Lade Rezept...</div>}
      {error && <div className="text-sm text-red font-mono py-2">Fehler: {error}</div>}
      {recipe && (
        <>
          {imgUrl && (
            <img
              src={imgUrl}
              alt={recipe.name}
              className="w-full h-48 object-cover rounded-lg mb-3"
              onError={e => { e.target.style.display = 'none' }}
            />
          )}
          <Label>{recipe.name}</Label>

          {(recipe.working_time || recipe.waiting_time) && (
            <div className="text-sm text-text-muted font-mono mb-3">
              {recipe.working_time > 0 && `Zubereitung: ${recipe.working_time} Min`}
              {recipe.working_time > 0 && recipe.waiting_time > 0 && ' \u00B7 '}
              {recipe.waiting_time > 0 && `Wartezeit: ${recipe.waiting_time} Min`}
            </div>
          )}

          {recipe.recipeIngredient?.length > 0 && (
            <>
              <div className="flex items-center justify-between mt-3 mb-1.5">
                <div className="text-xs tracking-[1.5px] text-text-muted font-mono uppercase">Zutaten</div>
                {onAddToBring && (
                  <button
                    onClick={async () => {
                      setBringStatus('adding')
                      try {
                        const items = recipe.recipeIngredient
                          .map(ing => ing.display || ing.note || (typeof ing === 'string' ? ing : null))
                          .filter(Boolean)
                        const result = await onAddToBring(items)
                        setBringStatus(result?.skipped > 0 ? `done:${result.added}:${result.skipped}` : 'done')
                      } catch { setBringStatus('error') }
                    }}
                    disabled={bringStatus === 'adding' || bringStatus?.startsWith('done')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border cursor-pointer transition-colors ${
                      bringStatus?.startsWith('done')
                        ? 'bg-green/[0.15] border-green/[0.25] text-green'
                        : bringStatus === 'error'
                          ? 'bg-red/[0.15] border-red/[0.25] text-red'
                          : 'bg-teal/[0.15] border-teal/[0.25] text-teal hover:bg-teal/[0.25]'
                    } disabled:opacity-60`}
                  >
                    {bringStatus === 'adding' ? 'Wird hinzugefuegt...'
                      : bringStatus?.startsWith('done:') ? (() => { const [,a,s] = bringStatus.split(':'); return `\u2713 ${a} hinzugefuegt, ${s} uebersprungen` })()
                      : bringStatus === 'done' ? '\u2713 Auf der Liste'
                      : bringStatus === 'error' ? 'Fehler'
                      : '\uD83D\uDED2 Auf Einkaufsliste'}
                  </button>
                )}
              </div>
              {recipe.recipeIngredient.map((ing, i) => (
                <div key={i} className="text-[15px] text-text-primary py-0.5 border-b border-border/50 last:border-0">
                  {ing.display || ing.note || ing}
                </div>
              ))}
            </>
          )}

          {recipe.recipeInstructions?.length > 0 && (
            <>
              <div className="text-xs tracking-[1.5px] text-text-muted font-mono mt-3 mb-1.5 uppercase">Zubereitung</div>
              {recipe.recipeInstructions.map((step, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <span className="text-sm text-amber font-mono font-semibold mt-0.5">{i + 1}.</span>
                  <span className="text-[15px] text-text-primary leading-relaxed">{step.text}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
      {!loading && !error && !recipe && (
        <div className="text-base text-text-primary py-2">
          {entry.title || entry.recipe?.name || 'Kein Rezept'}
        </div>
      )}
    </InfoModal>
  )
}

// ── Day Row (vertical / default) ─────────────────────────────────────

function DayRow({ date, entries, dayIdx, onEntryClick }) {
  const today = isToday(date)

  return (
    <div className={`p-2 px-2.5 rounded-[9px] mb-1.5 ${today ? 'bg-amber/[0.08] border border-amber/[0.2]' : 'bg-surface'}`}>
      <div className={`text-[11px] tracking-[1.5px] font-mono uppercase mb-1 ${today ? 'text-amber font-semibold' : 'text-text-muted'}`}>
        {WEEKDAYS[dayIdx]} {fmtDate(date)} {today && '\u00B7 Heute'}
      </div>
      {entries.length > 0 ? entries.map((entry, i) => (
        <div
          key={entry.id || i}
          onClick={() => onEntryClick(entry)}
          className="flex items-center gap-2 py-1 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {recipeImageUrl(entry) && (
            <img
              src={recipeImageUrl(entry)}
              alt=""
              className="w-8 h-8 rounded-md object-cover flex-shrink-0"
              onError={e => { e.target.style.display = 'none' }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[14px] text-text-primary truncate">
              {entry.title || entry.recipe?.name || 'Kein Titel'}
            </div>
            {entry.entryType && entry.entryType !== 'dinner' && (
              <span className="text-[11px] text-text-muted font-mono">
                {ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType}
              </span>
            )}
          </div>
        </div>
      )) : (
        <div className="text-[13px] text-text-muted italic">Kein Plan</div>
      )}
    </div>
  )
}

// ── Inline Add Input with Recipe Search ──────────────────────────────

function AddNoteInput({ date, onAdd, onSearch }) {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const searchTimeout = useState({ current: null })[0]

  const handleChange = (text) => {
    setValue(text)
    // Debounced recipe search
    clearTimeout(searchTimeout.current)
    if (text.trim().length >= 2 && onSearch) {
      searchTimeout.current = setTimeout(async () => {
        const found = await onSearch(text.trim())
        setResults(found)
        setShowResults(found.length > 0)
      }, 300)
    } else {
      setResults([])
      setShowResults(false)
    }
  }

  const submitNote = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      await onAdd(date, trimmed)
      setValue('')
      setShowResults(false)
    } catch { /* ignore */ }
    setAdding(false)
  }

  const selectRecipe = async (recipe) => {
    setAdding(true)
    setShowResults(false)
    try {
      await onAdd(date, '', 'dinner', recipe.id)
      setValue('')
      setResults([])
    } catch { /* ignore */ }
    setAdding(false)
  }

  return (
    <div className="relative mt-1.5">
      <div className="flex gap-1">
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitNote()}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          onClick={e => e.stopPropagation()}
          placeholder="Rezept oder Notiz..."
          disabled={adding}
          className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-2 py-1 text-sm text-text-primary placeholder:text-text-muted font-sans outline-none focus:border-teal transition-colors"
        />
        <button
          onClick={(e) => { e.stopPropagation(); submitNote() }}
          disabled={adding}
          className="px-2 py-1 rounded-lg bg-teal/[0.15] text-teal text-sm font-semibold border border-teal/[0.25] hover:bg-teal/[0.25] transition-colors cursor-pointer disabled:opacity-50"
        >
          +
        </button>
      </div>
      {/* Recipe search results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute left-0 right-0 bottom-full mb-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
          <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider px-2 pt-1.5 pb-0.5">Rezepte</div>
          {results.map(r => (
            <button
              key={r.id}
              onMouseDown={(e) => { e.preventDefault(); selectRecipe(r) }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-surface transition-colors cursor-pointer bg-transparent border-none"
            >
              {r.image && (
                <img
                  src={r.image}
                  alt=""
                  className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
              <span className="text-sm text-text-primary truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Abschnitte innerhalb einer Tagesspalte (Wochenplan) ─────────────

function SectionHead({ children }) {
  return (
    <div className="text-[10px] tracking-[1.2px] text-text-muted font-mono uppercase mt-2.5 mb-1 opacity-70">
      {children}
    </div>
  )
}

function EventRow({ ev }) {
  const time = ev.allDay
    ? 'ganzt\u00E4gig'
    : ev.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="flex gap-1.5 py-1 border-b border-border/30 last:border-0"
      style={{ borderLeft: `2px solid ${ev.color}`, paddingLeft: 6 }}>
      <div className="min-w-0">
        <div className="text-[11px] font-mono" style={{ color: ev.color }}>{time}</div>
        <div className="text-[13px] text-text-primary leading-snug line-clamp-2">{ev.summary || 'Kein Titel'}</div>
      </div>
    </div>
  )
}

function TaskRowMini({ task, date, onToggle }) {
  return (
    <div className="flex items-start gap-2 py-1 border-b border-border/30 last:border-0">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(task, date) }}
        className={`w-5 h-5 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[11px] transition-colors cursor-pointer ${
          task.done ? 'border-green bg-green/[0.2] text-green' : 'border-border hover:border-amber'
        }`}
        title={task.done ? 'Erledigt' : 'Als erledigt markieren'}
      >
        {task.done && '\u2713'}
      </button>
      <span className={`text-[13px] leading-snug line-clamp-2 ${
        task.done ? 'line-through text-text-muted' : task.overdue ? 'text-red' : 'text-text-primary'
      }`}>{task.title}</span>
    </div>
  )
}

// ── Day Column (horizontal mode) with tap-to-move ───────────────────

function EntryRow({ entry, movingEntry, onEntryClick, onSelectEntry, onDeleteEntry }) {
  const isSelected = movingEntry?.id === entry.id
  const longPressRef = useRef(null)

  const handleTouchStart = (e) => {
    if (movingEntry) return
    longPressRef.current = setTimeout(() => {
      longPressRef.current = 'fired'
      if (navigator.vibrate) navigator.vibrate(30)
      onSelectEntry({ ...entry })
    }, 400)
  }

  const handleTouchEnd = (e) => {
    if (longPressRef.current === 'fired') {
      e.preventDefault()
      longPressRef.current = null
      return
    }
    clearTimeout(longPressRef.current)
    longPressRef.current = null
  }

  const handleTouchMove = () => {
    if (longPressRef.current && longPressRef.current !== 'fired') {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  const handleClick = (e) => {
    e.stopPropagation()
    if (movingEntry) {
      if (isSelected) onSelectEntry(null)
      return
    }
    onEntryClick(entry)
  }

  return (
    <div
      className={`flex items-start gap-2 py-1.5 transition-all border-b border-border/30 last:border-0 group select-none ${
        isSelected
          ? 'bg-teal/[0.12] rounded-lg px-1.5 -mx-1.5 border-teal/[0.3]'
          : movingEntry ? 'opacity-40' : 'hover:opacity-80'
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
    >
      {recipeImageUrl(entry) && (
        <img
          src={recipeImageUrl(entry)}
          alt=""
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 cursor-pointer">
        <div className={`text-[15px] leading-snug line-clamp-2 ${isSelected ? 'text-teal font-semibold' : 'text-text-primary'}`}>
          {isSelected && '\u{21C4} '}{entry.title || entry.recipe?.name || 'Kein Titel'}
        </div>
        {isSelected && (
          <span className="text-xs text-teal font-mono">Ziel-Tag antippen</span>
        )}
        {!isSelected && entry.entryType && entry.entryType !== 'dinner' && (
          <span className="text-xs text-text-muted font-mono">
            {ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType}
          </span>
        )}
      </div>
      {!movingEntry && (
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
          className="text-sm text-text-muted/60 hover:text-red active:text-red font-mono cursor-pointer bg-transparent border-none p-2 -mr-1 flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
          title="Loeschen"
        >
          {'\u2715'}
        </button>
      )}
    </div>
  )
}

function DayColumn({ date, entries, dayIdx, onEntryClick, onAddNote, onDeleteEntry, onSearch, movingEntry, onSelectEntry, onMoveToDay, agenda, events = [], tasks = [], onToggleTask }) {
  const today = isToday(date)
  const isTarget = movingEntry && movingEntry.date !== dateKey(date)

  const handleDayClick = () => {
    if (isTarget) onMoveToDay(dateKey(date))
  }

  return (
    <div
      onClick={handleDayClick}
      className={`flex-1 ${agenda ? 'min-w-[158px]' : 'min-w-[140px]'} p-2.5 rounded-xl flex flex-col transition-all snap-start ${
        isTarget
          ? 'bg-teal/[0.08] border-2 border-dashed border-teal/[0.35] cursor-pointer'
          : today
            ? 'bg-amber/[0.08] border border-amber/[0.25] shadow-sm'
            : 'bg-surface border border-transparent'
      }`}
    >
      <div className={`text-xs tracking-[1.5px] font-mono uppercase mb-2 ${
        isTarget ? 'text-teal font-bold' : today ? 'text-amber font-bold' : 'text-text-muted font-medium'
      }`}>
        {isTarget ? `\u2192 ${WEEKDAYS_LONG[dayIdx]}` : WEEKDAYS_LONG[dayIdx]}
        <span className="block text-[11px] font-normal mt-0.5 opacity-70">
          {fmtDate(date)}
        </span>
      </div>
      <div className="flex-1">
        {agenda && <SectionHead>Essen</SectionHead>}
        {entries.length > 0 ? entries.map((entry, i) => (
          <EntryRow
            key={entry.id || i}
            entry={{ ...entry, date: dateKey(date) }}
            movingEntry={movingEntry}
            onEntryClick={onEntryClick}
            onSelectEntry={onSelectEntry}
            onDeleteEntry={onDeleteEntry}
          />
        )) : (
          <div className="text-sm text-text-muted italic py-1">Kein Plan</div>
        )}

        {agenda && (
          <>
            <SectionHead>Termine</SectionHead>
            {events.length > 0
              ? events.map((ev, i) => <EventRow key={`${ev.summary}-${i}`} ev={ev} />)
              : <div className="text-[13px] text-text-muted italic py-1">Keine</div>}

            <SectionHead>Aufgaben</SectionHead>
            {tasks.length > 0
              ? tasks.map(t => <TaskRowMini key={t.id} task={t} date={dateKey(date)} onToggle={onToggleTask} />)
              : <div className="text-[13px] text-text-muted italic py-1">Keine</div>}
          </>
        )}
      </div>
      {!movingEntry && <AddNoteInput date={dateKey(date)} onAdd={onAddNote} onSearch={onSearch} />}
      {isTarget && (
        <div className="text-xs text-teal font-mono text-center mt-2 animate-pulse">Hierhin verschieben</div>
      )}
    </div>
  )
}

// ── MealPlanCard ────────────────────────────────────────────────────

export function MealPlanCard({ horizontal = false, agenda = false }) {
  const { mealPlan, weekRange, loading, error, getRecipe, addMealPlanEntry, deleteMealPlanEntry, moveMealPlanEntry, searchRecipes } = useTandoor()
  const { sendMessage } = useHA()
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [movingEntry, setMovingEntry] = useState(null)
  const weekDates = getWeekDates(weekRange)

  // Wochenplan: Termine + Aufgaben derselben Woche dazuholen
  const { events: gcalEvents } = useGoogleCalendar(8, agenda)
  const { weekData, fetchWeek, completeTask, uncompleteTask } = useChores(agenda)
  useEffect(() => { if (agenda) fetchWeek() }, [agenda, fetchWeek])

  // Termine nach Tag buendeln (nur im Agenda-Modus)
  const eventsByDay = useMemo(() => {
    if (!agenda) return {}
    const m = {}
    for (const ev of gcalEvents) (m[dateKey(ev.start)] ||= []).push(ev)
    return m
  }, [agenda, gcalEvents])

  // Aufgaben nach Tag – die Chores-API liefert die Woche bereits so
  const tasksByDay = useMemo(() => {
    const m = {}
    for (const day of weekData?.week ?? []) m[day.date] = day.tasks ?? []
    return m
  }, [weekData])

  const handleToggleTask = useCallback(async (task, date) => {
    if (task.done) await uncompleteTask(task.id, date)
    else await completeTask(task.id, date, task.assignee)
    await fetchWeek()
  }, [completeTask, uncompleteTask, fetchWeek])

  const addToBring = useCallback(async (items) => {
    // Fetch existing Bring! items to avoid duplicates
    let existingNames = new Set()
    try {
      const result = await sendMessage({ type: 'todo/item/list', entity_id: BRING_ENTITY })
      const existing = result?.items ?? []
      existingNames = new Set(
        existing
          .filter(i => i.status === 'needs_action')
          .map(i => i.summary.toLowerCase().trim())
      )
    } catch { /* proceed without dedup if fetch fails */ }

    let added = 0
    let skipped = 0
    for (const item of items) {
      const clean = item.slice(0, 100)
      // Check if item (or its core ingredient) is already on the list
      const lower = clean.toLowerCase().trim()
      if (existingNames.has(lower)) { skipped++; continue }
      // Also check if any existing item contains this ingredient name or vice versa
      const isDuplicate = [...existingNames].some(existing =>
        existing.includes(lower) || lower.includes(existing)
      )
      if (isDuplicate) { skipped++; continue }

      await sendMessage({
        type: 'call_service', domain: 'todo', service: 'add_item',
        service_data: { item: clean },
        target: { entity_id: BRING_ENTITY },
      })
      existingNames.add(lower)
      added++
    }
    return { added, skipped }
  }, [sendMessage])

  const handleMoveToDay = useCallback(async (targetDate) => {
    if (!movingEntry) return
    await moveMealPlanEntry(movingEntry, targetDate)
    setMovingEntry(null)
  }, [movingEntry, moveMealPlanEntry])

  // Kalenderwoche berechnen
  const kwLabel = weekRange
    ? `KW ${getISOWeek(weekRange.monday)}`
    : ''

  // ── Horizontal layout ──────────────────────────────────────────────
  if (horizontal) {
    return (
      <>
        <Card>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="text-sm tracking-[1.5px] text-text-muted font-mono uppercase">{agenda ? 'Wochenplan' : 'Essensplan'}</div>
            {kwLabel && !movingEntry && <Pill color="teal">{kwLabel}</Pill>}
            {movingEntry && (
              <button
                onClick={() => setMovingEntry(null)}
                className="ml-auto px-3 py-1 rounded-lg bg-dim text-text-muted text-sm font-mono border border-border hover:text-text-primary transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
            )}
          </div>

          {loading && (
            <div className="text-sm text-text-muted font-mono py-3">Lade Essensplan...</div>
          )}

          {error && (
            <div className="p-2 rounded-lg bg-red/[0.1] border border-red/[0.2] mb-2">
              <span className="text-sm font-mono text-red">{error}</span>
            </div>
          )}

          {/* Horizontal scroll for days — min-width per column for mobile readability */}
          {!loading && weekDates.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
              {weekDates.map((date, i) => (
                <DayColumn
                  key={dateKey(date)}
                  date={date}
                  dayIdx={i}
                  entries={mealPlan[dateKey(date)] ?? []}
                  onEntryClick={setSelectedEntry}
                  onAddNote={addMealPlanEntry}
                  onDeleteEntry={deleteMealPlanEntry}
                  onSearch={searchRecipes}
                  movingEntry={movingEntry}
                  onSelectEntry={setMovingEntry}
                  onMoveToDay={handleMoveToDay}
                  agenda={agenda}
                  events={eventsByDay[dateKey(date)] ?? []}
                  tasks={tasksByDay[dateKey(date)] ?? []}
                  onToggleTask={handleToggleTask}
                />
              ))}
            </div>
          )}
        </Card>

        {selectedEntry && (
          <RecipeModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} getRecipe={getRecipe} onAddToBring={addToBring} />
        )}
      </>
    )
  }

  // ── Default vertical layout ────────────────────────────────────────
  return (
    <>
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Label>Essensplan</Label>
          {kwLabel && <Pill color="teal" small>{kwLabel}</Pill>}
        </div>

        {loading && (
          <div className="text-xs text-text-muted font-mono py-2">Lade Essensplan...</div>
        )}

        {error && (
          <div className="p-2 rounded-lg bg-red/[0.1] border border-red/[0.2] mb-2">
            <span className="text-[12px] font-mono text-red">{error}</span>
          </div>
        )}

        {!loading && weekDates.map((date, i) => (
          <DayRow
            key={dateKey(date)}
            date={date}
            dayIdx={i}
            entries={mealPlan[dateKey(date)] ?? []}
            onEntryClick={setSelectedEntry}
          />
        ))}
      </Card>

      {selectedEntry && (
        <RecipeModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} getRecipe={getRecipe} onAddToBring={addToBring} />
      )}
    </>
  )
}

// ── ISO Week ────────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil((((d - yearStart) / 86400000) + yearStart.getDay() + 1) / 7)
}
