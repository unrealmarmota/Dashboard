import { useState, useRef, useCallback, useEffect } from 'react'

export function DimmerSlider({ brightness, onChange, disabled, dimmed }) {
  const [local, setLocal] = useState(brightness)
  const dragging = useRef(false)
  const timerRef = useRef(null)

  // Sync from HA when not dragging
  useEffect(() => {
    if (!dragging.current) setLocal(brightness)
  }, [brightness])

  const commit = useCallback((val) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(val), 150)
  }, [onChange])

  const onInput = (ev) => {
    const val = parseInt(ev.target.value)
    dragging.current = true
    setLocal(val)
    commit(val)
  }

  const onEnd = () => {
    clearTimeout(timerRef.current)
    onChange(local)
    // Keep dragging flag a bit longer so incoming HA state doesn't flicker
    setTimeout(() => { dragging.current = false }, 400)
  }

  const pct = Math.round((local / 255) * 100)
  const isVisuallyOff = dimmed || disabled
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="text-sm text-text-muted min-w-3.5">{'\uD83C\uDF11'}</span>
      <div className="flex-1 relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-sm bg-dim" />
        <div className="absolute left-0 h-1 rounded-sm transition-[width] duration-100"
          style={{ width: `${pct}%`, background: isVisuallyOff ? 'var(--color-dim)' : 'linear-gradient(90deg, #d97706, var(--color-amber))' }} />
        <input type="range" min={0} max={255} value={local}
          onInput={onInput}
          onMouseUp={onEnd} onTouchEnd={onEnd}
          onClick={ev => ev.stopPropagation()}
          onMouseDown={() => { dragging.current = true }}
          onTouchStart={() => { dragging.current = true }}
          className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-5 m-0 p-0" />
      </div>
      <span className="text-sm text-text-muted">{'\u2600\uFE0F'}</span>
      <span className={`text-[13px] font-mono min-w-8 text-right ${isVisuallyOff ? 'text-dim' : 'text-amber'}`}>
        {isVisuallyOff && pct === 0 ? '\u2014' : `${pct}%`}
      </span>
    </div>
  )
}
