export function Gauge({ value, max, color, size = 68, label, unit }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const r = size / 2 - 7
  const circ = Math.PI * r
  const dash = pct * circ
  return (
    <div className="flex flex-col items-center gap-[3px]">
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path d={`M 7,${size / 2} A ${r},${r} 0 0 1 ${size - 7},${size / 2}`}
          fill="none" stroke="var(--color-dim)" strokeWidth={5} strokeLinecap="round" />
        <path d={`M 7,${size / 2} A ${r},${r} 0 0 1 ${size - 7},${size / 2}`}
          fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1s' }} />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" fill="white"
          fontSize={12} fontWeight="700" fontFamily="var(--font-mono)">{value}</text>
        <text x={size / 2} y={size / 2 + 11} textAnchor="middle" fill="var(--color-text-muted)"
          fontSize={7} fontFamily="var(--font-mono)">{unit}</text>
      </svg>
      <div className="text-[9px] text-text-muted tracking-wider font-mono">{label}</div>
    </div>
  )
}
