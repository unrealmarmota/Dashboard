import { useState, useRef, useCallback, useEffect } from 'react'
import { HAProvider, useHA } from './context/HAContext'
import { SettingsProvider } from './context/SettingsContext'
import { Ribbon } from './layout/Ribbon'
import { TabBar } from './layout/TabBar'
import { TabOben } from './tabs/TabOben'
import { TabUnten } from './tabs/TabUnten'
import { TabInfos } from './tabs/TabInfos'
import { TabRoboter } from './tabs/TabRoboter'
import { TabFamilie } from './tabs/TabFamilie'
import { HA_URL, CHORES_URL } from './config'

const TAB_ORDER = ['oben', 'unten', 'infos', 'familie']

// Lightweight poll for open chore count (independent of TabFamilie)
function useOpenChoreCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`${CHORES_URL}/api/today`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setCount((data.tasks || []).filter(t => !t.done).length)
      } catch { /* ignore */ }
    }
    poll()
    const iv = setInterval(poll, 60_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])
  return count
}
const WATER_CHANGE_INTERVAL = 21 // Tage
const WATER_CHANGE_ENTITY = 'input_datetime.aquarium_wasserwechsel'
const FILTER_WARN_DAYS = 14

function FilterMaintenanceReminder() {
  const { entities } = useHA()
  const daysLeft = parseFloat(entities?.['sensor.filter_reststunden_bis_zur_wartung']?.state)
  if (isNaN(daysLeft) || daysLeft > FILTER_WARN_DAYS) return null
  const urgent = daysLeft <= 3
  return (
    <div className={`mx-3 sm:mx-5 md:mx-8 mt-2 p-2.5 px-3.5 rounded-xl border select-none max-w-[1200px] lg:mx-auto flex items-center gap-2.5 ${urgent ? 'bg-red/[0.12] border-red/[0.25]' : 'bg-amber/[0.12] border-amber/[0.25]'}`}>
      <span className="text-lg">{'\uD83D\uDC20'}</span>
      <div className="flex-1">
        <div className={`text-[13px] font-semibold font-mono ${urgent ? 'text-red' : 'text-amber'}`}>
          Filter-Wartung {daysLeft <= 0 ? 'überfällig!' : `in ${Math.round(daysLeft)} Tagen`}
        </div>
        <div className="text-[11px] text-text-muted font-mono">
          EHEIM Digital {'\u00B7'} Modus: {entities?.['select.filter_filtermodus']?.state || '\u2013'}
        </div>
      </div>
      {urgent && <span className="text-lg">{'\u26A0\uFE0F'}</span>}
    </div>
  )
}

function AquariumReminder() {
  const { entities, callService } = useHA()
  const ent = entities?.[WATER_CHANGE_ENTITY]
  const lastDate = ent?.state // Format: "2026-03-12"

  // Tage seit letztem Wechsel berechnen
  let daysAgo = 99
  if (lastDate && lastDate !== 'unknown') {
    const last = new Date(lastDate + 'T00:00:00')
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    daysAgo = Math.floor((now - last) / 86400000)
  }

  const show = daysAgo >= WATER_CHANGE_INTERVAL

  const dismiss = () => {
    const today = new Date()
    callService('input_datetime', 'set_datetime', {
      entity_id: WATER_CHANGE_ENTITY,
      date: today.toISOString().slice(0, 10)
    })
  }

  if (!show) return null
  return (
    <div onClick={dismiss}
      className="mx-3 sm:mx-5 md:mx-8 mt-2 p-2.5 px-3.5 rounded-xl bg-blue/[0.12] border border-blue/[0.25] cursor-pointer select-none max-w-[1200px] lg:mx-auto flex items-center gap-2.5 transition-opacity hover:opacity-80">
      <span className="text-lg">{'\uD83D\uDC1F'}</span>
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-blue font-mono">Aquarium Wasserwechsel fällig!</div>
        <div className="text-[11px] text-text-muted font-mono">
          {daysAgo >= 99 ? 'Noch nie eingetragen' : `Letzter Wechsel vor ${daysAgo} Tagen`} {'\u00B7'} Antippen = erledigt
        </div>
      </div>
      <span className="text-[11px] text-blue font-mono">{'\u2713'}</span>
    </div>
  )
}

