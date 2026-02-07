import { useEffect, useRef } from 'react'
import type { Message } from '../types'

interface MessageListProps {
  messages: Message[]
  currentUsername: string
  typingUsers: string[]
}

// 生成用户头像颜色
function getAvatarColor(username: string): string {
  const colors = [
    'bg-gradient-to-br from-pink-400 to-rose-500',
    'bg-gradient-to-br from-purple-400 to-indigo-500',
    'bg-gradient-to-br from-blue-400 to-cyan-500',
    'bg-gradient-to-br from-teal-400 to-emerald-500',
    'bg-gradient-to-br from-amber-400 to-orange-500',
    'bg-gradient-to-br from-red-400 to-pink-500',
    'bg-gradient-to-br from-indigo-400 to-purple-500',
    'bg-gradient-to-br from-cyan-400 to-blue-500',
  ]
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// 获取用户名首字母
function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}

export default function MessageList({
  messages,
  currentUsername,
  typingUsers,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } else {
      return date.toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 md:px-4 py-3 md:py-6 -mt-16 -mb-20 pt-20 pb-24">
      {/* 背景装饰 - 移动端简化 */}
      <div className="fixed inset-0 pointer-events-none -z-10 hidden md:block">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-50 to-blue-50/30" />
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-100/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-100/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto space-y-3 md:space-y-6 px-1">
        {messages.map((message, index) => {
          const isOwn = message.sender === currentUsername
          const showAvatar = !isOwn && (index === 0 || messages[index - 1]?.sender !== message.sender)

          return (
            <div
              key={message.id}
              className={`flex gap-2 md:gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* 头像 */}
              {!isOwn && showAvatar && (
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${getAvatarColor(message.sender)} flex items-center justify-center text-white text-xs md:text-sm font-bold shadow-lg shadow-gray-200/50 flex-shrink-0`}>
                  {getInitials(message.sender)}
                </div>
              )}
              {!isOwn && !showAvatar && <div className="w-8 md:w-10 flex-shrink-0" />}

              <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[75%]`}>
                {/* 发送者名称（仅他人消息显示） */}
                {!isOwn && showAvatar && (
                  <span className="text-xs font-medium text-gray-500 mb-1 ml-1">
                    {message.sender}
                  </span>
                )}

                {/* 消息气泡 */}
                <div
                  className={`group relative px-3 py-2 md:px-4 md:py-2.5 ${
                    isOwn
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-blue-500/25'
                      : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm shadow-md shadow-gray-200/50 border border-gray-100'
                  }`}
                >
                  {message.content.content_type === 'text' ? (
                    <p className="break-words leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                      {message.content.text}
                    </p>
                  ) : (
                    <img
                      src={message.content.image}
                      alt="Shared image"
                      className="max-w-full rounded-lg min-w-[150px] md:min-w-[200px]"
                    />
                  )}

                  {/* 时间戳 */}
                  <div
                    className={`text-xs mt-0.5 md:mt-1 flex items-center gap-1 ${
                      isOwn ? 'text-blue-100/70' : 'text-gray-400'
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* 正在输入指示器 */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 bg-white/80 backdrop-blur-sm rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 w-fit ml-10 md:ml-13">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs md:text-sm text-gray-500">
              {typingUsers.join(', ')} 正在输入...
            </span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>
    </div>
  )
}
