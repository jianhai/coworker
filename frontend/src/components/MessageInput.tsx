import { useState, useRef, useEffect } from 'react'
import type { MessageContent } from '../types'

interface MessageInputProps {
  onSendMessage: (content: MessageContent) => void
  onTyping: () => void
  disabled?: boolean
}

export default function MessageInput({
  onSendMessage,
  onTyping,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<number>()

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value)
    onTyping()

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      // 停止输入指示器
    }, 1000)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSend = () => {
    if (image) {
      onSendMessage({ content_type: 'image', image })
      setImage(null)
    } else if (text.trim()) {
      onSendMessage({ content_type: 'text', text: text.trim() })
      setText('')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    for (const item of items || []) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => {
            setImage(reader.result as string)
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }

  const canSend = text.trim() || image

  return (
    <div className="border-t border-gray-200/60 bg-white/80 backdrop-blur-lg px-3 md:px-4 py-2 md:py-4">
      <div className="max-w-4xl mx-auto">
        {/* 图片预览 */}
        {image && (
          <div className="mb-2 md:mb-3 relative inline-block group">
            <div className="relative rounded-2xl overflow-hidden shadow-lg ring-2 ring-blue-100">
              <img src={image} alt="Preview" className="max-h-32 max-w-xs object-cover" />
            </div>
            <button
              onClick={() => setImage(null)}
              className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* 输入区域 */}
        <div className="flex items-end gap-2 md:gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* 图片上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 md:p-3 rounded-xl transition-all duration-200 flex-shrink-0 ${
              disabled
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50 active:scale-95'
            }`}
            title="上传图片"
            disabled={disabled}
          >
            <svg
              className="w-5 h-5 md:w-6 md:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>

          {/* 文本输入框 */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={text}
              onChange={handleTextChange}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              placeholder="输入消息..."
              disabled={disabled}
              className={`w-full px-4 py-2.5 md:py-3 md:px-5 rounded-2xl border-2 transition-all duration-200 text-sm md:text-base ${
                disabled
                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-50 border-gray-200 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100'
              }`}
            />
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={disabled || !canSend}
            className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-1 md:gap-2 flex-shrink-0 ${
              disabled || !canSend
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95'
            }`}
          >
            <span className="hidden sm:inline">发送</span>
            <svg
              className="w-4 h-4 md:w-5 md:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
