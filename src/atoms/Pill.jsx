const styles = {
  amber: 'bg-amber-dim text-amber border-amber-border',
  teal: 'bg-teal-dim text-teal border-teal-border',
  green: 'bg-green-dim text-green border-green-border',
  red: 'bg-red-dim text-red border-red-border',
}

export function Pill({ children, color = 'amber', small }) {
  return (
    <span className={`${small ? 'px-[7px] py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]'} rounded-full font-mono tracking-wider border shrink-0 ${styles[color]}`}>
      {children}
    </span>
  )
}
