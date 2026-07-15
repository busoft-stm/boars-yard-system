/**
 * Enterprise Smart Yard extensions — unified devices, infrastructure,
 * OEM integrations, GPS/BLE, and smart alerts. Mock/seed data only.
 */

export type ConnStatus = 'online' | 'degraded' | 'offline'
export type SensorStatus = 'ok' | 'warn' | 'offline' | 'na'

export type SmartLifecycle =
  | 'available'
  | 'assigned'
  | 'in_use'
  | 'charging'
  | 'maintenance'
  | 'lost'
  | 'retired'

export type SmartCapability =
  | 'rfid'
  | 'gps'
  | 'ble'
  | 'temperature'
  | 'fuel'
  | 'lte'

/**
 * Device type = hardware classification / inventory only.
 * Application features are driven by `capabilities`, not by type.
 */
export type SmartDeviceClass =
  | 'unified'
  | 'locator'
  | 'gps_tracker'
  | 'accessory'

/** Cellular / radio profile captured at registration (not live link health). */
export type ConnectivityProfile = 'lte' | '5g' | 'lte_5g' | 'wifi' | 'none'

export const ALL_SMART_CAPABILITIES: SmartCapability[] = [
  'rfid',
  'gps',
  'ble',
  'temperature',
  'fuel',
  'lte',
]

export const CAPABILITY_META: Record<
  SmartCapability,
  { label: string; feature: string }
> = {
  rfid: {
    label: 'RFID',
    feature: 'Trailer identification and gate automation',
  },
  gps: {
    label: 'GPS',
    feature: 'Real-time trailer location, movement tracking and geofencing',
  },
  ble: {
    label: 'BLE',
    feature: 'Exact slot positioning and proximity detection',
  },
  temperature: {
    label: 'Temperature Monitoring',
    feature: 'Cold-chain monitoring and temperature alerts',
  },
  fuel: {
    label: 'Fuel Monitoring',
    feature: 'Reefer fuel level monitoring and low fuel alerts',
  },
  lte: {
    label: 'LTE/5G',
    feature: 'Real-time telemetry communication with the Smart Yard platform',
  },
}

export const CONNECTIVITY_PROFILE_META: Record<
  ConnectivityProfile,
  { label: string }
> = {
  lte: { label: 'LTE' },
  '5g': { label: '5G' },
  lte_5g: { label: 'LTE/5G' },
  wifi: { label: 'Wi‑Fi' },
  none: { label: 'None' },
}

export const CONNECTIVITY_PROFILES = Object.keys(
  CONNECTIVITY_PROFILE_META,
) as ConnectivityProfile[]

/** Suggested capabilities when registering by device type (editable). */
export const SMART_DEVICE_CLASS_META: Record<
  SmartDeviceClass,
  {
    label: string
    description: string
    suggestedCapabilities: SmartCapability[]
    defaultHardwareModel: string
  }
> = {
  unified: {
    label: 'Unified',
    description:
      'Full-featured trailer device — suggest RFID, GPS, BLE, temp, fuel, LTE/5G',
    suggestedCapabilities: [
      'rfid',
      'gps',
      'ble',
      'temperature',
      'fuel',
      'lte',
    ],
    defaultHardwareModel: 'BH-USD-X1',
  },
  locator: {
    label: 'Locator',
    description: 'Yard identity and position — suggest RFID, GPS, BLE, LTE/5G',
    suggestedCapabilities: ['rfid', 'gps', 'ble', 'lte'],
    defaultHardwareModel: 'BH-LOC-200',
  },
  gps_tracker: {
    label: 'GPS Tracker',
    description: 'Position and cellular backhaul — suggest GPS and LTE/5G',
    suggestedCapabilities: ['gps', 'lte'],
    defaultHardwareModel: 'BH-GPS-50',
  },
  accessory: {
    label: 'Accessory pack',
    description: 'Add-on pack — suggest RFID and BLE',
    suggestedCapabilities: ['rfid', 'ble'],
    defaultHardwareModel: 'BH-ACC-10',
  },
}

export const SMART_DEVICE_CLASSES = Object.keys(
  SMART_DEVICE_CLASS_META,
) as SmartDeviceClass[]

/** @deprecated Use SmartDeviceClass — kept for older seed/edit fallbacks. */
export type SmartDeviceModel =
  | 'unified'
  | 'unified_no_fuel'
  | 'locator'
  | 'gps_lte'

export const SMART_DEVICE_MODEL_META: Record<
  SmartDeviceModel,
  {
    label: string
    description: string
    capabilities: SmartCapability[]
    deviceClass: SmartDeviceClass
  }
> = {
  unified: {
    label: 'Unified Smart Trailer Device',
    description: 'RFID · GPS · BLE · temperature · fuel · LTE/5G',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    deviceClass: 'unified',
  },
  unified_no_fuel: {
    label: 'Unified · without fuel',
    description: 'RFID · GPS · BLE · temperature · LTE/5G',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'lte'],
    deviceClass: 'unified',
  },
  locator: {
    label: 'Yard locator',
    description: 'RFID · GPS · BLE · LTE — no cold-chain sensors',
    capabilities: ['rfid', 'gps', 'ble', 'lte'],
    deviceClass: 'locator',
  },
  gps_lte: {
    label: 'GPS / LTE tracker',
    description: 'Yard position and cellular backhaul only',
    capabilities: ['gps', 'lte'],
    deviceClass: 'gps_tracker',
  },
}

export const SMART_DEVICE_MODELS = Object.keys(
  SMART_DEVICE_MODEL_META,
) as SmartDeviceModel[]

export function deviceHasCapability(
  device: Pick<UnifiedSmartDevice, 'capabilities'> | null | undefined,
  cap: SmartCapability,
): boolean {
  return !!device?.capabilities.includes(cap)
}

export function alertRequiredCapability(
  type: SmartAlertType,
): SmartCapability | null {
  switch (type) {
    case 'temperature_critical':
    case 'temperature_warning':
    case 'reefer_alarm':
      return 'temperature'
    case 'low_fuel':
      return 'fuel'
    case 'gps_offline':
    case 'left_geofence':
      return 'gps'
    case 'ble_offline':
      return 'ble'
    case 'device_offline':
      return 'lte'
    default:
      return null
  }
}

export function filterSmartAlertsByCapabilities(
  alerts: SmartAlert[],
  devices: UnifiedSmartDevice[],
): SmartAlert[] {
  return alerts.filter((alert) => {
    const need = alertRequiredCapability(alert.type)
    if (!need) return true
    const device =
      devices.find((d) => d.trailerId === alert.trailerId) ??
      devices.find((d) => d.assignedTrailer === alert.trailerNumber) ??
      (alert.detail.match(/USD-\d+/)
        ? devices.find((d) => alert.detail.includes(d.id))
        : undefined)
    if (!device) {
      // Unassigned / cage alerts: keep only if any matching inventory device has the cap,
      // or keep device_offline / gps on charging units found by ID in detail.
      if (alert.type === 'gps_offline' || alert.type === 'device_offline') {
        const byId = devices.find((d) => alert.detail.includes(d.id))
        if (byId) return deviceHasCapability(byId, need)
      }
      return true
    }
    return deviceHasCapability(device, need)
  })
}

export function sensorStatusesForCapabilities(
  capabilities: SmartCapability[],
  prev?: Pick<
    UnifiedSmartDevice,
    | 'gpsStatus'
    | 'bleStatus'
    | 'rfidStatus'
    | 'temperatureSensorStatus'
    | 'fuelSensorStatus'
  >,
) {
  const has = (c: SmartCapability) => capabilities.includes(c)
  const next = (
    enabled: boolean,
    prior: SensorStatus | undefined,
  ): SensorStatus => {
    if (!enabled) return 'na'
    if (!prior || prior === 'na') return 'ok'
    return prior
  }
  return {
    gpsStatus: next(has('gps'), prev?.gpsStatus),
    bleStatus: next(has('ble'), prev?.bleStatus),
    rfidStatus: next(has('rfid'), prev?.rfidStatus),
    temperatureSensorStatus: next(has('temperature'), prev?.temperatureSensorStatus),
    fuelSensorStatus: next(has('fuel'), prev?.fuelSensorStatus),
  }
}

/** % of assigned trailers whose device includes each capability. */
export function computeCapabilityCoverage(devices: UnifiedSmartDevice[]) {
  const assigned = devices.filter((d) => d.assignedTrailer)
  const n = assigned.length
  const pct = (cap: SmartCapability) =>
    n ? Math.round((assigned.filter((d) => d.capabilities.includes(cap)).length / n) * 100) : 0
  return {
    assignedDevices: n,
    gpsCoverage: pct('gps'),
    bleCoverage: pct('ble'),
    temperatureCoverage: pct('temperature'),
    fuelCoverage: pct('fuel'),
    rfidCoverage: pct('rfid'),
    connectedCoverage: pct('lte'),
  }
}

