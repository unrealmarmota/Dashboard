import { useState, useEffect } from 'react'
import { Card, Label, Pill, InfoModal } from '../atoms'
import { useChores } from '../hooks/useChores'

// ── Constants ────────────────────────────────────────────────────────
const MEMBERS = [
  { id: 'johannes', name: 'Johannes', color: 'var(--color-blue)' },
  { id: 'tanja', name: 'Tanja', color: 'var(--color-teal)' },
]
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const RECURRENCE_LABELS = {
  daily: 'Taeglich', weekly: 'Woechentlich', biweekly: '2-Woechentlich',
  monthly: 'Monatlich', once: 'Einmalig',
}
const STARS = [1, 2, 3, 4, 5]

// ── Filter ────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'daily', label: 'Taeglich' },
  { id: 'weekly', label: 'Woechentl.' },
  { id: 'monthly', label: 'Monatl.' },
  { id: 'once', label: 'Einmalig' },
]

function FilterBar({ active, onChange }) {
  return (
    <div className="flex gap-1 mb-2.5 overflow-x-auto">
      {FILTERS.map(f => (
        <button key={f.id} onClick={(e) => { e.stopPropagation(); onChange(f.id) }}
          className={`px-2.5 py-1.5 rounded-lg text-[13px] font-mono border-none cursor-pointer whitespace-nowrap transition-colors ${
            active === f.id ? 'bg-amber/[0.15] text-amber font-semibold' : 'bg-surface text-text-muted'
          }`}>
          {f.label}
        </button>
      ))}
    </div>
  )
}

