import { formatRelativeAgo } from '../utils/usFormat'

export type TempStatus = 'ok' | 'warn' | 'critical' | 'offline' | 'na'
export type Ownership = 'bh' | 'carrier'
export type TrailerRecordStatus = 'active' | 'disabled'
/** Yard visit / workflow status (where the trailer is in the yard process). */
export type TrailerStatus =
  | 'In yard'
  | 'Ready to dock'
  | 'At dock'
  | 'QA hold'
  | 'Yard hold'
  | 'Gate arrived'
  | 'Outbound staged'
  | 'Departed'

/**
 * Operational hold overlay — can apply while In yard / Ready to dock / At dock
 * without replacing the primary lifecycle status.
 */
export type OpsHold = 'none' | 'qa' | 'yard'

/** Dock work progress while status is At dock. */
export type DockPhase =
  | 'idle'
  | 'loading'
  | 'unloading'
  | 'qa_verify'
  | 'complete'

export const OPS_HOLD_META: Record<OpsHold, string> = {
  none: 'None',
  qa: 'QA hold',
  yard: 'Yard hold',
}

export const DOCK_PHASE_META: Record<DockPhase, string> = {
  idle: 'At door',
  loading: 'Loading',
  unloading: 'Unloading',
  qa_verify: 'QA verification',
  complete: 'Ready to unlock',
}

/** Primary lifecycle statuses (holds are overlays via opsHold). */
export const LIFECYCLE_TRAILER_STATUSES: TrailerStatus[] = [
  'Departed',
  'Gate arrived',
  'In yard',
  'Ready to dock',
  'At dock',
  'Outbound staged',
]

/** Parking / ops zone code. Built-ins include A–D, Dock, Gate; custom zones allowed. */
export type Zone = string
export type ZoneStatus = 'active' | 'disabled'

export type YardZoneDef = {
  id: Zone
  name: string
  slotCount: number
  status: ZoneStatus
}

/** Physical gate lane direction capability. */
export type GateLaneDirection = 'in' | 'out' | 'both'
export type GateLaneStatus = 'active' | 'disabled'

export type GateLaneDef = {
  id: string
  name: string
  direction: GateLaneDirection
  status: GateLaneStatus
  note?: string
}

export type YardLayout = {
  zones: YardZoneDef[]
  dockCount: number
  lanes: GateLaneDef[]
}

export const DEFAULT_GATE_LANES: GateLaneDef[] = [
  {
    id: 'lane-1',
    name: 'Lane 1',
    direction: 'in',
    status: 'active',
    note: 'Primary inbound',
  },
  {
    id: 'lane-2',
    name: 'Lane 2',
    direction: 'both',
    status: 'active',
    note: 'Flex lane',
  },
  {
    id: 'lane-3',
    name: 'Lane 3',
    direction: 'out',
    status: 'active',
    note: 'Outbound clear',
  },
]

export const DEFAULT_YARD_LAYOUT: YardLayout = {
  zones: [
    { id: 'A', name: 'Zone A', slotCount: 32, status: 'active' },
    { id: 'B', name: 'Zone B', slotCount: 24, status: 'active' },
    { id: 'C', name: 'Zone C', slotCount: 20, status: 'active' },
    { id: 'D', name: 'Zone D', slotCount: 16, status: 'active' },
  ],
  dockCount: 8,
  lanes: structuredClone(DEFAULT_GATE_LANES),
}

/** Reserved codes that cannot be used as parking zone IDs. */
export const RESERVED_ZONE_IDS = new Set(['Dock', 'Gate', 'all'])

export function normalizeZoneId(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toUpperCase()
}

export function normalizeGateLaneId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^-|-$/g, '')
}

export function normalizeYardLayout(
  input?: Partial<YardLayout> | null,
): YardLayout {
  const base = structuredClone(DEFAULT_YARD_LAYOUT)
  if (!input) return base

  const zones =
    Array.isArray(input.zones) && input.zones.length
      ? input.zones.map((z) => ({
          id: String(z.id),
          name: String(z.name || `Zone ${z.id}`),
          slotCount: Math.max(0, Number(z.slotCount) || 0),
          status: (z.status === 'disabled' ? 'disabled' : 'active') as ZoneStatus,
        }))
      : base.zones

  const dockCount = Math.max(
    1,
    Number(input.dockCount) || DEFAULT_YARD_LAYOUT.dockCount,
  )

  const lanesRaw = Array.isArray(input.lanes) ? input.lanes : null
  const lanes: GateLaneDef[] =
    lanesRaw && lanesRaw.length
      ? lanesRaw.map((lane, i) => {
          const name = String(lane.name || `Lane ${i + 1}`).trim()
          const id =
            normalizeGateLaneId(String(lane.id || name)) || `lane-${i + 1}`
          const direction: GateLaneDirection =
            lane.direction === 'out' || lane.direction === 'both'
              ? lane.direction
              : 'in'
          return {
            id,
            name,
            direction,
            status: lane.status === 'disabled' ? 'disabled' : 'active',
            note: lane.note?.trim() || undefined,
          }
        })
      : structuredClone(DEFAULT_GATE_LANES)

  return { zones, dockCount, lanes }
}