export type UnifiedSmartDevice = {
  id: string
  /** Display label for device type (inventory classification). */
  deviceType: string
  /** Hardware classification — does not unlock features by itself. */
  deviceClass: SmartDeviceClass
  /** Vendor / SKU model string. */
  hardwareModel: string
  /** Live link health (online / degraded / offline). */
  connectivity: ConnStatus
  /** Radio profile captured at registration. */
  connectivityProfile: ConnectivityProfile
  assignedTrailer: string | null
  trailerId: string | null
  batteryPct: number
  healthScore: number
  health: ConnStatus
  firmwareVersion: string
  lastCommunication: string
  lifecycle: SmartLifecycle
  chargingCycles: number
  currentLocation: string
  gpsStatus: SensorStatus
  bleStatus: SensorStatus
  rfidStatus: SensorStatus
  temperatureSensorStatus: SensorStatus
  fuelSensorStatus: SensorStatus
  /** Drives platform features, alerts, and coverage KPIs. */
  capabilities: SmartCapability[]
  lat: number
  lng: number
  slotConfidence: number | null
  nearbyDock: string | null
  /** When set and confidence is high, BLE auto-assigns this parking slot. */
  bleSuggestedSlot: string | null
  /** Hardware identity captured at register (optional on seeded fleet). */
  serialNumber?: string
  rfidTagId?: string
  imei?: string
  registerNote?: string
}

export type DeviceHistoryEvent = {
  id: string
  deviceId: string
  time: string
  type: 'assign' | 'unassign' | 'charge' | 'maintenance' | 'status' | 'firmware'
  detail: string
}

export type InfraKind =
  | 'rfid_reader'
  | 'ble_anchor'
  | 'edge_gateway'
  | 'iot_gateway'
  | 'gate_reader'
  | 'dock_sensor'
  | 'gps_coverage'

/** Operational status for site infrastructure (dashboard + inventory). */
export type InfraOpsStatus =
  | 'online'
  | 'offline'
  | 'degraded'
  | 'maintenance'
  | 'disabled'

export type YardInfraAsset = {
  id: string
  name: string
  kind: InfraKind
  /** Operational / lifecycle status on the site. */
  status: InfraOpsStatus
  /** Radio / network link health. */
  connectivity: ConnStatus
  location: string
  zone: string
  lastSeen: string
  note: string
  /** 0–100 map position relative to yard canvas */
  x: number
  y: number
  model?: string
  serialNumber?: string
  firmwareVersion?: string
  healthScore?: number
  /** 0–100 RSSI / link quality */
  signalStrength?: number
  /** Coverage radius on map (% of canvas width) */
  coverageRadius?: number
  lat?: number
  lng?: number
  uptimeHours?: number
  lastServiceDate?: string
  nextServiceDate?: string
  maintenanceHistory?: { date: string; detail: string }[]
  enabled?: boolean
}

export type InfraAutoMovementType =
  | 'trailer_entered_gate'
  | 'trailer_exited_gate'
  | 'rfid_detected_trailer'
  | 'gps_entered_yard'
  | 'gps_exited_yard'
  | 'ble_detected_slot'
  | 'trailer_moved_slot'
  | 'trailer_arrived_dock'
  | 'trailer_left_dock'
  | 'dock_occupied'
  | 'dock_released'

export type InfraAutoMovement = {
  id: string
  time: string
  type: InfraAutoMovementType
  event: string
  trailerNumber: string
  trailerId?: string
  infraDeviceId: string
  infraDeviceName: string
  zone: string
  status: 'detected' | 'confirmed' | 'cleared'
}

export type InfraAlertType =
  | 'rfid_offline'
  | 'ble_offline'
  | 'gateway_offline'
  | 'dock_sensor_offline'
  | 'weak_signal'
  | 'comm_failure'
  | 'firmware_update'

export type InfraAlert = {
  id: string
  type: InfraAlertType
  title: string
  detail: string
  infraDeviceId: string
  infraDeviceName: string
  time: string
  severity: 'critical' | 'warn' | 'info'
  status: 'open' | 'acknowledged' | 'resolved'
}

export type BleAnchor = {
  id: string
  label: string
  zone: string
  slotHint: string
  status: ConnStatus
  x: number
  y: number
  coverageM: number
}

export type GpsTrackPoint = {
  t: string
  lat: number
  lng: number
  zone: string
  label: string
}

export type OemSystem = 'Thermo King TracKing' | 'Carrier Transicold Lynx Fleet' | 'Oracle Transportation Management (OTM)'

export type OemIntegration = {
  id: string
  system: OemSystem
  connectionStatus: 'connected' | 'degraded' | 'paused' | 'error'
  lastSync: string
  apiHealth: ConnStatus
  connectedTrailers: number
  note: string
  logs: { time: string; level: 'info' | 'warn' | 'error'; message: string }[]
}

export type SmartAlertType =
  | 'temperature_critical'
  | 'temperature_warning'
  | 'low_fuel'
  | 'gps_offline'
  | 'ble_offline'
  | 'device_offline'
  | 'reefer_alarm'
  | 'battery_low'
  | 'left_geofence'
  | 'excess_dwell'

export type SmartAlert = {
  id: string
  type: SmartAlertType
  title: string
  detail: string
  trailerNumber?: string
  trailerId?: string
  time: string
  severity: 'critical' | 'warn' | 'info'
  href: string
}

export type AiRecommendation = {
  id: string
  tag: string
  title: string
  body: string
  impact: string
  actionLabel: string
  actionTo: string
  tone: 'critical' | 'warn' | 'ok' | 'info'
}

export type FutureAiCard = {
  id: string
  title: string
  blurb: string
  status: 'planned' | 'research' | 'roadmap'
}

export const LIFECYCLE_META: Record<SmartLifecycle, string> = {
  available: 'Available',
  assigned: 'Assigned',
  in_use: 'In use',
  charging: 'Charging',
  maintenance: 'Maintenance',
  lost: 'Lost',
  retired: 'Retired',
}

export const INFRA_KIND_META: Record<InfraKind, string> = {
  rfid_reader: 'RFID reader',
  ble_anchor: 'BLE anchor',
  edge_gateway: 'Edge gateway',
  iot_gateway: 'IoT gateway',
  gate_reader: 'Gate reader',
  dock_sensor: 'Dock sensor',
  gps_coverage: 'GPS geofence area',
}

export const INFRA_OPS_STATUS_META: Record<InfraOpsStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  degraded: 'Degraded',
  maintenance: 'Maintenance',
  disabled: 'Disabled',
}

export const INFRA_AUTO_MOVEMENT_META: Record<InfraAutoMovementType, string> = {
  trailer_entered_gate: 'Trailer Entered Gate',
  trailer_exited_gate: 'Trailer Exited Gate',
  rfid_detected_trailer: 'RFID Reader Detected Trailer',
  gps_entered_yard: 'GPS Entered Yard',
  gps_exited_yard: 'GPS Exited Yard',
  ble_detected_slot: 'BLE Detected Slot',
  trailer_moved_slot: 'Trailer Moved to Slot',
  trailer_arrived_dock: 'Trailer Arrived at Dock',
  trailer_left_dock: 'Trailer Left Dock',
  dock_occupied: 'Dock Occupied',
  dock_released: 'Dock Released',
}

export const INFRA_ALERT_META: Record<InfraAlertType, string> = {
  rfid_offline: 'RFID Reader Offline',
  ble_offline: 'BLE Anchor Offline',
  gateway_offline: 'Gateway Offline',
  dock_sensor_offline: 'Dock Sensor Offline',
  weak_signal: 'Weak Signal',
  comm_failure: 'Communication Failure',
  firmware_update: 'Firmware Update Required',
}

export const SMART_ALERT_LABELS: Record<SmartAlertType, string> = {
  temperature_critical: 'Temperature Critical',
  temperature_warning: 'Temperature Warning',
  low_fuel: 'Low Fuel',
  gps_offline: 'GPS Offline',
  ble_offline: 'BLE Offline',
  device_offline: 'Device Offline',
  reefer_alarm: 'Reefer Alarm',
  battery_low: 'Battery Low',
  left_geofence: 'Trailer Left Geofence',
  excess_dwell: 'Excess Dwell Time',
}

/** Yard map origin — synthetic GPS around facility. */
export const YARD_GPS_ORIGIN = { lat: 39.8784, lng: -82.889 }

function offsetGps(dx: number, dy: number) {
  return {
    lat: YARD_GPS_ORIGIN.lat + dy * 0.00012,
    lng: YARD_GPS_ORIGIN.lng + dx * 0.00015,
  }
}

