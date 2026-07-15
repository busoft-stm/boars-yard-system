import Dexie, { type EntityTable } from 'dexie'
import type { AuthUser } from '../auth/types'
import {
  gateEvents as seedGateEvents,
  movements as seedMovements,
  trailers as seedTrailers,
  type GateEvent,
  type Movement,
  type Trailer,
} from '../data/trailers'
import { seedUsers, type ManagedUser, DEFAULT_USER_PASSWORD } from '../data/users'
import { seedDevices, type YardDevice } from '../data/platform'
import {
  DEFAULT_YARD_LAYOUT,
  normalizeYardLayout,
  withMasterDefaults,
  type YardLayout,
} from '../data/trailers'

type MetaRow = { key: string; value: string }

class BoarsHeadYardDB extends Dexie {
  users!: EntityTable<ManagedUser, 'id'>
  trailers!: EntityTable<Trailer, 'id'>
  movements!: EntityTable<Movement, 'id'>
  gateEvents!: EntityTable<GateEvent, 'id'>
  devices!: EntityTable<YardDevice, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor() {
    super('BoarsHeadSmartYard')
    this.version(1).stores({
      users: 'id, email, role, status',
      trailers: 'id, number, status, slot, zone',
      movements: 'id, trailerId, time',
      gateEvents: 'id, trailerId, time',
      meta: 'key',
    })
    this.version(2).stores({
      users: 'id, email, role, status',
      trailers: 'id, number, status, slot, zone',
      movements: 'id, trailerId, time',
      gateEvents: 'id, trailerId, time',
      devices: 'id, kind, health, status',
      meta: 'key',
    })
    this.version(3)
      .stores({
        users: 'id, email, role, status',
        trailers: 'id, number, status, recordStatus, slot, zone',
        movements: 'id, trailerId, time',
        gateEvents: 'id, trailerId, time',
        devices: 'id, kind, health, status',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('trailers')
          .toCollection()
          .modify((t: { recordStatus?: string }) => {
            if (!t.recordStatus) t.recordStatus = 'active'
          })
      })
  }
}

export const db = new BoarsHeadYardDB()

const SEEDED_KEY = 'seeded_v1'
const DEVICES_SEEDED_KEY = 'devices_seeded_v2'
const REGISTER_EXTRA_KEY = 'register_extra_v1'
const YARD_LAYOUT_KEY = 'yard_layout_v1'
const AUTH_KEY = 'auth_session'

