import { useState, useEffect, useCallback } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, Pill, InfoModal } from '../atoms'
import { BRING_ENTITY } from '../config'

// ── Helpers ──────────────────────────────────────────────────────────

function ItemRow({ item, onToggle, onDelete, completed }) {
  return (
    <div className={`flex items-center gap-2 p-2 px-2.5 rounded-[9px] bg-surface mb-1.5 group ${completed ? 'opacity-50' : ''}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(item) }}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
          completed
            ? 'border-green bg-green/[0.2] text-green'
            : 'border-border hover:border-amber'
        }`}
      >
        {completed && <span className="text-[11px]">{'\u2713'}</span>}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-[14px] ${completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>
          {item.summary}
        </span>
        {item.description && (
          <span className="text-[12px] text-text-muted ml-1.5">{item.description}</span>
        )}
      </div>
      {completed && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item) }}
          className="text-[11px] text-text-muted hover:text-red font-mono opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {'\u2715'}
        </button>
      )}
    </div>
  )
}

// ── AddInput ────────────────────────────────────────────────────────

function AddInput({ onAdd }) {
  const [value, setValue] = useState('')

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <div className="flex gap-1.5 mb-2.5">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Artikel hinzufuegen..."
        className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-[14px] text-text-primary placeholder:text-text-muted font-sans outline-none focus:border-amber transition-colors"
      />
      <button
        onClick={submit}
        className="px-3 py-1.5 rounded-lg bg-amber/[0.15] text-amber text-[14px] font-semibold border border-amber/[0.25] hover:bg-amber/[0.25] transition-colors cursor-pointer"
      >
        +
      </button>
    </div>
  )
}

// ── BringCard ───────────────────────────────────────────────────────

export function BringCard() {
  const { sendMessage, connected } = useHA()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      const result = await sendMessage({ type: 'todo/item/list', entity_id: BRING_ENTITY })
      setItems(result?.items ?? [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [sendMessage])

  useEffect(() => {
    if (!connected) return
    fetchItems()
    const iv = setInterval(fetchItems, 30_000) // 30s Polling
    return () => clearInterval(iv)
  }, [connected, fetchItems])

  const addItem = useCallback(async (name) => {
    try {
      await sendMessage({
        type: 'call_service', domain: 'todo', service: 'add_item',
        service_data: { item: name },
        target: { entity_id: BRING_ENTITY },
      })
      await fetchItems()
    } catch (err) {
      setError(err.message)
    }
  }, [sendMessage, fetchItems])

  const toggleItem = useCallback(async (item) => {
    const newStatus = item.status === 'completed' ? 'needs_action' : 'completed'
    try {
      await sendMessage({
        type: 'call_service', domain: 'todo', service: 'update_item',
        service_data: { item: item.uid, rename: item.summary, status: newStatus },
        target: { entity_id: BRING_ENTITY },
      })
      await fetchItems()
    } catch (err) {
      setError(err.message)
    }
  }, [sendMessage, fetchItems])

  const deleteItem = useCallback(async (item) => {
    try {
      await sendMessage({
        type: 'call_service', domain: 'todo', service: 'remove_item',
        service_data: { item: item.uid },
        target: { entity_id: BRING_ENTITY },
      })
      await fetchItems()
    } catch (err) {
      setError(err.message)
    }
  }, [sendMessage, fetchItems])

  const pending = items.filter(i => i.status === 'needs_action')
  const completed = items.filter(i => i.status === 'completed')

  // ── Shared list rendering ─────────────────────────────────────────

  const renderList = (showInput) => (
    <>
      {showInput && <AddInput onAdd={addItem} />}

      {error && (
        <div className="p-2 rounded-lg bg-red/[0.1] border border-red/[0.2] mb-2">
          <span className="text-[12px] font-mono text-red">{error}</span>
        </div>
      )}

      {loading && !items.length && (
        <div className="text-xs text-text-muted font-mono py-2">Lade Liste...</div>
      )}

      {!loading && !pending.length && !completed.length && (
        <div className="text-[14px] text-text-muted py-2">Liste ist leer</div>
      )}

      {pending.map(item => (
        <ItemRow key={item.uid} item={item} onToggle={toggleItem} onDelete={deleteItem} completed={false} />
      ))}

      {completed.length > 0 && (
        <>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-[12px] text-text-muted font-mono mt-2 mb-1 hover:text-text-primary transition-colors cursor-pointer bg-transparent border-none p-0"
          >
            {showCompleted ? '\u25BE' : '\u25B8'} Erledigt ({completed.length})
          </button>
          {showCompleted && completed.map(item => (
            <ItemRow key={item.uid} item={item} onToggle={toggleItem} onDelete={deleteItem} completed />
          ))}
        </>
      )}
    </>
  )

  return (
    <>
      <Card className="cursor-pointer" onClick={() => setShowModal(true)}>
        <div className="flex items-center gap-2 mb-1">
          <Label>Einkaufsliste</Label>
          {pending.length > 0 && <Pill color="amber" small>{pending.length}</Pill>}
        </div>

        {/* Kompakt: max 6 Items */}
        {pending.slice(0, 6).map(item => (
          <ItemRow key={item.uid} item={item} onToggle={toggleItem} onDelete={deleteItem} completed={false} />
        ))}

        {pending.length > 6 && (
          <div className="text-[12px] text-text-muted mt-1.5 font-mono">
            + {pending.length - 6} weitere
          </div>
        )}

        {loading && !items.length && (
          <div className="text-xs text-text-muted font-mono py-2">Lade Liste...</div>
        )}

        {!loading && !pending.length && (
          <div className="text-[14px] text-text-muted py-1">Alles erledigt {'\u2713'}</div>
        )}
      </Card>

      {showModal && (
        <InfoModal onClose={() => setShowModal(false)}>
          <Label>Einkaufsliste</Label>
          <div className="text-[12px] text-text-muted font-mono mb-3">
            {pending.length} offen {completed.length > 0 && `\u00B7 ${completed.length} erledigt`}
          </div>
          {renderList(true)}
        </InfoModal>
      )}
    </>
  )
}
