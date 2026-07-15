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
  buildSlots,
  hist,
  isCheckInEligible,
  normalizeZoneId,
  normalizeGateLaneId,
  gateLaneSupportsDirection,
  RESERVED_ZONE_IDS,
  zoneFromSlotLabel,
  withMasterDefaults,
  yardMetrics as computeMetrics,
  DEFAULT_YARD_LAYOUT,
  SITE,
  type AddTrailerInput,
  type AssignParkingSlotInput,
  type CheckInTrailerInput,
  type GateEvent,
  type GateLaneDef,
  type GateLaneDirection,
  type GateLaneStatus,
  type Movement,
  type Slot,
  type Trailer,
  type TrailerRecordStatus,
  type TrailerStatus,
  type OpsHold,
  type DockPhase,
  type GateExitInput,
  type YardLayout,
  type YardZoneDef,
  type Zone,
  type ZoneStatus,
  canStageOutboundFromYard,
  trailerNeedsDock,
} from '../data/trailers'
import { formatUsDateTime, formatUsTime } from '../utils/usFormat'
import { db, loadYardLayout, saveYardLayout } from '../db/yardDb'
import {
  runTelemetryTick,
  TELEMETRY_TICK_MS,
} from '../db/telemetrySimulator'

export type AddTrailerOptions = {
  /**
   * Gate creates arrivals via checkInTrailer.
   * Trailer management always adds to the master register (defaults off site).
   */
  asRegister?: boolean
}

export type AddZoneInput = {
  id: string
  name?: string
  slotCount: number
}

export type AddParkingSlotsInput = {
  zoneId: Zone
  count: number
}

export type UpdateZoneInput = {
  name?: string
  slotCount?: number
}

export type AssignDockInput = {
  trailerId: string
  doorLabel: string
}

export type AddDocksInput = {
  count: number
}

export type AddGateLaneInput = {
  id?: string
  name: string
  direction: GateLaneDirection
  note?: string
}

export type UpdateGateLaneInput = {
  name?: string
  direction?: GateLaneDirection
  note?: string
}

type YardContextValue = {
  trailers: Trailer[]
  slots: Slot[]
  layout: YardLayout
  parkingZones: YardZoneDef[]
  gateLanes: GateLaneDef[]
  activeGateLanes: GateLaneDef[]
  movements: Movement[]
  gateEvents: GateEvent[]
  metrics: ReturnType<typeof computeMetrics>
  ready: boolean
  getTrailer: (id: string) => Trailer | undefined
  getSlot: (id: string) => Slot | undefined
  availableParkingSlots: Slot[]
  checkInEligible: Trailer[]
  addTrailer: (
    input: AddTrailerInput,
    options?: AddTrailerOptions,
  ) => Promise<Trailer>
  updateTrailer: (id: string, patch: Partial<Trailer>) => Promise<Trailer | null>
  setTrailerStatus: (id: string, status: Trailer['status']) => Promise<void>
  setTrailerOpsHold: (id: string, opsHold: OpsHold) => Promise<void>
  setDockPhase: (id: string, dockPhase: DockPhase) => Promise<Trailer>
  setTrailerRecordStatus: (
    id: string,
    recordStatus: TrailerRecordStatus,
  ) => Promise<void>
  checkInTrailer: (input: CheckInTrailerInput) => Promise<Trailer>
  assignParkingSlot: (input: AssignParkingSlotInput) => Promise<Trailer>
  assignToDock: (input: AssignDockInput) => Promise<Trailer>
  undockTrailer: (trailerId: string) => Promise<Trailer>
  /** Yard → Outbound staged when dock is not required for this visit. */
  stageOutboundFromYard: (trailerId: string) => Promise<Trailer>
  setTrailerDockRequired: (
    trailerId: string,
    dockRequired: boolean,
  ) => Promise<Trailer>
  gateExitTrailer: (input: GateExitInput) => Promise<Trailer>
  addDocks: (input: AddDocksInput) => Promise<YardLayout>
  addZone: (input: AddZoneInput) => Promise<YardZoneDef>
  updateZone: (zoneId: Zone, input: UpdateZoneInput) => Promise<YardZoneDef>
  setZoneStatus: (zoneId: Zone, status: ZoneStatus) => Promise<YardZoneDef>
  addParkingSlots: (input: AddParkingSlotsInput) => Promise<YardZoneDef>
  addGateLane: (input: AddGateLaneInput) => Promise<GateLaneDef>
  updateGateLane: (
    laneId: string,
    input: UpdateGateLaneInput,
  ) => Promise<GateLaneDef>
  setGateLaneStatus: (
    laneId: string,
    status: GateLaneStatus,
  ) => Promise<GateLaneDef>
}

const YardContext = createContext<YardContextValue | null>(null)