// ── Leaderboard ──────────────────────────────────────────────────────
function Leaderboard({ stats }) {
  if (!stats) return null
  const leading = stats.johannes?.weekPoints > stats.tanja?.weekPoints ? 'johannes'
    : stats.tanja?.weekPoints > stats.johannes?.weekPoints ? 'tanja' : null

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {MEMBERS.map(m => {
        const s = stats[m.id]
        if (!s) return null
        const isLeading = leading === m.id
        return (
          <div key={m.id}
            className={`text-center py-2.5 px-2 rounded-xl bg-surface ${isLeading ? 'ring-1 ring-amber/50' : ''}`}>
            <div className="text-[13px] font-mono text-text-muted">{m.name}</div>
            <div className="text-[22px] font-bold font-mono text-text-primary">{s.weekPoints}</div>
            <div className="text-[13px] text-text-muted font-mono">
              {s.streak > 0 ? `\uD83D\uDD25${s.streak}` : '\u2013'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── TaskRow (compact for card) ───────────────────────────────────────
function TaskRow({ task, onToggle }) {
  const memberColor = MEMBERS.find(m => m.id === task.assignee)?.color || 'var(--color-text-muted)'

  return (
    <div className={`flex items-center gap-2.5 p-2.5 px-3 rounded-xl bg-surface mb-2 ${task.overdue ? 'border border-red/[0.3]' : ''}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(task) }}
        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
          task.done ? 'border-green bg-green/[0.2] text-green' : 'border-border hover:border-amber'
        }`}
      >
        {task.done && <span className="text-[13px]">{'\u2713'}</span>}
      </button>
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: memberColor }} />
      <div className="flex-1 min-w-0">
        <span className={`text-[16px] ${task.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
          {task.title}
        </span>
      </div>
      {task.overdue && !task.done && <Pill color="red" small>Ueberfaellig</Pill>}
      <span className="text-[12px] text-text-muted font-mono flex-shrink-0">
        {'\u2B50'.repeat(Math.min(task.points || 1, 5))}
      </span>
    </div>
  )
}

// ── ModalTaskRow (larger for modal) ──────────────────────────────────
function ModalTaskRow({ task, onToggle }) {
  const memberColor = MEMBERS.find(m => m.id === task.assignee)?.color || 'var(--color-text-muted)'

  return (
    <div className={`flex items-center gap-3 p-3 px-4 rounded-xl bg-surface mb-2 ${task.overdue ? 'border border-red/[0.3]' : ''}`}>
      <button
        onClick={() => onToggle(task)}
        className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
          task.done ? 'border-green bg-green/[0.2] text-green' : 'border-border hover:border-amber'
        }`}
      >
        {task.done && <span className="text-base">{'\u2713'}</span>}
      </button>
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: memberColor }} />
      <div className="flex-1 min-w-0">
        <span className={`text-lg ${task.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
          {task.title}
        </span>
      </div>
      {task.overdue && !task.done && <Pill color="red">Ueberfaellig</Pill>}
      <span className="text-sm text-text-muted font-mono flex-shrink-0">
        {'\u2B50'.repeat(Math.min(task.points || 1, 5))}
      </span>
    </div>
  )
}

// ── ModalTabs ────────────────────────────────────────────────────────
function ModalTabs({ active, onChange }) {
  const tabs = [
    { id: 'week', label: 'Woche' },
    { id: 'stats', label: 'Stats' },
    { id: 'edit', label: 'Bearbeiten' },
  ]
  return (
    <div className="flex gap-1.5 mb-4 p-1 rounded-xl bg-dim">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex-1 py-2.5 rounded-lg text-base font-mono border-none cursor-pointer transition-all ${
            active === t.id ? 'bg-surface text-text-primary font-semibold shadow-sm' : 'bg-transparent text-text-muted'
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── WeekView ─────────────────────────────────────────────────────────
function WeekView({ weekData, onToggle }) {
  if (!weekData) return <div className="text-base text-text-muted font-mono py-3">Lade Woche...</div>

  const today = new Date().toLocaleDateString('sv-SE')

  return weekData.week.map((day, i) => {
    const isToday = day.date === today
    return (
      <div key={day.date}
        className={`p-3 px-4 rounded-xl mb-2 ${isToday ? 'bg-amber/[0.08] border border-amber/[0.2]' : 'bg-surface'}`}>
        <div className={`text-sm tracking-[1.5px] font-mono uppercase mb-2 ${isToday ? 'text-amber font-semibold' : 'text-text-muted'}`}>
          {WEEKDAYS[i]} {fmtDate(day.date)} {isToday && '\u00B7 Heute'}
        </div>
        {day.tasks.length > 0 ? day.tasks.map(t => (
          <ModalTaskRow key={`${t.id}-${day.date}`} task={t} onToggle={onToggle} />
        )) : (
          <div className="text-base text-text-muted italic">Keine Aufgaben</div>
        )}
      </div>
    )
  })
}

// ── StatsView ────────────────────────────────────────────────────────
function StatsView({ stats }) {
  if (!stats) return <div className="text-base text-text-muted font-mono py-3">Lade Stats...</div>

  const ALL_BADGES = [
    { id: 'first_task', name: 'Erster Schritt', icon: '\uD83C\uDF31' },
    { id: 'streak_3', name: 'Auf Kurs', icon: '\uD83D\uDD25' },
    { id: 'streak_7', name: 'Wochenmeister', icon: '\uD83C\uDFC6' },
    { id: 'streak_14', name: 'Unaufhaltsam', icon: '\uD83D\uDCAA' },
    { id: 'streak_30', name: 'Monatslegende', icon: '\uD83D\uDC51' },
    { id: 'points_50', name: 'Halbcenturio', icon: '\u2B50' },
    { id: 'points_100', name: 'Centurio', icon: '\uD83D\uDCAF' },
    { id: 'points_500', name: 'Haushaltsprofi', icon: '\uD83C\uDFC5' },
    { id: 'overdue_zero', name: 'Null Rueckstand', icon: '\u2705' },
  ]

  return (
    <>
      {/* Stat cards per member */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {MEMBERS.map(m => {
          const s = stats[m.id]
          if (!s) return null
          return (
            <div key={m.id} className="p-4 rounded-xl bg-surface border border-border">
              <div className="text-base font-semibold mb-3" style={{ color: m.color }}>{m.name}</div>
              <div className="grid grid-cols-2 gap-y-2 text-base font-mono">
                <div className="text-text-muted">Woche</div>
                <div className="text-text-primary font-bold text-right">{s.weekPoints}</div>
                <div className="text-text-muted">Monat</div>
                <div className="text-text-primary font-bold text-right">{s.monthPoints}</div>
                <div className="text-text-muted">Gesamt</div>
                <div className="text-text-primary font-bold text-right">{s.totalPoints}</div>
                <div className="text-text-muted">Streak</div>
                <div className="text-text-primary font-bold text-right">{'\uD83D\uDD25'}{s.streak}</div>
                <div className="text-text-muted">Best</div>
                <div className="text-text-primary font-bold text-right">{s.bestStreak}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Badge gallery */}
      <div className="text-sm tracking-[1.5px] text-text-muted font-mono mt-3 mb-2 uppercase">Badges</div>
      {MEMBERS.map(m => {
        const s = stats[m.id]
        if (!s) return null
        const earnedIds = new Set(s.badges.map(b => b.id))
        return (
          <div key={m.id} className="mb-3">
            <div className="text-base font-mono font-semibold mb-2" style={{ color: m.color }}>{m.name}</div>
            <div className="flex flex-wrap gap-2">
              {ALL_BADGES.map(b => {
                const earned = earnedIds.has(b.id)
                return (
                  <div key={b.id}
                    className={`px-3 py-1.5 rounded-lg text-sm font-mono border ${
                      earned ? 'bg-amber/[0.1] border-amber/[0.3] text-text-primary' : 'bg-dim border-border text-text-muted opacity-40'
                    }`}
                    title={b.name}>
                    {b.icon} {b.name}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── EditView ─────────────────────────────────────────────────────────
function EditView({ tasks, onFetchTasks, createTask, updateTask, deleteTask }) {
  const [form, setForm] = useState({
    title: '', assignee: null, recurrence: 'weekly', weekday: 0, monthday: 1, points: 2, dueDate: '',
  })
  const [editId, setEditId] = useState(null)

  useEffect(() => { onFetchTasks() }, [onFetchTasks])

  const resetForm = () => {
    setForm({ title: '', assignee: null, recurrence: 'weekly', weekday: 0, monthday: 1, points: 2, dueDate: '' })
    setEditId(null)
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    const data = { ...form }
    if (data.recurrence !== 'weekly' && data.recurrence !== 'biweekly') delete data.weekday
    if (data.recurrence !== 'monthly') delete data.monthday
    if (data.recurrence !== 'once') delete data.dueDate

    if (editId) {
      await updateTask(editId, data)
    } else {
      await createTask(data)
    }
    resetForm()
  }

  const startEdit = (task) => {
    setEditId(task.id)
    setForm({
      title: task.title,
      assignee: task.assignee,
      recurrence: task.recurrence,
      weekday: task.weekday ?? 0,
      monthday: task.monthday ?? 1,
      points: task.points || 1,
      dueDate: task.dueDate || '',
    })
  }

  return (
    <>
      {/* Form */}
      <div className="p-4 rounded-xl bg-surface border border-border mb-4">
        <div className="text-sm text-text-muted font-mono uppercase tracking-wider mb-3">
          {editId ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
        </div>

        <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Aufgabe..." onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-lg text-text-primary placeholder:text-text-muted font-sans outline-none focus:border-amber transition-colors mb-3" />

        {/* Assignee */}
        <div className="flex gap-2 mb-3">
          {[null, ...MEMBERS].map(m => {
            const id = m?.id ?? null
            const active = form.assignee === id
            return (
              <button key={id ?? 'none'} onClick={() => setForm(f => ({ ...f, assignee: id }))}
                className={`px-4 py-2 rounded-lg text-base font-mono border cursor-pointer transition-colors ${
                  active ? 'bg-amber/[0.15] border-amber/[0.3] text-amber' : 'bg-bg border-border text-text-muted'
                }`}>
                {m ? m.name : 'Beide'}
              </button>
            )
          })}
        </div>

        {/* Points */}
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-sm text-text-muted font-mono mr-2">Punkte:</span>
          {STARS.map(n => (
            <button key={n} onClick={() => setForm(f => ({ ...f, points: n }))}
              className={`text-2xl cursor-pointer bg-transparent border-none p-0 transition-opacity ${
                n <= form.points ? 'opacity-100' : 'opacity-25'
              }`}>
              {'\u2B50'}
            </button>
          ))}
        </div>

        {/* Recurrence */}
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(RECURRENCE_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setForm(f => ({ ...f, recurrence: key }))}
              className={`px-3 py-2 rounded-lg text-sm font-mono border cursor-pointer transition-colors ${
                form.recurrence === key ? 'bg-amber/[0.15] border-amber/[0.3] text-amber' : 'bg-bg border-border text-text-muted'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Weekday picker */}
        {(form.recurrence === 'weekly' || form.recurrence === 'biweekly') && (
          <div className="flex gap-1.5 mb-3">
            {WEEKDAYS.map((d, i) => (
              <button key={i} onClick={() => setForm(f => ({ ...f, weekday: i }))}
                className={`w-11 h-11 rounded-lg text-sm font-mono border cursor-pointer transition-colors ${
                  form.weekday === i ? 'bg-amber/[0.15] border-amber/[0.3] text-amber' : 'bg-bg border-border text-text-muted'
                }`}>
                {d}
              </button>
            ))}
          </div>
        )}

        {/* Monthday */}
        {form.recurrence === 'monthly' && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-text-muted font-mono">Tag:</span>
            <input type="number" min={1} max={28} value={form.monthday}
              onChange={e => setForm(f => ({ ...f, monthday: parseInt(e.target.value) || 1 }))}
              className="w-20 bg-bg border border-border rounded-xl px-3 py-2 text-base text-text-primary font-mono outline-none" />
          </div>
        )}

        {/* Due date */}
        {form.recurrence === 'once' && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-text-muted font-mono">Datum:</span>
            <input type="date" value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="bg-bg border border-border rounded-xl px-3 py-2 text-base text-text-primary font-mono outline-none" />
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-amber/[0.15] text-amber text-base font-semibold border border-amber/[0.25] hover:bg-amber/[0.25] transition-colors cursor-pointer">
            {editId ? 'Speichern' : 'Hinzufuegen'}
          </button>
          {editId && (
            <button onClick={resetForm}
              className="px-5 py-2.5 rounded-xl bg-dim text-text-muted text-base border border-border hover:text-text-primary transition-colors cursor-pointer">
              Abbrechen
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="text-sm tracking-[1.5px] text-text-muted font-mono mb-2 uppercase">Aufgaben ({tasks?.length || 0})</div>
      {tasks?.map(task => (
        <div key={task.id} className="flex items-center gap-3 p-3 px-4 rounded-xl bg-surface mb-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: MEMBERS.find(m => m.id === task.assignee)?.color || 'var(--color-text-muted)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-lg text-text-primary truncate">{task.title}</div>
            <div className="text-sm text-text-muted font-mono">
              {RECURRENCE_LABELS[task.recurrence] || task.recurrence}
              {task.weekday != null && ` \u00B7 ${WEEKDAYS[task.weekday]}`}
              {task.monthday && ` \u00B7 ${task.monthday}.`}
              {' \u00B7 '}{'\u2B50'.repeat(task.points || 1)}
            </div>
          </div>
          <button onClick={() => startEdit(task)}
            className="text-base text-text-muted hover:text-amber font-mono cursor-pointer bg-transparent border-none p-2">
            {'\u270F\uFE0F'}
          </button>
          <button onClick={() => deleteTask(task.id)}
            className="text-base text-text-muted hover:text-red font-mono cursor-pointer bg-transparent border-none p-2">
            {'\u2715'}
          </button>
        </div>
      ))}
    </>
  )
}

// ── Helper ───────────────────────────────────────────────────────────
function fmtDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${d}.${m}.`
}

// ── ChoresCard ──────────────────────────────────────────────────────

export function ChoresCard() {
  const {
    todayData, weekData, stats, tasks, loading, error,
    fetchWeek, fetchTasks, fetchStats,
    completeTask, uncompleteTask, createTask, updateTask, deleteTask,
  } = useChores()

  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState('week')
  const [filter, setFilter] = useState('all')

  const todayTasks = todayData?.tasks || []
  const filteredTasks = filter === 'all' ? todayTasks : todayTasks.filter(t => t.recurrence === filter)
  const openTasks = todayTasks.filter(t => !t.done)

  const handleToggle = async (task) => {
    if (task.done) {
      await uncompleteTask(task.id, task.dueDate)
    } else {
      await completeTask(task.id, task.dueDate, task.assignee)
    }
  }

  const handleOpenModal = () => {
    setShowModal(true)
    fetchWeek()
    fetchStats()
  }

  return (
    <>
      <Card className="cursor-pointer" onClick={handleOpenModal}>
        <div className="flex items-center gap-2 mb-1">
          <Label>Aufgaben</Label>
          {openTasks.length > 0 && <Pill color="amber" small>{openTasks.length}</Pill>}
        </div>

        <Leaderboard stats={stats} />

        {todayTasks.length > 0 && <FilterBar active={filter} onChange={setFilter} />}

        {loading && !todayTasks.length && (
          <div className="text-sm text-text-muted font-mono py-2">Lade Aufgaben...</div>
        )}

        {error && !todayTasks.length && (
          <div className="p-2.5 rounded-xl bg-red/[0.1] border border-red/[0.2] mb-2">
            <span className="text-[13px] font-mono text-red">{error}</span>
          </div>
        )}

        {/* Compact: max 20 tasks */}
        {filteredTasks.slice(0, 20).map(task => (
          <TaskRow key={task.id} task={task} onToggle={handleToggle} />
        ))}
        {filteredTasks.length > 20 && (
          <div className="text-[13px] text-text-muted mt-2 font-mono">
            + {filteredTasks.length - 20} weitere
          </div>
        )}

        {!loading && !todayTasks.length && !error && (
          <div className="text-[16px] text-text-muted py-1">Heute nichts zu tun {'\u{1F389}'}</div>
        )}
        {todayTasks.length > 0 && filteredTasks.length === 0 && (
          <div className="text-[14px] text-text-muted py-1 font-mono">Keine Aufgaben in dieser Kategorie</div>
        )}
      </Card>

      {showModal && (
        <InfoModal onClose={() => setShowModal(false)} wide>
          <div className="text-base tracking-[1.5px] text-text-muted font-mono mb-1 uppercase">Aufgaben</div>
          <ModalTabs active={modalTab} onChange={setModalTab} />

          {modalTab === 'week' && (
            <WeekView weekData={weekData} onToggle={handleToggle} />
          )}

          {modalTab === 'stats' && (
            <StatsView stats={stats} />
          )}

          {modalTab === 'edit' && (
            <EditView
              tasks={tasks}
              onFetchTasks={fetchTasks}
              createTask={createTask}
              updateTask={updateTask}
              deleteTask={deleteTask}
            />
          )}
        </InfoModal>
      )}
    </>
  )
}