export function gateLaneSupportsDirection(
  lane: GateLaneDef,
  direction: 'in' | 'out',
) {
  if (lane.status === 'disabled') return false
  return lane.direction === 'both' || lane.direction === direction
}

export function zoneFromSlotLabel(label: string): Zone {
  if (label.startsWith('Door ')) return 'Dock'
  const dash = label.indexOf('-')
  if (dash > 0) return label.slice(0, dash)
  return label.charAt(0) || 'Gate'
}
export type TrailerType = 'reefer' | 'dry' | 'multi_temp'
/** Trailer length in feet — presets plus free-form “Other”. */
export type TrailerLengthFt = number
export type ReeferBrand = 'thermo_king' | 'carrier' | 'none'

/** Common NA lengths shown in the length picker. */
export const TRAILER_LENGTH_PRESETS = [28, 40, 45, 48, 53] as const

export type TrailerLengthPreset =
  | (typeof TRAILER_LENGTH_PRESETS)[number]
  | 'other'

export function lengthToPreset(lengthFt: number): TrailerLengthPreset {
  return (TRAILER_LENGTH_PRESETS as readonly number[]).includes(lengthFt)
    ? (lengthFt as TrailerLengthPreset)
    : 'other'
}

export const TRAILER_TYPE_META: Record<TrailerType, string> = {
  reefer: 'Reefer',
  dry: 'Dry',
  multi_temp: 'Multi-temp',
}

export const REEFER_BRAND_META: Record<ReeferBrand, string> = {
  thermo_king: 'Thermo King',
  carrier: 'Carrier',
  none: 'None',
}

export interface TempPoint {
  t: string
  actual: number
}

export interface Trailer {
  id: string
  number: string
  ownership: Ownership
  carrier: string
  slot: string | null
  zone: Zone
  /** Yard workflow / visit status */
  status: TrailerStatus
  /** Master register lifecycle — disabled trailers cannot check in */
  recordStatus: TrailerRecordStatus
  /** Master: trailer classification */
  trailerType: TrailerType
  /** Master: length in feet */
  lengthFt: TrailerLengthFt
  /** Master: OEM reefer brand (None for dry / no unit) */
  reeferBrand: ReeferBrand
  /** Master: default setpoint applied for this asset */
  defaultSetpoint: number | null
  /** Master: home distribution center */
  homeSite: string
  /** Master: optional fleet / asset ID */
  fleetAssetId?: string
  /** Master: fleet notes for the asset */
  masterNotes?: string
  seal: string
  arrivedAt: string
  /** Epoch ms — check-in / arrival for live dwell calculation */
  arrivedAtMs?: number
  dwellHours: number
  setpoint: number | null
  actual: number | null
  fuelPct: number | null
  tempStatus: TempStatus
  reeferAlarm: boolean
  lastUpdate: string
  /** Epoch ms — last telemetry read for relative “updated” labels */
  lastTelemetryAtMs?: number
  telemetry: boolean
  product: string
  history: TempPoint[]
  notes?: string
  dockDoor?: string
  direction: 'inbound' | 'outbound' | 'empty'
  /** Operational hold overlay — not a primary lifecycle stage. */
  opsHold?: OpsHold
  /** Dock activity while At dock. */
  dockPhase?: DockPhase
  /**
   * When true (default), trailer uses Ready to dock → At dock → Outbound.
   * When false, yard parking can stage directly to Outbound (skip dock).
   */
  dockRequired?: boolean
}

/** On site for ops: active register and not departed. */
export function isOnSite(t: Trailer) {
  return (t.recordStatus ?? 'active') === 'active' && t.status !== 'Departed'
}

/** Eligible for gate check-in: active register, currently off site. */
export function isCheckInEligible(t: Trailer) {
  return (t.recordStatus ?? 'active') === 'active' && t.status === 'Departed'
}

export interface Slot {
  id: string
  zone: Zone
  label: string
  type: 'parking' | 'dock' | 'stage'
  trailerId: string | null
}