function SkeletonBar({ w = '100%', h = '12px', className = '' }) {
  return <div className={`rounded-md bg-dim animate-pulse ${className}`} style={{ width: w, height: h }} />
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col gap-2.5">
      <SkeletonBar w="40%" h="10px" />
      <SkeletonBar h="32px" />
      <div className="flex gap-2">
        <SkeletonBar w="60px" h="20px" />
        <SkeletonBar w="80px" h="20px" />
      </div>
      <SkeletonBar h="14px" />
      <SkeletonBar w="70%" h="14px" />
    </div>
  )
}

function SkeletonLoading() {
  return (
    <div className="bg-bg min-h-screen">
      <div className="bg-bg/[0.97] border-b border-border px-2 sm:px-4 py-1.5 flex items-center gap-2 flex-wrap">
        <SkeletonBar w="120px" h="28px" />
        <SkeletonBar w="70px" h="24px" className="rounded-full" />
        <SkeletonBar w="70px" h="24px" className="rounded-full" />
        <div className="flex-1" />
        <SkeletonBar w="60px" h="20px" />
        <SkeletonBar w="60px" h="20px" />
      </div>
      <div className="px-3 sm:px-5 md:px-8 py-3 max-w-[1200px] mx-auto grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
        {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="fixed bottom-4 left-0 right-0 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
          <div className="w-4 h-4 border-2 border-border border-t-amber rounded-full animate-spin" />
          <span className="text-xs text-text-muted font-mono">Verbinde mit Home Assistant...</span>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { connected, entities } = useHA()
  const [tab, setTab] = useState('oben')
  const openChores = useOpenChoreCount()
  const hasEntities = Object.keys(entities).length > 0
  const pullRef = useRef({ startY: 0, pulling: false })
  const [pullDistance, setPullDistance] = useState(0)

  const onPullStart = useCallback((ev) => {
    if (window.scrollY === 0) {
      pullRef.current = { startY: ev.touches[0].clientY, pulling: true }
    }
  }, [])

  const onPullMove = useCallback((ev) => {
    if (!pullRef.current.pulling) return
    const dy = ev.touches[0].clientY - pullRef.current.startY
    if (dy > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(dy * 0.4, 80))
    }
  }, [])

  const onPullEnd = useCallback(() => {
    if (pullDistance > 60) window.location.reload()
    pullRef.current.pulling = false
    setPullDistance(0)
  }, [pullDistance])

  if (!hasEntities) return <SkeletonLoading />

  return (
    <div className="bg-bg min-h-screen text-text-primary font-sans" onTouchStart={onPullStart} onTouchMove={onPullMove} onTouchEnd={onPullEnd}>
      {pullDistance > 0 && (
        <div className="flex justify-center py-1 transition-opacity" style={{ opacity: pullDistance / 60 }}>
          <div className={`w-5 h-5 border-2 border-border border-t-amber rounded-full ${pullDistance > 60 ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${pullDistance * 4}deg)` }} />
        </div>
      )}
      <div className="sticky top-0 z-[200]">
        <Ribbon />
        <TabBar active={tab} onChange={setTab} badges={{ familie: openChores }} />
      </div>
      <FilterMaintenanceReminder />
      <AquariumReminder />
      <div className="px-3 sm:px-5 md:px-8 py-2 md:py-3 max-w-[1200px] mx-auto">
        {tab === 'oben' && <TabOben />}
        {tab === 'unten' && <TabUnten />}
        {tab === 'infos' && <TabInfos />}
        {tab === 'roboter' && <TabRoboter />}
        {tab === 'familie' && <TabFamilie />}
      </div>
      {!connected && (
        <div className="fixed bottom-0 left-0 right-0 bg-red/90 text-white text-center py-1.5 text-sm z-[200]">
          Verbindung unterbrochen – Reconnect...
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <HAProvider>
        <Dashboard />
      </HAProvider>
    </SettingsProvider>
  )
}
