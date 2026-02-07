import { Navigate } from 'react-router-dom'

interface PrivateRouteProps {
  children: React.ReactNode
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')

  if (!token || !username) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
