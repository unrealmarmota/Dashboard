import { useState } from 'react'
import { useHA } from '../context/HAContext'
import { useSettings } from '../context/SettingsContext'
import { Dot, InfoModal } from '../atoms'
import { e, v, isHome, WEATHER_ICONS, WEATHER_DE } from '../config'
import { ClockDisplay } from './ClockDisplay'
import { MODES, ACCENTS, FONTS } from '../themes'
import { useCountdowns } from '../hooks/useCountdowns'

export function Ribbon() {
  const { entities } = useHA()
  const { settings, updateSetting, resetSettings } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const johannes = e(entities, 'person.johannes')
  const tanja = e(entities, 'person.tanja')
  const solar = v(entities, 'sensor.solakon_one_pv_leistung')
  const grid = v(entities, 'sensor.shellypro3em_total_active_power')
  const weather = e(entities, 'weather.forecast_stauferabby')
  const wAttrs = weather?.attributes || {}
  // Wetterstation (Ecowitt Wittboy) Live-Werte mit Forecast-Fallback
  const stationTemp = parseFloat(entities['sensor.gw3000a_outdoor_temperature']?.state)
  const stationHum  = parseFloat(entities['sensor.gw3000a_humidity']?.state)
  const stationWind = parseFloat(entities['sensor.gw3000a_wind_speed']?.state)
  const outsideTemp = !isNaN(stationTemp) ? stationTemp : wAttrs.temperature
  const outsideHum  = !isNaN(stationHum)  ? stationHum  : wAttrs.humidity
  const outsideWind = !isNaN(stationWind) ? stationWind : wAttrs.wind_speed
  const gridNum = parseFloat(grid)
  const solarNum = parseFloat(solar)
  const weatherIcon = WEATHER_ICONS[weather?.state] || '\u2601\uFE0F'
  const weatherDesc = WEATHER_DE[weather?.state] || weather?.state || ''

  const stateLabel = (s) => {
    if (!s || s === 'unknown') return '?'
    if (s.toLowerCase() === 'home') return null
    if (s === 'not_home') return 'Unterwegs'
    return s
  }

  const persons = [
    { name: 'Johannes', state: johannes?.state, avatar: '\uD83D\uDC68', location: stateLabel(johannes?.state) },
    { name: 'Tanja', state: tanja?.state, avatar: '\uD83D\uDC69', location: stateLabel(tanja?.state) },
  ]

  const hausverbrauch = (!isNaN(solarNum) && !isNaN(gridNum)) ? Math.max(0, solarNum + gridNum) : NaN

  const { getNext } = useCountdowns()
  const nextCountdown = getNext()

  const calendarEntities = Object.keys(entities).filter(k => k.startsWith('calendar.'))
  const nextEvent = calendarEntities.reduce((best, key) => {
    const cal = entities[key]
    const start = cal?.attributes?.start_time
    if (!start) return best
    const startDate = new Date(start)
    if (isNaN(startDate.getTime()) || startDate < new Date()) return best
    if (!best || startDate < new Date(best.start)) return { message: cal.attributes.message, start, entity: key }
    return best
  }, null)

  const energyItems = [
    { icon: '\u2600\uFE0F', val: isNaN(solarNum) ? '\u2013' : solarNum.toFixed(0), unit: 'W', label: 'Solar' },
    { icon: gridNum < 0 ? '\u2191' : '\u2193', val: isNaN(gridNum) ? '\u2013' : Math.abs(gridNum).toFixed(0), unit: 'W', label: gridNum < 0 ? 'Einspeisung' : 'Bezug' },
    { icon: '\uD83C\uDFE0', val: isNaN(hausverbrauch) ? '\u2013' : hausverbrauch.toFixed(0), unit: 'W', label: 'Verbrauch' },
  ]

  const weatherItems = [
    { icon: weatherIcon, val: typeof outsideTemp === 'number' ? outsideTemp.toFixed(1) : '\u2013', unit: '\u00B0', label: weatherDesc },
    { icon: '\uD83D\uDCA7', val: typeof outsideHum === 'number' ? Math.round(outsideHum) : '\u2013', unit: '%', label: 'Feuchte' },
    { icon: '\uD83C\uDF2C\uFE0F', val: typeof outsideWind === 'number' ? Math.round(outsideWind) : '\u2013', unit: 'km/h', label: 'Wind' },
    { icon: '\u2601\uFE0F', val: typeof wAttrs.cloud_coverage === 'number' ? Math.round(wAttrs.cloud_coverage) : '\u2013', unit: '%', label: 'Wolken' },
  ]

  return (
    <div className="bg-bg/[0.97] border-b border-border pl-2 pr-10 sm:pl-4 sm:pr-12 py-1.5 flex items-center gap-1.5 sm:gap-2 flex-wrap backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.6)] relative">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold text-amber">44</div>
        <div>
          <div className="font-sans font-extrabold text-[15px] text-white tracking-wide leading-none">STAUFER<span className="text-amber">.</span>ABBY</div>
          <div className="hidden sm:block text-[10px] text-text-muted tracking-[2px]">WAIBLINGEN</div>
        </div>
      </div>
      <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />
      {persons.map(p => (
        <div key={p.name} className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[13px] ${isHome(p.state) ? 'bg-teal-dim border-teal-border' : 'bg-amber-dim border-amber-border'}`}>
          <span>{p.avatar}</span>
          <span className={`hidden sm:inline font-mono ${isHome(p.state) ? 'text-teal' : 'text-amber'}`}>{p.name}</span>
          {p.location && <span className="text-[10px] text-text-muted font-mono">{'\u00B7'} {p.location}</span>}
          <Dot on={isHome(p.state)} />
        </div>
      ))}
      <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />
      <div className="flex items-center gap-3">
        {energyItems.map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <span className="text-sm">{item.icon}</span>
            <div>
              <div className="text-sm font-bold text-white font-mono leading-none">
                {item.val}<span className="text-[10px] text-text-muted">{item.unit && ` ${item.unit}`}</span>
              </div>
              <div className="hidden sm:block text-[10px] text-text-muted tracking-wide">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />
      <div className="flex items-center gap-2.5">
        {weatherItems.map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <span className="text-sm">{item.icon}</span>
            <div>
              <div className="text-sm font-bold text-white font-mono leading-none">
                {item.val}<span className="text-[10px] text-text-muted">{item.unit}</span>
              </div>
              <div className="hidden sm:block text-[10px] text-text-muted tracking-wide">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
      {nextEvent && (
        <>
          <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />
          <div className="flex items-center gap-1 max-w-[180px]">
            <span className="text-sm">{'\uD83D\uDCC5'}</span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-white font-mono leading-none truncate">{nextEvent.message}</div>
              <div className="text-[10px] text-text-muted font-mono">{new Date(nextEvent.start).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </>
      )}
      {nextCountdown && (
        <>
          <div className="w-px h-7 bg-border mx-0.5 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{nextCountdown.emoji}</span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-white font-mono leading-none truncate max-w-[90px]">{nextCountdown.label}</div>
              <div className="text-[10px] font-mono" style={{ color: nextCountdown.daysLeft <= 7 ? 'var(--color-amber)' : 'var(--color-text-muted)' }}>
                {nextCountdown.daysLeft === 0 ? 'Heute!' : nextCountdown.daysLeft === 1 ? 'Morgen!' : `noch ${nextCountdown.daysLeft}d`}
              </div>
            </div>
          </div>
        </>
      )}
      <button onClick={() => setShowSettings(true)}
        className="absolute top-1.5 right-2 sm:right-4 w-7 h-7 flex items-center justify-center rounded-lg bg-transparent border border-border text-text-muted cursor-pointer text-sm hover:text-text-primary hover:border-amber transition-colors z-10"
        aria-label="Einstellungen">{'\u2699\uFE0F'}</button>
      <ClockDisplay />

      {showSettings && (
        <InfoModal onClose={() => setShowSettings(false)}>
          <div className="pt-2">
            <div className="text-center mb-5">
              <div className="text-2xl mb-1">{'\u2699\uFE0F'}</div>
              <div className="text-base font-semibold text-text-primary font-mono">Einstellungen</div>
              <div className="text-[11px] text-text-muted font-mono">Werte werden lokal gespeichert</div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Theme */}
              <div className="p-3 rounded-lg bg-surface border border-border">
                <div className="text-[13px] text-text-primary font-mono font-semibold mb-2">{'\uD83C\uDFA8'} Theme</div>
                <div className="flex gap-1.5 mb-3">
                  {Object.entries(MODES).map(([key, m]) => (
                    <button key={key} onClick={() => updateSetting('theme', key)}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-[12px] font-mono cursor-pointer transition-colors ${settings.theme === key ? 'border-teal bg-teal/[0.12] text-teal font-bold' : 'border-border bg-transparent text-text-muted'}`}>
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
                {settings.theme !== 'downton' && (
                  <>
                    <div className="text-[11px] text-text-muted font-mono mb-1.5">Akzentfarbe</div>
                    <div className="flex gap-2 justify-center">
                      {Object.entries(ACCENTS).map(([key, a]) => (
                        <button key={key} onClick={() => updateSetting('accent', key)}
                          className={`w-8 h-8 rounded-full cursor-pointer transition-all border-2 ${settings.accent === key ? 'border-white scale-110' : 'border-transparent'}`}
                          style={{ background: a.preview }}
                          title={a.label} />
                      ))}
                    </div>
                  </>
                )}
              </div>


              {/* Schrift */}
              <div className="p-3 rounded-lg bg-surface border border-border">
                <div className="text-[13px] text-text-primary font-mono font-semibold mb-2">{'\uD83D\uDD24'} Schrift</div>
                <div className="flex gap-1.5">
                  {Object.entries(FONTS).map(([key, f]) => (
                    <button key={key} onClick={() => updateSetting('font', key)}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-[12px] font-mono cursor-pointer transition-colors ${settings.font === key ? 'border-teal bg-teal/[0.12] text-teal font-bold' : 'border-border bg-transparent text-text-muted'}`}>
                      {f.icon} {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reset */}
            <div className="mt-5 text-center">
              <button onClick={resetSettings}
                className="px-4 py-1.5 rounded-lg border border-border bg-transparent text-text-muted cursor-pointer text-xs font-mono hover:text-red hover:border-red transition-colors">
                Zur{'\u00FC'}cksetzen
              </button>
            </div>
          </div>
        </InfoModal>
      )}
    </div>
  )
}
