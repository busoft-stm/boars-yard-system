import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ROLE_META, DEFAULT_USER_PASSWORD } from '../data/users'
import { useUsers } from '../users/UsersContext'
import { loadAuthSession, saveAuthSession } from '../db/yardDb'
import type { AuthUser } from './types'

export type { AuthUser }

export type ProfileUpdateInput = {
  name: string
  email: string
  site: string
  phone?: string
}

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  ready: boolean
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => Promise<void>
  updateProfile: (input: ProfileUpdateInput) => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>
  canManageUsers: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    findByEmail,
    updateUser,
    setUserPassword,
    users,
    ready: usersReady,
  } = useUsers()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!usersReady) return
    let cancelled = false
    loadAuthSession()
      .then(async (session) => {
        if (cancelled) return
        if (session?.role && ROLE_META[session.role]) {
          setUser({
            ...session,
            roleLabel: ROLE_META[session.role].label,
          })
          setReady(true)
          return
        }
        // Auto-login admin during Figma MCP page capture (hash #figmacapture=…)
        const capture =
          typeof window !== 'undefined' &&
          window.location.hash.includes('figmacapture=')
        const onLogin =
          typeof window !== 'undefined' &&
          window.location.pathname === '/login'
        if (capture && !onLogin) {
          const admin =
            users.find((u) => u.role === 'admin' && u.status === 'active') ??
            users[0]
          if (admin) {
            const next: AuthUser = {
              id: admin.id,
              name: admin.name,
              email: admin.email,
              role: admin.role,
              roleLabel: ROLE_META[admin.role].label,
              site: admin.site,
            }
            await saveAuthSession(next)
            if (!cancelled) setUser(next)
          }
        }
        if (!cancelled) setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [usersReady, users])

  const login = useCallback(
    async (email: string, password: string) => {
      if (!email.trim() || !password.trim()) {
        return { ok: false as const, error: 'Enter email and password.' }
      }

      const known = findByEmail(email)
      if (!known) {
        return {
          ok: false as const,
          error:
            'No account found for this email. Ask a Platform Admin to add you.',
        }
      }
      if (known.status === 'disabled') {
        return { ok: false as const, error: 'This account is disabled.' }
      }
      if (known.status === 'invited') {
        return {
          ok: false as const,
          error:
            'Invite pending — ask a Platform Admin to activate your account.',
        }
      }

      const expected = known.password?.trim() || DEFAULT_USER_PASSWORD
      if (password !== expected) {
        return { ok: false as const, error: 'Invalid email or password.' }
      }

      const next: AuthUser = {
        id: known.id,
        name: known.name,
        email: known.email,
        role: known.role,
        roleLabel: ROLE_META[known.role].label,
        site: known.site,
      }

      await saveAuthSession(next)
      setUser(next)
      return { ok: true as const }
    },
    [findByEmail],
  )

  const logout = useCallback(async () => {
    await saveAuthSession(null)
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput) => {
      if (!user) throw new Error('Not signed in.')
      const name = input.name.trim()
      const email = input.email.trim().toLowerCase()
      const site = input.site.trim() || 'Primary DC'
      if (!name || !email) {
        throw new Error('Name and email are required.')
      }
      const conflict = findByEmail(email)
      if (conflict && conflict.id !== user.id) {
        throw new Error('A user with this email already exists.')
      }
      await updateUser(user.id, {
        name,
        email,
        site,
        phone: input.phone?.trim() || undefined,
      })
      const next: AuthUser = {
        ...user,
        name,
        email,
        site,
      }
      await saveAuthSession(next)
      setUser(next)
    },
    [user, findByEmail, updateUser],
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user) throw new Error('Not signed in.')
      const known = users.find((u) => u.id === user.id)
      if (!known) throw new Error('User not found.')
      const expected = known.password?.trim() || DEFAULT_USER_PASSWORD
      if (currentPassword.trim() !== expected) {
        throw new Error('Current password is incorrect.')
      }
      if (newPassword.trim().length < 6) {
        throw new Error('Password must be at least 6 characters.')
      }
      if (newPassword.trim() === currentPassword.trim()) {
        throw new Error(
          'New password must be different from the current password.',
        )
      }
      await setUserPassword(user.id, newPassword)
    },
    [user, users, setUserPassword],
  )

  const canManageUsers = user?.role === 'admin'

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      ready,
      login,
      logout,
      updateProfile,
      changePassword,
      canManageUsers,
    }),
    [
      user,
      ready,
      login,
      logout,
      updateProfile,
      changePassword,
      canManageUsers,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