/**
 * Trailer devices aligned to trailers.ts fleet.
 * Variety of vendors / classes / capabilities — features follow capabilities.
 */
function seedDevice(input: {
  id: string
  deviceClass: SmartDeviceClass
  hardwareModel: string
  connectivityProfile: ConnectivityProfile
  serialNumber: string
  rfidTagId?: string
  imei?: string
  registerNote?: string
  assignedTrailer: string | null
  trailerId: string | null
  batteryPct: number
  healthScore: number
  health: ConnStatus
  connectivity: ConnStatus
  firmwareVersion: string
  lastCommunication: string
  lifecycle: SmartLifecycle
  chargingCycles: number
  currentLocation: string
  capabilities: SmartCapability[]
  dx: number
  dy: number
  slotConfidence: number | null
  nearbyDock: string | null
  bleSuggestedSlot: string | null
  /** Override live sensor health when capability is present. */
  sensorOverrides?: Partial<
    Pick<
      UnifiedSmartDevice,
      | 'gpsStatus'
      | 'bleStatus'
      | 'rfidStatus'
      | 'temperatureSensorStatus'
      | 'fuelSensorStatus'
    >
  >
}): UnifiedSmartDevice {
  const classLabel = SMART_DEVICE_CLASS_META[input.deviceClass].label
  const sensors = {
    ...sensorStatusesForCapabilities(input.capabilities),
    ...input.sensorOverrides,
  }
  const has = (c: SmartCapability) => input.capabilities.includes(c)
  return {
    id: input.id,
    deviceType: classLabel,
    deviceClass: input.deviceClass,
    hardwareModel: input.hardwareModel,
    connectivityProfile: input.connectivityProfile,
    assignedTrailer: input.assignedTrailer,
    trailerId: input.trailerId,
    batteryPct: input.batteryPct,
    healthScore: input.healthScore,
    health: input.health,
    connectivity: input.connectivity,
    firmwareVersion: input.firmwareVersion,
    lastCommunication: input.lastCommunication,
    lifecycle: input.lifecycle,
    chargingCycles: input.chargingCycles,
    currentLocation: input.currentLocation,
    gpsStatus: has('gps') ? sensors.gpsStatus : 'na',
    bleStatus: has('ble') ? sensors.bleStatus : 'na',
    rfidStatus: has('rfid') ? sensors.rfidStatus : 'na',
    temperatureSensorStatus: has('temperature')
      ? sensors.temperatureSensorStatus
      : 'na',
    fuelSensorStatus: has('fuel') ? sensors.fuelSensorStatus : 'na',
    capabilities: input.capabilities,
    ...offsetGps(input.dx, input.dy),
    slotConfidence: input.slotConfidence,
    nearbyDock: input.nearbyDock,
    bleSuggestedSlot: input.bleSuggestedSlot,
    serialNumber: input.serialNumber,
    rfidTagId: has('rfid') ? input.rfidTagId : undefined,
    imei: has('lte') ? input.imei : undefined,
    registerNote: input.registerNote,
  }
}

