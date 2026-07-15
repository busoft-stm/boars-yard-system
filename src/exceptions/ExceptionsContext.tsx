import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useYard } from '../yard/YardContext'
import { useUsers } from '../users/UsersContext'
import { type UserRole } from '../data/users'
import type { Trailer } from '../data/trailers'
import { useSmartYard } from '../smart/SmartYardContext'
import type { UnifiedSmartDevice } from '../data/smartEnterprise'
import {
  PLAYBOOK_DEFS,
  playbookForReason,
  type PlaybookKind,
  type PlaybookStep,
} from './playbooks'

export type ExceptionStatus = 'open' | 'assigned' | 'inspecting' | 'resolved'
export type ExceptionSeverity = 'critical' | 'warn' | 'offline'

export type ExceptionRow = {
  id: string
  trailerId: string
  reason: string
  severity: ExceptionSeverity
  status: ExceptionStatus
  assigneeId: string | null
  assignee: string | null
  slaMin: number
  note: string
  playbook: PlaybookKind
  playbookStep: PlaybookStep
}

export const EXCEPTION_ASSIGNABLE_ROLES: UserRole[] = [
  'admin',
  'site_lead',
  'yard_ops',
  'qa',
]

export function isLowFuel(fuelPct: number | null | undefined) {
  return fuelPct != null && fuelPct < 25
}

type IssueSeed = Pick<
  ExceptionRow,
  'id' | 'trailerId' | 'reason' | 'severity' | 'slaMin' | 'playbook'
>

function issuesForTrailer(
  t: Trailer,
  device?: UnifiedSmartDevice | null,
): IssueSeed[] {
  const issues: IssueSeed[] = []
  const hasCap = (cap: 'temperature' | 'fuel' | 'lte' | 'gps' | 'ble') =>
    !device || device.capabilities.includes(cap)

  if (hasCap('temperature')) {
    if (t.tempStatus === 'critical') {
      issues.push({
        id: `${t.id}:temp`,
        trailerId: t.id,
        reason: 'Temperature excursion',
        severity: 'critical',
        slaMin: 15,
        playbook: 'temperature',
      })
    } else if (t.tempStatus === 'warn') {
      issues.push({
        id: `${t.id}:temp`,
        trailerId: t.id,
        reason: 'Warming toward threshold',
        severity: 'warn',
        slaMin: 45,
        playbook: 'temperature',
      })
    } else if (t.tempStatus === 'offline') {
      issues.push({
        id: `${t.id}:offline`,
        trailerId: t.id,
        reason: 'Telemetry stale / offline',
        severity: 'offline',
        slaMin: 45,
        playbook: 'device_offline',
      })
    } else if (!t.telemetry && hasCap('lte')) {
      issues.push({
        id: `${t.id}:telemetry`,
        trailerId: t.id,
        reason: 'No carrier telemetry',
        severity: 'offline',
        slaMin: 60,
        playbook: 'device_offline',
      })
    }
  }

  if (t.status === 'QA hold' || t.status === 'Yard hold' || t.opsHold === 'qa') {
    issues.push({
      id: `${t.id}:hold`,
      trailerId: t.id,
      reason:
        t.opsHold === 'qa' || t.status === 'QA hold' ? 'QA hold' : 'Yard hold',
      severity: 'warn',
      slaMin: 45,
      playbook: 'hold',
    })
  } else if (t.opsHold === 'yard') {
    issues.push({
      id: `${t.id}:hold`,
      trailerId: t.id,
      reason: 'Yard hold',
      severity: 'warn',
      slaMin: 45,
      playbook: 'hold',
    })
  }

  if (hasCap('fuel') && isLowFuel(t.fuelPct)) {
    issues.push({
      id: `${t.id}:fuel`,
      trailerId: t.id,
      reason: `Low fuel · ${t.fuelPct}%`,
      severity: 'warn',
      slaMin: 60,
      playbook: 'fuel',
    })
  }

  if (t.dwellHours >= 16) {
    issues.push({
      id: `${t.id}:dwell`,
      trailerId: t.id,
      reason: 'Long dwell',
      severity: 'warn',
      slaMin: 45,
      playbook: 'dwell',
    })
  }

  if (hasCap('temperature') && t.reeferAlarm) {
    issues.push({
      id: `${t.id}:alarm`,
      trailerId: t.id,
      reason: 'Reefer alarm',
      severity: 'critical',
      slaMin: 15,
      playbook: 'reefer',
    })
  }

  if (device && t.status !== 'Departed') {
    if (
      hasCap('gps') &&
      (device.gpsStatus === 'offline' || device.gpsStatus === 'warn')
    ) {
      issues.push({
        id: `${t.id}:gps`,
        trailerId: t.id,
        reason: 'GPS offline / degraded',
        severity: device.gpsStatus === 'offline' ? 'offline' : 'warn',
        slaMin: 30,
        playbook: 'gps_offline',
      })
    }
    if (
      hasCap('ble') &&
      (device.bleStatus === 'offline' || device.bleStatus === 'warn')
    ) {
      issues.push({
        id: `${t.id}:ble`,
        trailerId: t.id,
        reason: 'BLE offline / degraded',
        severity: device.bleStatus === 'offline' ? 'offline' : 'warn',
        slaMin: 30,
        playbook: 'ble_offline',
      })
    }
    if (
      hasCap('lte') &&
      (device.connectivity === 'offline' || device.health === 'offline')
    ) {
      issues.push({
        id: `${t.id}:device`,
        trailerId: t.id,
        reason: 'Device offline',
        severity: 'critical',
        slaMin: 20,
        playbook: 'device_offline',
      })
    }
  }

  return issues
}

