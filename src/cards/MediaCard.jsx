import { useState } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label, Dot, Pill, InfoModal } from '../atoms'
import { e, HA_BASE } from '../config'

const PLAYERS = [
  { id: 'media_player.lg_webos_smart_tv', name: 'LG TV', icon: '\uD83D\uDCFA', canPower: true },
  { id: 'media_player.plex_plex_for_lg_lg_oled55b7d_z', name: 'Plex', icon: '\uD83C\uDFA5' },
  { id: 'media_player.xbox', name: 'Xbox', icon: '\uD83C\uDFAE' },
  { id: 'media_player.tanja_s_fire_tv', name: 'Fire TV', icon: '\uD83D\uDD25' },
  { id: 'media_player.tanja_s_2nd_fire_tv', name: 'Fire TV 2', icon: '\uD83D\uDD25' },
  { id: 'media_player.tanjas_echo_dot', name: 'Echo Dot', icon: '\uD83D\uDD0A' },
  { id: 'media_player.fire_tablet', name: 'Tablet', icon: '\uD83D\uDCF1' },
]

const stateLabel = (s) => {
  if (s === 'playing') return 'Spielt'
  if (s === 'paused') return 'Pausiert'
  if (s === 'idle') return 'Idle'
  if (s === 'on') return 'An'
  if (s === 'off') return 'Aus'
  if (s === 'unavailable') return 'Offline'
  return s || '\u2013'
}

const stateColor = (s) => {
  if (s === 'playing') return 'green'
  if (s === 'paused') return 'amber'
  if (s === 'on' || s === 'idle') return 'teal'
  return 'gray'
}

// Bit flags for supported_features
const SUPPORT_PAUSE = 1
const SUPPORT_VOLUME_SET = 4
const SUPPORT_VOLUME_MUTE = 8
const SUPPORT_PREV = 16
const SUPPORT_NEXT = 32
const SUPPORT_TURN_ON = 128
const SUPPORT_TURN_OFF = 256
const SUPPORT_VOLUME_STEP = 1024

const picUrl = (pic) => {
  if (!pic) return null
  if (pic.startsWith('/api/')) return `${HA_BASE}${pic}`
  if (pic.startsWith('/')) return `${HA_BASE}${pic}`
  return pic
}

