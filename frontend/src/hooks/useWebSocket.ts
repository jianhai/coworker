import { useEffect, useRef, useState, useCallback } from 'react'
import { getApiUrl } from '../api'
import { ServerMessage, ClientMessage } from '../types'

interface UseWebSocketOptions {
  token: string
  onMessage: (message: ServerMessage) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Event) => void
}

export function useWebSocket({
  token,
  onMessage,
  onConnected,
  onDisconnected,
  onError,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number>()
  const connectingRef = useRef(false)

  const connect = useCallback(async () => {
    if (connectingRef.current) return

    connectingRef.current = true
    try {
      const apiUrl = await getApiUrl()
      const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws'
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        connectingRef.current = false
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage
          // 认证成功消息
          if (message.type === 'user_joined') {
            setIsConnected(true)
            setIsAuthenticated(true)
            console.log('WebSocket authenticated')
            onConnected?.()
          }
          onMessage(message)
        } catch (error) {
          console.error('Failed to parse message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.(error)
        connectingRef.current = false
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        setIsAuthenticated(false)
        wsRef.current = null
        connectingRef.current = false
        onDisconnected?.()

        // 自动重连
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect()
        }, 3000)
      }

      wsRef.current = ws

      // 发送认证 token
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ token }))
        }
      }, 100)
    } catch (error) {
      console.error('Failed to connect:', error)
      connectingRef.current = false
    }
  }, [token, onMessage, onConnected, onDisconnected, onError])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      console.log('WebSocket sent:', message)
    } else {
      console.warn('WebSocket is not connected, message not sent:', message)
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { isConnected, isAuthenticated, send, connect, disconnect }
}
