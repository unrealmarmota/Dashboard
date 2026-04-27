export function Card({ children, accent, className = '', onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-card border rounded-xl sm:rounded-[14px] p-3 sm:p-4 relative transition-colors ${accent ? 'border-amber-border' : 'border-border'} ${onClick ? 'cursor-pointer' : ''} ${className}`}>
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-[14px] bg-gradient-to-r from-amber to-transparent" />
      )}
      {children}
    </div>
  )
}
