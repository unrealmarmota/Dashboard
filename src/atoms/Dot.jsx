export function Dot({ on, color }) {
  const c = color || 'var(--color-teal)'
  return (
    <div
      className="w-2 h-2 rounded-full shrink-0 transition-all duration-300"
      style={{
        background: on ? c : 'var(--color-dim)',
        boxShadow: on ? `0 0 7px ${c}99` : 'none',
      }}
    />
  )
}
