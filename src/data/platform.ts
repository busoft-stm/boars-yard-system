export type DeviceKind = 'rfid' | 'ble' | 'gateway' | 'reefer_modem'
export type DeviceHealth = 'online' | 'degraded' | 'offline' | 'unassigned'
export type DeviceStatus = 'active' | 'disabled'

export type YardDevice = {
  id: string
  name: string
  kind: DeviceKind
  health: DeviceHealth
  status: DeviceStatus
  batteryPct: number | null
  assignedTrailer: string | null
  location: string
  lastSeen: string
  vendor: string
}

export const DEVICE_KIND_META: Record<
  DeviceKind,
  { label: string; description: string; uses: string[] }
> = {
  rfid: {
    label: 'RFID',
    description:
      'Passive or semi-passive tags affixed to trailers for gate and yard identification when telematics are missing.',
    uses: [
      'Gate check-in identification',
      'Yard slot / zone presence',
      'Carrier trailer tracking',
      'Lost / recovered asset pool',
    ],
  },
  ble: {
    label: 'BLE',
    description:
      'Battery-powered Bluetooth Low Energy temp tags for sealed trailers that need on-yard cold-chain visibility.',
    uses: [
      'Supplemental temperature sensing',
      'Battery & signal health',
      'Trailer assignment at gate',
      'Priority walk support',
    ],
  },
  gateway: {
    label: 'Gateway',
    description:
      'Fixed yard readers that collect RFID / BLE signals and relay device health into Smart Yard.',
    uses: [
      'North yard coverage',
      'Gate canopy coverage',
      'Tag last-seen updates',
      'Unassigned device intake',
    ],
  },
  reefer_modem: {
    label: 'Reefer modem',
    description:
      'OEM telematics links (Thermo King / Carrier) for factory-instrumented reefers — setpoint, alarms, and fuel.',
    uses: [
      'Internal temp & setpoint',
      'Reefer alarm routing',
      'Fuel / unit status',
      'OTM cold-chain correlation',
    ],
  },
}

export type IntegrationFeed = {
  id: string
  name: string
  system: 'OTM' | 'Thermo King' | 'Carrier' | 'SMS' | 'Email'
  status: 'connected' | 'degraded' | 'paused'
  lastSync: string
  recordsToday: number
  note: string
}

/**
 * Legacy discrete device inventory — aligned to the same fleet trailers
 * as unified smart devices (smartEnterprise.ts) and trailers.ts.
 */
export const seedDevices: YardDevice[] = [
  {
    id: 'gw-01',
    name: 'Yard gateway · North',
    kind: 'gateway',
    health: 'online',
    status: 'active',
    batteryPct: null,
    assignedTrailer: null,
    location: 'Pole N-2 · Zone A',
    lastSeen: 'Just now',
    vendor: 'BH Smart Yard',
  },
  {
    id: 'gw-02',
    name: 'Yard gateway · Gate',
    kind: 'gateway',
    health: 'online',
    status: 'active',
    batteryPct: null,
    assignedTrailer: null,
    location: 'Gate canopy',
    lastSeen: '1 min ago',
    vendor: 'BH Smart Yard',
  },
  {
    id: 'rfid-4412',
    name: 'RFID tag · BH-4412',
    kind: 'rfid',
    health: 'online',
    status: 'active',
    batteryPct: 86,
    assignedTrailer: 'BH-4412',
    location: 'A-14',
    lastSeen: '2 min ago',
    vendor: 'Magnetic RFID',
  },
  {
    id: 'ble-8821',
    name: 'BLE temp tag · CRL-8821',
    kind: 'ble',
    health: 'degraded',
    status: 'active',
    batteryPct: 55,
    assignedTrailer: 'CRL-8821',
    location: 'A-31',
    lastSeen: '6 min ago',
    vendor: 'Active BLE',
  },
  {
    id: 'ble-un1',
    name: 'BLE tag · spare 04',
    kind: 'ble',
    health: 'unassigned',
    status: 'active',
    batteryPct: 96,
    assignedTrailer: null,
    location: 'Gate cabinet',
    lastSeen: 'Today · 8:10 AM',
    vendor: 'Active BLE',
  },
  {
    id: 'ct-3381',
    name: 'Reefer modem · BH-3381',
    kind: 'reefer_modem',
    health: 'online',
    status: 'active',
    batteryPct: null,
    assignedTrailer: 'BH-3381',
    location: 'Carrier Transicold · B-07',
    lastSeen: '4 min ago',
    vendor: 'Carrier Transicold',
  },
  {
    id: 'tk-2290',
    name: 'Reefer modem · BH-2290',
    kind: 'reefer_modem',
    health: 'online',
    status: 'active',
    batteryPct: null,
    assignedTrailer: 'BH-2290',
    location: 'Thermo King · A-02',
    lastSeen: '1 min ago',
    vendor: 'Thermo King',
  },
  {
    id: 'tk-4412',
    name: 'Reefer modem · BH-4412',
    kind: 'reefer_modem',
    health: 'degraded',
    status: 'active',
    batteryPct: null,
    assignedTrailer: 'BH-4412',
    location: 'Thermo King · A-14',
    lastSeen: '2 min ago',
    vendor: 'Thermo King',
  },
  {
    id: 'ct-3155',
    name: 'Reefer modem · BH-3155',
    kind: 'reefer_modem',
    health: 'online',
    status: 'active',
    batteryPct: null,
    assignedTrailer: 'BH-3155',
    location: 'Carrier Transicold · C-01',
    lastSeen: '3 min ago',
    vendor: 'Carrier Transicold',
  },
  {
    id: 'tk-9012',
    name: 'Reefer modem · BH-9012',
    kind: 'reefer_modem',
    health: 'online',
    status: 'active',
    batteryPct: null,
    assignedTrailer: 'BH-9012',
    location: 'Thermo King · B-11',
    lastSeen: '1 min ago',
    vendor: 'Thermo King',
  },
  {
    id: 'rfid-off',
    name: 'RFID tag · lost pool',
    kind: 'rfid',
    health: 'offline',
    status: 'active',
    batteryPct: 4,
    assignedTrailer: null,
    location: 'Unknown',
    lastSeen: 'Jul 12, 2026 · 4:22 PM',
    vendor: 'Magnetic RFID',
  },
]

export const seedIntegrations: IntegrationFeed[] = [
  {
    id: 'otm',
    name: 'Oracle Transportation Management',
    system: 'OTM',
    status: 'connected',
    lastSync: '2 min ago',
    recordsToday: 186,
    note: 'System of record — 18 on-site trailers, carriers, arrivals, yard moves',
  },
  {
    id: 'tk',
    name: 'Thermo King telematics',
    system: 'Thermo King',
    status: 'connected',
    lastSync: '48 sec ago',
    recordsToday: 942,
    note: '9 BH Thermo King reefers — temp, setpoint, alarms, fuel',
  },
  {
    id: 'carrier',
    name: 'Carrier Transicold API',
    system: 'Carrier',
    status: 'degraded',
    lastSync: '6 min ago',
    recordsToday: 410,
    note: '5 on-site Carrier reefers — intermittent feed · fallback walk for silent carriers',
  },
  {
    id: 'sms',
    name: 'SMS alerts',
    system: 'SMS',
    status: 'connected',
    lastSync: 'Just now',
    recordsToday: 28,
    note: 'Critical excursion & reefer alarm routing · BH-4412 / BH-3155',
  },
  {
    id: 'email',
    name: 'Email notifications',
    system: 'Email',
    status: 'connected',
    lastSync: 'Just now',
    recordsToday: 61,
    note: 'Ops / QA distribution lists',
  },
]