export interface Movement {
  id: string
  time: string
  /** Epoch ms for sorting / recency */
  timeMs?: number
  trailerNumber: string
  trailerId: string
  type: 'gate_in' | 'gate_out' | 'slot_move' | 'dock_assign' | 'undock' | 'hold' | 'stage_outbound'
  from: string
  to: string
  by: string
  note?: string
}

export interface GateEvent {
  id: string
  time: string
  timeMs?: number
  direction: 'in' | 'out'
  trailerNumber: string
  trailerId: string
  carrier: string
  seal: string
  appointment?: string
  status: 'processing' | 'cleared' | 'held'
  lane: string
}

function hist(base: number, drift: number[]): TempPoint[] {
  const labels = ['6 AM', '8 AM', '10 AM', '12 PM', '2 PM', 'Now']
  return labels.map((t, i) => ({
    t,
    actual: Math.round((base + (drift[i] ?? 0)) * 10) / 10,
  }))
}

export const SITE = {
  name: "Boar's Head Distribution Center",
  code: 'BHD',
  region: 'OH',
  timezone: 'Eastern Time',
  asOf: 'Tue, Jul 14, 2026 · 2:14 PM ET',
}

/** Fill master fields for older IndexedDB / partial rows. */
export function withMasterDefaults(t: Trailer): Trailer {
  const telemetry = t.telemetry
  const trailerType = t.trailerType ?? 'reefer'
  const reeferBrand =
    t.reeferBrand ??
    (telemetry
      ? t.ownership === 'bh'
        ? 'thermo_king'
        : 'carrier'
      : 'none')

  // Migrate legacy hold lifecycle statuses → In yard + opsHold overlay.
  let status = t.status
  let opsHold: OpsHold = t.opsHold ?? 'none'
  if (status === 'QA hold') {
    status = 'In yard'
    opsHold = 'qa'
  } else if (status === 'Yard hold') {
    status = 'In yard'
    opsHold = 'yard'
  }

  const dockPhase: DockPhase =
    status === 'At dock' ? (t.dockPhase ?? 'complete') : 'idle'

  return applyLiveTimingFields({
    ...t,
    status,
    opsHold,
    dockPhase,
    dockRequired: t.dockRequired ?? true,
    recordStatus: t.recordStatus ?? 'active',
    trailerType,
    lengthFt: t.lengthFt ?? 53,
    reeferBrand,
    defaultSetpoint:
      t.defaultSetpoint !== undefined
        ? t.defaultSetpoint
        : telemetry
          ? (t.setpoint ?? 34)
          : null,
    homeSite: t.homeSite?.trim() || SITE.name,
    fleetAssetId: t.fleetAssetId,
    masterNotes: t.masterNotes,
  })
}

/** Recompute dwell + relative telemetry labels from epoch fields. */
export function applyLiveTimingFields(t: Trailer, now = Date.now()): Trailer {
  let dwellHours = t.dwellHours
  if (t.arrivedAtMs != null && t.status !== 'Departed') {
    dwellHours = Math.max(0.1, (now - t.arrivedAtMs) / (60 * 60 * 1000))
  }
  const lastUpdate =
    t.lastTelemetryAtMs != null
      ? formatRelativeAgo(t.lastTelemetryAtMs, now)
      : t.lastUpdate
  return { ...t, dwellHours, lastUpdate }
}

export function trailerNeedsDock(t: Pick<Trailer, 'dockRequired'>) {
  return t.dockRequired !== false
}

/** Yard → Departure without a dock door (non-dock workflows). */
export function canStageOutboundFromYard(
  t: Pick<Trailer, 'status' | 'opsHold' | 'dockRequired' | 'recordStatus'>,
) {
  if ((t.recordStatus ?? 'active') !== 'active') return false
  if (trailerNeedsDock(t)) return false
  if (trailerHasOpsHold(t)) return false
  return t.status === 'In yard' || t.status === 'Gate arrived'
}

export function trailerHasOpsHold(t: Pick<Trailer, 'opsHold' | 'status'>) {
  if (t.opsHold === 'qa' || t.opsHold === 'yard') return true
  return t.status === 'QA hold' || t.status === 'Yard hold'
}

export function displayYardStatus(t: Pick<Trailer, 'status' | 'opsHold'>) {
  if (t.opsHold === 'qa') return 'QA hold'
  if (t.opsHold === 'yard') return 'Yard hold'
  return t.status
}

