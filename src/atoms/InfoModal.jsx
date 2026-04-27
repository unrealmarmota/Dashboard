import { useEffect } from 'react'

export function InfoModal({ onClose, children, wide, extraWide }) {
  useEffect(() => {
    const handleKey = (ev) => { if (ev.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative bg-card border border-border rounded-2xl p-5 sm:p-6 ${extraWide ? 'max-w-[900px]' : wide ? 'max-w-[520px]' : 'max-w-[320px]'} w-full max-h-[90vh] overflow-y-auto`}
        style={{ animation: 'modalIn 0.15s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Schliessen"
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border text-text-muted text-base cursor-pointer hover:text-text-primary transition-colors">{'\u2715'}</button>
        <div className="pr-8">
          {children}
        </div>
      </div>
    </div>
  )
}
