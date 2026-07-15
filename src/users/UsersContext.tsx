import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  type ManagedUser,
  type UserRole,
  type UserStatus,
} from '../data/users'
import { formatUsPhone } from '../utils/usFormat'
import { db } from '../db/yardDb'

export type NewUserInput = {
  name: string
  email: string
  role: UserRole
  site: string
  phone?: string
  status?: UserStatus
  password: string
}

type UsersContextValue = {
  users: ManagedUser[]
  ready: boolean
  addUser: (input: NewUserInput) => Promise<ManagedUser>
  updateUser: (id: string, patch: Partial<ManagedUser>) => Promise<void>
  setUserPassword: (id: string, password: string) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  setUserStatus: (id: string, status: UserStatus) => Promise<void>
  findByEmail: (email: string) => ManagedUser | undefined
}

const UsersContext = createContext<UsersContextValue | null>(null)

export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const rows = await db.users.toArray()
    setUsers(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    refresh()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [refresh])

  const findByEmail = useCallback(
    (email: string) =>
      users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()),
    [users],
  )

  const addUser = useCallback(
    async (input: NewUserInput) => {
      const password = input.password.trim()
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.')
      }
      const user: ManagedUser = {
        id: `u-${Date.now()}`,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        status: input.status ?? 'invited',
        site: input.site.trim() || 'Primary DC',
        lastActive: input.status === 'active' ? 'Just now' : 'Invite pending',
        phone: input.phone?.trim() ? formatUsPhone(input.phone) : undefined,
        password,
      }
      await db.users.put(user)
      await refresh()
      return user
    },
    [refresh],
  )

  const updateUser = useCallback(
    async (id: string, patch: Partial<ManagedUser>) => {
      const existing = await db.users.get(id)
      if (!existing) return
      const next: ManagedUser = {
        ...existing,
        ...patch,
        id,
        password: patch.password?.trim() || existing.password,
      }
      if (patch.phone != null) {
        next.phone = patch.phone.trim() ? formatUsPhone(patch.phone) : undefined
      }
      await db.users.put(next)
      await refresh()
    },
    [refresh],
  )

  const setUserPassword = useCallback(
    async (id: string, password: string) => {
      const trimmed = password.trim()
      if (trimmed.length < 6) {
        throw new Error('Password must be at least 6 characters.')
      }
      const existing = await db.users.get(id)
      if (!existing) throw new Error('User not found.')
      await db.users.put({ ...existing, password: trimmed })
      await refresh()
    },
    [refresh],
  )

  const deleteUser = useCallback(
    async (id: string) => {
      await db.users.delete(id)
      await refresh()
    },
    [refresh],
  )

  const setUserStatus = useCallback(
    async (id: string, status: UserStatus) => {
      const existing = await db.users.get(id)
      if (!existing) return
      const lastActive =
        status === 'disabled'
          ? 'Disabled'
          : status === 'invited'
            ? 'Invite pending'
            : existing.lastActive === 'Disabled' ||
                existing.lastActive === 'Invite pending'
              ? 'Just now'
              : existing.lastActive
      await db.users.put({ ...existing, status, lastActive })
      await refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      users,
      ready,
      addUser,
      updateUser,
      setUserPassword,
      deleteUser,
      setUserStatus,
      findByEmail,
    }),
    [
      users,
      ready,
      addUser,
      updateUser,
      setUserPassword,
      deleteUser,
      setUserStatus,
      findByEmail,
    ],
  )

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
}

export function useUsers() {
  const ctx = useContext(UsersContext)
  if (!ctx) throw new Error('useUsers must be used within UsersProvider')
  return ctx
}
