import {
  gateEvents as staticGateEvents,
  movements as staticMovements,
  trailers as staticTrailers,
  withMasterDefaults,
  type GateEvent,
  type Movement,
  type TempPoint,
  type TempStatus,
  type Trailer,
} from '../data/trailers'
import { formatRelativeAgo, formatUsDateTime, formatUsTime } from '../utils/usFormat'

/** Minutes-ago offsets for movement / gate event ordering (newest first). */
const MOVEMENT_AGE_MIN = [12, 44, 76, 108, 140, 172, 205, 238, 272, 305]
const GATE_AGE_MIN = [12, 54, 98, 142, 186, 230]

function parseLastUpdateMinutes(label: string): number | null {
  if (!label || label === '—') return null
  if (label === 'Just now') return 0
  const min = /^(\d+)\s*min/i.exec(label)
  if (min) return Number(min[1])
  const hr = /^(\d+)\s*hr/i.exec(label)
  if (hr) return Number(hr[1]) * 60
  return 2
}

function buildHistoryWindow(
  points: TempPoint[],
  actual: number | null,
): TempPoint[] {
  if (actual == null) return points
  const labels = ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now']
  const base = points.length ? points.map((p) => p.actual) : [actual]
  const tail = base.slice(-6)
  while (tail.length < 6) tail.unshift(actual)
  tail.push(actual)
  return labels.map((t, i) => ({
    t,
    actual: Math.round(tail[i]! * 10) / 10,
  }))
}

/** Canonical live sample set — hydrated against the current clock on each reseed. */
export function hydrateTrailerSeed(t: Trailer, now: number): Trailer {
  const onSite = t.status !== 'Departed'
  const arrivedAtMs = onSite
    ? now - Math.max(0.1, t.dwellHours) * 60 * 60 * 1000
    : now - 36 * 60 * 60 * 1000

  const telemetryAgoMin =
    t.telemetry && t.actual != null
      ? (parseLastUpdateMinutes(t.lastUpdate) ?? 2)
      : t.telemetry && t.tempStatus === 'offline'
        ? 47
        : null

  const lastTelemetryAtMs =
    telemetryAgoMin != null ? now - telemetryAgoMin * 60 * 1000 : undefined

  return withMasterDefaults({
    ...t,
    arrivedAtMs,
    arrivedAt: onSite ? formatUsDateTime(new Date(arrivedAtMs)) : t.arrivedAt,
    lastTelemetryAtMs,
    lastUpdate:
      lastTelemetryAtMs != null
        ? formatRelativeAgo(lastTelemetryAtMs, now)
        : t.lastUpdate,
    history: buildHistoryWindow(t.history, t.actual),
  })
}

function hydrateMovement(m: Movement, ageMin: number, now: number): Movement {
  const timeMs = now - ageMin * 60 * 1000
  return {
    ...m,
    timeMs,
    time: formatUsTime(new Date(timeMs)),
  }
}

function hydrateGateEvent(g: GateEvent, ageMin: number, now: number): GateEvent {
  const timeMs = now - ageMin * 60 * 1000
  return {
    ...g,
    timeMs,
    time: formatUsTime(new Date(timeMs)),
  }
}

/** Gate history rows aligned to trailers that exist in the register. */
const CLEAN_GATE_EVENTS: GateEvent[] = staticGateEvents.map((g) => {
  if (g.id === 'g2') {
    return {
      ...g,
      trailerId: 'bh-5501',
      trailerNumber: 'BH-5501',
      carrier: "Boar’s Head",
      seal: 'SL-00000',
      status: 'cleared' as const,
    }
  }
  if (g.id === 'g4') {
    return {
      ...g,
      trailerId: 'cx-9901',
      trailerNumber: 'CX-9901',
      carrier: 'Carrier partner',
      seal: 'SL-00001',
      status: 'cleared' as const,
    }
  }
  return g
})

export function buildLiveSeed(now = Date.now()) {
  const trailers = staticTrailers.map((t) => hydrateTrailerSeed(t, now))
  const movements = staticMovements
    .map((m, i) => hydrateMovement(m, MOVEMENT_AGE_MIN[i] ?? 360 + i * 20, now))
    .sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0))
  const gateEvents = CLEAN_GATE_EVENTS.map((g, i) =>
    hydrateGateEvent(g, GATE_AGE_MIN[i] ?? 240 + i * 30, now),
  )

  return { trailers, movements, gateEvents }
}

export function computeTempStatus(
  actual: number | null,
  setpoint: number | null,
  telemetry: boolean,
): TempStatus {
  if (!telemetry || actual == null) return 'offline'
  if (setpoint === 0) return actual <= 5 ? 'ok' : 'warn'
  const sp = setpoint ?? 34
  const delta = actual - sp
  if (delta >= 5) return 'critical'
  if (delta >= 2) return 'warn'
  return 'ok'
}

export type TelemetryProfile =
  | 'critical'
  | 'warn'
  | 'ok'
  | 'frozen'
  | 'offline'

export function telemetryProfile(t: Trailer): TelemetryProfile {
  if (!t.telemetry) return 'offline'
  if (t.tempStatus === 'offline' && t.actual == null) return 'offline'
  if (t.setpoint === 0) return 'frozen'
  if (t.tempStatus === 'critical') return 'critical'
  if (t.tempStatus === 'warn') return 'warn'
  return 'ok'
}

export function simulateTrailerTelemetry(
  t: Trailer,
  now: number,
): Partial<Trailer> {
  const profile = telemetryProfile(t)

  if (!t.telemetry || profile === 'offline') {
    const staleMs = t.lastTelemetryAtMs ?? now - 47 * 60 * 1000
    return {
      lastTelemetryAtMs: staleMs,
      lastUpdate: formatRelativeAgo(staleMs, now),
    }
  }

  const setpoint = t.setpoint ?? 34
  let actual = t.actual ?? setpoint
  const noise = () => (Math.random() - 0.5) * 0.35

  if (profile === 'frozen') {
    actual = Math.max(-2, Math.min(3, actual + noise() * 0.4))
  } else if (profile === 'critical') {
    actual = Math.min(actual + 0.15 + Math.random() * 0.25, setpoint + 8)
  } else if (profile === 'warn') {
    actual = actual + noise() * 0.5 + 0.05
  } else {
    actual = setpoint + noise()
  }

  actual = Math.round(actual * 10) / 10
  const tempStatus = computeTempStatus(actual, setpoint, true)
  const fuelPct =
    t.fuelPct != null
      ? Math.max(
          12,
          Math.round((t.fuelPct - 0.03 - Math.random() * 0.04) * 10) / 10,
        )
      : null

  return {
    actual,
    tempStatus,
    reeferAlarm:
      tempStatus === 'critical' || (t.reeferAlarm && tempStatus !== 'ok'),
    fuelPct,
    lastTelemetryAtMs: now,
    lastUpdate: 'Just now',
    history: buildHistoryWindow(t.history, actual),
  }
}
