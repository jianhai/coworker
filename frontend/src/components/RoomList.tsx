import { useState, useEffect } from 'react'
import { getEndpoint } from '../api'
import type { Room, BotDetail, CreateBotRequest } from '../types'

interface RoomListProps {
  rooms: Room[]
  selectedRoom: Room | null
  onSelectRoom: (room: Room) => void
  onCreateRoom: (name: string) => void
  onDeleteRoom: (roomId: string) => void
}

interface BotState {
  [roomId: string]: {
    bots: BotDetail[]
    loading: boolean
    showForm: boolean
    showList: boolean
  }
}

interface MemberState {
  [roomId: string]: {
    members: string[]
    loading: boolean
    showList: boolean
  }
}

// 生成房间图标颜色
function getRoomColor(name: string): string {
  const colors = [
    'from-pink-400 to-rose-500',
    'from-purple-400 to-indigo-500',
    'from-blue-400 to-cyan-500',
    'from-teal-400 to-emerald-500',
    'from-amber-400 to-orange-500',
    'from-red-400 to-pink-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function RoomList({
  rooms,
  selectedRoom,
  onSelectRoom,
  onCreateRoom,
  onDeleteRoom,
}: RoomListProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [botStates, setBotStates] = useState<BotState>({})
  const [memberStates, setMemberStates] = useState<MemberState>({})

  const [formState, setFormState] = useState({
    roomId: '',
    botName: '',
    botAvatar: '🤖',
    defaultReply: '你好！',
    keywordInput: '',
    replyInput: '',
    keywords: {} as Record<string, string>,
    aiModel: '',
    systemPrompt: '',
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (newRoomName.trim()) {
      onCreateRoom(newRoomName.trim())
      setNewRoomName('')
      setShowCreate(false)
    }
  }

  const fetchBots = async (roomId: string) => {
    try {
      const response = await fetch(await getEndpoint(`/api/rooms/${roomId}/bots`))
      if (response.ok) {
        const data = await response.json()
        setBotStates((prev) => ({
          ...prev,
          [roomId]: {
            ...(prev[roomId] || { showForm: false, showList: false }),
            bots: data.bots || [],
            loading: false,
          },
        }))
      }
    } catch (error) {
      console.error('Failed to fetch bots:', error)
    }
  }

  const fetchMembers = async (roomId: string) => {
    setMemberStates((prev) => ({
      ...prev,
      [roomId]: { ...(prev[roomId] || { showList: false }), members: [], loading: true },
    }))
    try {
      const response = await fetch(await getEndpoint(`/api/rooms/${roomId}/members`))
      if (response.ok) {
        const data = await response.json()
        setMemberStates((prev) => ({
          ...prev,
          [roomId]: { members: data.members || [], loading: false, showList: true },
        }))
      } else {
        setMemberStates((prev) => ({
          ...prev,
          [roomId]: { ...(prev[roomId] || { showList: false }), loading: false },
        }))
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
      setMemberStates((prev) => ({
        ...prev,
        [roomId]: { ...(prev[roomId] || { showList: false }), loading: false },
      }))
    }
  }

  useEffect(() => {
    const currentRoomIds = new Set(rooms.map(r => r.id))
    setBotStates((prev) => {
      const cleaned: BotState = {}
      Object.keys(prev).forEach(id => {
        if (currentRoomIds.has(id)) {
          cleaned[id] = prev[id]
        }
      })
      return cleaned
    })

    rooms.forEach((room) => {
      setBotStates((prev) => ({
        ...prev,
        [room.id]: {
          ...(prev[room.id] || { showForm: false, showList: false }),
          bots: (prev[room.id] || {}).bots || [],
          loading: true,
        },
      }))
    })

    rooms.forEach((room) => {
      fetchBots(room.id)
    })
  }, [rooms])

  const handleCreateBot = async (roomId: string) => {
    const state = botStates[roomId]
    if (!state) return

    setBotStates((prev) => ({
      ...prev,
      [roomId]: { ...state, loading: true },
    }))

    try {
      const request: CreateBotRequest = {
        name: formState.botName,
        avatar: formState.botAvatar || undefined,
        ai_model: 'deepseek-chat',
        system_prompt: formState.systemPrompt || undefined,
      }

      const response = await fetch(await getEndpoint(`/api/rooms/${roomId}/bots`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (response.ok) {
        setFormState({
          roomId: '',
          botName: '',
          botAvatar: '🤖',
          defaultReply: '你好！',
          keywordInput: '',
          replyInput: '',
          keywords: {},
          aiModel: '',
          systemPrompt: '',
        })
        fetchBots(roomId)
      }
    } catch (error) {
      console.error('Failed to create bot:', error)
    } finally {
      setBotStates((prev) => ({
        ...prev,
        [roomId]: { ...prev[roomId]!, loading: false },
      }))
    }
  }

  const handleDeleteBot = async (roomId: string, botId: string, botName: string) => {
    if (!confirm(`确定要删除机器人 "${botName}" 吗？`)) return

    const state = botStates[roomId]
    if (!state) return

    setBotStates((prev) => ({
      ...prev,
      [roomId]: { ...state, loading: true },
    }))

    try {
      const response = await fetch(await getEndpoint(`/api/rooms/${roomId}/bots/${botId}`), {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchBots(roomId)
      }
    } catch (error) {
      console.error('Failed to delete bot:', error)
    } finally {
      setBotStates((prev) => ({
        ...prev,
        [roomId]: { ...prev[roomId]!, loading: false },
      }))
    }
  }

  const toggleBotList = (roomId: string) => {
    setBotStates((prev) => {
      const state = prev[roomId]
      if (!state) return prev
      return {
        ...prev,
        [roomId]: { ...state, showList: !state.showList },
      }
    })
  }

  const showBotForm = (roomId: string) => {
    setFormState((prev) => ({ ...prev, roomId }))
    setBotStates((prev) => {
      const state = prev[roomId]
      if (!state) return prev
      return {
        ...prev,
        [roomId]: { ...state, showForm: true },
      }
    })
  }

  const hideBotForm = (roomId: string) => {
    setFormState({
      roomId: '',
      botName: '',
      botAvatar: '🤖',
      defaultReply: '你好！',
      keywordInput: '',
      replyInput: '',
      keywords: {},
      aiModel: '',
      systemPrompt: '',
    })
    setBotStates((prev) => {
      const state = prev[roomId]
      if (!state) return prev
      return {
        ...prev,
        [roomId]: { ...state, showForm: false },
      }
    })
  }

  const isFormForRoom = (roomId: string) => formState.roomId === roomId

  const toggleMemberList = (roomId: string) => {
    setMemberStates((prev) => {
      const state = prev[roomId]
      if (!state || !state.showList) {
        fetchMembers(roomId)
        return {
          ...prev,
          [roomId]: { ...(state || { members: [] }), loading: true, showList: true },
        }
      } else {
        return {
          ...prev,
          [roomId]: { ...(state || { members: [] }), showList: false },
        }
      }
    })
  }

  const handleMemberClick = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    toggleMemberList(roomId)
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-50 to-white border-r border-gray-200">
      {/* Create Room */}
      <div className="p-3 md:p-4 border-b border-gray-200/60">
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-2.5 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center justify-center gap-2 text-sm md:text-base"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建聊天室
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-2 md:space-y-3">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="聊天室名称"
              className="w-full px-3 md:px-4 py-2.5 md:py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm md:text-base"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 font-medium text-sm md:text-base"
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false)
                  setNewRoomName('')
                }}
                className="flex-1 py-2.5 md:py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium text-sm md:text-base"
              >
                取消
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Room List */}
      <div className="flex-1 overflow-y-auto px-2 md:px-3 py-2 space-y-1.5 md:space-y-2">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 md:h-48 text-gray-400">
            <svg className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs md:text-sm">暂无聊天室</p>
          </div>
        ) : (
          rooms.map((room) => {
            const state = botStates[room.id]
            const bots = state?.bots || []
            const showList = state?.showList ?? false
            const showForm = state?.showForm ?? false
            const isSelected = selectedRoom?.id === room.id
            const colorClass = getRoomColor(room.name)

            return (
              <div key={room.id} className="space-y-1">
                {/* Room Card */}
                <div
                  className={`group relative p-2.5 md:p-3 rounded-xl md:rounded-2xl cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div
                    className="flex items-center justify-between"
                    onClick={() => onSelectRoom(room)}
                  >
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                      {/* Room Icon */}
                      <div className={`w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-gradient-to-br ${isSelected ? 'from-white/20 to-white/10' : colorClass} flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md flex-shrink-0`}>
                        {room.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold truncate text-sm md:text-base ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                          {room.name}
                        </div>
                        <div className={`text-xs md:text-sm flex items-center gap-1 ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {room.member_count}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - 移动端常显，桌面端hover显示 */}
                    <div className={`flex items-center gap-0.5 md:gap-1 ${isSelected ? 'opacity-100' : 'opacity-60 md:opacity-0 md:group-hover:opacity-100'} transition-opacity`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleBotList(room.id)
                        }}
                        className={`p-1.5 md:p-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'hover:bg-white/20 text-white'
                            : 'hover:bg-gray-100 text-gray-500 hover:text-blue-500'
                        }`}
                        title={`机器人 (${bots.length})`}
                      >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMemberClick(room.id, e)
                        }}
                        className={`p-1.5 md:p-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'hover:bg-white/20 text-white'
                            : 'hover:bg-gray-100 text-gray-500 hover:text-blue-500'
                        }`}
                        title="成员"
                      >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`确定要删除聊天室 "${room.name}" 吗？`)) {
                            onDeleteRoom(room.id)
                          }
                        }}
                        className={`p-1.5 md:p-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'hover:bg-white/20 text-white'
                            : 'hover:bg-red-50 text-gray-500 hover:text-red-500'
                        }`}
                        title="删除"
                      >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bot Panel */}
                {showList && (
                  <div className="ml-2 md:ml-3 p-2 md:p-3 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100">
                    {showForm && isFormForRoom(room.id) ? (
                      <div className="space-y-2 md:space-y-3">
                        <h4 className="text-xs md:text-sm font-semibold text-gray-700">创建AI机器人</h4>
                        <input
                          type="text"
                          value={formState.botName}
                          onChange={(e) => setFormState((prev) => ({ ...prev, botName: e.target.value }))}
                          placeholder="机器人名称"
                          className="w-full px-2.5 md:px-3 py-2 text-xs md:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                        />
                        <input
                          type="text"
                          value={formState.botAvatar}
                          onChange={(e) => setFormState((prev) => ({ ...prev, botAvatar: e.target.value }))}
                          placeholder="头像 (emoji，如 🤖)"
                          className="w-full px-2.5 md:px-3 py-2 text-xs md:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                        />
                        <textarea
                          value={formState.systemPrompt}
                          onChange={(e) => setFormState((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                          placeholder="系统提示词（可选）"
                          className="w-full px-2.5 md:px-3 py-2 text-xs md:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreateBot(room.id)}
                            disabled={state?.loading || !formState.botName.trim()}
                            className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs md:text-sm rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-medium"
                          >
                            {state?.loading ? '创建中...' : '创建'}
                          </button>
                          <button
                            onClick={() => hideBotForm(room.id)}
                            className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs md:text-sm rounded-xl hover:bg-gray-300 font-medium"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5 md:space-y-2 mb-2 md:mb-3">
                          {bots.map((bot) => (
                            <div
                              key={bot.id}
                              className="flex items-center justify-between bg-white px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border border-gray-200"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg md:text-xl">{bot.avatar}</span>
                                <span className="text-xs md:text-sm font-medium text-gray-700">{bot.name}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteBot(room.id, bot.id, bot.name)}
                                disabled={state?.loading}
                                className="text-red-500 hover:text-red-700 text-xs disabled:text-gray-400 p-1 rounded-lg hover:bg-red-50"
                              >
                                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => showBotForm(room.id)}
                          className="w-full py-2 md:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs md:text-sm rounded-xl hover:from-emerald-600 hover:to-teal-600 font-medium shadow-md shadow-emerald-500/20"
                        >
                          + 添加机器人
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Member Panel */}
                {(() => {
                  const memberState = memberStates[room.id]
                  const showMemberList = memberState?.showList ?? false
                  const members = memberState?.members || []
                  const membersLoading = memberState?.loading ?? false
                  const botState = botStates[room.id]
                  const bots = botState?.bots || []

                  if (!showMemberList) return null

                  return (
                    <div className="ml-2 md:ml-3 p-2 md:p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl md:rounded-2xl border border-indigo-100">
                      <div className="flex items-center justify-between mb-2 md:mb-3">
                        <h4 className="text-xs md:text-sm font-semibold text-indigo-800 flex items-center gap-1.5 md:gap-2">
                          <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          成员 ({members.length + bots.length})
                        </h4>
                        <button
                          onClick={() => toggleMemberList(room.id)}
                          className="text-indigo-500 hover:text-indigo-700 p-1 rounded-lg hover:bg-indigo-100"
                          title="关闭"
                        >
                          <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {membersLoading ? (
                        <div className="flex items-center justify-center py-3 md:py-4">
                          <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : members.length === 0 && bots.length === 0 ? (
                        <div className="text-center py-3 md:py-4 text-gray-500 text-xs md:text-sm">
                          暂无成员
                        </div>
                      ) : (
                        <div className="space-y-1 md:space-y-1.5">
                          {/* Bots Section */}
                          {bots.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-500 mb-1 md:mb-1.5 px-1">机器人</div>
                              {bots.map((bot) => (
                                <div
                                  key={bot.id}
                                  className="flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border border-emerald-200"
                                >
                                  <span className="text-base md:text-lg">{bot.avatar}</span>
                                  <span className="text-xs md:text-sm font-medium text-gray-700">{bot.name}</span>
                                  <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 md:px-2 py-0.5 rounded-full">AI</span>
                                </div>
                              ))}
                            </>
                          )}
                          {/* Members Section */}
                          {members.length > 0 && (
                            <>
                              {bots.length > 0 && <div className="text-xs font-medium text-gray-500 mb-1 md:mb-1.5 mt-1.5 md:mt-2 px-1">用户</div>}
                              {members.map((member) => (
                                <div
                                  key={member}
                                  className="flex items-center gap-1.5 md:gap-2 bg-white px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border border-indigo-100"
                                >
                                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                    {member.slice(0, 2).toUpperCase()}
                                  </div>
                                  <span className="text-xs md:text-sm font-medium text-gray-700">{member}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
