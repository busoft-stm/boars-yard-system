import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  seedGeofenceEvents,
  type GeofenceEvent,
  type GeofenceEventType,
} from '../data/geofence'
import { useYard } from '../yard/YardContext'
import { useSmartYard } from '../smart/SmartYardContext'
import { useNotifications } from '../notifications/NotificationsContext'
import { formatUsTime } from '../utils/usFormat'

type GeofenceContextValue = {
  events: GeofenceEvent[]
  pendingRecovery: GeofenceEvent[]
  unacknowledged: GeofenceEvent[]
  acknowledge: (id: string) => void
  acknowledgeForTrailer: (trailerId: string) => void
  recordEvent: (input: {
    type: GeofenceEventType
    trailerId: string
    trailerNumber: string
    deviceId?: string
    detail: string
    needsDeviceRecovery?: boolean
    acknowledged?: boolean
    notify?: boolean
  }) => GeofenceEvent
  simulateEnter: (trailerId: string) => void
  simulateLeave: (trailerId: string) => void
}

const GeofenceContext = createContext<GeofenceContextValue | null>(null)

export function GeofenceProvider({ children }: { children: ReactNode }) {
  const { trailers } = useYard()
  const { getDeviceForTrailer } = useSmartYard()
  const { pushNotification } = useNotifications()
  const [events, setEvents] = useState<GeofenceEvent[]>(() =>
    structuredClone(seedGeofenceEvents),
  )
  const notifiedIds = useRef(new Set<string>())

  useEffect(() => {
    for (const ev of events) {
      if (ev.acknowledged || notifiedIds.current.has(ev.id)) continue
      if (ev.type === 'leave_yard' && ev.needsDeviceRecovery) {
        notifiedIds.current.add(ev.id)
        pushNotification({
          title: 'Left yard geofence',
          detail: `${ev.trailerNumber}${ev.deviceId ? ` · ${ev.deviceId}` : ''} · recover device at gate exit`,
          tone: 'warn',
          href: '/gate',
        })
      } else if (ev.type === 'enter_yard') {
        notifiedIds.current.add(ev.id)
        pushNotification({
          title: 'Entered yard geofence',
          detail: `${ev.trailerNumber} · auto arrival event`,
          tone: 'info',
          href: '/yards',
        })
      }
    }
  }, [events, pushNotification])

  const acknowledge = useCallback((id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, acknowledged: true } : e)),
    )
  }, [])

  const acknowledgeForTrailer = useCallback((trailerId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.trailerId === trailerId && !e.acknowledged
          ? { ...e, acknowledged: true }
          : e,
      ),
    )
  }, [])

  const recordEvent = useCallback(
    (input: {
      type: GeofenceEventType
      trailerId: string
      trailerNumber: string
      deviceId?: string
      detail: string
      needsDeviceRecovery?: boolean
      acknowledged?: boolean
      notify?: boolean
    }) => {
      const ev: GeofenceEvent = {
        id: `gf-${Date.now()}`,
        type: input.type,
        trailerNumber: input.trailerNumber,
        trailerId: input.trailerId,
        deviceId: input.deviceId,
        time: formatUsTime(),
        detail: input.detail,
        acknowledged: !!input.acknowledged,
        needsDeviceRecovery: !!input.needsDeviceRecovery,
      }
      setEvents((prev) => [ev, ...prev].slice(0, 40))
      if (input.notify === false) {
        notifiedIds.current.add(ev.id)
      }
      return ev
    },
    [],
  )

  const simulateEnter = useCallback(
    (trailerId: string) => {
      const t = trailers.find((x) => x.id === trailerId)
      if (!t) return
      const device = getDeviceForTrailer(t.number)
      return recordEvent({
        type: 'enter_yard',
        trailerId: t.id,
        trailerNumber: t.number,
        deviceId: device?.id,
        detail: 'Simulated enter yard geofence · auto arrival',
      })
    },
    [trailers, getDeviceForTrailer, recordEvent],
  )

  const simulateLeave = useCallback(
    (trailerId: string) => {
      const t = trailers.find((x) => x.id === trailerId)
      if (!t) return
      const device = getDeviceForTrailer(t.number)
      const needsRecovery = !!device
      return recordEvent({
        type: 'leave_yard',
        trailerId: t.id,
        trailerNumber: t.number,
        deviceId: device?.id,
        detail: needsRecovery
          ? `Simulated leave · recover ${device!.id}`
          : 'Simulated leave yard geofence',
        needsDeviceRecovery: needsRecovery,
      })
    },
    [trailers, getDeviceForTrailer, recordEvent],
  )

  const pendingRecovery = useMemo(
    () =>
      events.filter(
        (e) =>
          !e.acknowledged && e.type === 'leave_yard' && e.needsDeviceRecovery,
      ),
    [events],
  )

  const unacknowledged = useMemo(
    () => events.filter((e) => !e.acknowledged),
    [events],
  )

  const value = useMemo(
    () => ({
      events,
      pendingRecovery,
      unacknowledged,
      acknowledge,
      acknowledgeForTrailer,
      recordEvent,
      simulateEnter,
      simulateLeave,
    }),
    [
      events,
      pendingRecovery,
      unacknowledged,
      acknowledge,
      acknowledgeForTrailer,
      recordEvent,
      simulateEnter,
      simulateLeave,
    ],
  )

  return (
    <GeofenceContext.Provider value={value}>{children}</GeofenceContext.Provider>
  )
}

export function useGeofence() {
  const ctx = useContext(GeofenceContext)
  if (!ctx) throw new Error('useGeofence must be used within GeofenceProvider')
  return ctx
}