export function MediaCard() {
  const { entities, callService } = useHA()

  const players = PLAYERS.map(p => {
    const ent = e(entities, p.id)
    const state = ent?.state ?? 'unavailable'
    const attrs = ent?.attributes || {}
    const features = attrs.supported_features || 0
    return {
      ...p, state, attrs,
      title: attrs.media_title || null,
      artist: attrs.media_artist || null,
      picture: picUrl(attrs.entity_picture_local || attrs.entity_picture),
      source: attrs.source || null,
      volume: attrs.volume_level ?? null,
      isMuted: attrs.is_volume_muted ?? false,
      canPause: !!(features & SUPPORT_PAUSE),
      canNext: !!(features & SUPPORT_NEXT),
      canPrev: !!(features & SUPPORT_PREV),
      canTurnOn: p.canPower && !!(features & SUPPORT_TURN_ON),
      canTurnOff: p.canPower && !!(features & SUPPORT_TURN_OFF),
      canVolume: !!(features & SUPPORT_VOLUME_SET) || !!(features & SUPPORT_VOLUME_STEP),
      canVolumeMute: !!(features & SUPPORT_VOLUME_MUTE),
    }
  })

  const active = players.filter(p => p.state === 'playing' || p.state === 'paused')
  const others = players.filter(p => p.state !== 'playing' && p.state !== 'paused' && p.state !== 'unavailable')
  const offline = players.filter(p => p.state === 'unavailable')

  const togglePlay = (p) => {
    if (p.state === 'playing') callService('media_player', 'media_pause', { entity_id: p.id })
    else callService('media_player', 'media_play', { entity_id: p.id })
  }

  const volStep = (p, delta) => {
    const next = Math.min(1, Math.max(0, (p.volume ?? 0) + delta))
    callService('media_player', 'volume_set', { entity_id: p.id, volume_level: Math.round(next * 100) / 100 })
  }
  const toggleMute = (p) => callService('media_player', 'volume_mute', { entity_id: p.id, is_volume_muted: !p.isMuted })

  // Harmony Hub Aktivitaet
  const harmony = e(entities, 'select.harmony_hub_activities')
  const harmonyActivity = harmony?.state || null
  const harmonyOn = harmonyActivity && harmonyActivity !== 'PowerOff' && harmonyActivity !== 'power_off'
  const harmonyOptions = harmony?.attributes?.options || []

  const HARMONY_ICONS = {
    'Film wiedergeben': '\uD83C\uDFAC',
    'Musik h\u00F6ren': '\uD83C\uDFB5',
    'Netflix schauen': '\uD83C\uDF7F',
    'Smart': '\uD83D\uDCA1',
    'TV': '\uD83D\uDCE1',
    'power_off': '\u23FB',
    'PowerOff': '\u23FB',
  }
  const HARMONY_LABELS = {
    'Film wiedergeben': 'Film',
    'Musik h\u00F6ren': 'Musik',
    'Netflix schauen': 'Netflix',
    'Smart': 'Smart',
    'TV': 'TV',
  }
  const switchHarmony = (opt) => callService('select', 'select_option', { entity_id: 'select.harmony_hub_activities', option: opt })

  // Fernbedienung
  const [remoteOpen, setRemoteOpen] = useState(false)
  const tvBtn = (btn) => callService('webostv', 'button', { entity_id: 'media_player.lg_webos_smart_tv', button: btn })

  const RBtn = ({ children, onClick, className = '', size = 'w-14 h-14' }) => (
    <button onClick={onClick}
      className={`${size} rounded-xl border border-border bg-surface text-text-primary cursor-pointer flex items-center justify-center active:scale-90 active:bg-dim transition-all select-none ${className}`}>
      {children}
    </button>
  )

  return (
    <>
    {remoteOpen && (
      <InfoModal onClose={() => setRemoteOpen(false)} wide>
        <div className="text-center mb-4">
          <div className="text-lg mb-1">{'\uD83D\uDCFA'} Fernbedienung</div>
          <div className="text-[11px] text-text-muted font-mono">LG webOS TV</div>
        </div>

        {/* D-Pad */}
        <div className="flex flex-col items-center gap-1.5 mb-4">
          <RBtn onClick={() => tvBtn('UP')} className="text-xl">{'\u25B2'}</RBtn>
          <div className="flex items-center gap-1.5">
            <RBtn onClick={() => tvBtn('LEFT')} className="text-xl">{'\u25C0'}</RBtn>
            <RBtn onClick={() => tvBtn('ENTER')} className="!bg-amber-dim !border-amber-border text-amber font-bold text-sm" size="w-16 h-16">OK</RBtn>
            <RBtn onClick={() => tvBtn('RIGHT')} className="text-xl">{'\u25B6'}</RBtn>
          </div>
          <RBtn onClick={() => tvBtn('DOWN')} className="text-xl">{'\u25BC'}</RBtn>
        </div>

        {/* Navigation */}
        <div className="flex justify-center gap-2 mb-4">
          <RBtn onClick={() => tvBtn('BACK')} className="text-sm font-mono" size="w-20 h-12">{'\u2190'} Back</RBtn>
          <RBtn onClick={() => tvBtn('HOME')} className="text-base" size="w-14 h-12">{'\uD83C\uDFE0'}</RBtn>
          <RBtn onClick={() => tvBtn('EXIT')} className="text-sm font-mono" size="w-20 h-12">Exit {'\u2715'}</RBtn>
        </div>

        {/* Farbtasten + Extras */}
        <div className="flex justify-center gap-2 mb-4">
          <button onClick={() => tvBtn('RED')} className="w-10 h-8 rounded-lg bg-red/30 border border-red/40 cursor-pointer active:scale-90 transition-transform" />
          <button onClick={() => tvBtn('GREEN')} className="w-10 h-8 rounded-lg bg-green/30 border border-green/40 cursor-pointer active:scale-90 transition-transform" />
          <button onClick={() => tvBtn('YELLOW')} className="w-10 h-8 rounded-lg bg-amber/30 border border-amber/40 cursor-pointer active:scale-90 transition-transform" />
          <button onClick={() => tvBtn('BLUE')} className="w-10 h-8 rounded-lg bg-blue/30 border border-blue/40 cursor-pointer active:scale-90 transition-transform" />
        </div>

        {/* Channel + Volume */}
        <div className="flex justify-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-text-muted font-mono mb-0.5">Kanal</span>
            <RBtn onClick={() => tvBtn('CHANNELUP')} className="text-sm" size="w-12 h-10">{'\u25B2'}</RBtn>
            <RBtn onClick={() => tvBtn('CHANNELDOWN')} className="text-sm" size="w-12 h-10">{'\u25BC'}</RBtn>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-text-muted font-mono mb-0.5">Lautst.</span>
            <RBtn onClick={() => tvBtn('VOLUMEUP')} className="text-sm" size="w-12 h-10">{'\u002B'}</RBtn>
            <RBtn onClick={() => tvBtn('VOLUMEDOWN')} className="text-sm" size="w-12 h-10">{'\u2212'}</RBtn>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-text-muted font-mono mb-0.5">&nbsp;</span>
            <RBtn onClick={() => tvBtn('MUTE')} className="text-base" size="w-12 h-10">{'\uD83D\uDD07'}</RBtn>
            <RBtn onClick={() => tvBtn('MENU')} className="text-[11px] font-mono" size="w-12 h-10">Menu</RBtn>
          </div>
        </div>
      </InfoModal>
    )}

    <Card>
      <div className="flex justify-between items-center mb-2.5">
        <Label>Media {'\u00B7'} Entertainment</Label>
        <div className="flex items-center gap-1.5">
          {active.length > 0 && <Pill small color="green">{active.length} aktiv</Pill>}
          {harmonyOn && <Pill small color="amber">{harmonyActivity}</Pill>}
          <button onClick={() => setRemoteOpen(true)}
            className="px-2 py-1 rounded-lg border border-border bg-surface text-text-muted cursor-pointer text-sm active:scale-90 transition-transform"
            title="Fernbedienung">{'\uD83D\uDCFA'}</button>
        </div>
      </div>

      {/* Harmony Hub Aktivitaeten */}
      {harmonyOptions.length > 0 && (
        <div className="mb-2.5 p-2.5 rounded-xl bg-surface border border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm">{'\uD83C\uDFAE'}</span>
            <span className="text-[11px] text-text-muted font-mono">Harmony Hub</span>
            {harmonyOn && <Pill small color="amber">{harmonyActivity}</Pill>}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {harmonyOptions.filter(o => o !== 'power_off' && o !== 'PowerOff').map(opt => (
              <button key={opt} onClick={() => switchHarmony(opt)}
                className={`px-3 py-2 rounded-lg cursor-pointer text-xs font-mono transition-all active:scale-90 ${harmonyActivity === opt ? 'bg-amber-dim border border-amber-border text-amber font-semibold' : 'bg-transparent border border-border text-text-muted hover:border-text-muted'}`}>
                {HARMONY_ICONS[opt] || '\uD83C\uDFAE'} {HARMONY_LABELS[opt] || opt}
              </button>
            ))}
            {harmonyOn && (
              <button onClick={() => switchHarmony(harmonyOptions.find(o => o === 'power_off' || o === 'PowerOff') || 'power_off')}
                className="px-3 py-2 rounded-lg cursor-pointer text-xs font-mono border border-red-border bg-red-dim text-red ml-auto active:scale-90 transition-all">
                {'\u23FB'} Aus
              </button>
            )}
          </div>
        </div>
      )}

      {/* Now Playing — aktive Player gross */}
      {active.map(p => (
        <div key={p.id} className="mb-2.5 p-3 rounded-xl bg-surface border border-border">
          <div className="flex gap-3.5 items-center">
            {p.picture ? (
              <img src={p.picture} alt="" className="w-20 h-20 rounded-xl shrink-0 object-cover border border-border shadow-lg" />
            ) : (
              <div className="w-20 h-20 rounded-xl shrink-0 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-3xl border border-border">
                {p.state === 'playing' ? '\u25B6' : '\u23F8'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm">{p.icon}</span>
                <span className="text-[11px] text-text-muted font-mono">{p.name}</span>
                <Pill small color={stateColor(p.state)}>{stateLabel(p.state)}</Pill>
              </div>
              <div className="text-[15px] font-semibold text-white truncate">{p.title || 'Unbekannt'}</div>
              {p.artist && <div className="text-xs text-text-muted truncate">{p.artist}</div>}
              {p.source && !p.artist && <div className="text-[11px] text-text-muted font-mono mt-0.5">Quelle: {p.source}</div>}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-3 mt-3">
            {p.canPrev && (
              <button onClick={() => callService('media_player', 'media_previous_track', { entity_id: p.id })}
                className="w-12 h-12 rounded-xl border border-border bg-transparent text-text-muted cursor-pointer text-xl flex items-center justify-center active:scale-90 transition-transform">{'\u23EE'}</button>
            )}
            {p.canPause && (
              <button onClick={() => togglePlay(p)}
                className="w-14 h-14 rounded-xl border border-amber-border bg-amber-dim text-amber cursor-pointer text-2xl flex items-center justify-center active:scale-90 transition-transform">
                {p.state === 'playing' ? '\u23F8' : '\u25B6'}
              </button>
            )}
            {p.canNext && (
              <button onClick={() => callService('media_player', 'media_next_track', { entity_id: p.id })}
                className="w-12 h-12 rounded-xl border border-border bg-transparent text-text-muted cursor-pointer text-xl flex items-center justify-center active:scale-90 transition-transform">{'\u23ED'}</button>
            )}
            {p.canTurnOff && p.state !== 'off' && (
              <button onClick={() => callService('media_player', 'turn_off', { entity_id: p.id })}
                className="w-12 h-12 rounded-xl border border-red-border bg-red-dim text-red cursor-pointer text-lg flex items-center justify-center active:scale-90 transition-transform ml-auto">{'\u23FB'}</button>
            )}
          </div>

          {/* Volume */}
          {(p.canVolume || p.canVolumeMute) && (
            <div className="flex justify-center items-center gap-2 mt-2.5">
              {p.canVolumeMute && (
                <button onClick={() => toggleMute(p)}
                  className={`w-12 h-12 rounded-xl border cursor-pointer text-lg flex items-center justify-center active:scale-90 transition-all ${p.isMuted ? 'border-red-border bg-red-dim text-red' : 'border-border bg-transparent text-text-muted'}`}>
                  {p.isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
                </button>
              )}
              {p.canVolume && (<>
                <button onClick={() => volStep(p, -0.05)}
                  className="w-12 h-12 rounded-xl border border-border bg-transparent text-text-muted cursor-pointer text-xl flex items-center justify-center active:scale-90 transition-transform">{'\u2212'}</button>
                <span className={`text-[15px] font-mono font-semibold min-w-[48px] text-center ${p.isMuted ? 'text-dim line-through' : 'text-text-primary'}`}>
                  {p.volume !== null ? `${Math.round(p.volume * 100)}%` : '\u2013'}
                </span>
                <button onClick={() => volStep(p, 0.05)}
                  className="w-12 h-12 rounded-xl border border-border bg-transparent text-text-muted cursor-pointer text-xl flex items-center justify-center active:scale-90 transition-transform">{'\u002B'}</button>
              </>)}
            </div>
          )}
        </div>
      ))}

      {/* Idle/On Player — kompakt */}
      {others.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1.5 mb-1.5">
          {others.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-surface border border-border">
              <Dot on={p.state === 'on' || p.state === 'idle'} color={`var(--color-${stateColor(p.state)})`} />
              <span className="text-sm">{p.icon}</span>
              <span className="text-[11px] text-text-primary truncate flex-1">{p.name}</span>
              <span className="text-[10px] text-text-muted font-mono">{stateLabel(p.state)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Offline Player — gedimmt */}
      {offline.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {offline.map(p => (
            <div key={p.id} className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface/50 border border-dim">
              <span className="text-xs opacity-40">{p.icon}</span>
              <span className="text-[10px] text-dim truncate">{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
    </>
  )
}
