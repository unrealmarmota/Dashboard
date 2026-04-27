export function AutarkieGauge({ value, size = 90 }) {
  const pct = Math.max(0, Math.min(100, value))
  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct > 80 ? 'var(--color-green)' : pct > 40 ? 'var(--color-amber)' : 'var(--color-red)'
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-dim)" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 1s, stroke 0.5s' }} />
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill="white"
          fontSize={22} fontWeight="800" fontFamily="'Outfit', sans-serif">{Math.round(pct)}%</text>
        <text x={size / 2} y={size / 2 + 10} textAnchor="middle" fill="var(--color-text-muted)"
          fontSize={9} fontFamily="var(--font-mono)">AUTARKIE</text>
      </svg>
    </div>
  )
}