export const trailers: Trailer[] = [
  {
    id: 'bh-4412',
    number: 'BH-4412',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'A-14',
    zone: 'A',
    status: 'In yard',
    opsHold: 'yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-4412',
    seal: 'SL-99201',
    arrivedAt: 'Jul 14, 2026 · 5:40 AM',
    dwellHours: 8.5,
    setpoint: 34,
    actual: 41.2,
    fuelPct: 62,
    tempStatus: 'critical',
    reeferAlarm: true,
    lastUpdate: '2 min ago',
    telemetry: true,
    product: 'Deli meats · chilled',
    history: hist(34.2, [0.2, 0.8, 2.1, 4.5, 6.8, 7.0]),
    notes: 'Rising trend — reefer alarm active',
    direction: 'inbound',
  },
  {
    id: 'bh-3381',
    number: 'BH-3381',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'B-07',
    zone: 'B',
    status: 'Ready to dock',
    opsHold: 'none',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'carrier',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-3381',
    seal: 'SL-99118',
    arrivedAt: 'Jul 14, 2026 · 7:15 AM',
    dwellHours: 7.0,
    setpoint: 34,
    actual: 36.8,
    fuelPct: 48,
    tempStatus: 'warn',
    reeferAlarm: false,
    lastUpdate: '4 min ago',
    telemetry: true,
    product: 'Cheese · chilled',
    history: hist(34.1, [0.1, 0.3, 0.9, 1.8, 2.4, 2.7]),
    direction: 'inbound',
  },
  {
    id: 'bh-2290',
    number: 'BH-2290',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'A-02',
    zone: 'A',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-2290',
    seal: 'SL-99044',
    arrivedAt: 'Jul 13, 2026 · 10:10 PM',
    dwellHours: 16.1,
    setpoint: 0,
    actual: 1.4,
    fuelPct: 71,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '1 min ago',
    telemetry: true,
    product: 'Frozen SKUs',
    history: hist(0.8, [0.2, 0.1, 0.4, 0.3, 0.5, 0.6]),
    direction: 'inbound',
  },
  {
    id: 'bh-5104',
    number: 'BH-5104',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'C-19',
    zone: 'C',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-5104',
    seal: 'SL-99330',
    arrivedAt: 'Jul 14, 2026 · 9:02 AM',
    dwellHours: 5.2,
    setpoint: 34,
    actual: 34.6,
    fuelPct: 55,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '3 min ago',
    telemetry: true,
    product: 'Deli meats · chilled',
    history: hist(34.2, [0.1, 0.2, 0.3, 0.2, 0.4, 0.4]),
    direction: 'inbound',
  },
  {
    id: 'bh-1877',
    number: 'BH-1877',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'B-22',
    zone: 'B',
    status: 'In yard',
    opsHold: 'qa',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'carrier',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-1877',
    seal: 'SL-98871',
    arrivedAt: 'Jul 14, 2026 · 4:55 AM',
    dwellHours: 9.3,
    setpoint: 34,
    actual: 38.1,
    fuelPct: 34,
    tempStatus: 'warn',
    reeferAlarm: false,
    lastUpdate: '6 min ago',
    telemetry: true,
    product: 'Prepared foods',
    history: hist(34.5, [0.2, 0.6, 1.4, 2.5, 3.3, 3.6]),
    direction: 'inbound',
  },
  {
    id: 'bh-6022',
    number: 'BH-6022',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'D-03',
    zone: 'D',
    status: 'In yard',
    opsHold: 'none',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-6022',
    seal: 'SL-99412',
    arrivedAt: 'Jul 14, 2026 · 11:20 AM',
    dwellHours: 2.9,
    setpoint: 34,
    actual: null,
    fuelPct: null,
    tempStatus: 'offline',
    reeferAlarm: false,
    lastUpdate: '47 min ago',
    telemetry: true,
    product: 'Chilled mixed',
    history: hist(34.0, [0, 0.1, 0.2, 0.1, 0.0, 0.0]),
    notes: 'Telemetry stale — verify unit power',
    direction: 'inbound',
  },
  {
    id: 'crl-8821',
    number: 'CRL-8821',
    ownership: 'carrier',
    carrier: 'ColdRun Logistics',
    slot: 'A-31',
    zone: 'A',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'none',
    defaultSetpoint: null,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-CRL-8821',
    seal: 'SL-77620',
    arrivedAt: 'Jul 14, 2026 · 8:40 AM',
    dwellHours: 5.6,
    setpoint: 34,
    actual: null,
    fuelPct: null,
    tempStatus: 'offline',
    reeferAlarm: false,
    lastUpdate: '—',
    telemetry: false,
    product: 'Inbound chilled',
    history: [],
    notes: 'Carrier trailer — no telemetry feed',
    direction: 'inbound',
  },
  {
    id: 'pax-1103',
    number: 'PAX-1103',
    ownership: 'carrier',
    carrier: 'PaxTemp Freight',
    slot: 'C-08',
    zone: 'C',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'none',
    defaultSetpoint: null,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-PAX-1103',
    seal: 'SL-45001',
    arrivedAt: 'Jul 14, 2026 · 6:18 AM',
    dwellHours: 7.9,
    setpoint: 0,
    actual: null,
    fuelPct: null,
    tempStatus: 'offline',
    reeferAlarm: false,
    lastUpdate: '—',
    telemetry: false,
    product: 'Frozen inbound',
    history: [],
    notes: 'Carrier trailer — manual check only',
    direction: 'inbound',
  },
  {
    id: 'bh-7740',
    number: 'BH-7740',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'D-15',
    zone: 'D',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-7740',
    seal: 'SL-99501',
    arrivedAt: 'Jul 14, 2026 · 10:05 AM',
    dwellHours: 4.2,
    setpoint: 34,
    actual: 33.9,
    fuelPct: 81,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '1 min ago',
    telemetry: true,
    product: 'Cheese · chilled',
    history: hist(34.0, [-0.1, 0, 0.1, -0.2, -0.1, -0.1]),
    direction: 'inbound',
  },
  {
    id: 'bh-9012',
    number: 'BH-9012',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'B-11',
    zone: 'B',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-9012',
    seal: 'SL-99610',
    arrivedAt: 'Jul 13, 2026 · 7:45 PM',
    dwellHours: 18.5,
    setpoint: 34,
    actual: 34.2,
    fuelPct: 22,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '5 min ago',
    telemetry: true,
    product: 'Deli meats · chilled',
    history: hist(34.1, [0, 0.1, 0.1, 0.2, 0.1, 0.1]),
    notes: 'Long dwell — temp stable',
    direction: 'inbound',
  },
  {
    id: 'ftl-440',
    number: 'FTL-440',
    ownership: 'carrier',
    carrier: 'FrostLine Transport',
    slot: null,
    zone: 'Gate',
    status: 'Gate arrived',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'none',
    defaultSetpoint: null,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-FTL-440',
    seal: 'SL-22109',
    arrivedAt: 'Jul 14, 2026 · 1:50 PM',
    dwellHours: 0.4,
    setpoint: 34,
    actual: null,
    fuelPct: null,
    tempStatus: 'offline',
    reeferAlarm: false,
    lastUpdate: '—',
    telemetry: false,
    product: 'Inbound chilled',
    history: [],
    direction: 'inbound',
    dockRequired: false,
  },
  {
    id: 'bh-3155',
    number: 'BH-3155',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'C-01',
    zone: 'C',
    status: 'Ready to dock',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'carrier',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-3155',
    seal: 'SL-98755',
    arrivedAt: 'Jul 14, 2026 · 8:00 AM',
    dwellHours: 6.2,
    setpoint: 34,
    actual: 39.4,
    fuelPct: 41,
    tempStatus: 'critical',
    reeferAlarm: false,
    lastUpdate: '3 min ago',
    telemetry: true,
    product: 'Prepared foods',
    history: hist(34.3, [0.4, 1.2, 2.8, 4.1, 5.0, 5.1]),
    direction: 'inbound',
  },
  {
    id: 'bh-2201',
    number: 'BH-2201',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: null,
    zone: 'Dock',
    status: 'At dock',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'carrier',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-2201',
    seal: 'SL-98011',
    arrivedAt: 'Jul 14, 2026 · 6:30 AM',
    dwellHours: 7.7,
    setpoint: 34,
    actual: 34.1,
    fuelPct: 58,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '2 min ago',
    telemetry: true,
    product: 'Deli meats · unload',
    history: hist(34.0, [0.1, 0.1, 0.2, 0.1, 0.1, 0.1]),
    dockDoor: 'Door 3',
    direction: 'inbound',
  },
  {
    id: 'bh-8804',
    number: 'BH-8804',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: null,
    zone: 'Dock',
    status: 'At dock',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-8804',
    seal: 'SL-98120',
    arrivedAt: 'Jul 14, 2026 · 9:40 AM',
    dwellHours: 4.6,
    setpoint: 0,
    actual: 0.6,
    fuelPct: 66,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '1 min ago',
    telemetry: true,
    product: 'Frozen · unload',
    history: hist(0.4, [0.1, 0.2, 0.1, 0.2, 0.2, 0.2]),
    dockDoor: 'Door 7',
    direction: 'inbound',
  },
  {
    id: 'bh-1120',
    number: 'BH-1120',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'D-08',
    zone: 'D',
    status: 'Outbound staged',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-1120',
    seal: 'SL-97044',
    arrivedAt: 'Jul 14, 2026 · 12:05 PM',
    dwellHours: 2.1,
    setpoint: 34,
    actual: 34.4,
    fuelPct: 73,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '3 min ago',
    telemetry: true,
    product: 'Outbound chilled',
    history: hist(34.2, [0.1, 0.2, 0.1, 0.2, 0.2, 0.2]),
    direction: 'outbound',
  },
  {
    id: 'nx-552',
    number: 'NX-552',
    ownership: 'carrier',
    carrier: 'NorthEx Carriers',
    slot: 'A-18',
    zone: 'A',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'dry',
    lengthFt: 53,
    reeferBrand: 'none',
    defaultSetpoint: null,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-NX-552',
    seal: 'SL-33018',
    arrivedAt: 'Jul 14, 2026 · 10:50 AM',
    dwellHours: 3.4,
    setpoint: 34,
    actual: null,
    fuelPct: null,
    tempStatus: 'offline',
    reeferAlarm: false,
    lastUpdate: '—',
    telemetry: false,
    product: 'Inbound chilled',
    history: [],
    direction: 'inbound',
    dockRequired: false,
  },
  {
    id: 'bh-4040',
    number: 'BH-4040',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'B-03',
    zone: 'B',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'thermo_king',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-4040',
    seal: 'SL-96551',
    arrivedAt: 'Jul 14, 2026 · 7:55 AM',
    dwellHours: 6.3,
    setpoint: 34,
    actual: 34.0,
    fuelPct: 52,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '4 min ago',
    telemetry: true,
    product: 'Cheese · chilled',
    history: hist(34.0, [0, 0.1, 0, 0.1, 0, 0]),
    direction: 'empty',
    dockRequired: false,
  },
  {
    id: 'bh-6711',
    number: 'BH-6711',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: 'C-12',
    zone: 'C',
    status: 'In yard',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'carrier',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-6711',
    seal: 'SL-96102',
    arrivedAt: 'Jul 14, 2026 · 1:20 AM',
    dwellHours: 12.9,
    setpoint: 34,
    actual: 35.1,
    fuelPct: 44,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '2 min ago',
    telemetry: true,
    product: 'Deli meats · chilled',
    history: hist(34.2, [0.2, 0.3, 0.4, 0.6, 0.8, 0.9]),
    direction: 'inbound',
  },
  {
    id: 'bh-5501',
    number: 'BH-5501',
    ownership: 'bh',
    carrier: "Boar’s Head",
    slot: null,
    zone: 'Gate',
    status: 'Departed',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'carrier',
    defaultSetpoint: 34,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-BH-5501',
    seal: 'SL-00000',
    arrivedAt: 'Jul 12, 2026 · 4:00 PM',
    dwellHours: 0,
    setpoint: 34,
    actual: null,
    fuelPct: 80,
    tempStatus: 'ok',
    reeferAlarm: false,
    lastUpdate: '—',
    telemetry: true,
    product: 'Deli meats · chilled',
    history: [],
    notes: 'Fleet register — ready for next gate check-in',
    direction: 'inbound',
  },
  {
    id: 'cx-9901',
    number: 'CX-9901',
    ownership: 'carrier',
    carrier: 'Carrier partner',
    slot: null,
    zone: 'Gate',
    status: 'Departed',
    recordStatus: 'active',
    trailerType: 'reefer',
    lengthFt: 53,
    reeferBrand: 'none',
    defaultSetpoint: null,
    homeSite: SITE.name,
    fleetAssetId: 'ASSET-CX-9901',
    seal: 'SL-00001',
    arrivedAt: 'Jul 11, 2026 · 11:20 AM',
    dwellHours: 0,
    setpoint: null,
    actual: null,
    fuelPct: null,
    tempStatus: 'na',
    reeferAlarm: false,
    lastUpdate: '—',
    telemetry: false,
    product: 'Mixed · chilled',
    history: [],
    notes: 'Carrier register — assign BLE at check-in if needed',
    direction: 'inbound',
  },
]

