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
  type DeviceHealth,
  type DeviceKind,
  type DeviceStatus,
  type YardDevice,
} from '../data/platform'
import { db } from '../db/yardDb'
import { formatUsDateTime } from '../utils/usFormat'

export type NewDeviceInput = {
  name: string
  kind: DeviceKind
  health: DeviceHealth
  status?: DeviceStatus
  batteryPct: number | null
  assignedTrailer: string | null
  location: string
  vendor: string
}

type DevicesContextValue = {
  devices: YardDevice[]
  ready: boolean
  addDevice: (input: NewDeviceInput) => Promise<YardDevice>
  updateDevice: (id: string, patch: Partial<YardDevice>) => Promise<void>
  setDeviceStatus: (id: string, status: DeviceStatus) => Promise<void>
  devicesForTrailer: (trailerNumber: string) => YardDevice[]
  syncTrailerDevices: (
    trailerNumber: string,
    deviceIds: string[],
  ) => Promise<void>
  remapTrailerNumber: (fromNumber: string, toNumber: string) => Promise<void>
}

const DevicesContext = createContext<DevicesContextValue | null>(null)

export function DevicesProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<YardDevice[]>([])
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const rows = await db.devices.toArray()
    setDevices(rows)
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

  const addDevice = useCallback(
    async (input: NewDeviceInput) => {
      const device: YardDevice = {
        id: `dev-${Date.now()}`,
        name: input.name.trim(),
        kind: input.kind,
        health: input.health,
        status: input.status ?? 'active',
        batteryPct: input.batteryPct,
        assignedTrailer: input.assignedTrailer?.trim() || null,
        location: input.location.trim() || 'Gate cabinet',
        lastSeen: formatUsDateTime(),
        vendor: input.vendor.trim() || 'BH Smart Yard',
      }
      await db.devices.put(device)
      await refresh()
      return device
    },
    [refresh],
  )

  const updateDevice = useCallback(
    async (id: string, patch: Partial<YardDevice>) => {
      const existing = await db.devices.get(id)
      if (!existing) return
      const next: YardDevice = {
        ...existing,
        ...patch,
        id,
        lastSeen: formatUsDateTime(),
      }
      await db.devices.put(next)
      await refresh()
    },
    [refresh],
  )

  const setDeviceStatus = useCallback(
    async (id: string, status: DeviceStatus) => {
      const existing = await db.devices.get(id)
      if (!existing) return
      await db.devices.put({
        ...existing,
        status,
        health: status === 'disabled' ? 'offline' : existing.health === 'offline' ? 'unassigned' : existing.health,
        lastSeen: formatUsDateTime(),
      })
      await refresh()
    },
    [refresh],
  )

  const devicesForTrailer = useCallback(
    (trailerNumber: string) => {
      const key = trailerNumber.trim().toUpperCase()
      return devices.filter(
        (d) =>
          d.assignedTrailer?.toUpperCase() === key && d.kind !== 'gateway',
      )
    },
    [devices],
  )

  const syncTrailerDevices = useCallback(
    async (trailerNumber: string, deviceIds: string[]) => {
      const key = trailerNumber.trim().toUpperCase()
      const selected = new Set(deviceIds)
      const rows = await db.devices.toArray()
      const now = formatUsDateTime()

      await db.transaction('rw', db.devices, async () => {
        for (const d of rows) {
          if (d.kind === 'gateway') continue
          const assigned = d.assignedTrailer?.toUpperCase() === key
          const shouldAssign = selected.has(d.id)

          if (shouldAssign && !assigned) {
            await db.devices.put({
              ...d,
              assignedTrailer: key,
              health:
                d.health === 'unassigned' || d.health === 'offline'
                  ? 'online'
                  : d.health,
              lastSeen: now,
            })
          } else if (!shouldAssign && assigned) {
            await db.devices.put({
              ...d,
              assignedTrailer: null,
              health: d.status === 'disabled' ? 'offline' : 'unassigned',
              location: 'Gate cabinet',
              lastSeen: now,
            })
          }
        }
      })
      await refresh()
    },
    [refresh],
  )

  const remapTrailerNumber = useCallback(
    async (fromNumber: string, toNumber: string) => {
      const from = fromNumber.trim().toUpperCase()
      const to = toNumber.trim().toUpperCase()
      if (!from || !to || from === to) return
      const rows = (await db.devices.toArray()).filter(
        (d) => d.assignedTrailer?.toUpperCase() === from,
      )
      const now = formatUsDateTime()
      await db.transaction('rw', db.devices, async () => {
        for (const d of rows) {
          await db.devices.put({
            ...d,
            assignedTrailer: to,
            lastSeen: now,
          })
        }
      })
      await refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      devices,
      ready,
      addDevice,
      updateDevice,
      setDeviceStatus,
      devicesForTrailer,
      syncTrailerDevices,
      remapTrailerNumber,
    }),
    [
      devices,
      ready,
      addDevice,
      updateDevice,
      setDeviceStatus,
      devicesForTrailer,
      syncTrailerDevices,
      remapTrailerNumber,
    ],
  )

  return (
    <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>
  )
}

export function useDevices() {
  const ctx = useContext(DevicesContext)
  if (!ctx) throw new Error('useDevices must be used within DevicesProvider')
  return ctx
}
