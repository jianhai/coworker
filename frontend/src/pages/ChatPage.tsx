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
  const token = localStorage.getItem('token') || ''
  const username = localStorage.getItem('username') || ''

  useEffect(() => {
    // 初始化配置
    getApiUrl().then(() => {
      // 配置加载完成后获取房间列表
      fetchRooms()
    })
  }, [])

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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-100 via-white to-blue-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-sm px-6 py-4 border-b border-gray-200/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            协作聊天室
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
              {username.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-gray-700 font-medium">{username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出
          </button>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-800">加载失败</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchRooms}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Sidebar - Room List */}
        <aside className="w-80 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden flex flex-col">
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
              onSelectRoom={setSelectedRoom}
              onCreateRoom={handleCreateRoom}
              onDeleteRoom={handleDeleteRoom}
            />
          )}
        </aside>

        {/* Chat Area */}
        <main className="flex-1 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden">
          {selectedRoom ? (
            <ChatWindow room={selectedRoom} token={token} username={username} onRoomJoined={handleRoomJoined} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-500">选择一个聊天室开始对话</p>
              <p className="text-sm mt-2 text-gray-400">或者创建一个新的聊天室</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