function buildSlots(
  trailerList: Trailer[],
  layout: YardLayout = DEFAULT_YARD_LAYOUT,
): Slot[] {
  const onSite = trailerList.filter(isOnSite)
  const occupied = new Map(
    onSite.filter((t) => t.slot).map((t) => [t.slot!, t.id]),
  )
  const slots: Slot[] = []

  for (const z of layout.zones) {
    for (let i = 1; i <= z.slotCount; i++) {
      const label = `${z.id}-${String(i).padStart(2, '0')}`
      slots.push({
        id: label,
        zone: z.id,
        label,
        type: 'parking',
        trailerId: occupied.get(label) ?? null,
      })
    }
  }

  for (let i = 1; i <= layout.dockCount; i++) {
    const label = `Door ${i}`
    const trailer = onSite.find((t) => t.dockDoor === label)
    slots.push({
      id: `dock-${i}`,
      zone: 'Dock',
      label,
      type: 'dock',
      trailerId: trailer?.id ?? null,
    })
  }

  return slots
}

export { buildSlots, hist }

export const slots = buildSlots(trailers)

export const movements: Movement[] = [
  {
    id: 'm1',
    time: '1:52 PM',
    trailerNumber: 'FTL-440',
    trailerId: 'ftl-440',
    type: 'gate_in',
    from: 'Highway',
    to: 'Gate Lane 2',
    by: 'Gate · R. Patel',
    note: 'Appointment 14:00',
  },
  {
    id: 'm2',
    time: '1:20 PM',
    trailerNumber: 'BH-1120',
    trailerId: 'bh-1120',
    type: 'slot_move',
    from: 'C-04',
    to: 'D-08',
    by: 'Yard · M. Ortiz',
    note: 'Staged for outbound',
  },
  {
    id: 'm3',
    time: '12:48 PM',
    trailerNumber: 'BH-2201',
    trailerId: 'bh-2201',
    type: 'dock_assign',
    from: 'B-16',
    to: 'Door 3',
    by: 'Dock · A. Chen',
  },
  {
    id: 'm4',
    time: '12:05 PM',
    trailerNumber: 'BH-8804',
    trailerId: 'bh-8804',
    type: 'dock_assign',
    from: 'A-09',
    to: 'Door 7',
    by: 'Dock · A. Chen',
  },
  {
    id: 'm5',
    time: '11:28 AM',
    trailerNumber: 'BH-6022',
    trailerId: 'bh-6022',
    type: 'slot_move',
    from: 'Gate',
    to: 'D-03',
    by: 'Yard · M. Ortiz',
  },
  {
    id: 'm6',
    time: '10:55 AM',
    trailerNumber: 'NX-552',
    trailerId: 'nx-552',
    type: 'gate_in',
    from: 'Highway',
    to: 'A-18',
    by: 'Gate · R. Patel',
  },
  {
    id: 'm7',
    time: '10:12 AM',
    trailerNumber: 'BH-4412',
    trailerId: 'bh-4412',
    type: 'hold',
    from: 'A-14',
    to: 'A-14',
    by: 'QA · L. Nguyen',
    note: 'Temp excursion hold',
  },
  {
    id: 'm8',
    time: '9:40 AM',
    trailerNumber: 'BH-5104',
    trailerId: 'bh-5104',
    type: 'slot_move',
    from: 'Gate',
    to: 'C-19',
    by: 'Yard · J. Brooks',
  },
  {
    id: 'm9',
    time: '8:42 AM',
    trailerNumber: 'CRL-8821',
    trailerId: 'crl-8821',
    type: 'gate_in',
    from: 'Highway',
    to: 'A-31',
    by: 'Gate · R. Patel',
  },
  {
    id: 'm10',
    time: '7:18 AM',
    trailerNumber: 'BH-3381',
    trailerId: 'bh-3381',
    type: 'slot_move',
    from: 'Gate',
    to: 'B-07',
    by: 'Yard · J. Brooks',
  },
]

