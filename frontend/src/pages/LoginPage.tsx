import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import RegisterForm from '../components/RegisterForm'
import type { AuthResponse } from '../types'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const navigate = useNavigate()

  const handleAuthSuccess = (data: AuthResponse) => {
    localStorage.setItem('token', data.token)
    localStorage.setItem('username', data.username)
    navigate('/chat')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          {isRegister ? '注册账号' : '聊天室登录'}
        </h1>

        {isRegister ? (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onToggleLogin={() => setIsRegister(false)}
          />
        ) : (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onToggleRegister={() => setIsRegister(true)}
          />
        )}
      </div>
    </div>
  )
}
