import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { HA_URL, HA_TOKEN } from '../config'

const HAContext = createContext(null)
export const useHA = () => {
  const ctx = useContext(HAContext)
  if (!ctx) throw new Error('useHA must be used within HAProvider')
  return ctx
}

export function HAProvider({ children }) {
  const [entities, setEntities] = useState({})
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const msgIdRef = useRef(1)
  const reconnectTimer = useRef(null)
  const pendingRef = useRef({})
  const disposedRef = useRef(false)

  const connect = useCallback(() => {
    if (disposedRef.current) return
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return
    const newWs = new WebSocket(HA_URL)
    wsRef.current = newWs
    newWs.onopen = () => {}
    newWs.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      if (msg.type === 'auth_required') newWs.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }))
      if (msg.type === 'auth_ok') {
        setConnected(true)
        newWs.send(JSON.stringify({ id: msgIdRef.current++, type: 'subscribe_events', event_type: 'state_changed' }))
        newWs.send(JSON.stringify({ id: msgIdRef.current++, type: 'get_states' }))
      }
      if (msg.type === 'auth_invalid') {
        console.error('HA auth failed:', msg.message)
        newWs.close()
        return
      }
      if (msg.type === 'result' && msg.success && Array.isArray(msg.result)) {
        const m = {}; msg.result.forEach(e => { m[e.entity_id] = e }); setEntities(m)
      }
      if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
        const { entity_id, new_state } = msg.event.data
        if (new_state) setEntities(prev => ({ ...prev, [entity_id]: new_state }))
      }
      if (msg.id && pendingRef.current[msg.id]) {
        const { resolve, reject, timer } = pendingRef.current[msg.id]
        clearTimeout(timer)
        delete pendingRef.current[msg.id]
        if (msg.success === false) reject(msg.error || msg)
        else resolve(msg.result)
      }
    }
    newWs.onclose = () => {
      setConnected(false)
      // Reject all pending promises on disconnect
      Object.values(pendingRef.current).forEach(({ reject, timer }) => {
        clearTimeout(timer)
        reject(new Error('WS disconnected'))
      })
      pendingRef.current = {}
      if (!disposedRef.current) reconnectTimer.current = setTimeout(connect, 5000)
    }
    newWs.onerror = () => newWs.close()
  }, [])

  useEffect(() => {
    disposedRef.current = false
    connect()
    return () => {
      disposedRef.current = true
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const callService = useCallback((domain, service, data) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ id: msgIdRef.current++, type: 'call_service', domain, service, service_data: data }))
  }, [])

  const sendMessage = useCallback((msg) => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) { reject(new Error('WS not connected')); return }
      const id = msgIdRef.current++
      const timer = setTimeout(() => {
        if (pendingRef.current[id]) {
          delete pendingRef.current[id]
          reject(new Error('WS timeout'))
        }
      }, 15000)
      pendingRef.current[id] = { resolve, reject, timer }
      ws.send(JSON.stringify({ ...msg, id }))
    })
  }, [])

  return <HAContext.Provider value={{ entities, connected, callService, sendMessage }}>{children}</HAContext.Provider>
}
