import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  computeSmartKpis,
  filterSmartAlertsByCapabilities,
  gpsTrackForTrailer,
  seedAiRecommendations,
  seedBleAnchors,
  seedDeviceHistory,
  seedInfraAssets,
  seedOemIntegrations,
  seedSmartAlerts,
  seedUnifiedDevices,
  seedInfraAutoMovements,
  seedInfraAlerts,
  withInfraDefaults,
  computeInfraOpsKpis,
  sensorStatusesForCapabilities,
  SMART_DEVICE_CLASS_META,
  YARD_GPS_ORIGIN,
  type ConnectivityProfile,
  type DeviceHistoryEvent,
  type OemIntegration,
  type SmartAlert,
  type SmartCapability,
  type SmartDeviceClass,
  type SmartLifecycle,
  type UnifiedSmartDevice,
  type YardInfraAsset,
  type InfraKind,
  type InfraAutoMovement,
  type InfraAlert,
  type BleAnchor,
} from '../data/smartEnterprise'
import { formatUsTime } from '../utils/usFormat'

function offsetGpsForInstall() {
  return {
    lat: YARD_GPS_ORIGIN.lat + (Math.random() - 0.5) * 0.001,
    lng: YARD_GPS_ORIGIN.lng + (Math.random() - 0.5) * 0.001,
  }
}

type SmartDeviceWriteInput = {
  deviceClass: SmartDeviceClass
  hardwareModel: string
  capabilities: SmartCapability[]
  connectivityProfile: ConnectivityProfile
  serialNumber?: string
  rfidTagId?: string
  imei?: string
  location?: string
  firmwareVersion?: string
  note?: string
}

type SmartYardContextValue = {
  devices: UnifiedSmartDevice[]
  deviceHistory: DeviceHistoryEvent[]
  infra: YardInfraAsset[]
  bleAnchors: typeof seedBleAnchors
  infraMovements: InfraAutoMovement[]
  infraAlerts: InfraAlert[]
  infraOpsKpis: ReturnType<typeof computeInfraOpsKpis>
  oemIntegrations: OemIntegration[]
  smartAlerts: SmartAlert[]
  aiRecommendations: typeof seedAiRecommendations
  kpis: ReturnType<typeof computeSmartKpis>
  getDeviceForTrailer: (trailerNumber: string) => UnifiedSmartDevice | undefined
  getDeviceById: (id: string) => UnifiedSmartDevice | undefined
  getInfraById: (id: string) => YardInfraAsset | undefined
  historyForDevice: (deviceId: string) => DeviceHistoryEvent[]
  gpsTrackForTrailer: typeof gpsTrackForTrailer
  assignDeviceToTrailer: (
    deviceId: string,
    trailerNumber: string,
    trailerId: string,
    location: string,
  ) => Promise<UnifiedSmartDevice>
  unassignDevice: (deviceId: string) => Promise<UnifiedSmartDevice>
  setDeviceLifecycle: (
    deviceId: string,
    lifecycle: SmartLifecycle,
  ) => Promise<UnifiedSmartDevice>
  applyBleProximitySlot: (
    deviceId: string,
    slotLabel: string,
    confidence: number,
    nearbyDock?: string | null,
  ) => Promise<UnifiedSmartDevice>
  installInfraDevice: (input: {
    name: string
    kind: InfraKind
    zone: string
    location: string
    status?: YardInfraAsset['status']
    coverageRadius?: number
    firmwareVersion?: string
    serialNumber?: string
    note?: string
  }) => Promise<YardInfraAsset>
  updateInfraDevice: (
    id: string,
    patch: Partial<YardInfraAsset>,
  ) => Promise<YardInfraAsset>
  setInfraEnabled: (id: string, enabled: boolean) => Promise<YardInfraAsset>
  setInfraMaintenance: (id: string) => Promise<YardInfraAsset>
  acknowledgeInfraAlert: (id: string) => void
  resolveInfraAlert: (id: string) => void
  installSmartDevice: (input: SmartDeviceWriteInput) => Promise<UnifiedSmartDevice>
  updateSmartDevice: (
    deviceId: string,
    input: SmartDeviceWriteInput,
  ) => Promise<UnifiedSmartDevice>
}