export const gateEvents: GateEvent[] = [
  {
    id: 'g1',
    time: '1:52 PM',
    direction: 'in',
    trailerNumber: 'FTL-440',
    trailerId: 'ftl-440',
    carrier: 'FrostLine Transport',
    seal: 'SL-22109',
    appointment: '2:00 PM',
    status: 'processing',
    lane: 'Lane 2',
  },
  {
    id: 'g2',
    time: '1:10 PM',
    direction: 'out',
    trailerNumber: 'BH-3099',
    trailerId: 'bh-3099',
    carrier: "Boar’s Head",
    seal: 'SL-95880',
    status: 'cleared',
    lane: 'Lane 1',
  },
  {
    id: 'g3',
    time: '12:22 PM',
    direction: 'in',
    trailerNumber: 'BH-1120',
    trailerId: 'bh-1120',
    carrier: "Boar’s Head",
    seal: 'SL-97044',
    appointment: '12:00 PM',
    status: 'cleared',
    lane: 'Lane 1',
  },
  {
    id: 'g4',
    time: '11:05 AM',
    direction: 'out',
    trailerNumber: 'PAX-902',
    trailerId: 'pax-902',
    carrier: 'PaxTemp Freight',
    seal: 'SL-44110',
    status: 'cleared',
    lane: 'Lane 2',
  },
  {
    id: 'g5',
    time: '10:55 AM',
    direction: 'in',
    trailerNumber: 'NX-552',
    trailerId: 'nx-552',
    carrier: 'NorthEx Carriers',
    seal: 'SL-33018',
    appointment: '11:00 AM',
    status: 'cleared',
    lane: 'Lane 1',
  },
  {
    id: 'g6',
    time: '9:15 AM',
    direction: 'in',
    trailerNumber: 'BH-1877',
    trailerId: 'bh-1877',
    carrier: "Boar’s Head",
    seal: 'SL-98871',
    status: 'held',
    lane: 'Lane 2',
    appointment: '9:00 AM',
  },
]