function slugId(number: string) {
  return number
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function nowLabel() {
  return formatUsDateTime()
}

function timeNow() {
  return formatUsTime()
}

function nowMs() {
  return Date.now()
}

function stampMovement(
  partial: Omit<Movement, 'time' | 'timeMs'>,
): Movement {
  const ms = nowMs()
  return { ...partial, time: formatUsTime(new Date(ms)), timeMs: ms }
}

function stampGateEvent(
  partial: Omit<GateEvent, 'time' | 'timeMs'>,
): GateEvent {
  const ms = nowMs()
  return { ...partial, time: formatUsTime(new Date(ms)), timeMs: ms }
}

function liveTouch(): Pick<Trailer, 'lastUpdate' | 'lastTelemetryAtMs'> {
  const ms = nowMs()
  return { lastUpdate: 'Just now', lastTelemetryAtMs: ms }
}

function normalizeTrailer(t: Trailer): Trailer {
  return withMasterDefaults(t)
}

export function YardProvider({ children }: { children: ReactNode }) {
  const [trailers, setTrailers] = useState<Trailer[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [gateEvents, setGateEvents] = useState<GateEvent[]>([])
  const [layout, setLayout] = useState<YardLayout>(DEFAULT_YARD_LAYOUT)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const [t, m, g, yardLayout] = await Promise.all([
      db.trailers.toArray(),
      db.movements.toArray(),
      db.gateEvents.toArray(),
      loadYardLayout(),
    ])
    setTrailers(t.map(normalizeTrailer))
    setMovements(
      m.sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0)),
    )
    setGateEvents(
      g.sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0)),
    )
    setLayout(yardLayout)
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

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function tick() {
      if (cancelled) return
      try {
        await runTelemetryTick()
        if (!cancelled) await refresh()
      } catch {
        /* ignore background tick errors */
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), TELEMETRY_TICK_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [ready, refresh])

  const slots = useMemo(() => buildSlots(trailers, layout), [trailers, layout])
  const metrics = useMemo(
    () => computeMetrics(trailers, layout),
    [trailers, layout],
  )
  const parkingZones = layout.zones
  const gateLanes = layout.lanes
  const activeGateLanes = useMemo(
    () => layout.lanes.filter((l) => l.status !== 'disabled'),
    [layout.lanes],
  )

  const availableParkingSlots = useMemo(() => {
    const disabled = new Set(
      layout.zones.filter((z) => z.status === 'disabled').map((z) => z.id),
    )
    return slots.filter(
      (s) =>
        s.type === 'parking' && !s.trailerId && !disabled.has(s.zone),
    )
  }, [slots, layout.zones])

  const checkInEligible = useMemo(
    () =>
      trailers
        .filter(isCheckInEligible)
        .sort((a, b) => a.number.localeCompare(b.number)),
    [trailers],
  )

  const getTrailer = useCallback(
    (id: string) => trailers.find((t) => t.id === id),
    [trailers],
  )

  const getSlot = useCallback(
    (id: string) => slots.find((s) => s.id === id || s.label === id),
    [slots],
  )

  const addZone = useCallback(
    async (input: AddZoneInput) => {
      const id = normalizeZoneId(input.id)
      if (!id) throw new Error('Zone code is required.')
      if (RESERVED_ZONE_IDS.has(id) || id === 'DOCK' || id === 'GATE') {
        throw new Error('That zone code is reserved.')
      }
      const count = Math.floor(Number(input.slotCount))
      if (!Number.isFinite(count) || count < 1 || count > 200) {
        throw new Error('Slot count must be between 1 and 200.')
      }

      const current = await loadYardLayout()
      if (current.zones.some((z) => z.id.toUpperCase() === id)) {
        throw new Error(`Zone ${id} already exists.`)
      }

      const zone: YardZoneDef = {
        id,
        name: input.name?.trim() || `Zone ${id}`,
        slotCount: count,
        status: 'active',
      }
      const next: YardLayout = {
        ...current,
        zones: [...current.zones, zone],
      }
      await saveYardLayout(next)
      setLayout(next)
      return zone
    },
    [],
  )

  const updateZone = useCallback(
    async (zoneId: Zone, input: UpdateZoneInput) => {
      const current = await loadYardLayout()
      const idx = current.zones.findIndex((z) => z.id === zoneId)
      if (idx < 0) throw new Error('Zone not found.')

      const zone = current.zones[idx]
      let nextName = zone.name
      if (input.name !== undefined) {
        nextName = input.name.trim() || zone.name
      }

      let nextCount = zone.slotCount
      if (input.slotCount !== undefined) {
        const count = Math.floor(Number(input.slotCount))
        if (!Number.isFinite(count) || count < 1 || count > 500) {
          throw new Error('Slot count must be between 1 and 500.')
        }
        const occupied = trailers.filter(
          (t) =>
            t.slot != null &&
            t.slot.startsWith(`${zone.id}-`) &&
            t.status !== 'Departed',
        ).length
        if (count < occupied) {
          throw new Error(
            `Cannot reduce below ${occupied} occupied slots in this zone.`,
          )
        }
        nextCount = count
      }

      const updated: YardZoneDef = {
        ...zone,
        name: nextName,
        slotCount: nextCount,
      }
      const next: YardLayout = {
        ...current,
        zones: current.zones.map((z, i) => (i === idx ? updated : z)),
      }
      await saveYardLayout(next)
      setLayout(next)
      return updated
    },
    [trailers],
  )

  const setZoneStatus = useCallback(
    async (zoneId: Zone, status: ZoneStatus) => {
      const current = await loadYardLayout()
      const idx = current.zones.findIndex((z) => z.id === zoneId)
      if (idx < 0) throw new Error('Zone not found.')

      const zone = current.zones[idx]
      if (zone.status === status) return zone

      if (status === 'disabled') {
        const occupied = trailers.some(
          (t) =>
            t.slot != null &&
            t.slot.startsWith(`${zone.id}-`) &&
            t.status !== 'Departed',
        )
        if (occupied) {
          throw new Error(
            `Move trailers out of ${zone.name} before disabling the zone.`,
          )
        }
      }

      const updated: YardZoneDef = { ...zone, status }
      const next: YardLayout = {
        ...current,
        zones: current.zones.map((z, i) => (i === idx ? updated : z)),
      }
      await saveYardLayout(next)
      setLayout(next)
      return updated
    },
    [trailers],
  )

  const addParkingSlots = useCallback(
    async (input: AddParkingSlotsInput) => {
      const count = Math.floor(Number(input.count))
      if (!Number.isFinite(count) || count < 1 || count > 100) {
        throw new Error('Add between 1 and 100 parking slots.')
      }

      const current = await loadYardLayout()
      const idx = current.zones.findIndex((z) => z.id === input.zoneId)
      if (idx < 0) throw new Error('Zone not found.')

      const zone = current.zones[idx]
      if (zone.status === 'disabled') {
        throw new Error('Enable the zone before adding parking slots.')
      }
      const nextCount = zone.slotCount + count
      if (nextCount > 500) {
        throw new Error('Zone cannot exceed 500 parking slots.')
      }

      const updated: YardZoneDef = { ...zone, slotCount: nextCount }
      const next: YardLayout = {
        ...current,
        zones: current.zones.map((z, i) => (i === idx ? updated : z)),
      }
      await saveYardLayout(next)
      setLayout(next)
      return updated
    },
    [],
  )

  const addTrailer = useCallback(
    async (input: AddTrailerInput, options?: AddTrailerOptions) => {
      const asRegister = options?.asRegister ?? true
      const baseId = slugId(input.number) || `trailer-${Date.now()}`
      const existing = await db.trailers.toArray()
      let id = baseId
      let n = 2
      while (existing.some((t) => t.id === id)) {
        id = `${baseId}-${n++}`
      }

      const actual = input.actual
      const history =
        actual != null ? hist(actual, [-0.4, -0.2, 0, 0.1, 0.2, 0]) : []

      const yardStatus = asRegister ? 'Departed' : input.status
      const trailer: Trailer = {
        id,
        number: input.number.trim().toUpperCase(),
        ownership: input.ownership,
        carrier: input.carrier.trim(),
        slot: asRegister ? null : input.slot,
        zone: asRegister ? 'Gate' : input.zone,
        status: yardStatus,
        recordStatus: input.recordStatus ?? 'active',
        trailerType: input.trailerType,
        lengthFt: input.lengthFt,
        reeferBrand: input.reeferBrand,
        defaultSetpoint: input.defaultSetpoint,
        homeSite: input.homeSite.trim() || SITE.name,
        fleetAssetId: input.fleetAssetId?.trim() || undefined,
        masterNotes: input.masterNotes?.trim() || undefined,
        seal:
          input.seal.trim() ||
          `SL-${Math.floor(90000 + Math.random() * 9999)}`,
        arrivedAt: asRegister ? '—' : nowLabel(),
        arrivedAtMs: asRegister ? undefined : nowMs(),
        dwellHours: asRegister ? 0 : 0.1,
        setpoint: input.setpoint ?? input.defaultSetpoint,
        actual: input.actual,
        fuelPct: input.fuelPct,
        tempStatus: input.tempStatus,
        reeferAlarm: input.reeferAlarm,
        lastUpdate: 'Just now',
        lastTelemetryAtMs: asRegister ? undefined : nowMs(),
        telemetry: input.telemetry,
        product: input.product.trim() || 'General · chilled',
        history,
        direction: input.direction,
        dockDoor: asRegister ? undefined : input.dockDoor,
        notes: asRegister
          ? 'Registered in fleet — check in at Gate when arriving'
          : undefined,
      }

      await db.trailers.put(trailer)
      await refresh()
      return trailer
    },
    [refresh],
  )

  const updateTrailer = useCallback(
    async (id: string, patch: Partial<Trailer>) => {
      const existing = await db.trailers.get(id)
      if (!existing) return null

      const next: Trailer = {
        ...normalizeTrailer(existing),
        ...patch,
        id,
        number: (patch.number ?? existing.number).trim().toUpperCase(),
        ...liveTouch(),
      }

      if (patch.status && patch.status !== existing.status) {
        const movement = stampMovement({
          id: `m-${Date.now()}`,
          trailerNumber: next.number,
          trailerId: next.id,
          type: 'hold',
          from: existing.status,
          to: patch.status,
          by: 'Yard operations',
          note: 'Yard status updated in trailer management',
        })
        await db.transaction('rw', db.trailers, db.movements, async () => {
          await db.trailers.put(next)
          await db.movements.put(movement)
        })
      } else {
        await db.trailers.put(next)
      }
      await refresh()
      return next
    },
    [refresh],
  )

  const setTrailerStatus = useCallback(
    async (id: string, status: TrailerStatus) => {
      const existing = await db.trailers.get(id)
      if (!existing) return
      const trailer = normalizeTrailer(existing)

      // Legacy hold statuses become overlays on In yard.
      if (status === 'QA hold' || status === 'Yard hold') {
        await updateTrailer(id, {
          status: 'In yard',
          opsHold: status === 'QA hold' ? 'qa' : 'yard',
        })
        return
      }

      if (trailer.status === status) return

      let zone: Zone = trailer.zone
      let slot = trailer.slot
      let dockDoor = trailer.dockDoor
      let dockPhase: DockPhase = trailer.dockPhase ?? 'idle'
      let opsHold: OpsHold = trailer.opsHold ?? 'none'
      // Ready / At dock implies dock workflow — auto-enable if still on yard-depart.
      let dockRequired = trailer.dockRequired
      if (
        (status === 'Ready to dock' || status === 'At dock') &&
        !trailerNeedsDock(trailer)
      ) {
        dockRequired = true
      }

      if (status === 'Gate arrived') {
        zone = 'Gate'
        slot = null
        dockDoor = undefined
        dockPhase = 'idle'
      } else if (status === 'At dock') {
        zone = 'Dock'
        dockDoor = trailer.dockDoor ?? 'Door 1'
        slot = null
        dockPhase = 'idle'
      } else if (status === 'Departed') {
        slot = null
        dockDoor = undefined
        zone = 'Gate'
        dockPhase = 'idle'
        opsHold = 'none'
      } else if (status === 'Outbound staged') {
        dockDoor = undefined
        dockPhase = 'idle'
      } else {
        dockPhase = 'idle'
      }

      await updateTrailer(id, {
        status,
        zone,
        slot,
        dockDoor,
        dockPhase,
        opsHold,
        dockRequired,
      })
    },
    [updateTrailer],
  )

  const setTrailerOpsHold = useCallback(
    async (id: string, opsHold: OpsHold) => {
      const existing = await db.trailers.get(id)
      if (!existing) return
      const trailer = normalizeTrailer(existing)
      if (trailer.status === 'Departed') {
        throw new Error('Cannot set a hold on a departed trailer.')
      }
      await updateTrailer(id, { opsHold })
    },
    [updateTrailer],
  )

  const setDockPhase = useCallback(
    async (id: string, dockPhase: DockPhase) => {
      const existing = await db.trailers.get(id)
      if (!existing) throw new Error('Trailer not found.')
      const trailer = normalizeTrailer(existing)
      if (trailer.status !== 'At dock') {
        throw new Error('Dock activity applies only while At dock.')
      }
      if (trailer.opsHold === 'qa' || trailer.opsHold === 'yard') {
        throw new Error('Clear the operational hold before dock work.')
      }
      const next = await updateTrailer(id, { dockPhase })
      if (!next) throw new Error('Could not update dock phase.')
      return next
    },
    [updateTrailer],
  )

  const setTrailerRecordStatus = useCallback(
    async (id: string, recordStatus: TrailerRecordStatus) => {
      const existing = await db.trailers.get(id)
      if (!existing) return

      const patch: Partial<Trailer> = { recordStatus }
      if (recordStatus === 'disabled' && existing.status !== 'Departed') {
        patch.status = 'Departed'
        patch.slot = null
        patch.dockDoor = undefined
        patch.zone = 'Gate'
      }
      await updateTrailer(id, patch)
    },
    [updateTrailer],
  )

  const checkInTrailer = useCallback(
    async (input: CheckInTrailerInput) => {
      const existing = await db.trailers.get(input.trailerId)
      if (!existing) throw new Error('Trailer not found in register.')
      const trailer = normalizeTrailer(existing)
      if (trailer.recordStatus === 'disabled') {
        throw new Error('This trailer is disabled and cannot check in.')
      }
      if (trailer.status !== 'Departed') {
        throw new Error(
          `${trailer.number} is already on site (${trailer.status}).`,
        )
      }

      const seal =
        input.seal?.trim() ||
        trailer.seal ||
        `SL-${Math.floor(90000 + Math.random() * 9999)}`

      const yardLayout = await loadYardLayout()
      const laneName = (input.lane ?? '').trim()
      const inboundLanes = yardLayout.lanes.filter((l) =>
        gateLaneSupportsDirection(l, 'in'),
      )
      if (!inboundLanes.length) {
        throw new Error(
          'No active inbound gate lanes. Enable or add a lane in Gates.',
        )
      }
      const selectedLane = laneName
        ? yardLayout.lanes.find(
            (l) =>
              l.name.toLowerCase() === laneName.toLowerCase() ||
              l.id === normalizeGateLaneId(laneName),
          )
        : inboundLanes[0]
      if (!selectedLane) {
        throw new Error(`Gate lane "${laneName}" was not found.`)
      }
      if (!gateLaneSupportsDirection(selectedLane, 'in')) {
        throw new Error(
          `${selectedLane.name} is inactive or not open for inbound check-in.`,
        )
      }

      let slot: string | null = null
      let zone: Zone = 'Gate'
      let status: TrailerStatus = 'Gate arrived'

      if (input.slot?.trim()) {
        const slotLabel = input.slot.trim()
        const currentSlots = buildSlots(
          (await db.trailers.toArray()).map(normalizeTrailer),
          yardLayout,
        )
        const target = currentSlots.find(
          (s) => s.type === 'parking' && s.label === slotLabel,
        )
        if (!target) throw new Error('Parking slot not found.')
        if (target.trailerId) {
          throw new Error(`${slotLabel} is already occupied.`)
        }
        slot = slotLabel
        zone = zoneFromSlotLabel(slotLabel)
        status = 'In yard'
      }

      const next: Trailer = {
        ...trailer,
        status,
        zone,
        slot,
        dockDoor: undefined,
        dockPhase: 'idle',
        opsHold: 'none',
        dockRequired: input.dockRequired ?? trailer.dockRequired ?? true,
        seal,
        arrivedAt: nowLabel(),
        arrivedAtMs: nowMs(),
        dwellHours: 0.1,
        direction: input.direction ?? 'inbound',
        setpoint:
          input.setpoint != null
            ? input.setpoint
            : (trailer.setpoint ?? trailer.defaultSetpoint),
        actual:
          input.actualTemp != null ? input.actualTemp : trailer.actual,
        ...liveTouch(),
        notes: trailer.notes?.includes('register')
          ? undefined
          : trailer.notes,
      }

      const movement = stampMovement({
        id: `m-${Date.now()}`,
        trailerNumber: next.number,
        trailerId: next.id,
        type: 'gate_in',
        from: 'Off site',
        to: slot ? slot : 'Gate',
        by: 'Gate clerk',
        note: slot
          ? `Gate check-in · ${selectedLane.name} · assigned to ${slot}`
          : `Gate check-in · ${selectedLane.name}`,
      })

      const gate = stampGateEvent({
        id: `g-${Date.now()}`,
        direction: 'in',
        trailerNumber: next.number,
        trailerId: next.id,
        carrier: next.carrier,
        seal: next.seal,
        status: slot ? 'cleared' : 'processing',
        lane: selectedLane.name,
      })

      await db.transaction(
        'rw',
        db.trailers,
        db.movements,
        db.gateEvents,
        async () => {
          await db.trailers.put(next)
          await db.movements.put(movement)
          await db.gateEvents.put(gate)
          if (slot) {
            const slotMove: Movement = {
              id: `m-${Date.now()}-slot`,
              time: timeNow(),
              trailerNumber: next.number,
              trailerId: next.id,
              type: 'slot_move',
              from: 'Gate',
              to: slot,
              by: 'Gate clerk',
              note: 'Parking slot assigned at check-in',
            }
            await db.movements.put(slotMove)
          }
        },
      )
      await refresh()
      return next
    },
    [refresh],
  )

  const assignParkingSlot = useCallback(
    async (input: AssignParkingSlotInput) => {
      const existing = await db.trailers.get(input.trailerId)
      if (!existing) throw new Error('Trailer not found.')
      const trailer = normalizeTrailer(existing)

      if (trailer.recordStatus === 'disabled') {
        throw new Error('Cannot assign a slot to a disabled trailer.')
      }
      if (trailer.status === 'Departed') {
        throw new Error('Trailer is off site — check in at Gate first.')
      }
      if (trailer.status === 'At dock') {
        throw new Error('Trailer is at dock — undock before assigning a yard slot.')
      }

      const slotLabel = input.slot.trim()
      if (!slotLabel) throw new Error('Select a parking slot.')

      const allTrailers = (await db.trailers.toArray()).map(normalizeTrailer)
      const layout = await loadYardLayout()
      const slotList = buildSlots(allTrailers, layout)
      const target = slotList.find(
        (s) => s.type === 'parking' && s.label === slotLabel,
      )
      if (!target) throw new Error('Parking slot not found.')
      if (target.trailerId && target.trailerId !== trailer.id) {
        throw new Error(`${slotLabel} is already occupied.`)
      }

      const disabledZone = layout.zones.find(
        (z) => z.id === target.zone && z.status === 'disabled',
      )
      if (disabledZone) {
        throw new Error(`${disabledZone.name} is disabled.`)
      }

      const from = trailer.slot ?? (trailer.status === 'Gate arrived' ? 'Gate' : 'Yard')
      const zone = target.zone || zoneFromSlotLabel(slotLabel)

      const next: Trailer = {
        ...trailer,
        status: 'In yard',
        slot: slotLabel,
        zone,
        dockDoor: undefined,
        lastUpdate: 'Just now',
      }

      const movement: Movement = {
        id: `m-${Date.now()}`,
        time: timeNow(),
        trailerNumber: next.number,
        trailerId: next.id,
        type: 'slot_move',
        from,
        to: slotLabel,
        by: 'Yard operations',
        note:
          trailer.slot && trailer.slot !== slotLabel
            ? `Relocated to ${slotLabel}`
            : `Assigned to ${slotLabel}`,
      }

      await db.transaction(
        'rw',
        db.trailers,
        db.movements,
        db.gateEvents,
        async () => {
          await db.trailers.put(next)
          await db.movements.put(movement)
          // Clear any open gate events for this trailer now that it's parked
          const openGate = await db.gateEvents
            .where('trailerId')
            .equals(next.id)
            .toArray()
          for (const g of openGate) {
            if (g.status === 'processing' || g.status === 'held') {
              await db.gateEvents.put({ ...g, status: 'cleared' })
            }
          }
        },
      )
      await refresh()
      return next
    },
    [refresh],
  )

  const assignToDock = useCallback(
    async (input: AssignDockInput) => {
      const existing = await db.trailers.get(input.trailerId)
      if (!existing) throw new Error('Trailer not found.')
      const trailer = normalizeTrailer(existing)

      if (trailer.recordStatus === 'disabled') {
        throw new Error('Cannot dock a disabled trailer.')
      }
      if (trailer.status === 'Departed') {
        throw new Error('Trailer is off site — check in at Gate first.')
      }
      if (trailer.opsHold === 'qa' || trailer.opsHold === 'yard') {
        throw new Error('Clear the operational hold before assigning a dock.')
      }
      if (!trailerNeedsDock(trailer)) {
        throw new Error(
          `${trailer.number} does not require dock — stage for departure from Yards, or enable Dock required.`,
        )
      }

      const doorLabel = input.doorLabel.trim()
      if (!doorLabel) throw new Error('Select a dock door.')

      const allTrailers = (await db.trailers.toArray()).map(normalizeTrailer)
      const yardLayout = await loadYardLayout()
      const slotList = buildSlots(allTrailers, yardLayout)
      const door = slotList.find(
        (s) => s.type === 'dock' && s.label === doorLabel,
      )
      if (!door) throw new Error(`Dock door ${doorLabel} not found.`)
      if (door.trailerId && door.trailerId !== trailer.id) {
        throw new Error(`${doorLabel} is already occupied.`)
      }

      const from =
        trailer.dockDoor ??
        trailer.slot ??
        (trailer.status === 'Gate arrived' ? 'Gate' : trailer.status)

      const next: Trailer = {
        ...trailer,
        status: 'At dock',
        zone: 'Dock',
        slot: null,
        dockDoor: doorLabel,
        dockPhase: 'idle',
        lastUpdate: 'Just now',
      }

      const movement: Movement = {
        id: `m-${Date.now()}`,
        time: timeNow(),
        trailerNumber: next.number,
        trailerId: next.id,
        type: 'dock_assign',
        from,
        to: doorLabel,
        by: 'Dock operations',
        note: `Assigned to ${doorLabel}`,
      }

      await db.transaction('rw', db.trailers, db.movements, async () => {
        await db.trailers.put(next)
        await db.movements.put(movement)
      })
      await refresh()
      return next
    },
    [refresh],
  )

  const undockTrailer = useCallback(
    async (trailerId: string) => {
      const existing = await db.trailers.get(trailerId)
      if (!existing) throw new Error('Trailer not found.')
      const trailer = normalizeTrailer(existing)

      if (trailer.status !== 'At dock' && !trailer.dockDoor) {
        throw new Error('Trailer is not at a dock door.')
      }
      const phase = trailer.dockPhase ?? 'idle'
      if (phase !== 'complete') {
        throw new Error(
          'Complete loading/unloading and QA verification before unlock.',
        )
      }

      const from = trailer.dockDoor ?? 'Dock'
      const next: Trailer = {
        ...trailer,
        status: 'Outbound staged',
        zone: 'Dock',
        slot: null,
        dockDoor: undefined,
        dockPhase: 'idle',
        lastUpdate: 'Just now',
      }

      const movement: Movement = {
        id: `m-${Date.now()}`,
        time: timeNow(),
        trailerNumber: next.number,
        trailerId: next.id,
        type: 'undock',
        from,
        to: 'Dock apron',
        by: 'Dock operations',
        note: `Unlocked ${from}`,
      }

      await db.transaction('rw', db.trailers, db.movements, async () => {
        await db.trailers.put(next)
        await db.movements.put(movement)
      })
      await refresh()
      return next
    },
    [refresh],
  )

  const stageOutboundFromYard = useCallback(
    async (trailerId: string) => {
      const existing = await db.trailers.get(trailerId)
      if (!existing) throw new Error('Trailer not found.')
      const trailer = normalizeTrailer(existing)

      if (!canStageOutboundFromYard(trailer)) {
        if (trailerNeedsDock(trailer)) {
          throw new Error(
            `${trailer.number} requires dock — set Ready to dock, then assign a door.`,
          )
        }
        if (trailer.opsHold === 'qa' || trailer.opsHold === 'yard') {
          throw new Error('Clear the operational hold before staging outbound.')
        }
        throw new Error(
          'Stage outbound from Gate arrived or In yard when dock is not required.',
        )
      }

      const from =
        trailer.slot ??
        (trailer.status === 'Gate arrived' ? 'Gate' : trailer.zone)
      const next: Trailer = {
        ...trailer,
        status: 'Outbound staged',
        zone: 'Gate',
        slot: null,
        dockDoor: undefined,
        dockPhase: 'idle',
        direction: 'outbound',
        lastUpdate: 'Just now',
      }

      const movement: Movement = {
        id: `m-${Date.now()}`,
        time: timeNow(),
        trailerNumber: next.number,
        trailerId: next.id,
        type: 'stage_outbound',
        from,
        to: 'Outbound apron',
        by: 'Yard operations',
        note: 'Dock not required · staged for gate exit',
      }

      await db.transaction('rw', db.trailers, db.movements, async () => {
        await db.trailers.put(next)
        await db.movements.put(movement)
      })
      await refresh()
      return next
    },
    [refresh],
  )

  const setTrailerDockRequired = useCallback(
    async (trailerId: string, dockRequired: boolean) => {
      const existing = await db.trailers.get(trailerId)
      if (!existing) throw new Error('Trailer not found.')
      const trailer = normalizeTrailer(existing)
      if (trailer.status === 'At dock' && !dockRequired) {
        throw new Error(
          'Unlock from dock before switching to yard-depart workflow.',
        )
      }
      if (trailer.status === 'Ready to dock' && !dockRequired) {
        throw new Error(
          'Move trailer out of dock queue before disabling Dock required.',
        )
      }
      const next = await updateTrailer(trailerId, { dockRequired })
      if (!next) throw new Error('Could not update dock workflow.')
      return next
    },
    [updateTrailer],
  )

  const gateExitTrailer = useCallback(
    async (input: GateExitInput) => {
      const existing = await db.trailers.get(input.trailerId)
      if (!existing) throw new Error('Trailer not found.')
      const trailer = normalizeTrailer(existing)
      if (trailer.status === 'Departed') {
        throw new Error(`${trailer.number} is already departed.`)
      }
      if (
        trailer.status !== 'Outbound staged' &&
        trailer.status !== 'Gate arrived'
      ) {
        throw new Error(
          'Stage outbound (or hold at gate) before gate exit.',
        )
      }

      const yardLayout = await loadYardLayout()
      const outboundLanes = yardLayout.lanes.filter((l) =>
        gateLaneSupportsDirection(l, 'out'),
      )
      const laneName = (input.lane ?? '').trim()
      const selectedLane = laneName
        ? yardLayout.lanes.find(
            (l) =>
              l.name.toLowerCase() === laneName.toLowerCase() ||
              l.id === normalizeGateLaneId(laneName),
          )
        : outboundLanes[0]
      if (!selectedLane || !gateLaneSupportsDirection(selectedLane, 'out')) {
        throw new Error('Select an active outbound / flex gate lane.')
      }

      const next: Trailer = {
        ...trailer,
        status: 'Departed',
        zone: 'Gate',
        slot: null,
        dockDoor: undefined,
        dockPhase: 'idle',
        opsHold: 'none',
        direction: 'outbound',
        lastUpdate: 'Just now',
      }

      const movement: Movement = {
        id: `m-${Date.now()}`,
        time: timeNow(),
        trailerNumber: next.number,
        trailerId: next.id,
        type: 'gate_out',
        from: trailer.status,
        to: 'Off site',
        by: 'Gate clerk',
        note: `Gate exit · ${selectedLane.name}`,
      }

      const gate: GateEvent = {
        id: `g-${Date.now()}`,
        time: timeNow(),
        direction: 'out',
        trailerNumber: next.number,
        trailerId: next.id,
        carrier: next.carrier,
        seal: next.seal,
        status: 'cleared',
        lane: selectedLane.name,
      }

      await db.transaction(
        'rw',
        db.trailers,
        db.movements,
        db.gateEvents,
        async () => {
          await db.trailers.put(next)
          await db.movements.put(movement)
          await db.gateEvents.put(gate)
        },
      )
      await refresh()
      return next
    },
    [refresh],
  )

  const addDocks = useCallback(async (input: AddDocksInput) => {
    const count = Math.floor(Number(input.count))
    if (!Number.isFinite(count) || count < 1 || count > 20) {
      throw new Error('Add between 1 and 20 dock doors at a time.')
    }
    const current = await loadYardLayout()
    const nextCount = current.dockCount + count
    if (nextCount > 64) {
      throw new Error('Yard supports a maximum of 64 dock doors.')
    }
    const next: YardLayout = { ...current, dockCount: nextCount }
    await saveYardLayout(next)
    setLayout(next)
    return next
  }, [])

  const addGateLane = useCallback(async (input: AddGateLaneInput) => {
    const name = input.name.trim()
    if (!name) throw new Error('Lane name is required.')
    if (name.length > 40) throw new Error('Lane name is too long.')

    const id =
      normalizeGateLaneId(input.id || name) ||
      `lane-${Date.now().toString(36)}`
    if (!id) throw new Error('Lane id is required.')

    const current = await loadYardLayout()
    if (
      current.lanes.some(
        (l) =>
          l.id === id || l.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new Error('A gate lane with that name already exists.')
    }
    if (current.lanes.length >= 24) {
      throw new Error('Yard supports a maximum of 24 gate lanes.')
    }

    const lane: GateLaneDef = {
      id,
      name,
      direction: input.direction,
      status: 'active',
      note: input.note?.trim() || undefined,
    }
    const next: YardLayout = {
      ...current,
      lanes: [...current.lanes, lane],
    }
    await saveYardLayout(next)
    setLayout(next)
    return lane
  }, [])

  const updateGateLane = useCallback(
    async (laneId: string, input: UpdateGateLaneInput) => {
      const current = await loadYardLayout()
      const idx = current.lanes.findIndex((l) => l.id === laneId)
      if (idx < 0) throw new Error('Gate lane not found.')

      const lane = current.lanes[idx]
      let nextName = lane.name
      if (input.name !== undefined) {
        nextName = input.name.trim()
        if (!nextName) throw new Error('Lane name is required.')
        if (
          current.lanes.some(
            (l, i) =>
              i !== idx && l.name.toLowerCase() === nextName.toLowerCase(),
          )
        ) {
          throw new Error('A gate lane with that name already exists.')
        }
      }

      const updated: GateLaneDef = {
        ...lane,
        name: nextName,
        direction: input.direction ?? lane.direction,
        note:
          input.note !== undefined
            ? input.note.trim() || undefined
            : lane.note,
      }
      const next: YardLayout = {
        ...current,
        lanes: current.lanes.map((l, i) => (i === idx ? updated : l)),
      }
      await saveYardLayout(next)
      setLayout(next)
      return updated
    },
    [],
  )

  const setGateLaneStatus = useCallback(
    async (laneId: string, status: GateLaneStatus) => {
      const current = await loadYardLayout()
      const idx = current.lanes.findIndex((l) => l.id === laneId)
      if (idx < 0) throw new Error('Gate lane not found.')

      const lane = current.lanes[idx]
      if (lane.status === status) return lane

      if (status === 'disabled') {
        const stillActive = current.lanes.filter(
          (l) => l.id !== laneId && l.status !== 'disabled',
        )
        if (!stillActive.length) {
          throw new Error('Keep at least one gate lane active.')
        }
        const stillInbound = stillActive.some((l) =>
          gateLaneSupportsDirection({ ...l, status: 'active' }, 'in'),
        )
        if (
          gateLaneSupportsDirection(lane, 'in') &&
          !stillInbound
        ) {
          throw new Error(
            'Enable another inbound lane before disabling this one.',
          )
        }
      }

      const updated: GateLaneDef = { ...lane, status }
      const next: YardLayout = {
        ...current,
        lanes: current.lanes.map((l, i) => (i === idx ? updated : l)),
      }
      await saveYardLayout(next)
      setLayout(next)
      return updated
    },
    [],
  )

  const value: YardContextValue = {
    trailers,
    slots,
    layout,
    parkingZones,
    gateLanes,
    activeGateLanes,
    movements,
    gateEvents,
    metrics,
    ready,
    getTrailer,
    getSlot,
    availableParkingSlots,
    checkInEligible,
    addTrailer,
    updateTrailer,
    setTrailerStatus,
    setTrailerOpsHold,
    setDockPhase,
    setTrailerRecordStatus,
    checkInTrailer,
    assignParkingSlot,
    assignToDock,
    undockTrailer,
    stageOutboundFromYard,
    setTrailerDockRequired,
    gateExitTrailer,
    addDocks,
    addZone,
    updateZone,
    setZoneStatus,
    addParkingSlots,
    addGateLane,
    updateGateLane,
    setGateLaneStatus,
  }

  return <YardContext.Provider value={value}>{children}</YardContext.Provider>
}

export function useYard() {
  const ctx = useContext(YardContext)
  if (!ctx) throw new Error('useYard must be used within YardProvider')
  return ctx
}

export { isOnSite, isCheckInEligible, canStageOutboundFromYard, trailerNeedsDock } from '../data/trailers'
