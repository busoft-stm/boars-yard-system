import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SnackbarTone } from './Snackbar'

export type NotificationTone = 'critical' | 'warn' | 'info'

export type AppNotification = {
  id: string
  title: string
  detail: string
  tone: NotificationTone
  href: string
  createdAt: number
}

type NotificationsContextValue = {
  notifications: AppNotification[]
  unreadCount: number
  pushNotification: (input: {
    title: string
    detail: string
    tone?: NotificationTone
    href?: string
  }) => void
  pushFromToast: (message: string, tone?: SnackbarTone) => void
  markAllRead: () => void
  clearNotifications: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
)

const MAX_ITEMS = 30

function toneFromSnackbar(tone: SnackbarTone | undefined): NotificationTone {
  if (tone === 'error') return 'critical'
  if (tone === 'success') return 'info'
  return 'info'
}

function hrefFromMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('exception') || lower.includes('qa hold')) {
    return '/exceptions'
  }
  if (lower.includes('gate') || lower.includes('checked in') || lower.includes('outbound')) {
    return '/gate'
  }
  if (
    lower.includes('temperature') ||
    lower.includes('reefer') ||
    lower.includes('cold-chain') ||
    lower.includes('excursion')
  ) {
    return '/temperature'
  }
  if (lower.includes('dock')) return '/dock'
  if (lower.includes('device') || lower.includes('ble') || lower.includes('gps') || lower.includes('battery')) {
    return '/devices'
  }
  if (lower.includes('otm') || lower.includes('thermo') || lower.includes('carrier') || lower.includes('integration')) {
    return '/integrations'
  }
  if (lower.includes('geofence') || lower.includes('fuel') || lower.includes('dwell')) {
    return '/map'
  }
  return '/exceptions'
}

function splitMessage(message: string): { title: string; detail: string } {
  const parts = message.split(' · ')
  if (parts.length >= 2) {
    return { title: parts[0]!.trim(), detail: parts.slice(1).join(' · ').trim() }
  }
  const dash = message.indexOf(' — ')
  if (dash > 0) {
    return {
      title: message.slice(0, dash).trim(),
      detail: message.slice(dash + 3).trim(),
    }
  }
  return { title: 'Yard update', detail: message }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [readAt, setReadAt] = useState(0)

  const pushNotification = useCallback(
    (input: {
      title: string
      detail: string
      tone?: NotificationTone
      href?: string
    }) => {
      const item: AppNotification = {
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: input.title,
        detail: input.detail,
        tone: input.tone ?? 'info',
        href: input.href ?? '/exceptions',
        createdAt: Date.now(),
      }
      setNotifications((prev) => [item, ...prev].slice(0, MAX_ITEMS))
    },
    [],
  )

  const pushFromToast = useCallback(
    (message: string, tone?: SnackbarTone) => {
      const { title, detail } = splitMessage(message)
      pushNotification({
        title,
        detail,
        tone: toneFromSnackbar(tone),
        href: hrefFromMessage(message),
      })
    },
    [pushNotification],
  )

  const markAllRead = useCallback(() => {
    setReadAt(Date.now())
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setReadAt(Date.now())
  }, [])

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.createdAt > readAt).length,
    [notifications, readAt],
  )

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      pushNotification,
      pushFromToast,
      markAllRead,
      clearNotifications,
    }),
    [
      notifications,
      unreadCount,
      pushNotification,
      pushFromToast,
      markAllRead,
      clearNotifications,
    ],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return ctx
}
