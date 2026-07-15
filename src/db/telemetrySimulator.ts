import { db } from './yardDb'
import { simulateTrailerTelemetry } from './liveSeed'
import { isOnSite, withMasterDefaults, type Trailer } from '../data/trailers'

export async function runTelemetryTick(now = Date.now()): Promise<number> {
  const rows = await db.trailers.toArray()
  let updated = 0

  await db.transaction('rw', db.trailers, async () => {
    for (const row of rows) {
      const t = row as Trailer
      const patch = isOnSite(t) ? simulateTrailerTelemetry(t, now) : {}
      const next = withMasterDefaults({ ...t, ...patch })
      const changed =
        next.actual !== t.actual ||
        next.tempStatus !== t.tempStatus ||
        next.dwellHours !== t.dwellHours ||
        next.lastUpdate !== t.lastUpdate ||
        next.fuelPct !== t.fuelPct ||
        next.reeferAlarm !== t.reeferAlarm

      if (changed) {
        await db.trailers.put(next)
        updated += 1
      }
    }
  })

  return updated
}

export const TELEMETRY_TICK_MS = 45_000
