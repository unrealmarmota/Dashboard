import { useState, useEffect } from 'react'
import { useHA } from '../context/HAContext'
import { Card, Label } from '../atoms'
import { e } from '../config'

function MediaBrowser({ heosId, onPlay, onClose }) {
  const { sendMessage } = useHA()
  const [items, setItems] = useState([])
  const [path, setPath] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const browse = async (contentType, contentId, title) => {
    setLoading(true); setError(null)
    try {
      const msg = { type: 'media_player/browse_media', entity_id: heosId }
      if (contentType && contentId) { msg.media_content_type = contentType; msg.media_content_id = contentId }
      const result = await sendMessage(msg)
      setItems(result?.children || [])
      if (contentType && contentId && title) setPath(prev => [...prev, { title, type: contentType, id: contentId }])
      else setPath([])
    } catch (err) { setError(err?.message || 'Fehler'); setItems([]) }
    setLoading(false)
  }

  // Initial browse on mount
  useEffect(() => { browse(null, null, null) }, [])

  const goBack = () => {
    if (path.length <= 1) browse(null, null, null)
    else {
      const target = path[path.length - 2]
      setPath(path.slice(0, -2))
      browse(target.type, target.id, target.title)
    }
  }

  return (
    <div className="mb-3 rounded-[10px] border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border bg-card">
        {path.length > 0 && (
          <button onClick={goBack} className="px-2 py-0.5 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-sm">{'\u2190'}</button>
        )}
        <span className="text-[13px] text-text-primary font-semibold flex-1 truncate">
          {path.length > 0 ? path[path.length - 1].title : '\uD83D\uDCC2 Medien durchsuchen'}
        </span>
        <button onClick={onClose} className="px-2 py-0.5 rounded-md border border-border bg-transparent text-text-muted cursor-pointer text-[13px]">{'\u2715'}</button>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {loading ? <div className="p-5 text-center text-text-muted text-[13px]">Lade...</div>
          : error ? <div className="p-3.5 text-center text-red text-[13px]">{error}</div>
          : items.length === 0 ? <div className="p-3.5 text-center text-text-muted text-[13px]">Keine Einträge</div>
          : items.map((item, i) => (
            <div key={item.media_content_id || i}
              onClick={() => item.can_expand ? browse(item.media_content_type, item.media_content_id, item.title) : item.can_play && onPlay(item)}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-dim last:border-b-0 hover:bg-dim transition-colors">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-md shrink-0 bg-dim flex items-center justify-center text-base">
                  {item.can_expand ? '\uD83D\uDCC1' : '\uD83C\uDFB5'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-text-primary truncate">{item.title}</div>
                {item.media_content_type && <div className="text-[11px] text-text-muted">{item.media_content_type}</div>}
              </div>
              {item.can_play && (
                <button onClick={ev => { ev.stopPropagation(); onPlay(item) }}
                  className="px-2.5 py-[3px] rounded-md border border-teal-border bg-teal-dim text-teal cursor-pointer text-xs shrink-0">{'\u25B6'}</button>
              )}
              {item.can_expand && <span className="text-text-muted text-sm shrink-0">{'\u203A'}</span>}
            </div>
          ))}
      </div>
    </div>
  )
}

export function DenonCard() {
  const { entities, callService, sendMessage } = useHA()
  const avr = e(entities, 'media_player.denon')
  const heos = e(entities, 'media_player.denon_2')
  const avrId = 'media_player.denon'
  const heosId = 'media_player.denon_2'

  const avrState = avr?.state ?? 'unavailable'
  const isOn = avrState !== 'unavailable' && avrState !== 'off'
  const avrAttrs = avr?.attributes || {}
  const sources = avrAttrs.source_list || []
  const currentSource = avrAttrs.source ?? '\u2013'
  const currentMode = avrAttrs.sound_mode ?? '\u2013'
  const volume = avrAttrs.volume_level ?? 0
  const isMuted = avrAttrs.is_volume_muted ?? false

  const heosState = heos?.state
  const heosAvail = heosState && heosState !== 'unavailable'
  const heosAttrs = heos?.attributes || {}
  const title = heosAttrs.media_title ?? ''
  const artist = heosAttrs.media_artist ?? ''
  const album = heosAttrs.media_album_name ?? ''
  const entityPicture = heosAttrs.entity_picture_local || heosAttrs.entity_picture || null
  const hasMediaInfo = heosAvail && (title || artist)

  const selectSource = (src) => callService('media_player', 'select_source', { entity_id: avrId, source: src })
  const setVolume = (val) => callService('media_player', 'volume_set', { entity_id: avrId, volume_level: val })
  const toggleMute = () => callService('media_player', 'volume_mute', { entity_id: avrId, is_volume_muted: !isMuted })

  const [browserOpen, setBrowserOpen] = useState(false)

  const playItem = (item) => {
    if (!isOn) {
      callService('media_player', 'turn_on', { entity_id: avrId })
      setTimeout(() => selectSource('HEOS Music'), 2000)
      setTimeout(() => callService('media_player', 'play_media', { entity_id: heosId, media_content_type: item.media_content_type, media_content_id: item.media_content_id }), 3500)
    } else {
      if (currentSource !== 'HEOS Music' && currentSource !== 'NET') {
        selectSource('HEOS Music')
        setTimeout(() => callService('media_player', 'play_media', { entity_id: heosId, media_content_type: item.media_content_type, media_content_id: item.media_content_id }), 1000)
      } else {
        callService('media_player', 'play_media', { entity_id: heosId, media_content_type: item.media_content_type, media_content_id: item.media_content_id })
      }
    }
    setBrowserOpen(false)
  }

  const favSources = ['HEOS Music', 'TV Audio', 'Bluetooth', 'Tuner', 'Game']

  return (
    <Card accent={isOn}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <Label>Denon AVR {'\u00B7'} Receiver</Label>
          <button onClick={() => callService('media_player', isOn ? 'turn_off' : 'turn_on', { entity_id: avrId })}
            className={`px-4 py-1.5 rounded-lg border cursor-pointer text-[13px] font-mono ${isOn ? 'border-red-border bg-red-dim text-red' : 'border-teal-border bg-teal-dim text-teal'}`}>
            {isOn ? '\u23FB Aus' : '\u23FB Ein'}
          </button>
        </div>

        {isOn ? (<>
          {/* Source + Mode */}
          <div className="flex items-center gap-2.5 p-3 px-3.5 rounded-lg bg-surface">
            <span className="text-base">{'\uD83D\uDD0A'}</span>
            <span className="text-sm text-text-primary">Quelle: <span className="text-amber font-semibold">{currentSource}</span></span>
            {currentMode !== '\u2013' && <span className="text-xs text-text-muted font-mono">{'\u00B7'} {currentMode}</span>}
            {heosAvail && <span className={`text-[11px] font-mono ml-auto ${heosState === 'playing' ? 'text-green' : heosState === 'paused' ? 'text-amber' : 'text-text-muted'}`}>
              {heosState === 'playing' ? '\u25CF Playing' : heosState === 'paused' ? '\u25CF Paused' : heosState === 'idle' ? '\u25CF Idle' : ''}
            </span>}
          </div>

          {/* Now Playing */}
          {hasMediaInfo && (
            <div className="flex gap-3.5 items-center p-3 rounded-[10px] bg-surface border border-border">
              {entityPicture ? (
                <img src={entityPicture} alt="" className="w-16 h-16 rounded-lg shrink-0 object-cover border border-border" />
              ) : (
                <div className="w-14 h-14 rounded-lg shrink-0 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-2xl border border-border">
                  {heosState === 'playing' ? '\uD83C\uDFB5' : heosState === 'paused' ? '\u23F8' : '\uD83C\uDFB6'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-white truncate">{title || 'Unbekannt'}</div>
                {artist && <div className="text-[13px] text-text-muted truncate">{artist}</div>}
                {album && <div className="text-xs text-dim truncate">{album}</div>}
              </div>
            </div>
          )}

          {/* Playback Controls */}
          {heosAvail && (
            <div className="flex justify-center gap-2">
              {[
                { icon: '\u23EE', action: () => callService('media_player', 'media_previous_track', { entity_id: heosId }), accent: false },
                { icon: heosState === 'playing' ? '\u23F8' : '\u25B6', action: () => callService('media_player', heosState === 'playing' ? 'media_pause' : 'media_play', { entity_id: heosId }), accent: true },
                { icon: '\u23ED', action: () => callService('media_player', 'media_next_track', { entity_id: heosId }), accent: false },
              ].map((btn, i) => (
                <button key={i} onClick={btn.action}
                  className={`rounded-lg cursor-pointer text-base transition-all ${btn.accent ? 'px-6 py-2.5 border border-amber-border bg-amber-dim text-amber' : 'px-4 py-2.5 border border-border bg-transparent text-text-muted'}`}>
                  {btn.icon}
                </button>
              ))}
            </div>
          )}

          {/* Media Browser */}
          {browserOpen && <MediaBrowser heosId={heosId} onPlay={playItem} onClose={() => setBrowserOpen(false)} />}

          {/* Source Selection */}
          <div>
            <div className="text-xs text-text-muted font-mono mb-2">Quelle wählen</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setBrowserOpen(!browserOpen)}
                className={`px-3.5 py-2 rounded-lg cursor-pointer text-xs font-mono font-semibold border ${browserOpen ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-purple-500/[0.08] border-purple-500/20 text-purple-400'}`}>
                {'\uD83C\uDFB5'} Musik
              </button>
              {favSources.filter(s => sources.includes(s) && s !== 'HEOS Music').map(src => (
                <button key={src} onClick={() => selectSource(src)}
                  className={`px-3.5 py-2 rounded-lg cursor-pointer text-xs font-mono transition-all ${currentSource === src ? 'bg-amber-dim border border-amber-border text-amber font-semibold' : 'bg-transparent border border-border text-text-muted'}`}>
                  {src}
                </button>
              ))}
              <select value={currentSource} onChange={ev => selectSource(ev.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs font-mono bg-surface border border-border text-text-muted cursor-pointer">
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2.5">
            <button onClick={toggleMute} className="border-none bg-transparent cursor-pointer text-base p-0">
              {isMuted ? '\uD83D\uDD07' : volume > 0.5 ? '\uD83D\uDD0A' : volume > 0 ? '\uD83D\uDD09' : '\uD83D\uDD08'}
            </button>
            <div className="flex-1 relative h-5 flex items-center">
              <div className="absolute inset-x-0 h-1 rounded-sm bg-dim" />
              <div className="absolute left-0 h-1 rounded-sm transition-[width] duration-100"
                style={{ width: `${Math.round(volume * 100)}%`, background: isMuted ? 'var(--color-dim)' : 'linear-gradient(90deg, #d97706, var(--color-amber))' }} />
              <input type="range" min={0} max={100} value={Math.round(volume * 100)}
                onChange={ev => setVolume(parseInt(ev.target.value) / 100)}
                className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-5 m-0 p-0" />
            </div>
            <span className={`text-[13px] font-mono min-w-8 text-right ${isMuted ? 'text-dim' : 'text-amber'}`}>
              {isMuted ? 'MUTE' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </>) : (
          <div className="text-center py-4">
            <div className="text-[28px] mb-3">{'\uD83D\uDD07'}</div>
            <div className="text-sm text-text-muted mb-4">Receiver aus</div>
            <div className="flex gap-2.5 justify-center flex-wrap">
              {[
                { label: '\uD83C\uDFB5 Musik', cls: 'bg-gradient-to-br from-purple-500/[0.15] to-pink-500/[0.15] border-purple-500/30 text-purple-300', action: () => { callService('media_player', 'turn_on', { entity_id: avrId }); setTimeout(() => { selectSource('HEOS Music'); setBrowserOpen(true) }, 3000) } },
                { label: '\uD83D\uDCFA TV Audio', cls: 'bg-surface border-border text-text-muted', action: () => { callService('media_player', 'turn_on', { entity_id: avrId }); setTimeout(() => selectSource('TV Audio'), 3000) } },
                { label: '\uD83D\uDD35 Bluetooth', cls: 'bg-surface border-border text-text-muted', action: () => { callService('media_player', 'turn_on', { entity_id: avrId }); setTimeout(() => selectSource('Bluetooth'), 3000) } },
              ].map(b => (
                <button key={b.label} onClick={b.action} className={`px-5 py-2.5 rounded-lg cursor-pointer text-[13px] font-mono border ${b.cls}`}>{b.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