export const seedUnifiedDevices: UnifiedSmartDevice[] = [
  seedDevice({
    id: 'USD-1001',
    deviceClass: 'unified',
    hardwareModel: 'BH-USD-X1',
    connectivityProfile: 'lte_5g',
    serialNumber: 'SN-BH-001001',
    rfidTagId: 'E28011001001',
    imei: '35986000001001',
    registerNote: 'Primary cold-chain kit · Thermo King lane',
    assignedTrailer: 'BH-4412',
    trailerId: 'bh-4412',
    batteryPct: 86,
    healthScore: 94,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '3.4.2',
    lastCommunication: '2 min ago',
    lifecycle: 'in_use',
    chargingCycles: 142,
    currentLocation: 'A-14',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 2,
    dy: 3,
    slotConfidence: 96,
    nearbyDock: null,
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1002',
    deviceClass: 'unified',
    hardwareModel: 'Sensitech YardPro 4',
    connectivityProfile: 'lte_5g',
    serialNumber: 'ST-YP4-220184',
    rfidTagId: 'E28011001002',
    imei: '35986000001002',
    registerNote: 'Vendor: Sensitech · dual-band LTE/5G',
    assignedTrailer: 'BH-2201',
    trailerId: 'bh-2201',
    batteryPct: 71,
    healthScore: 88,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '4.1.0',
    lastCommunication: '2 min ago',
    lifecycle: 'in_use',
    chargingCycles: 98,
    currentLocation: 'Door 3',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 8,
    dy: 1,
    slotConfidence: 91,
    nearbyDock: 'Door 3',
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1003',
    deviceClass: 'unified',
    hardwareModel: 'BH-USD-X1',
    connectivityProfile: 'lte',
    serialNumber: 'SN-BH-001003',
    rfidTagId: 'E28011001003',
    imei: '35986000001003',
    assignedTrailer: 'BH-3381',
    trailerId: 'bh-3381',
    batteryPct: 18,
    healthScore: 62,
    health: 'degraded',
    connectivity: 'degraded',
    firmwareVersion: '3.3.9',
    lastCommunication: '4 min ago',
    lifecycle: 'in_use',
    chargingCycles: 210,
    currentLocation: 'B-07',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 3,
    dy: 6,
    slotConfidence: 92,
    nearbyDock: null,
    bleSuggestedSlot: 'B-08',
    sensorOverrides: {
      bleStatus: 'warn',
      temperatureSensorStatus: 'warn',
    },
  }),
  seedDevice({
    id: 'USD-1004',
    deviceClass: 'unified',
    hardwareModel: 'Carrier Lynx Link M2',
    connectivityProfile: '5g',
    serialNumber: 'CL-M2-315501',
    rfidTagId: 'E28011001004',
    imei: '35986000001004',
    registerNote: 'Carrier OEM pack · 5G preferred',
    assignedTrailer: 'BH-3155',
    trailerId: 'bh-3155',
    batteryPct: 64,
    healthScore: 72,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '2.8.4',
    lastCommunication: '3 min ago',
    lifecycle: 'in_use',
    chargingCycles: 121,
    currentLocation: 'C-01',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 5,
    dy: 4,
    slotConfidence: 89,
    nearbyDock: 'Door 2',
    bleSuggestedSlot: null,
    sensorOverrides: { temperatureSensorStatus: 'warn' },
  }),
  seedDevice({
    id: 'USD-1005',
    deviceClass: 'unified',
    hardwareModel: 'BH-USD-X1',
    connectivityProfile: 'lte_5g',
    serialNumber: 'SN-BH-001005',
    rfidTagId: 'E28011001005',
    imei: '35986000001005',
    registerNote: 'Cage ready · bench-tested OK',
    assignedTrailer: null,
    trailerId: null,
    batteryPct: 100,
    healthScore: 99,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '3.4.2',
    lastCommunication: 'Just now',
    lifecycle: 'available',
    chargingCycles: 12,
    currentLocation: 'Device cage · Gate',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 0,
    dy: 0,
    slotConfidence: null,
    nearbyDock: null,
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1006',
    deviceClass: 'unified',
    hardwareModel: 'BH-USD-X1NF',
    connectivityProfile: 'lte_5g',
    serialNumber: 'SN-BH-001006',
    rfidTagId: 'E28011001006',
    imei: '35986000001006',
    registerNote: 'No fuel probe SKU',
    assignedTrailer: null,
    trailerId: null,
    batteryPct: 42,
    healthScore: 70,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '3.4.0',
    lastCommunication: '8 min ago',
    lifecycle: 'charging',
    chargingCycles: 188,
    currentLocation: 'Charge bay 2',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'lte'],
    dx: -1,
    dy: 1,
    slotConfidence: null,
    nearbyDock: null,
    bleSuggestedSlot: null,
    sensorOverrides: { gpsStatus: 'offline' },
  }),
  seedDevice({
    id: 'USD-1007',
    deviceClass: 'unified',
    hardwareModel: 'Orbcomm ST9100',
    connectivityProfile: 'lte',
    serialNumber: 'ORB-ST91-1007',
    rfidTagId: 'E28011001007',
    imei: '35986000001007',
    registerNote: 'LTE module RMA · ops bench',
    assignedTrailer: null,
    trailerId: null,
    batteryPct: 9,
    healthScore: 41,
    health: 'offline',
    connectivity: 'offline',
    firmwareVersion: '3.2.4',
    lastCommunication: '2 hr ago',
    lifecycle: 'maintenance',
    chargingCycles: 301,
    currentLocation: 'Ops bench',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 1,
    dy: -1,
    slotConfidence: null,
    nearbyDock: null,
    bleSuggestedSlot: null,
    sensorOverrides: {
      gpsStatus: 'offline',
      bleStatus: 'offline',
      rfidStatus: 'warn',
      temperatureSensorStatus: 'offline',
      fuelSensorStatus: 'offline',
    },
  }),
  seedDevice({
    id: 'USD-1008',
    deviceClass: 'locator',
    hardwareModel: 'BH-LOC-200',
    connectivityProfile: 'lte',
    serialNumber: 'SN-LOC-001008',
    rfidTagId: 'E28011001008',
    imei: '35986000001008',
    registerNote: 'Reported missing after outbound · last ping Zone D',
    assignedTrailer: null,
    trailerId: null,
    batteryPct: 0,
    healthScore: 0,
    health: 'offline',
    connectivity: 'offline',
    firmwareVersion: '2.9.1',
    lastCommunication: '14 days ago',
    lifecycle: 'lost',
    chargingCycles: 450,
    currentLocation: 'Unknown',
    capabilities: ['rfid', 'gps', 'ble', 'lte'],
    dx: 0,
    dy: 0,
    slotConfidence: null,
    nearbyDock: null,
    bleSuggestedSlot: null,
    sensorOverrides: {
      gpsStatus: 'offline',
      bleStatus: 'offline',
      rfidStatus: 'offline',
    },
  }),
  seedDevice({
    id: 'USD-1009',
    deviceClass: 'unified',
    hardwareModel: 'BH-USD-X1',
    connectivityProfile: 'lte_5g',
    serialNumber: 'SN-BH-001009',
    rfidTagId: 'E28011001009',
    imei: '35986000001009',
    assignedTrailer: 'BH-9012',
    trailerId: 'bh-9012',
    batteryPct: 77,
    healthScore: 85,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '3.4.2',
    lastCommunication: '1 min ago',
    lifecycle: 'in_use',
    chargingCycles: 88,
    currentLocation: 'B-11',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 3.5,
    dy: 5,
    slotConfidence: 94,
    nearbyDock: null,
    bleSuggestedSlot: null,
    sensorOverrides: { fuelSensorStatus: 'warn' },
  }),
  seedDevice({
    id: 'USD-1010',
    deviceClass: 'unified',
    hardwareModel: 'BH-USD-X1NF',
    connectivityProfile: 'lte_5g',
    serialNumber: 'SN-BH-001010',
    rfidTagId: 'E28011001010',
    imei: '35986000001010',
    registerNote: 'Unified without fuel monitoring',
    assignedTrailer: 'BH-1877',
    trailerId: 'bh-1877',
    batteryPct: 58,
    healthScore: 79,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '3.4.1',
    lastCommunication: '5 min ago',
    lifecycle: 'in_use',
    chargingCycles: 156,
    currentLocation: 'B-22',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'lte'],
    dx: 4,
    dy: 7,
    slotConfidence: 90,
    nearbyDock: null,
    bleSuggestedSlot: null,
    sensorOverrides: { temperatureSensorStatus: 'warn' },
  }),
  seedDevice({
    id: 'USD-1011',
    deviceClass: 'unified',
    hardwareModel: 'Thermo King YardSense',
    connectivityProfile: 'lte_5g',
    serialNumber: 'TK-YS-880411',
    rfidTagId: 'E28011001011',
    imei: '35986000001011',
    assignedTrailer: 'BH-8804',
    trailerId: 'bh-8804',
    batteryPct: 81,
    healthScore: 91,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '1.6.2',
    lastCommunication: '2 min ago',
    lifecycle: 'in_use',
    chargingCycles: 74,
    currentLocation: 'Door 7',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 9,
    dy: 2,
    slotConfidence: 93,
    nearbyDock: 'Door 7',
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1012',
    deviceClass: 'unified',
    hardwareModel: 'BH-USD-X1',
    connectivityProfile: 'lte',
    serialNumber: 'SN-BH-001012',
    rfidTagId: 'E28011001012',
    imei: '35986000001012',
    assignedTrailer: 'BH-2290',
    trailerId: 'bh-2290',
    batteryPct: 69,
    healthScore: 87,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '3.4.2',
    lastCommunication: '1 min ago',
    lifecycle: 'in_use',
    chargingCycles: 133,
    currentLocation: 'A-02',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 1,
    dy: 2,
    slotConfidence: 95,
    nearbyDock: null,
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1013',
    deviceClass: 'unified',
    hardwareModel: 'Sensitech YardPro 4',
    connectivityProfile: 'lte_5g',
    serialNumber: 'ST-YP4-602213',
    rfidTagId: 'E28011001013',
    imei: '35986000001013',
    assignedTrailer: 'BH-6022',
    trailerId: 'bh-6022',
    batteryPct: 31,
    healthScore: 48,
    health: 'offline',
    connectivity: 'offline',
    firmwareVersion: '4.0.8',
    lastCommunication: '47 min ago',
    lifecycle: 'in_use',
    chargingCycles: 244,
    currentLocation: 'D-03',
    capabilities: ['rfid', 'gps', 'ble', 'temperature', 'fuel', 'lte'],
    dx: 7,
    dy: 5,
    slotConfidence: 41,
    nearbyDock: null,
    bleSuggestedSlot: null,
    sensorOverrides: {
      gpsStatus: 'offline',
      bleStatus: 'offline',
      temperatureSensorStatus: 'offline',
      fuelSensorStatus: 'offline',
    },
  }),
  seedDevice({
    id: 'USD-1014',
    deviceClass: 'locator',
    hardwareModel: 'BH-LOC-200',
    connectivityProfile: 'lte',
    serialNumber: 'SN-LOC-001014',
    rfidTagId: 'E28011001014',
    imei: '35986000001014',
    registerNote: 'Identity + position only · no cold-chain sensors',
    assignedTrailer: 'CRL-8821',
    trailerId: 'crl-8821',
    batteryPct: 55,
    healthScore: 76,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '3.4.0',
    lastCommunication: '6 min ago',
    lifecycle: 'assigned',
    chargingCycles: 49,
    currentLocation: 'A-31',
    capabilities: ['rfid', 'gps', 'ble', 'lte'],
    dx: 2.5,
    dy: 4.5,
    slotConfidence: 87,
    nearbyDock: null,
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1015',
    deviceClass: 'gps_tracker',
    hardwareModel: 'CalAmp TTU-2830',
    connectivityProfile: 'lte',
    serialNumber: 'CA-TTU-440015',
    imei: '35986000001015',
    registerNote: 'GPS + LTE only · dry-van / over-the-road handoff',
    assignedTrailer: 'FTL-440',
    trailerId: 'ftl-440',
    batteryPct: 66,
    healthScore: 82,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '5.2.1',
    lastCommunication: '3 min ago',
    lifecycle: 'in_use',
    chargingCycles: 61,
    currentLocation: 'Gate perimeter',
    capabilities: ['gps', 'lte'],
    dx: -2,
    dy: 8,
    slotConfidence: null,
    nearbyDock: null,
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1016',
    deviceClass: 'gps_tracker',
    hardwareModel: 'BH-GPS-50',
    connectivityProfile: '5g',
    serialNumber: 'SN-GPS-001016',
    imei: '35986000001016',
    registerNote: 'Available pool · position backhaul only',
    assignedTrailer: null,
    trailerId: null,
    batteryPct: 94,
    healthScore: 97,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '3.1.0',
    lastCommunication: '1 min ago',
    lifecycle: 'available',
    chargingCycles: 8,
    currentLocation: 'Device cage · Gate',
    capabilities: ['gps', 'lte'],
    dx: 0.5,
    dy: -0.5,
    slotConfidence: null,
    nearbyDock: null,
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1017',
    deviceClass: 'accessory',
    hardwareModel: 'BH-ACC-10',
    connectivityProfile: 'wifi',
    serialNumber: 'SN-ACC-001017',
    rfidTagId: 'E28011001017',
    registerNote: 'RFID + BLE accessory · Wi‑Fi to yard gateway',
    assignedTrailer: null,
    trailerId: null,
    batteryPct: 88,
    healthScore: 93,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '1.2.0',
    lastCommunication: '4 min ago',
    lifecycle: 'available',
    chargingCycles: 22,
    currentLocation: 'Device cage · Gate',
    capabilities: ['rfid', 'ble'],
    dx: 0.2,
    dy: 0.4,
    slotConfidence: null,
    nearbyDock: null,
    bleSuggestedSlot: null,
  }),
  seedDevice({
    id: 'USD-1018',
    deviceClass: 'locator',
    hardwareModel: 'Geotab GO9 Yard',
    connectivityProfile: 'lte',
    serialNumber: 'GT-GO9-510418',
    rfidTagId: 'E28011001018',
    imei: '35986000001018',
    registerNote: 'Locator without BLE · GPS coverage demo gap for slot precision',
    assignedTrailer: 'BH-5104',
    trailerId: 'bh-5104',
    batteryPct: 73,
    healthScore: 84,
    health: 'online',
    connectivity: 'online',
    firmwareVersion: '6.0.3',
    lastCommunication: '3 min ago',
    lifecycle: 'in_use',
    chargingCycles: 57,
    currentLocation: 'C-19',
    capabilities: ['rfid', 'gps', 'lte'],
    dx: 6,
    dy: 3,
    slotConfidence: 54,
    nearbyDock: null,
    bleSuggestedSlot: null,
  }),
]

