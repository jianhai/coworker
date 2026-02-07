import { useState, useEffect, useCallback } from 'react'
import { getApiUrl } from '../api'
import RoomList from '../components/RoomList'
import ChatWindow from '../components/ChatWindow'
import type { Room } from '../types'

export default function ChatPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsKey, setRoomsKey] = useState(0)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'rooms' | 'chat'>('rooms')
  const token = localStorage.getItem('token') || ''
  const username = localStorage.getItem('username') || ''

  useEffect(() => {
    // 初始化配置
    getApiUrl().then(() => {
      fetchRooms()
    })
  }, [])

  // 检测是否为移动设备
  const isMobile = window.innerWidth < 768

  const handleRoomJoined = useCallback((roomId: string) => {
    if (joinedRoomId && joinedRoomId !== roomId) {
      setRooms(prev => prev.map(r =>
        r.id === joinedRoomId ? { ...r, member_count: Math.max(0, r.member_count - 1) } : r
      ))
    }

    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, member_count: r.member_count + 1 } : r
    ))

    setJoinedRoomId(roomId)
  }, [joinedRoomId])

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const apiUrl = await getApiUrl()
      const response = await fetch(`${apiUrl}/api/rooms`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setRoomsKey(prev => prev + 1)
      setRooms(data.rooms || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取房间列表失败'
      console.error('Failed to fetch rooms:', err)
      setError(errorMessage)
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCreateRoom = async (name: string) => {
    try {
      const apiUrl = await getApiUrl()
      const response = await fetch(`${apiUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (response.ok) {
        await fetchRooms()
      }
    } catch (error) {
      console.error('Failed to create room:', error)
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    try {
      const apiUrl = await getApiUrl()
      const response = await fetch(`${apiUrl}/api/rooms/${roomId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        if (selectedRoom?.id === roomId) {
          setSelectedRoom(null)
          setMobileView('rooms')
        }
        await fetchRooms()
      } else {
        const errorData = await response.json()
        alert(`删除失败: ${errorData.error || '未知错误'}`)
      }
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : '网络错误'}`)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    window.location.href = '/'
  }

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room)
    if (window.innerWidth < 768) {
      setMobileView('chat')
    }
  }

  const handleBackToRooms = () => {
    setMobileView('rooms')
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-100 via-white to-blue-50/30">
      {/* Header - 隐藏在移动端聊天视图中 */}
      <header className={`bg-white/80 backdrop-blur-lg shadow-sm px-4 md:px-6 py-3 md:py-4 border-b border-gray-200/60 flex items-center justify-between ${isMobile && mobileView === 'chat' ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-base md:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            协作聊天室
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
              {username.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-gray-700 font-medium">{username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 md:px-5 py-2 md:py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium flex items-center gap-1 md:gap-2 text-sm md:text-base"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden md:inline">退出</span>
          </button>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="mx-4 md:mx-6 mt-4 p-3 md:p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-800 text-sm md:text-base">加载失败</p>
              <p className="text-xs md:text-sm text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchRooms}
              className="px-3 md:px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs md:text-sm font-medium"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-2 md:p-4 gap-2 md:gap-4 relative">
        {/* Sidebar - Room List */}
        <aside className={`absolute md:relative inset-0 md:inset-auto z-20 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden flex flex-col transition-transform duration-300 ${isMobile && mobileView === 'chat' ? '-translate-x-full' : 'translate-x-0'} md:translate-x-0 w-full md:w-80`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>加载中...</span>
              </div>
            </div>
          ) : (
            <RoomList
              key={roomsKey}
              rooms={rooms}
              selectedRoom={selectedRoom}
              onSelectRoom={handleSelectRoom}
              onCreateRoom={handleCreateRoom}
              onDeleteRoom={handleDeleteRoom}
            />
          )}
        </aside>

        {/* Chat Area */}
        <main className={`absolute md:relative inset-0 md:inset-auto z-10 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden transition-transform duration-300 ${isMobile && mobileView === 'rooms' ? 'translate-x-full' : 'translate-x-0'} md:translate-x-0 w-full`}>
          {selectedRoom ? (
            <ChatWindow room={selectedRoom} token={token} username={username} onRoomJoined={handleRoomJoined} onBack={handleBackToRooms} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 px-4">
              <div className="w-16 h-16 md:w-24 md:h-24 mb-4 md:mb-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <svg className="w-8 h-8 md:w-12 md:h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm md:text-lg font-medium text-gray-500 text-center">选择一个聊天室开始对话</p>
              <p className="text-xs md:text-sm mt-2 text-gray-400 text-center">或者创建一个新的聊天室</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
