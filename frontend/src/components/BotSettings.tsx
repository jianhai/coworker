import { useState, useEffect } from 'react'
import { getApiUrl } from '../api'
import type { BotDetail, CreateBotRequest } from '../types'

interface BotSettingsProps {
  roomId: string
}

export default function BotSettings({ roomId }: BotSettingsProps) {
  const [bots, setBots] = useState<BotDetail[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state
  const [botName, setBotName] = useState('')
  const [botAvatar, setBotAvatar] = useState('🤖')
  const [defaultReply, setDefaultReply] = useState('你好！')
  const [keywordInput, setKeywordInput] = useState('')
  const [replyInput, setReplyInput] = useState('')
  const [keywords, setKeywords] = useState<Record<string, string>>({})

  const fetchBots = async () => {
    try {
      const apiUrl = await getApiUrl()
      const response = await fetch(`${apiUrl}/api/rooms/${roomId}/bots`)
      if (response.ok) {
        const data = await response.json()
        setBots(data.bots || [])
      }
    } catch (error) {
      console.error('Failed to fetch bots:', error)
    }
  }

  useEffect(() => {
    fetchBots()
  }, [roomId])

  const handleCreateBot = async () => {
    setLoading(true)
    try {
      const request: CreateBotRequest = {
        name: botName,
        avatar: botAvatar || undefined,
        default_reply: defaultReply || undefined,
        keywords: Object.keys(keywords).length > 0 ? keywords : undefined,
      }

      const apiUrl = await getApiUrl()
      const response = await fetch(`${apiUrl}/api/rooms/${roomId}/bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (response.ok) {
        setShowCreateForm(false)
        setBotName('')
        setBotAvatar('🤖')
        setDefaultReply('你好！')
        setKeywords({})
        fetchBots()
      }
    } catch (error) {
      console.error('Failed to create bot:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBot = async (botId: string, botName: string) => {
    if (!confirm(`确定要删除机器人 "${botName}" 吗？`)) return

    setLoading(true)
    try {
      const apiUrl = await getApiUrl()
      const response = await fetch(`${apiUrl}/api/rooms/${roomId}/bots/${botId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchBots()
      }
    } catch (error) {
      console.error('Failed to delete bot:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddKeyword = () => {
    if (keywordInput.trim() && replyInput.trim()) {
      setKeywords({ ...keywords, [keywordInput.trim()]: replyInput.trim() })
      setKeywordInput('')
      setReplyInput('')
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    const newKeywords = { ...keywords }
    delete newKeywords[keyword]
    setKeywords(newKeywords)
  }

  if (showCreateForm) {
    return (
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">创建聊天机器人</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">机器人名称</label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="例如：小助手"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">头像 (emoji)</label>
            <input
              type="text"
              value={botAvatar}
              onChange={(e) => setBotAvatar(e.target.value)}
              placeholder="🤖"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">默认回复</label>
            <input
              type="text"
              value={defaultReply}
              onChange={(e) => setDefaultReply(e.target.value)}
              placeholder="当没有匹配关键词时的回复"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-2">关键词回复</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="关键词"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder="回复内容"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddKeyword}
                className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
              >
                添加
              </button>
            </div>

            {Object.entries(keywords).length > 0 && (
              <div className="space-y-1">
                {Object.entries(keywords).map(([keyword, reply]) => (
                  <div
                    key={keyword}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200"
                  >
                    <span className="text-sm">
                      <span className="font-medium text-blue-600">{keyword}</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="text-gray-600">{reply}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreateBot}
              disabled={loading || !botName.trim()}
              className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? '创建中...' : '创建'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false)
                setBotName('')
                setBotAvatar('🤖')
                setDefaultReply('你好！')
                setKeywords({})
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          聊天机器人 ({bots.length})
        </h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
        >
          添加
        </button>
      </div>

      {bots.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">该聊天室还没有机器人</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="bg-white rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{bot.avatar}</span>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{bot.name}</p>
                    <p className="text-xs text-gray-500">默认: {bot.default_reply}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteBot(bot.id, bot.name)}
                  disabled={loading}
                  className="text-red-500 hover:text-red-700 text-sm disabled:text-gray-400"
                >
                  {loading ? '删除中...' : '删除'}
                </button>
              </div>

              {bot.keywords && Object.keys(bot.keywords).length > 0 && (
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <p className="text-xs text-gray-600 mb-1">关键词:</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(bot.keywords).map(([keyword, reply]) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                        title={`回复: ${reply}`}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