export const seedDeviceHistory: DeviceHistoryEvent[] = [
  {
    id: 'dh1',
    deviceId: 'USD-1001',
    time: '5:45 AM',
    type: 'assign',
    detail: 'Assigned to BH-4412 at Gate Lane 1',
  },
  {
    id: 'dh2',
    deviceId: 'USD-1001',
    time: '5:47 AM',
    type: 'status',
    detail:
      'Caps RFID/GPS/BLE/temp/fuel/LTE enabled · BH-USD-X1 · monitoring started · A-14',
  },
  {
    id: 'dh3',
    deviceId: 'USD-1006',
    time: '12:10 PM',
    type: 'charge',
    detail: 'Charging cycle #188 started · bay 2 · BH-USD-X1NF (no fuel)',
  },
  {
    id: 'dh4',
    deviceId: 'USD-1007',
    time: '11:05 AM',
    type: 'maintenance',
    detail: 'Unassigned · Orbcomm ST9100 LTE module RMA on ops bench',
  },
  {
    id: 'dh5',
    deviceId: 'USD-1002',
    time: '10:22 AM',
    type: 'assign',
    detail: 'Assigned to BH-2201 · Sensitech YardPro 4 · staged to Door 3',
  },
  {
    id: 'dh6',
    deviceId: 'USD-1003',
    time: '9:48 AM',
    type: 'status',
    detail: 'BH-3381 · battery below 20% · low-power mode',
  },
  {
    id: 'dh7',
    deviceId: 'USD-1009',
    time: '8:15 AM',
    type: 'assign',
    detail: 'Assigned to BH-9012 · fuel capability armed (22% tank)',
  },
  {
    id: 'dh8',
    deviceId: 'USD-1004',
    time: '8:05 AM',
    type: 'assign',
    detail: 'Assigned to BH-3155 · Carrier Lynx Link M2 · C-01',
  },
  {
    id: 'dh9',
    deviceId: 'USD-1013',
    time: '1:20 PM',
    type: 'status',
    detail: 'BH-6022 · LTE lost · GPS/BLE/temp offline (capabilities still listed)',
  },
  {
    id: 'dh10',
    deviceId: 'USD-1014',
    time: '11:40 AM',
    type: 'assign',
    detail: 'Assigned to CRL-8821 · Locator caps RFID/GPS/BLE/LTE only',
  },
  {
    id: 'dh11',
    deviceId: 'USD-1015',
    time: '1:05 PM',
    type: 'assign',
    detail: 'Assigned to FTL-440 · CalAmp TTU-2830 · GPS + LTE tracker',
  },
  {
    id: 'dh12',
    deviceId: 'USD-1018',
    time: '9:15 AM',
    type: 'assign',
    detail: 'Assigned to BH-5104 · Geotab locator without BLE',
  },
  {
    id: 'dh13',
    deviceId: 'USD-1017',
    time: 'Yesterday',
    type: 'status',
    detail: 'Registered BH-ACC-10 accessory · RFID + BLE · Wi‑Fi profile',
  },
]

export const seedBleAnchors: BleAnchor[] = [
  { id: 'BA-A1', label: 'Anchor A-North', zone: 'A', slotHint: 'A-01–A-16', status: 'online', x: 12, y: 18, coverageM: 28 },
  { id: 'BA-A2', label: 'Anchor A-South', zone: 'A', slotHint: 'A-17–A-32', status: 'online', x: 18, y: 42, coverageM: 28 },
  { id: 'BA-B1', label: 'Anchor B', zone: 'B', slotHint: 'B-01–B-24', status: 'online', x: 38, y: 28, coverageM: 32 },
  { id: 'BA-C1', label: 'Anchor C', zone: 'C', slotHint: 'C-01–C-20', status: 'degraded', x: 58, y: 30, coverageM: 30 },
  { id: 'BA-D1', label: 'Anchor D', zone: 'D', slotHint: 'D-01–D-16', status: 'online', x: 76, y: 34, coverageM: 26 },
  { id: 'BA-DOCK', label: 'Dock apron', zone: 'Dock', slotHint: 'Door 1–8', status: 'online', x: 88, y: 55, coverageM: 40 },
  { id: 'BA-GATE', label: 'Gate canopy', zone: 'Gate', slotHint: 'Lanes 1–3', status: 'online', x: 8, y: 78, coverageM: 22 },
]

function infraModelForKind(kind: InfraKind): string {
  switch (kind) {
    case 'ble_anchor':
      return 'BH-BLE-ANCHOR-2'
    case 'edge_gateway':
      return 'BH-EDGE-GW-4'
    case 'iot_gateway':
      return 'BH-IOT-GW-1'
    case 'dock_sensor':
      return 'BH-DOCK-OC-8'
    case 'gps_coverage':
      return 'BH-GPS-RTK-Z'
    case 'gate_reader':
      return 'BH-GATE-RFID-L'
    default:
      return 'BH-RFID-FX9500'
  }
}

/** Normalize infra rows for V1 + V2 (fills optional Ops Center fields). */
export function withInfraDefaults(
  raw: Omit<YardInfraAsset, 'connectivity'> &
    Partial<Pick<YardInfraAsset, 'connectivity'>> & {
      status: InfraOpsStatus | ConnStatus
    },
): YardInfraAsset {
  const status = (raw.status as InfraOpsStatus) ?? 'online'
  const connectivity: ConnStatus =
    raw.connectivity ??
    (status === 'offline' || status === 'disabled'
      ? 'offline'
      : status === 'degraded' || status === 'maintenance'
        ? 'degraded'
        : 'online')
  const healthScore =
    raw.healthScore ??
    (status === 'online'
      ? 92
      : status === 'degraded'
        ? 68
        : status === 'maintenance'
          ? 55
          : status === 'disabled'
            ? 40
            : 28)
  const gps = offsetGps((raw.x - 50) / 10, (50 - raw.y) / 10)
  return {
    ...raw,
    status,
    connectivity,
    model: raw.model ?? infraModelForKind(raw.kind),
    serialNumber: raw.serialNumber ?? `SN-${raw.id}`,
    firmwareVersion: raw.firmwareVersion ?? '2.4.1',
    healthScore,
    signalStrength:
      raw.signalStrength ??
      (connectivity === 'online' ? 88 : connectivity === 'degraded' ? 52 : 12),
    coverageRadius:
      raw.coverageRadius ??
      (raw.kind === 'ble_anchor'
        ? 9
        : raw.kind === 'gps_coverage'
          ? 18
          : raw.kind === 'gate_reader' || raw.kind === 'rfid_reader'
            ? 6
            : 5),
    lat: raw.lat ?? gps.lat,
    lng: raw.lng ?? gps.lng,
    uptimeHours:
      raw.uptimeHours ??
      (status === 'offline' ? 0 : Math.round(120 + healthScore * 3)),
    lastServiceDate: raw.lastServiceDate ?? 'Jun 12, 2026',
    nextServiceDate: raw.nextServiceDate ?? 'Sep 12, 2026',
    maintenanceHistory: raw.maintenanceHistory ?? [
      { date: 'Jun 12, 2026', detail: 'Quarterly inspection · firmware verified' },
      { date: 'Mar 3, 2026', detail: 'Antenna sweep · OK' },
    ],
    enabled: raw.enabled ?? status !== 'disabled',
  }
}