const SmartYardContext = createContext<SmartYardContextValue | null>(null)

export function SmartYardProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<UnifiedSmartDevice[]>(() =>
    structuredClone(seedUnifiedDevices),
  )
  const [deviceHistory, setDeviceHistory] = useState<DeviceHistoryEvent[]>(() =>
    structuredClone(seedDeviceHistory),
  )
  const [infra, setInfra] = useState(() =>
    structuredClone(seedInfraAssets).map(withInfraDefaults),
  )
  const [bleAnchors, setBleAnchors] = useState(() =>
    structuredClone(seedBleAnchors),
  )
  const [infraMovements] = useState(() =>
    structuredClone(seedInfraAutoMovements),
  )
  const [infraAlerts, setInfraAlerts] = useState(() =>
    structuredClone(seedInfraAlerts),
  )
  const [oemIntegrations] = useState(() => structuredClone(seedOemIntegrations))
  const [smartAlertsSeed] = useState(() => structuredClone(seedSmartAlerts))

  const smartAlerts = useMemo(
    () => filterSmartAlertsByCapabilities(smartAlertsSeed, devices),
    [smartAlertsSeed, devices],
  )

  const kpis = useMemo(
    () => computeSmartKpis(devices, infra),
    [devices, infra],
  )

  const infraOpsKpis = useMemo(
    () => computeInfraOpsKpis(infra, infraMovements),
    [infra, infraMovements],
  )

  const getDeviceForTrailer = useCallback(
    (trailerNumber: string) =>
      devices.find((d) => d.assignedTrailer === trailerNumber),
    [devices],
  )

  const getDeviceById = useCallback(
    (id: string) => devices.find((d) => d.id === id),
    [devices],
  )

  const getInfraById = useCallback(
    (id: string) => infra.find((i) => i.id === id),
    [infra],
  )

  const historyForDevice = useCallback(
    (deviceId: string) =>
      deviceHistory.filter((h) => h.deviceId === deviceId),
    [deviceHistory],
  )

  const pushHistory = useCallback(
    (deviceId: string, type: DeviceHistoryEvent['type'], detail: string) => {
      const ev: DeviceHistoryEvent = {
        id: `dh-${Date.now()}`,
        deviceId,
        time: formatUsTime(),
        type,
        detail,
      }
      setDeviceHistory((prev) => [ev, ...prev])
    },
    [],
  )

  const assignDeviceToTrailer = useCallback(
    async (
      deviceId: string,
      trailerNumber: string,
      trailerId: string,
      location: string,
    ) => {
      const device = devices.find((d) => d.id === deviceId)
      if (!device) throw new Error('Smart device not found.')
      if (device.lifecycle === 'retired' || device.lifecycle === 'lost') {
        throw new Error('Cannot assign a lost or retired device.')
      }
      if (device.lifecycle === 'maintenance') {
        throw new Error('Device is in maintenance.')
      }
      if (
        device.assignedTrailer &&
        device.assignedTrailer !== trailerNumber
      ) {
        throw new Error(
          `${device.id} is already assigned to ${device.assignedTrailer}.`,
        )
      }

      const next: UnifiedSmartDevice = {
        ...device,
        assignedTrailer: trailerNumber,
        trailerId,
        currentLocation: location || device.currentLocation,
        lifecycle: 'in_use',
        gpsStatus: device.capabilities.includes('gps')
          ? device.gpsStatus === 'na'
            ? 'ok'
            : device.gpsStatus
          : 'na',
        bleStatus: device.capabilities.includes('ble')
          ? device.bleStatus === 'na'
            ? 'ok'
            : device.bleStatus
          : 'na',
        rfidStatus: device.capabilities.includes('rfid')
          ? device.rfidStatus === 'na'
            ? 'ok'
            : device.rfidStatus
          : 'na',
        temperatureSensorStatus: device.capabilities.includes('temperature')
          ? device.temperatureSensorStatus === 'na'
            ? 'ok'
            : device.temperatureSensorStatus
          : 'na',
        fuelSensorStatus: device.capabilities.includes('fuel')
          ? device.fuelSensorStatus === 'na'
            ? 'ok'
            : device.fuelSensorStatus
          : 'na',
        lastCommunication: 'Just now',
        bleSuggestedSlot: null,
        connectivity:
          device.connectivity === 'offline' ? 'degraded' : device.connectivity,
      }
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? next : d)))
      const caps =
        device.capabilities.length > 0
          ? device.capabilities.join(', ')
          : 'none'
      pushHistory(
        deviceId,
        'assign',
        `Assigned to ${trailerNumber} · activated caps: ${caps}`,
      )
      return next
    },
    [devices, pushHistory],
  )

  const unassignDevice = useCallback(
    async (deviceId: string) => {
      const device = devices.find((d) => d.id === deviceId)
      if (!device) throw new Error('Smart device not found.')
      const next: UnifiedSmartDevice = {
        ...device,
        assignedTrailer: null,
        trailerId: null,
        lifecycle: 'available',
        currentLocation: 'Device cage · Gate',
        nearbyDock: null,
        slotConfidence: null,
        lastCommunication: 'Just now',
      }
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? next : d)))
      pushHistory(deviceId, 'unassign', 'Returned to available pool')
      return next
    },
    [devices, pushHistory],
  )

  const setDeviceLifecycle = useCallback(
    async (deviceId: string, lifecycle: SmartLifecycle) => {
      const device = devices.find((d) => d.id === deviceId)
      if (!device) throw new Error('Smart device not found.')
      const next: UnifiedSmartDevice = {
        ...device,
        lifecycle,
        lastCommunication: 'Just now',
        ...(lifecycle === 'available'
          ? {
              assignedTrailer: null,
              trailerId: null,
              currentLocation: 'Device cage · Gate',
            }
          : {}),
        ...(lifecycle === 'charging'
          ? { currentLocation: 'Charge bay', gpsStatus: 'offline' as const }
          : {}),
      }
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? next : d)))
      pushHistory(
        deviceId,
        lifecycle === 'charging'
          ? 'charge'
          : lifecycle === 'maintenance'
            ? 'maintenance'
            : 'status',
        `Lifecycle → ${lifecycle.replace('_', ' ')}`,
      )
      return next
    },
    [devices, pushHistory],
  )

  const applyBleProximitySlot = useCallback(
    async (
      deviceId: string,
      slotLabel: string,
      confidence: number,
      nearbyDock: string | null = null,
    ) => {
      const device = devices.find((d) => d.id === deviceId)
      if (!device) throw new Error('Smart device not found.')
      const next: UnifiedSmartDevice = {
        ...device,
        currentLocation: slotLabel,
        slotConfidence: confidence,
        nearbyDock,
        bleSuggestedSlot: null,
        bleStatus: 'ok',
        lastCommunication: 'Just now',
      }
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? next : d)))
      pushHistory(
        deviceId,
        'status',
        `BLE proximity · auto-assigned slot ${slotLabel} (${confidence}% confidence)`,
      )
      return next
    },
    [devices, pushHistory],
  )

  const installInfraDevice = useCallback(
    async (input: {
      name: string
      kind: InfraKind
      zone: string
      location: string
      status?: YardInfraAsset['status']
      coverageRadius?: number
      firmwareVersion?: string
      serialNumber?: string
      note?: string
    }) => {
      const name = input.name.trim()
      if (!name) throw new Error('Name is required.')
      const zone = input.zone.trim() || 'A'
      const location = input.location.trim()
      if (!location) throw new Error('Location is required.')
      const status = input.status ?? 'online'
      const id = `INF-${Date.now().toString(36).toUpperCase()}`
      const x = 15 + Math.round(Math.random() * 70)
      const y = 20 + Math.round(Math.random() * 55)
      const firmware = input.firmwareVersion?.trim()
      const serial = input.serialNumber?.trim()
      const coverage =
        typeof input.coverageRadius === 'number' &&
        Number.isFinite(input.coverageRadius) &&
        input.coverageRadius > 0
          ? input.coverageRadius
          : undefined
      const asset = withInfraDefaults({
        id,
        name,
        kind: input.kind,
        status,
        location,
        zone,
        lastSeen: 'Just now',
        note: input.note?.trim() || 'Newly installed',
        x,
        y,
        enabled: status !== 'disabled',
        ...(firmware ? { firmwareVersion: firmware } : {}),
        ...(serial ? { serialNumber: serial } : {}),
        ...(coverage !== undefined ? { coverageRadius: coverage } : {}),
      })
      setInfra((prev) => [asset, ...prev])
      if (input.kind === 'ble_anchor') {
        const anchor: BleAnchor = {
          id,
          label: name,
          zone,
          slotHint: location,
          status:
            status === 'offline' || status === 'disabled'
              ? 'offline'
              : status === 'degraded' || status === 'maintenance'
                ? 'degraded'
                : 'online',
          x,
          y,
          coverageM: Math.round((asset.coverageRadius ?? 9) * 3.2),
        }
        setBleAnchors((prev) => [anchor, ...prev])
      }
      return asset
    },
    [],
  )

  const updateInfraDevice = useCallback(
    async (id: string, patch: Partial<YardInfraAsset>) => {
      let next: YardInfraAsset | undefined
      setInfra((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i
          next = withInfraDefaults({ ...i, ...patch, id: i.id, kind: i.kind })
          return next
        }),
      )
      if (!next) throw new Error('Infrastructure device not found.')
      if (next.kind === 'ble_anchor') {
        setBleAnchors((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  label: next!.name,
                  zone: next!.zone,
                  slotHint: next!.location,
                  status:
                    next!.connectivity === 'offline'
                      ? 'offline'
                      : next!.connectivity === 'degraded'
                        ? 'degraded'
                        : 'online',
                  x: next!.x,
                  y: next!.y,
                }
              : a,
          ),
        )
      }
      return next
    },
    [],
  )

  const setInfraEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      return updateInfraDevice(id, {
        enabled,
        status: enabled ? 'online' : 'disabled',
        connectivity: enabled ? 'online' : 'offline',
        lastSeen: enabled ? 'Just now' : 'Disabled',
      })
    },
    [updateInfraDevice],
  )

  const setInfraMaintenance = useCallback(
    async (id: string) => {
      const existing = infra.find((i) => i.id === id)
      const history = [
        {
          date: formatUsTime(),
          detail: 'Opened maintenance window',
        },
        ...(existing?.maintenanceHistory ?? []),
      ]
      return updateInfraDevice(id, {
        status: 'maintenance',
        connectivity: 'degraded',
        lastSeen: 'In service',
        maintenanceHistory: history,
      })
    },
    [infra, updateInfraDevice],
  )

  const acknowledgeInfraAlert = useCallback((id: string) => {
    setInfraAlerts((prev) =>
      prev.map((a) =>
        a.id === id && a.status === 'open'
          ? { ...a, status: 'acknowledged' }
          : a,
      ),
    )
  }, [])

  const resolveInfraAlert = useCallback((id: string) => {
    setInfraAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'resolved' } : a,
      ),
    )
  }, [])

  const installSmartDevice = useCallback(
    async (input: SmartDeviceWriteInput) => {
      if (!input.capabilities.length) {
        throw new Error('Select at least one device capability.')
      }
      const nextNum =
        devices.reduce((max, d) => {
          const m = /^USD-(\d+)$/.exec(d.id)
          if (!m) return max
          return Math.max(max, Number(m[1]))
        }, 1000) + 1
      const id = `USD-${nextNum}`
      const classMeta = SMART_DEVICE_CLASS_META[input.deviceClass]
      const capabilities = [...input.capabilities]
      const has = (c: SmartCapability) => capabilities.includes(c)
      const sensors = sensorStatusesForCapabilities(capabilities)
      const serial = input.serialNumber?.trim()
      if (!serial) throw new Error('Enter the hardware serial number.')
      const hardwareModel = input.hardwareModel.trim()
      if (!hardwareModel) throw new Error('Enter the device model / SKU.')
      const rfidTag = has('rfid')
        ? input.rfidTagId?.trim() || undefined
        : undefined
      if (has('rfid') && !rfidTag) {
        throw new Error('Enter the on-device RFID EPC.')
      }
      const imei = has('lte') ? input.imei?.trim() || undefined : undefined
      const note = input.note?.trim() || undefined
      const device: UnifiedSmartDevice = {
        id,
        deviceType: classMeta.label,
        deviceClass: input.deviceClass,
        hardwareModel,
        connectivityProfile: input.connectivityProfile,
        assignedTrailer: null,
        trailerId: null,
        batteryPct: 100,
        healthScore: 100,
        health: 'online',
        connectivity: 'online',
        firmwareVersion: input.firmwareVersion?.trim() || '—',
        lastCommunication: 'Just now',
        lifecycle: 'available',
        chargingCycles: 0,
        currentLocation: input.location?.trim() || 'Unspecified',
        ...sensors,
        capabilities,
        ...offsetGpsForInstall(),
        slotConfidence: null,
        nearbyDock: null,
        bleSuggestedSlot: null,
        serialNumber: serial,
        rfidTagId: rfidTag,
        imei,
        registerNote: note,
      }
      setDevices((prev) => [device, ...prev])
      pushHistory(
        id,
        'status',
        `Registered ${classMeta.label} · ${hardwareModel} · ${serial} · caps ${capabilities.join(', ')}${
          rfidTag ? ` · RFID ${rfidTag}` : ''
        } · ${device.currentLocation}${note ? ` · ${note}` : ''}`,
      )
      return device
    },
    [devices, pushHistory],
  )

  const updateSmartDevice = useCallback(
    async (deviceId: string, input: SmartDeviceWriteInput) => {
      const device = devices.find((d) => d.id === deviceId)
      if (!device) throw new Error('Smart device not found.')
      if (!input.capabilities.length) {
        throw new Error('Select at least one device capability.')
      }
      const classMeta = SMART_DEVICE_CLASS_META[input.deviceClass]
      const capabilities = [...input.capabilities]
      const has = (c: SmartCapability) => capabilities.includes(c)
      const sensors = sensorStatusesForCapabilities(capabilities, device)
      const hardwareModel = input.hardwareModel.trim()
      if (!hardwareModel) throw new Error('Enter the device model / SKU.')
      const next: UnifiedSmartDevice = {
        ...device,
        deviceType: classMeta.label,
        deviceClass: input.deviceClass,
        hardwareModel,
        connectivityProfile: input.connectivityProfile,
        capabilities,
        serialNumber: input.serialNumber?.trim() || device.serialNumber,
        rfidTagId: has('rfid')
          ? input.rfidTagId?.trim() || device.rfidTagId
          : undefined,
        imei: has('lte')
          ? input.imei?.trim() || undefined
          : undefined,
        currentLocation:
          input.location?.trim() || device.currentLocation,
        firmwareVersion:
          input.firmwareVersion?.trim() || device.firmwareVersion,
        registerNote: input.note?.trim() || undefined,
        ...sensors,
      }
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? next : d)))
      pushHistory(
        deviceId,
        'status',
        `Updated inventory · ${classMeta.label} · ${hardwareModel} · caps ${capabilities.join(', ')} · ${next.currentLocation}`,
      )
      return next
    },
    [devices, pushHistory],
  )

  const value: SmartYardContextValue = {
    devices,
    deviceHistory,
    infra,
    bleAnchors,
    infraMovements,
    infraAlerts,
    infraOpsKpis,
    oemIntegrations,
    smartAlerts,
    aiRecommendations: seedAiRecommendations,
    kpis,
    getDeviceForTrailer,
    getDeviceById,
    getInfraById,
    historyForDevice,
    gpsTrackForTrailer,
    assignDeviceToTrailer,
    unassignDevice,
    setDeviceLifecycle,
    applyBleProximitySlot,
    installInfraDevice,
    updateInfraDevice,
    setInfraEnabled,
    setInfraMaintenance,
    acknowledgeInfraAlert,
    resolveInfraAlert,
    installSmartDevice,
    updateSmartDevice,
  }

  return (
    <SmartYardContext.Provider value={value}>{children}</SmartYardContext.Provider>
  )
}

export function useSmartYard() {
  const ctx = useContext(SmartYardContext)
  if (!ctx) throw new Error('useSmartYard must be used within SmartYardProvider')
  return ctx
}
