export function Toggle({ on, onToggle }) {
  return (
    <div onClick={ev => { ev.stopPropagation(); onToggle() }}
      className={`w-[42px] h-6 rounded-xl cursor-pointer relative transition-colors shrink-0 ${on ? 'bg-amber' : 'bg-dim'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full transition-[left] duration-200 ${on ? 'left-[22px] bg-bg' : 'left-1 bg-slate-500'}`} />
    </div>
  )
}