export const seedInfraAssets: YardInfraAsset[] = [
  withInfraDefaults({
    id: 'RF-G1',
    name: 'Gate RFID reader · Lane 1',
    kind: 'gate_reader',
    status: 'online',
    location: 'Gate canopy',
    zone: 'Gate',
    lastSeen: 'Just now',
    note: 'IN lane LPR+RFID',
    x: 10,
    y: 80,
    firmwareVersion: '3.1.0',
  }),
  withInfraDefaults({
    id: 'RF-G2',
    name: 'Gate RFID reader · Lane 2',
    kind: 'gate_reader',
    status: 'online',
    location: 'Gate canopy',
    zone: 'Gate',
    lastSeen: 'Just now',
    note: 'Flex lane',
    x: 16,
    y: 80,
  }),
  withInfraDefaults({
    id: 'RF-G3',
    name: 'Gate RFID reader · Lane 3',
    kind: 'rfid_reader',
    status: 'degraded',
    location: 'Gate canopy',
    zone: 'Gate',
    lastSeen: '6 min ago',
    note: 'OUT · firmware pending',
    x: 22,
    y: 80,
    firmwareVersion: '2.9.4',
    healthScore: 61,
  }),
  withInfraDefaults({
    id: 'GW-N',
    name: 'Edge gateway · North',
    kind: 'edge_gateway',
    status: 'online',
    location: 'Zone A mast',
    zone: 'A',
    lastSeen: 'Just now',
    note: 'BLE + RFID backhaul',
    x: 20,
    y: 22,
  }),
  withInfraDefaults({
    id: 'GW-S',
    name: 'Edge gateway · Dock',
    kind: 'edge_gateway',
    status: 'online',
    location: 'Dock office',
    zone: 'Dock',
    lastSeen: '1 min ago',
    note: 'Dock sensors + anchors',
    x: 90,
    y: 60,
  }),
  withInfraDefaults({
    id: 'IOT-1',
    name: 'IoT gateway · Yard core',
    kind: 'iot_gateway',
    status: 'online',
    location: 'Ops hut',
    zone: 'B',
    lastSeen: 'Just now',
    note: 'Trailer Device telemetry ingest',
    x: 48,
    y: 48,
    coverageRadius: 14,
  }),
  withInfraDefaults({
    id: 'IOT-2',
    name: 'IoT gateway · Dock uplink',
    kind: 'iot_gateway',
    status: 'maintenance',
    location: 'Dock office',
    zone: 'Dock',
    lastSeen: '42 min ago',
    note: 'Scheduled modem swap',
    x: 86,
    y: 62,
    healthScore: 48,
  }),
  withInfraDefaults({
    id: 'DS-1',
    name: 'Dock door sensor 1–4',
    kind: 'dock_sensor',
    status: 'online',
    location: 'Doors 1–4',
    zone: 'Dock',
    lastSeen: 'Just now',
    note: 'Occupancy + seal',
    x: 84,
    y: 48,
  }),
  withInfraDefaults({
    id: 'DS-2',
    name: 'Dock door sensor 5–8',
    kind: 'dock_sensor',
    status: 'online',
    location: 'Doors 5–8',
    zone: 'Dock',
    lastSeen: 'Just now',
    note: 'Occupancy + seal',
    x: 92,
    y: 48,
  }),
  withInfraDefaults({
    id: 'GPS-1',
    name: 'GPS geofence · Yard west',
    kind: 'gps_coverage',
    status: 'online',
    location: 'Zones A–B',
    zone: 'A',
    lastSeen: 'Just now',
    note: 'RTK assist · enter/leave',
    x: 30,
    y: 40,
    coverageRadius: 20,
  }),
  withInfraDefaults({
    id: 'GPS-2',
    name: 'GPS geofence · Yard east',
    kind: 'gps_coverage',
    status: 'degraded',
    location: 'Zones C–D',
    zone: 'C',
    lastSeen: '4 min ago',
    note: 'Multipath near dock',
    x: 70,
    y: 40,
    coverageRadius: 18,
    healthScore: 64,
  }),
  withInfraDefaults({
    id: 'RF-Y1',
    name: 'Yard RFID reader · Zone B',
    kind: 'rfid_reader',
    status: 'offline',
    location: 'B mast',
    zone: 'B',
    lastSeen: '2 hr ago',
    note: 'Link down · power cycle pending',
    x: 42,
    y: 36,
    healthScore: 18,
  }),
  ...seedBleAnchors.map((a) =>
    withInfraDefaults({
      id: a.id,
      name: a.label,
      kind: 'ble_anchor',
      status: a.status === 'degraded' ? 'degraded' : a.status === 'offline' ? 'offline' : 'online',
      location: a.slotHint,
      zone: a.zone,
      lastSeen: a.status === 'online' ? 'Just now' : '9 min ago',
      note: `Coverage ~${a.coverageM}m`,
      x: a.x,
      y: a.y,
      coverageRadius: Math.max(6, Math.round(a.coverageM / 3.2)),
    }),
  ),
]

export const seedInfraAutoMovements: InfraAutoMovement[] = [
  {
    id: 'iam-1',
    time: '2:18 PM',
    type: 'trailer_entered_gate',
    event: 'Trailer Entered Gate',
    trailerNumber: 'FTL-440',
    trailerId: 'ftl-440',
    infraDeviceId: 'RF-G1',
    infraDeviceName: 'Gate RFID reader · Lane 1',
    zone: 'Gate',
    status: 'confirmed',
  },
  {
    id: 'iam-2',
    time: '2:18 PM',
    type: 'rfid_detected_trailer',
    event: 'RFID Reader Detected Trailer',
    trailerNumber: 'FTL-440',
    trailerId: 'ftl-440',
    infraDeviceId: 'RF-G1',
    infraDeviceName: 'Gate RFID reader · Lane 1',
    zone: 'Gate',
    status: 'detected',
  },
  {
    id: 'iam-3',
    time: '2:19 PM',
    type: 'gps_entered_yard',
    event: 'GPS Entered Yard',
    trailerNumber: 'FTL-440',
    trailerId: 'ftl-440',
    infraDeviceId: 'GPS-1',
    infraDeviceName: 'GPS geofence · Yard west',
    zone: 'A',
    status: 'detected',
  },
  {
    id: 'iam-4',
    time: '2:05 PM',
    type: 'ble_detected_slot',
    event: 'BLE Detected Slot A-14',
    trailerNumber: 'BH-4412',
    trailerId: 'bh-4412',
    infraDeviceId: 'BA-A1',
    infraDeviceName: 'Anchor A-North',
    zone: 'A',
    status: 'confirmed',
  },
  {
    id: 'iam-5',
    time: '1:52 PM',
    type: 'trailer_moved_slot',
    event: 'Trailer Moved to Slot B-04',
    trailerNumber: 'BH-2290',
    trailerId: 'bh-2290',
    infraDeviceId: 'BA-B1',
    infraDeviceName: 'Anchor B',
    zone: 'B',
    status: 'confirmed',
  },
  {
    id: 'iam-6',
    time: '1:40 PM',
    type: 'trailer_arrived_dock',
    event: 'Trailer Arrived at Dock',
    trailerNumber: 'BH-2201',
    trailerId: 'bh-2201',
    infraDeviceId: 'DS-1',
    infraDeviceName: 'Dock door sensor 1–4',
    zone: 'Dock',
    status: 'confirmed',
  },
  {
    id: 'iam-7',
    time: '1:40 PM',
    type: 'dock_occupied',
    event: 'Dock Occupied',
    trailerNumber: 'BH-2201',
    trailerId: 'bh-2201',
    infraDeviceId: 'DS-1',
    infraDeviceName: 'Dock door sensor 1–4',
    zone: 'Dock',
    status: 'confirmed',
  },
  {
    id: 'iam-8',
    time: '1:12 PM',
    type: 'trailer_left_dock',
    event: 'Trailer Left Dock',
    trailerNumber: 'BH-8804',
    trailerId: 'bh-8804',
    infraDeviceId: 'DS-2',
    infraDeviceName: 'Dock door sensor 5–8',
    zone: 'Dock',
    status: 'cleared',
  },
  {
    id: 'iam-9',
    time: '1:12 PM',
    type: 'dock_released',
    event: 'Dock Released',
    trailerNumber: 'BH-8804',
    trailerId: 'bh-8804',
    infraDeviceId: 'DS-2',
    infraDeviceName: 'Dock door sensor 5–8',
    zone: 'Dock',
    status: 'cleared',
  },
  {
    id: 'iam-10',
    time: '12:55 PM',
    type: 'gps_exited_yard',
    event: 'GPS Exited Yard',
    trailerNumber: 'PAX-1103',
    trailerId: 'pax-1103',
    infraDeviceId: 'GPS-2',
    infraDeviceName: 'GPS geofence · Yard east',
    zone: 'C',
    status: 'detected',
  },
  {
    id: 'iam-11',
    time: '12:56 PM',
    type: 'trailer_exited_gate',
    event: 'Trailer Exited Gate',
    trailerNumber: 'PAX-1103',
    trailerId: 'pax-1103',
    infraDeviceId: 'RF-G3',
    infraDeviceName: 'Gate RFID reader · Lane 3',
    zone: 'Gate',
    status: 'confirmed',
  },
]