type ExceptionOverride = Pick<
  ExceptionRow,
  'status' | 'assigneeId' | 'assignee' | 'note' | 'playbookStep'
>

type ExceptionsContextValue = {
  rows: ExceptionRow[]
  assignableUsers: {
    id: string
    name: string
    role: UserRole
  }[]
  assignException: (exceptionId: string, userId: string) => void
  startInspect: (exceptionId: string) => Promise<void>
  resolveException: (exceptionId: string, note?: string) => Promise<void>
  getAssignment: (trailerId: string) => ExceptionRow | undefined
  getPlaybook: (kind: PlaybookKind) => (typeof PLAYBOOK_DEFS)[PlaybookKind]
}

const ExceptionsContext = createContext<ExceptionsContextValue | null>(null)

function statusToStep(status: ExceptionStatus): PlaybookStep {
  if (status === 'resolved') return 'resolved'
  if (status === 'inspecting') return 'inspecting'
  if (status === 'assigned') return 'assigned'
  return 'notified'
}

export function ExceptionsProvider({ children }: { children: ReactNode }) {
  const { trailers, setTrailerOpsHold } = useYard()
  const { users } = useUsers()
  const { getDeviceForTrailer } = useSmartYard()
  const [overrides, setOverrides] = useState<Record<string, ExceptionOverride>>(
    {},
  )
  const [seededDemo, setSeededDemo] = useState(false)

  const assignableUsers = useMemo(
    () =>
      users
        .filter(
          (u) =>
            (u.status === 'active' || u.status === 'invited') &&
            EXCEPTION_ASSIGNABLE_ROLES.includes(u.role),
        )
        .map((u) => ({ id: u.id, name: u.name, role: u.role }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )

  const derived = useMemo(() => {
    const rows: ExceptionRow[] = []
    for (const t of trailers) {
      const device = getDeviceForTrailer(t.number)
      for (const issue of issuesForTrailer(t, device)) {
        const over = overrides[issue.id]
        const status = over?.status ?? 'open'
        rows.push({
          ...issue,
          playbook: issue.playbook ?? playbookForReason(issue.reason),
          status,
          assigneeId: over?.assigneeId ?? null,
          assignee: over?.assignee ?? null,
          note: over?.note ?? '',
          playbookStep: over?.playbookStep ?? statusToStep(status),
        })
      }
    }
    return rows
  }, [trailers, overrides, getDeviceForTrailer])

  useEffect(() => {
    if (seededDemo || !derived.length || !assignableUsers.length) return
    const sam =
      assignableUsers.find((u) => u.name === 'Sam Okonkwo') ??
      assignableUsers[0]
    const first = derived[0]
    if (!first || overrides[first.id]) {
      setSeededDemo(true)
      return
    }
    setOverrides((prev) => ({
      ...prev,
      [first.id]: {
        status: 'assigned',
        playbookStep: 'assigned',
        assigneeId: sam.id,
        assignee: sam.name,
        note: '',
      },
    }))
    setSeededDemo(true)
  }, [derived, assignableUsers, seededDemo, overrides])

  const assignException = useCallback(
    (exceptionId: string, userId: string) => {
      const assignee = assignableUsers.find((u) => u.id === userId)
      if (!assignee) throw new Error('Selected user cannot own exceptions.')
      setOverrides((prev) => ({
        ...prev,
        [exceptionId]: {
          status: 'assigned',
          playbookStep: 'assigned',
          assigneeId: assignee.id,
          assignee: assignee.name,
          note: prev[exceptionId]?.note ?? '',
        },
      }))
    },
    [assignableUsers],
  )

  const startInspect = useCallback(
    async (exceptionId: string) => {
      const row = derived.find((r) => r.id === exceptionId)
      if (!row) throw new Error('Exception not found.')
      if (row.status === 'resolved') return
      const def = PLAYBOOK_DEFS[row.playbook]
      if (def.setQaHoldOnInspect) {
        await setTrailerOpsHold(row.trailerId, 'qa')
      }
      setOverrides((prev) => ({
        ...prev,
        [exceptionId]: {
          status: 'inspecting',
          playbookStep: 'inspecting',
          assigneeId: prev[exceptionId]?.assigneeId ?? row.assigneeId,
          assignee: prev[exceptionId]?.assignee ?? row.assignee,
          note: prev[exceptionId]?.note ?? row.note,
        },
      }))
    },
    [derived, setTrailerOpsHold],
  )

  const resolveException = useCallback(
    async (exceptionId: string, note?: string) => {
      const row = derived.find((r) => r.id === exceptionId)
      if (row) {
        const def = PLAYBOOK_DEFS[row.playbook]
        const trailer = trailers.find((t) => t.id === row.trailerId)
        if (
          def.setQaHoldOnInspect &&
          trailer &&
          (trailer.opsHold === 'qa' || trailer.opsHold === 'yard')
        ) {
          await setTrailerOpsHold(row.trailerId, 'none')
        }
        if (row.playbook === 'hold' && trailer?.opsHold !== 'none') {
          await setTrailerOpsHold(row.trailerId, 'none')
        }
      }
      setOverrides((prev) => ({
        ...prev,
        [exceptionId]: {
          status: 'resolved',
          playbookStep: 'resolved',
          assigneeId: prev[exceptionId]?.assigneeId ?? null,
          assignee: prev[exceptionId]?.assignee ?? null,
          note:
            note?.trim() ||
            prev[exceptionId]?.note ||
            'Resolved · resume operations',
        },
      }))
    },
    [derived, trailers, setTrailerOpsHold],
  )

  const getAssignment = useCallback(
    (trailerId: string) =>
      derived.find(
        (r) => r.trailerId === trailerId && r.status !== 'resolved',
      ),
    [derived],
  )

  const getPlaybook = useCallback(
    (kind: PlaybookKind) => PLAYBOOK_DEFS[kind],
    [],
  )

  const value = useMemo(
    () => ({
      rows: derived,
      assignableUsers,
      assignException,
      startInspect,
      resolveException,
      getAssignment,
      getPlaybook,
    }),
    [
      derived,
      assignableUsers,
      assignException,
      startInspect,
      resolveException,
      getAssignment,
      getPlaybook,
    ],
  )

  return (
    <ExceptionsContext.Provider value={value}>
      {children}
    </ExceptionsContext.Provider>
  )
}

export function useExceptions() {
  const ctx = useContext(ExceptionsContext)
  if (!ctx)
    throw new Error('useExceptions must be used within ExceptionsProvider')
  return ctx
}