export function getTrailer(id: string, list: Trailer[] = trailers) {
  return list.find((t) => t.id === id)
}

export function getSlot(id: string, list: Slot[] = slots) {
  return list.find((s) => s.id === id || s.label === id)
}

export function yardMetrics(
  trailerList: Trailer[] = trailers,
  layout: YardLayout = DEFAULT_YARD_LAYOUT,
) {
  const slotList = buildSlots(trailerList, layout)
  const onSite = trailerList.filter(isOnSite)
  const parked = onSite.filter((t) => t.slot)
  const atDock = onSite.filter((t) => t.status === 'At dock')
  const atGate = onSite.filter((t) => t.status === 'Gate arrived')
  const holds = onSite.filter((t) => trailerHasOpsHold(t))
  const critical = onSite.filter((t) => t.tempStatus === 'critical').length
  const warn = onSite.filter((t) => t.tempStatus === 'warn').length
  const offline = onSite.filter((t) => t.tempStatus === 'offline').length
  const ok = onSite.filter((t) => t.tempStatus === 'ok').length
  const instrumented = onSite.filter((t) => t.telemetry).length
  const parkingSlots = slotList.filter((s) => {
    if (s.type !== 'parking') return false
    const zoneDef = layout.zones.find((z) => z.id === s.zone)
    return zoneDef?.status !== 'disabled'
  })
  const capacity = parkingSlots.length
  const occupancy = capacity ? Math.round((parked.length / capacity) * 100) : 0
  const walk = onSite.filter(
    (t) =>
      t.tempStatus === 'critical' ||
      t.tempStatus === 'warn' ||
      t.tempStatus === 'offline' ||
      t.reeferAlarm ||
      t.dwellHours >= 16 ||
      trailerHasOpsHold(t),
  )
  const longDwell = onSite.filter((t) => t.dwellHours >= 12).length
  const readyDock = onSite.filter((t) => t.status === 'Ready to dock').length
  const outbound = onSite.filter((t) => t.status === 'Outbound staged').length

  const byZone = layout.zones
    .filter((z) => z.status !== 'disabled')
    .map((z) => {
      const zoneSlots = slotList.filter((s) => s.zone === z.id && s.type === 'parking')
      const used = zoneSlots.filter((s) => s.trailerId).length
      return { zone: z.id, used, total: zoneSlots.length }
    })

  return {
    onSite: onSite.length,
    parked: parked.length,
    atDock: atDock.length,
    atGate: atGate.length,
    holds: holds.length,
    critical,
    warn,
    offline,
    ok,
    instrumented,
    occupancy,
    capacity,
    walk,
    walkCount: walk.length,
    longDwell,
    readyDock,
    outbound,
    byZone,
    openDocks: slotList.filter((s) => s.type === 'dock' && !s.trailerId).length,
    totalDocks: slotList.filter((s) => s.type === 'dock').length,
  }
}

