import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import type { Room, Message, MessageContent, ServerMessage } from '../types'

interface ChatWindowProps {
  room: Room
  token: string
  username: string
  onRoomJoined?: (roomId: string) => void
  onBack?: () => void
}

export default function ChatWindow({ room, token, username, onRoomJoined, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimeoutRef = useRef<number>()
  const joinedRoomRef = useRef<string>('')
  const isMobile = window.innerWidth < 768

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'message':
        if (msg.room_id === room.id && msg.message) {
          setMessages((prev) => [...prev, msg.message!])
        }
        break
      case 'history':
        if (msg.room_id === room.id && msg.messages) {
          console.log('Received history for room:', room.id, 'messages:', msg.messages.length)
          setMessages(msg.messages)
        }
        break
      case 'user_joined':
        if (msg.room_id === room.id) {
          // 可以显示通知
        }
        break
      case 'user_left':
        if (msg.room_id === room.id) {
          // 可以显示通知
        }
        break
      case 'typing':
        if (msg.room_id === room.id && msg.username && msg.username !== username) {
          setTypingUsers((prev) => {
            if (!prev.includes(msg.username!)) {
              return [...prev, msg.username!]
            }
            return prev
          })

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
          }
          typingTimeoutRef.current = window.setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u !== msg.username))
          }, 2000)
        }
        break
      case 'error':
        console.error('Server error:', msg.error)
        break
    }
  }, [room.id, username])

  const { isConnected, isAuthenticated, send } = useWebSocket({
    token,
    onMessage: handleServerMessage,
  })

  useEffect(() => {
    if (isAuthenticated) {
      console.log('Joining room:', room.id)
      send({ type: 'join_room', room_id: room.id })
      if (joinedRoomRef.current !== room.id) {
        console.log('Immediately refreshing room list for:', room.id)
        joinedRoomRef.current = room.id
        onRoomJoined?.(room.id)
      }
    }

    return () => {
      if (isConnected) {
        send({ type: 'leave_room', room_id: room.id })
      }
    }
  }, [room.id, isAuthenticated, send, onRoomJoined])

  const handleSendMessage = useCallback((content: MessageContent) => {
    send({
      type: 'message',
      room_id: room.id,
      content,
    })
  }, [send, room.id])

  const handleTyping = useCallback(() => {
    send({
      type: 'typing',
      room_id: room.id,
    })
  }, [send, room.id])

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Room Header */}
      <div className="px-3 md:px-6 py-2 md:py-4 bg-white/80 backdrop-blur-lg border-b border-gray-200/60 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          {/* 返回按钮 - 仅移动端 */}
          {onBack && isMobile && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* 房间图标 */}
          <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base md:text-lg font-bold text-gray-800 truncate">{room.name}</h2>
            <div className="flex items-center gap-2 mt-0.5 md:mt-1">
              <span className={`relative flex h-2 w-2 md:h-2.5 md:w-2.5`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              </span>
              <span className={`text-xs md:text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
                {isConnected ? '已连接' : '未连接'}
              </span>
              <span className="text-gray-300 hidden sm:inline">|</span>
              <span className="text-xs md:text-sm text-gray-500 hidden sm:inline">
                {room.member_count} 人在线
              </span>
            </div>
          </div>
        </div>

        {/* 装饰性元素 - 桌面端 */}
        <div className="hidden md:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        currentUsername={username}
        typingUsers={typingUsers}
      />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        disabled={!isConnected}
      />
    </div>
  )
}
