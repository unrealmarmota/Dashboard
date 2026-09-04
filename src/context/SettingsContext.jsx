import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { SOLAR_STROMPREIS, SOLAR_EINSPEISEVERGUETUNG, SOLAR_ANLAGENKOSTEN } from '../config'
import { applyTheme } from '../themes'

const KEY = 'ha_dashboard_settings'
const DEFAULTS = {
  strompreis: SOLAR_STROMPREIS,
  einspeiseverguetung: SOLAR_EINSPEISEVERGUETUNG,
  anlagenkosten: SOLAR_ANLAGENKOSTEN,
  theme: 'dark',
  accent: 'teal',
  font: 'sans',
  mollySkin: 'brass',
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch { return { ...DEFAULTS } }
}

const SettingsContext = createContext(null)
export const useSettings = () => {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)

  // Theme beim Start anwenden
  useEffect(() => {
    applyTheme(settings.theme, settings.accent, settings.font)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      if (key === 'theme' || key === 'accent' || key === 'font') {
        applyTheme(next.theme, next.accent, next.font)
      }
      return next
    })
  }, [])

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULTS })
    try { localStorage.removeItem(KEY) } catch {}
    applyTheme(DEFAULTS.theme, DEFAULTS.accent, DEFAULTS.font)
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