export const seedInfraAlerts: InfraAlert[] = [
  {
    id: 'ia-1',
    type: 'rfid_offline',
    title: 'RFID Reader Offline',
    detail: 'RF-Y1 · Zone B mast · no heartbeat 2h',
    infraDeviceId: 'RF-Y1',
    infraDeviceName: 'Yard RFID reader · Zone B',
    time: '2:10 PM',
    severity: 'critical',
    status: 'open',
  },
  {
    id: 'ia-2',
    type: 'ble_offline',
    title: 'BLE Anchor Offline',
    detail: 'BA-C1 degraded coverage · Zone C',
    infraDeviceId: 'BA-C1',
    infraDeviceName: 'Anchor C',
    time: '1:55 PM',
    severity: 'warn',
    status: 'acknowledged',
  },
  {
    id: 'ia-3',
    type: 'gateway_offline',
    title: 'Gateway Offline',
    detail: 'IOT-2 in maintenance · Dock uplink paused',
    infraDeviceId: 'IOT-2',
    infraDeviceName: 'IoT gateway · Dock uplink',
    time: '1:20 PM',
    severity: 'warn',
    status: 'open',
  },
  {
    id: 'ia-4',
    type: 'weak_signal',
    title: 'Weak Signal',
    detail: 'GPS-2 multipath · east geofence RSSI low',
    infraDeviceId: 'GPS-2',
    infraDeviceName: 'GPS geofence · Yard east',
    time: '12:48 PM',
    severity: 'warn',
    status: 'open',
  },
  {
    id: 'ia-5',
    type: 'firmware_update',
    title: 'Firmware Update Required',
    detail: 'RF-G3 · 2.9.4 → 3.1.0 pending',
    infraDeviceId: 'RF-G3',
    infraDeviceName: 'Gate RFID reader · Lane 3',
    time: '11:30 AM',
    severity: 'info',
    status: 'open',
  },
  {
    id: 'ia-6',
    type: 'comm_failure',
    title: 'Communication Failure',
    detail: 'Intermittent packet loss on GW-S dock backhaul',
    infraDeviceId: 'GW-S',
    infraDeviceName: 'Edge gateway · Dock',
    time: '10:15 AM',
    severity: 'warn',
    status: 'resolved',
  },
  {
    id: 'ia-7',
    type: 'dock_sensor_offline',
    title: 'Dock Sensor Offline',
    detail: 'Simulated recovery drill · DS-1 restored',
    infraDeviceId: 'DS-1',
    infraDeviceName: 'Dock door sensor 1–4',
    time: 'Yesterday',
    severity: 'critical',
    status: 'resolved',
  },
]

export function computeInfraOpsKpis(
  infra: YardInfraAsset[],
  movements: InfraAutoMovement[],
) {
  const total = infra.length
  const online = infra.filter((i) => i.status === 'online' && i.enabled !== false)
    .length
  const offline = infra.filter((i) => i.status === 'offline').length
  const maintenance = infra.filter((i) => i.status === 'maintenance').length
  const healthScores = infra.map((i) => i.healthScore ?? 0)
  const healthPct = total
    ? Math.round(healthScores.reduce((s, n) => s + n, 0) / total)
    : 0
  const autoEventsToday = movements.filter(
    (m) => !m.time.toLowerCase().includes('yesterday'),
  ).length
  return {
    total,
    online,
    offline,
    maintenance,
    healthPct,
    autoEventsToday,
  }
}

export const seedOemIntegrations: OemIntegration[] = [
  {
    id: 'oem-tk',
    system: 'Thermo King TracKing',
    connectionStatus: 'connected',
    lastSync: '48 sec ago',
    apiHealth: 'online',
    connectedTrailers: 9,
    note: 'BH Thermo King reefers on site · setpoint, fuel, alarms',
    logs: [
      { time: '2:14 PM', level: 'info', message: 'Heartbeat OK · 9 units polled (BH-4412, BH-2290, BH-5104, BH-6022, BH-7740, BH-9012, BH-8804, BH-1120, BH-4040)' },
      { time: '2:10 PM', level: 'warn', message: 'Alarm sync · BH-4412 reefer alarm active · A-14' },
      { time: '1:55 PM', level: 'warn', message: 'Latency 1.8s on region US-East' },
      { time: '1:22 PM', level: 'info', message: 'Fuel pack · BH-9012 at 22% · low-fuel threshold' },
    ],
  },
  {
    id: 'oem-carrier',
    system: 'Carrier Transicold Lynx Fleet',
    connectionStatus: 'degraded',
    lastSync: '6 min ago',
    apiHealth: 'degraded',
    connectedTrailers: 5,
    note: 'On-site Carrier reefers · BH-3381, BH-1877, BH-3155, BH-2201, BH-6711',
    logs: [
      { time: '2:08 PM', level: 'warn', message: 'Token refresh delayed' },
      { time: '1:40 PM', level: 'info', message: 'Synced BH-3155 temp window · 39.4°F vs SP 34' },
      { time: '1:18 PM', level: 'info', message: 'BH-2201 Door 3 · setpoint holding 34.1°F' },
      { time: '12:22 PM', level: 'error', message: 'Timeout on fleet snapshot (retried)' },
    ],
  },
  {
    id: 'oem-otm',
    system: 'Oracle Transportation Management (OTM)',
    connectionStatus: 'connected',
    lastSync: '2 min ago',
    apiHealth: 'online',
    connectedTrailers: 18,
    note: 'SoR for appointments, SCAC, shipment identity · 18 on-site + gate',
    logs: [
      { time: '2:12 PM', level: 'info', message: 'Appointment delta · FTL-440 gate arrived' },
      { time: '1:50 PM', level: 'info', message: 'Shipment status push ACK · BH-2201 / BH-8804 at dock' },
      { time: '1:05 PM', level: 'info', message: 'Carrier master sync · CRL-8821, PAX-1103, NX-552, FTL-440' },
    ],
  },
]

export const seedSmartAlerts: SmartAlert[] = [
  {
    id: 'sa1',
    type: 'temperature_critical',
    title: 'Temperature Critical',
    detail: 'BH-4412 at 41.2°F vs SP 34 · reefer alarm · A-14',
    trailerNumber: 'BH-4412',
    trailerId: 'bh-4412',
    time: '2:11 PM',
    severity: 'critical',
    href: '/trailer/bh-4412',
  },
  {
    id: 'sa2',
    type: 'temperature_critical',
    title: 'Temperature Critical',
    detail: 'BH-3155 at 39.4°F vs SP 34 · Ready to dock · C-01',
    trailerNumber: 'BH-3155',
    trailerId: 'bh-3155',
    time: '2:09 PM',
    severity: 'critical',
    href: '/trailer/bh-3155',
  },
  {
    id: 'sa3',
    type: 'temperature_warning',
    title: 'Temperature Warning',
    detail: 'BH-3381 at 36.8°F · warming vs SP 34 · B-07',
    trailerNumber: 'BH-3381',
    trailerId: 'bh-3381',
    time: '2:06 PM',
    severity: 'warn',
    href: '/trailer/bh-3381',
  },
  {
    id: 'sa4',
    type: 'low_fuel',
    title: 'Low Fuel',
    detail: 'BH-9012 fuel at 22% · top-off before dock · B-11',
    trailerNumber: 'BH-9012',
    trailerId: 'bh-9012',
    time: '2:04 PM',
    severity: 'warn',
    href: '/trailer/bh-9012',
  },
  {
    id: 'sa5',
    type: 'battery_low',
    title: 'Battery Low',
    detail: 'USD-1003 on BH-3381 · battery 18% · swap at cage',
    trailerNumber: 'BH-3381',
    trailerId: 'bh-3381',
    time: '1:58 PM',
    severity: 'warn',
    href: '/devices',
  },
  {
    id: 'sa6',
    type: 'reefer_alarm',
    title: 'Reefer Alarm',
    detail: 'BH-4412 Thermo King alarm correlated via TracKing',
    trailerNumber: 'BH-4412',
    trailerId: 'bh-4412',
    time: '1:55 PM',
    severity: 'critical',
    href: '/exceptions',
  },
  {
    id: 'sa7',
    type: 'device_offline',
    title: 'Device Offline',
    detail: 'USD-1007 offline 2 hr · ops bench maintenance',
    time: '1:50 PM',
    severity: 'critical',
    href: '/devices',
  },
  {
    id: 'sa8',
    type: 'ble_offline',
    title: 'BLE Offline',
    detail: 'USD-1013 on BH-6022 · BLE + GPS + temp lost · D-03',
    trailerNumber: 'BH-6022',
    trailerId: 'bh-6022',
    time: '1:45 PM',
    severity: 'warn',
    href: '/trailer/bh-6022',
  },
  {
    id: 'sa9',
    type: 'gps_offline',
    title: 'GPS Offline',
    detail: 'USD-1006 GPS offline while charging · bay 2',
    time: '1:42 PM',
    severity: 'info',
    href: '/devices',
  },
  {
    id: 'sa10',
    type: 'excess_dwell',
    title: 'Excess Dwell Time',
    detail: 'BH-2290 dwell 16.1h · frozen load · A-02',
    trailerNumber: 'BH-2290',
    trailerId: 'bh-2290',
    time: '1:30 PM',
    severity: 'warn',
    href: '/trailer/bh-2290',
  },
  {
    id: 'sa11',
    type: 'left_geofence',
    title: 'Trailer Left Geofence',
    detail: 'FTL-440 · USD-1015 CalAmp GPS at gate perimeter · check-in pending',
    trailerNumber: 'FTL-440',
    trailerId: 'ftl-440',
    time: '1:51 PM',
    severity: 'warn',
    href: '/gate',
  },
  {
    id: 'sa12',
    type: 'temperature_warning',
    title: 'Temperature Warning',
    detail: 'BH-1877 warming · fuel 34% · B-22',
    trailerNumber: 'BH-1877',
    trailerId: 'bh-1877',
    time: '1:20 PM',
    severity: 'warn',
    href: '/trailer/bh-1877',
  },
]