// keep old name used by existing pages
export function counts(trailerList: Trailer[] = trailers) {
  return yardMetrics(trailerList)
}

export type AddTrailerInput = {
  number: string
  ownership: Ownership
  carrier: string
  product: string
  seal: string
  status: TrailerStatus
  recordStatus?: TrailerRecordStatus
  trailerType: TrailerType
  lengthFt: TrailerLengthFt
  reeferBrand: ReeferBrand
  defaultSetpoint: number | null
  homeSite: string
  fleetAssetId?: string
  masterNotes?: string
  slot: string | null
  zone: Zone
  dockDoor?: string
  setpoint: number | null
  actual: number | null
  fuelPct: number | null
  telemetry: boolean
  direction: 'inbound' | 'outbound' | 'empty'
  tempStatus: TempStatus
  reeferAlarm: boolean
  lane?: string
}

export type CheckInTrailerInput = {
  trailerId: string
  seal?: string
  lane?: string
  direction?: 'inbound' | 'outbound' | 'empty'
  /** Optional parking slot to assign immediately after check-in */
  slot?: string
  /** Optional visit temperature captured at gate */
  actualTemp?: number
  setpoint?: number
  /** Visit workflow — when false, yard can stage outbound without dock. */
  dockRequired?: boolean
}

export type AssignParkingSlotInput = {
  trailerId: string
  slot: string
}

export type GateExitInput = {
  trailerId: string
  lane?: string
}