export async function ensureDbSeeded() {
  const seeded = await db.meta.get(SEEDED_KEY)
  if (seeded?.value !== '1') {
    await db.transaction(
      'rw',
      db.users,
      db.trailers,
      db.movements,
      db.gateEvents,
      db.meta,
      async () => {
        const userCount = await db.users.count()
        if (userCount === 0) await db.users.bulkAdd(seedUsers)
        const trailerCount = await db.trailers.count()
        if (trailerCount === 0) await db.trailers.bulkAdd(seedTrailers)
        const moveCount = await db.movements.count()
        if (moveCount === 0) await db.movements.bulkAdd(seedMovements)
        const gateCount = await db.gateEvents.count()
        if (gateCount === 0) await db.gateEvents.bulkAdd(seedGateEvents)
        await db.meta.put({ key: SEEDED_KEY, value: '1' })
      },
    )
  }

  // Backfill master register fields on older IndexedDB rows
  const allTrailers = await db.trailers.toArray()
  const needsMaster = allTrailers.filter(
    (t) => !t.recordStatus || !t.trailerType || !t.homeSite,
  )
  if (needsMaster.length) {
    await db.transaction('rw', db.trailers, async () => {
      for (const t of needsMaster) {
        await db.trailers.put(withMasterDefaults(t))
      }
    })
  }

  // Ensure register demo units exist for gate check-in
  const extra = await db.meta.get(REGISTER_EXTRA_KEY)
  if (extra?.value !== '1') {
    const extras = seedTrailers.filter(
      (t) => t.id === 'bh-5501' || t.id === 'cx-9901',
    )
    await db.transaction('rw', db.trailers, db.meta, async () => {
      for (const t of extras) {
        const found = await db.trailers.get(t.id)
        if (!found) await db.trailers.put(t)
      }
      await db.meta.put({ key: REGISTER_EXTRA_KEY, value: '1' })
    })
  }

  const devicesSeeded = await db.meta.get(DEVICES_SEEDED_KEY)
  if (devicesSeeded?.value !== '1') {
    await db.transaction('rw', db.devices, db.meta, async () => {
      await db.devices.clear()
      await db.devices.bulkAdd(seedDevices)
      await db.meta.put({ key: DEVICES_SEEDED_KEY, value: '1' })
    })
  }

  // Backfill per-user passwords for older IndexedDB rows
  const usersNeedingPassword = (await db.users.toArray()).filter(
    (u) => !u.password || !String(u.password).trim(),
  )
  if (usersNeedingPassword.length) {
    await db.transaction('rw', db.users, async () => {
      for (const u of usersNeedingPassword) {
        await db.users.put({
          ...u,
          password: DEFAULT_USER_PASSWORD,
        } as ManagedUser)
      }
    })
  }

  // Rename legacy Groveport site labels in local mock data
  const siteRename = await db.meta.get('site_rename_v1')
  if (siteRename?.value !== '1') {
    const oldName = 'Groveport Distribution Center'
    const newName = "Boar's Head Distribution Center"
    await db.transaction('rw', db.trailers, db.users, db.meta, async () => {
      const trailers = await db.trailers.toArray()
      for (const t of trailers) {
        if (
          t.homeSite === oldName ||
          t.homeSite === 'Groveport' ||
          !t.homeSite?.trim()
        ) {
          await db.trailers.put({ ...t, homeSite: newName })
        }
      }
      const users = await db.users.toArray()
      for (const u of users) {
        if (u.site === 'Groveport, OH' || u.site === 'Groveport') {
          await db.users.put({ ...u, site: 'Primary DC' })
        }
      }
      await db.meta.put({ key: 'site_rename_v1', value: '1' })
    })
  }

  // Patch low-fuel demo level so Exceptions list includes Low fuel rows
  const lowFuelPatch = await db.meta.get('low_fuel_exception_v1')
  if (lowFuelPatch?.value !== '1') {
    await db.transaction('rw', db.trailers, db.meta, async () => {
      const bh9012 = await db.trailers.get('bh-9012')
      if (bh9012 && (bh9012.fuelPct == null || bh9012.fuelPct >= 25)) {
        await db.trailers.put({ ...bh9012, fuelPct: 22 })
      }
      await db.meta.put({ key: 'low_fuel_exception_v1', value: '1' })
    })
  }

  // If FTL-440 is parked but still has an open gate event, mark the gate cleared
  const ftlGates = await db.gateEvents.where('trailerId').equals('ftl-440').toArray()
  const ftl = await db.trailers.get('ftl-440')
  if (ftl?.slot) {
    for (const g of ftlGates) {
      if (g.status === 'processing' || g.status === 'held') {
        await db.gateEvents.put({ ...g, status: 'cleared' })
      }
    }
  }
}

export async function loadYardLayout(): Promise<YardLayout> {
  const row = await db.meta.get(YARD_LAYOUT_KEY)
  if (!row?.value) return structuredClone(DEFAULT_YARD_LAYOUT)
  try {
    const parsed = JSON.parse(row.value) as Partial<YardLayout>
    return normalizeYardLayout(parsed)
  } catch {
    return structuredClone(DEFAULT_YARD_LAYOUT)
  }
}

export async function saveYardLayout(layout: YardLayout) {
  await db.meta.put({
    key: YARD_LAYOUT_KEY,
    value: JSON.stringify(normalizeYardLayout(layout)),
  })
}

export async function loadAuthSession(): Promise<AuthUser | null> {
  const row = await db.meta.get(AUTH_KEY)
  if (!row?.value) return null
  try {
    return JSON.parse(row.value) as AuthUser
  } catch {
    return null
  }
}

export async function saveAuthSession(user: AuthUser | null) {
  if (!user) {
    await db.meta.delete(AUTH_KEY)
    return
  }
  await db.meta.put({ key: AUTH_KEY, value: JSON.stringify(user) })
}
