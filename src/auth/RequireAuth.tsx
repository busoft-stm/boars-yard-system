import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function RequireAuth() {
  const { isAuthenticated, ready } = useAuth()
  if (!ready) {
    return (
      <div className="db-boot">
        <img src="/boars_head_logo.webp" alt="Boar’s Head" className="db-boot-logo" />
        <p>Loading session…</p>
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