export const seedAiRecommendations: AiRecommendation[] = [
  {
    id: 'ai1',
    tag: 'Dock',
    title: 'Move BH-2201 to Door 5 after unlock on Door 3',
    body: 'Door 5 opens in ~12 min · reduces apron congestion while BH-8804 finishes Door 7 unload.',
    impact: 'Cycle time',
    actionLabel: 'Open Docks',
    actionTo: '/dock',
    tone: 'ok',
  },
  {
    id: 'ai2',
    tag: 'Dwell',
    title: 'BH-2290 approaching extended dwell threshold',
    body: '16.1h on A-02 with frozen SKUs — stage Ready to dock before 18h walk priority.',
    impact: 'Slot recovery',
    actionLabel: 'Trailer detail',
    actionTo: '/trailer/bh-2290',
    tone: 'warn',
  },
  {
    id: 'ai3',
    tag: 'Fuel',
    title: 'Fuel expected to reach critical in ~3 hours',
    body: 'BH-9012 at 22% tank · Thermo King load trend vs setpoint · schedule top-off at B-11.',
    impact: 'Cold chain continuity',
    actionLabel: 'Trailer detail',
    actionTo: '/trailer/bh-9012',
    tone: 'warn',
  },
  {
    id: 'ai4',
    tag: 'Temp',
    title: 'Temperature deviation on BH-4412 — prioritize QA',
    body: '41.2°F vs SP 34 with active reefer alarm · clear Yard hold before product claim risk.',
    impact: 'Food safety',
    actionLabel: 'Cold chain',
    actionTo: '/temperature',
    tone: 'critical',
  },
  {
    id: 'ai5',
    tag: 'QA',
    title: 'Prioritize QA on BH-3155 (critical) before dock pull',
    body: 'Ready to dock at C-01 with 39.4°F excursion — inspect before Door assignment.',
    impact: 'Throughput',
    actionLabel: 'Exceptions',
    actionTo: '/exceptions',
    tone: 'critical',
  },
  {
    id: 'ai6',
    tag: 'Move',
    title: 'Suggested move · Zone C pressure to Zone A open slots',
    body: 'BLE on C-01 (BH-3155) shows dock proximity; A-South still has open stalls for staging.',
    impact: 'Yard balance',
    actionLabel: 'Yards',
    actionTo: '/map',
    tone: 'info',
  },
  {
    id: 'ai7',
    tag: 'Maintenance',
    title: 'Predictive maintenance on USD-1007 LTE module',
    body: 'Offline pattern after BH-6022 unassign matches prior RMA · keep on ops bench until bench test.',
    impact: 'Device availability',
    actionLabel: 'Devices',
    actionTo: '/devices',
    tone: 'warn',
  },
  {
    id: 'ai8',
    tag: 'Device',
    title: 'Attach smart device to FTL-440 at gate',
    body: 'Gate arrived · offline temp · USD-1005 full kit available in cage, or USD-1016 GPS tracker for position-only attach.',
    impact: 'Visibility',
    actionLabel: 'Devices',
    actionTo: '/devices',
    tone: 'info',
  },
]

export const futureAiCards: FutureAiCard[] = [
  {
    id: 'f1',
    title: 'Predictive Maintenance',
    blurb: 'OEM runtime + device health models to schedule unit service before failure.',
    status: 'roadmap',
  },
  {
    id: 'f2',
    title: 'AI Slot Recommendation',
    blurb: 'Suggest parking slots from dwell, temp risk, and outbound dock plans.',
    status: 'planned',
  },
  {
    id: 'f3',
    title: 'Digital Twin Yard',
    blurb: 'Live digital twin of yard slots, doors, and geofences for what-if staging.',
    status: 'research',
  },
  {
    id: 'f4',
    title: 'Computer Vision Gate Detection',
    blurb: 'Camera + LPR fusion to auto-create gate events and seal presence.',
    status: 'research',
  },
  {
    id: 'f5',
    title: 'Drone Yard Inspection',
    blurb: 'Scheduled aerial sweeps for orphan trailers and yard exceptions.',
    status: 'planned',
  },
  {
    id: 'f6',
    title: 'Predictive Temperature Analytics',
    blurb: 'Multi-hour breach prediction from weather, door events, and reefer load.',
    status: 'roadmap',
  },
  {
    id: 'f7',
    title: 'Automated Work Assignment',
    blurb: 'Auto-dispatch jockey and QA tasks from smart alerts and AI recommendations.',
    status: 'planned',
  },
]

export const deviceAssignmentSteps = [
  'Trailer Arrives',
  'Gate Check-In',
  'Attach Smart Device',
  'Assign to Trailer',
  'GPS Activated',
  'BLE Activated',
  'Temperature Monitoring Started',
  'Trailer Ready for Yard Operations',
] as const

export function gpsTrackForTrailer(trailerNumber: string): GpsTrackPoint[] {
  const base = seedUnifiedDevices.find((d) => d.assignedTrailer === trailerNumber)
  if (!base) return []
  const lat0 = base.lat
  const lng0 = base.lng
  const atDock = base.currentLocation.startsWith('Door')
  const zoneHint = atDock
    ? 'Dock'
    : base.currentLocation.includes('-')
      ? base.currentLocation.split('-')[0]!
      : 'Yard'
  return [
    {
      t: 'Gate in',
      lat: lat0 - 0.00045,
      lng: lng0 - 0.00055,
      zone: 'Gate',
      label: `${trailerNumber} · gate check-in`,
    },
    {
      t: 'Rolled',
      lat: lat0 - 0.0002,
      lng: lng0 - 0.0002,
      zone: zoneHint,
      label: `Rolled toward ${base.currentLocation}`,
    },
    {
      t: 'Approach',
      lat: lat0 - 0.00005,
      lng: lng0 - 0.00005,
      zone: atDock ? 'Dock' : zoneHint,
      label: atDock ? 'Apron approach' : 'Approaching slot',
    },
    {
      t: 'Now',
      lat: lat0,
      lng: lng0,
      zone: atDock ? 'Dock' : base.currentLocation,
      label: `Current · ${base.currentLocation}`,
    },
  ]
}

export function computeSmartKpis(devices: UnifiedSmartDevice[], infra: YardInfraAsset[]) {
  const online = devices.filter((d) => d.health === 'online').length
  const gpsActive = devices.filter(
    (d) =>
      d.assignedTrailer &&
      d.capabilities.includes('gps') &&
      d.gpsStatus === 'ok',
  ).length
  const bleOnline = infra.filter((i) => i.kind === 'ble_anchor' && i.status === 'online').length
  const bleTotal = infra.filter((i) => i.kind === 'ble_anchor').length
  const connectedReefers = devices.filter(
    (d) =>
      d.assignedTrailer &&
      d.capabilities.includes('temperature') &&
      d.temperatureSensorStatus !== 'offline' &&
      d.lifecycle === 'in_use',
  ).length
  const offlineDevices = devices.filter((d) => d.health === 'offline' || d.connectivity === 'offline').length
  const withTelemetry = devices.filter(
    (d) =>
      d.assignedTrailer &&
      d.capabilities.includes('lte') &&
      d.connectivity !== 'offline',
  ).length
  const assigned = devices.filter((d) => d.assignedTrailer).length
  const capabilityCoverage = computeCapabilityCoverage(devices)
  return {
    devicesOnline: online,
    devicesTotal: devices.length,
    gpsActive,
    bleAnchorsOnline: bleOnline,
    bleAnchorsTotal: bleTotal,
    connectedReefers,
    offlineDevices,
    telemetryCoverage: assigned ? Math.round((withTelemetry / assigned) * 100) : 0,
    ...capabilityCoverage,
  }
}
