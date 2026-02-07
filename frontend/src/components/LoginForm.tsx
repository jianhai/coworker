import { useState } from 'react'
import { getApiUrl } from '../api'
import type { AuthResponse, LoginRequest } from '../types'

interface LoginFormProps {
  onSuccess: (data: AuthResponse) => void
  onToggleRegister: () => void
}

export default function LoginForm({ onSuccess, onToggleRegister }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const apiUrl = await getApiUrl()
      const response = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password } as LoginRequest),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '登录失败')
      }

      onSuccess(data as AuthResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
      {error && (
        <div className="bg-red-100 text-red-700 p-2.5 md:p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          用户名
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          required
          autoComplete="username"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          密码
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          required
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-500 text-white py-2.5 md:py-3 rounded-xl hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-base touch-manipulation"
      >
        {loading ? '登录中...' : '登录'}
      </button>

      <p className="text-center text-sm text-gray-600">
        还没有账号？
        <button
          type="button"
          onClick={onToggleRegister}
          className="text-blue-500 hover:underline ml-1 font-medium touch-manipulation"
        >
          注册
        </button>
      </p>
    </form>
  )
}
