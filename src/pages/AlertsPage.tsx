import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OwnBadge, StatusBadge, formatTemp } from '../components/Badges'
import { ModalCloseBtn } from '../components/ActionIcons'
import {
  ColumnFilterHeader,
  PlainHeader,
} from '../components/ColumnFilterHeader'
import { Pagination, usePagination } from '../components/Pagination'
import { useYard } from '../yard/YardContext'
import { useAuth } from '../auth/AuthContext'
import { useSnackbar } from '../components/Snackbar'
import {
  useExceptions,
  type ExceptionStatus,
} from '../exceptions/ExceptionsContext'
import {
  PLAYBOOK_STEPS,
  PLAYBOOK_STEP_META,
  type PlaybookStep,
} from '../exceptions/playbooks'
import { ROLE_META } from '../data/users'
import type { Trailer } from '../data/trailers'

function statusBadgeClass(status: ExceptionStatus) {
  if (status === 'resolved') return 'ok'
  if (status === 'inspecting') return 'warn'
  if (status === 'assigned') return 'warn'
  return 'critical'
}

function statusLabel(status: ExceptionStatus) {
  if (status === 'resolved') return 'Resolved'
  if (status === 'inspecting') return 'Inspecting'
  if (status === 'assigned') return 'Assigned'
  return 'Open'
}

function ownershipLabel(ownership: Trailer['ownership']) {
  return ownership === 'bh' ? 'BH-owned' : 'Carrier'
}

function PlaybookStepper({ current }: { current: PlaybookStep }) {
  const order = PLAYBOOK_STEP_META[current].order
  return (
    <div className="playbook-steps" aria-label={`Playbook at ${PLAYBOOK_STEP_META[current].label}`}>
      {PLAYBOOK_STEPS.map((step) => {
        const stepOrder = PLAYBOOK_STEP_META[step].order
        const state =
          stepOrder < order ? 'done' : stepOrder === order ? 'current' : 'todo'
        return (
          <span key={step} className={`playbook-step ${state}`}>
            {PLAYBOOK_STEP_META[step].label}
          </span>
        )
      })}
    </div>
  )
}

export function AlertsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { success, error: showError } = useSnackbar()
  const { trailers } = useYard()
  const {
    rows,
    assignableUsers,
    assignException,
    startInspect,
    resolveException,
    getPlaybook,
  } = useExceptions()
  const [trailerFilter, setTrailerFilter] = useState('all')
  const [exceptionFilter, setExceptionFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [inspectBusy, setInspectBusy] = useState<string | null>(null)
  const [resolveBusy, setResolveBusy] = useState(false)

  const enriched = useMemo(() => {
    return rows
      .map((r) => {
        const trailer = trailers.find((t) => t.id === r.trailerId)
        if (!trailer) return null
        return { row: r, trailer }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
  }, [rows, trailers])

  const trailerOptions = useMemo(() => {
    const ownerships = Array.from(
      new Set(enriched.map((r) => r.trailer.ownership)),
    )
    return [
      ...ownerships.map((o) => ({
        value: `own:${o}`,
        label: ownershipLabel(o),
      })),
      ...enriched
        .map((r) => r.trailer.number)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort()
        .map((n) => ({ value: `num:${n}`, label: n })),
    ]
  }, [enriched])

  const exceptionOptions = useMemo(() => {
    const set = new Set(enriched.map((r) => r.row.reason))
    return Array.from(set)
      .sort()
      .map((reason) => ({ value: reason, label: reason }))
  }, [enriched])

  const assigneeOptions = useMemo(() => {
    const opts = [
      { value: 'unassigned', label: 'Unassigned' },
      ...(user?.id ? [{ value: 'me', label: 'Assigned to me' }] : []),
    ]
    const seen = new Set<string>()
    for (const r of enriched) {
      if (r.row.assigneeId && r.row.assignee && !seen.has(r.row.assigneeId)) {
        seen.add(r.row.assigneeId)
        opts.push({ value: r.row.assigneeId, label: r.row.assignee })
      }
    }
    for (const u of assignableUsers) {
      if (!seen.has(u.id)) {
        seen.add(u.id)
        opts.push({ value: u.id, label: u.name })
      }
    }
    return opts
  }, [enriched, user?.id, assignableUsers])

  const statusOptions = useMemo(
    () => [
      { value: 'open', label: 'Open' },
      { value: 'assigned', label: 'Assigned' },
      { value: 'inspecting', label: 'Inspecting' },
      { value: 'resolved', label: 'Resolved' },
    ],
    [],
  )

  const tableRows = useMemo(() => {
    return enriched.filter(({ row, trailer }) => {
      if (trailerFilter !== 'all') {
        if (trailerFilter.startsWith('own:')) {
          if (trailer.ownership !== trailerFilter.slice(4)) return false
        } else if (trailerFilter.startsWith('num:')) {
          if (trailer.number !== trailerFilter.slice(4)) return false
        }
      }
      if (exceptionFilter !== 'all' && row.reason !== exceptionFilter) {
        return false
      }
      if (assigneeFilter === 'unassigned') {
        if (row.assigneeId) return false
      } else if (assigneeFilter === 'me') {
        if (!user?.id || row.assigneeId !== user.id) return false
      } else if (assigneeFilter !== 'all') {
        if (row.assigneeId !== assigneeFilter) return false
      }
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      return true
    })
  }, [
    enriched,
    trailerFilter,
    exceptionFilter,
    assigneeFilter,
    statusFilter,
    user?.id,
  ])

  const filterKey = `${trailerFilter}|${exceptionFilter}|${assigneeFilter}|${statusFilter}`
  const pagination = usePagination(tableRows, 10, filterKey)

  const openCount = rows.filter((r) => r.status !== 'resolved').length
  const resolveTrailer = trailers.find((t) => {
    const row = rows.find((r) => r.id === resolveId)
    return row ? t.id === row.trailerId : false
  })
  const resolveRow = rows.find((r) => r.id === resolveId)
  const resolvePlaybook = resolveRow
    ? getPlaybook(resolveRow.playbook)
    : null

  function onAssign(exceptionId: string, userId: string) {
    if (!userId) {
      showError('Select a user to assign.')
      return
    }
    try {
      assignException(exceptionId, userId)
      const assignee = assignableUsers.find((u) => u.id === userId)
      const row = rows.find((r) => r.id === exceptionId)
      const t = trailers.find((x) => x.id === row?.trailerId)
      success(
        t && assignee
          ? `${t.number} assigned to ${assignee.name}.`
          : 'Exception assigned.',
      )
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Could not assign exception.',
      )
    }
  }

  async function onInspect(exceptionId: string) {
    setInspectBusy(exceptionId)
    try {
      await startInspect(exceptionId)
      const row = rows.find((r) => r.id === exceptionId)
      const t = trailers.find((x) => x.id === row?.trailerId)
      const pb = row ? getPlaybook(row.playbook) : null
      success(
        t
          ? `${t.number} · inspecting${pb?.setQaHoldOnInspect ? ' · QA hold set' : ''}`
          : 'Inspection started.',
      )
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Could not start inspection.',
      )
    } finally {
      setInspectBusy(null)
    }
  }

  async function confirmResolve() {
    if (!resolveId) return
    setResolveBusy(true)
    try {
      await resolveException(resolveId, note)
      const row = rows.find((r) => r.id === resolveId)
      const t = trailers.find((x) => x.id === row?.trailerId)
      success(
        t
          ? `${t.number} resolved · resume operations`
          : 'Exception resolved · resume operations',
      )
      setResolveId(null)
      setNote('')
    } catch {
      showError('Could not resolve exception.')
    } finally {
      setResolveBusy(false)
    }
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Cold-chain & yard risk</div>
          <h1>Exceptions</h1>
          <p>
            Playbooks: Notify → Assign → Inspect → Resolve → Resume. Covers
            temperature, reefer, holds, dwell, fuel, and GPS/BLE/device offline
            issues.
          </p>
        </div>
        <div className="meta-chip">
          {tableRows.length} showing · {openCount} open
        </div>
      </div>

      <div className="panel table-wrap table-wrap-filters">
        <table>
          <thead>
            <tr>
              <th>
                <ColumnFilterHeader
                  label="Trailer"
                  value={trailerFilter}
                  options={trailerOptions}
                  onChange={setTrailerFilter}
                  searchable
                  searchPlaceholder="Search trailer…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Exception"
                  value={exceptionFilter}
                  options={exceptionOptions}
                  onChange={setExceptionFilter}
                  allLabel="All reasons"
                  searchable
                  searchPlaceholder="Search reason…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Assigned"
                  value={assigneeFilter}
                  options={assigneeOptions}
                  onChange={setAssigneeFilter}
                  allLabel="All users"
                  searchable
                  searchPlaceholder="Search user…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Status"
                  value={statusFilter}
                  options={statusOptions}
                  onChange={setStatusFilter}
                  allLabel="All statuses"
                />
              </th>
              <th>
                <PlainHeader>Actions</PlainHeader>
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map(({ row, trailer }) => {
              const resolved = row.status === 'resolved'
              const pb = getPlaybook(row.playbook)
              const canInspect =
                !resolved &&
                (row.status === 'assigned' || row.status === 'open')
              const canResolve = !resolved
              return (
                <tr key={row.id}>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => navigate(`/trailer/${trailer.id}`)}
                    >
                      <div className="trailer-cell">
                        <span className="trailer-id">{trailer.number}</span>
                        <span className="trailer-meta">
                          <OwnBadge ownership={trailer.ownership} /> ·{' '}
                          {trailer.carrier} ·{' '}
                          {trailer.slot ?? trailer.dockDoor ?? 'Gate'} ·{' '}
                          {formatTemp(trailer.actual)}
                          {row.reason.startsWith('Low fuel') &&
                          trailer.fuelPct != null
                            ? ` · Fuel ${trailer.fuelPct}%`
                            : ''}
                        </span>
                      </div>
                    </button>
                  </td>
                  <td>
                    <div className="trailer-cell">
                      <span>
                        <span className={`priority ${row.severity}`} />{' '}
                        {row.reason}
                        {trailer.reeferAlarm && !row.reason.includes('Reefer')
                          ? ' · Reefer alarm'
                          : ''}
                      </span>
                      <span className="trailer-meta">
                        {pb.title} · SLA {row.slaMin}m ·{' '}
                        <StatusBadge status={trailer.tempStatus} />
                      </span>
                      <PlaybookStepper current={row.playbookStep} />
                    </div>
                  </td>
                  <td>
                    {resolved ? (
                      <span className="trailer-meta">
                        {row.assignee ?? '—'}
                      </span>
                    ) : (
                      <select
                        className="select select-compact"
                        value={row.assigneeId ?? ''}
                        aria-label={`Assign ${trailer.number}`}
                        onChange={(e) => onAssign(row.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Unassigned</option>
                        {assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} · {ROLE_META[u.role].label}
                            {user?.id === u.id ? ' (you)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${statusBadgeClass(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                    {resolved && row.note ? (
                      <div className="trailer-meta" style={{ marginTop: 4 }}>
                        {row.note}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div className="btn-row">
                      {canInspect ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={inspectBusy === row.id}
                          onClick={() => void onInspect(row.id)}
                        >
                          {inspectBusy === row.id ? '…' : 'Inspect'}
                        </button>
                      ) : null}
                      {canResolve ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            setResolveId(row.id)
                            setNote('')
                          }}
                        >
                          Resolve
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => navigate(`/trailer/${trailer.id}`)}
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!tableRows.length ? (
              <tr>
                <td colSpan={5} className="empty">
                  No exceptions match the column filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <Pagination
          page={pagination.page}
          setPage={pagination.setPage}
          pageSize={pagination.pageSize}
          setPageSize={pagination.setPageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
        />
      </div>

      {resolveId && resolveTrailer && resolveRow && resolvePlaybook ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !resolveBusy && setResolveId(null)}
        >
          <div
            className="modal-panel modal-panel-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolve-exception-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">{resolvePlaybook.title}</div>
                <h2 id="resolve-exception-title">{resolveTrailer.number}</h2>
              </div>
              <ModalCloseBtn
                onClick={() => !resolveBusy && setResolveId(null)}
              />
            </div>
            <div className="modal-body">
              <p className="role-info-lead" style={{ marginTop: 0 }}>
                {resolveRow.reason}
                {resolveRow.assignee ? ` · ${resolveRow.assignee}` : ''}
              </p>
              <PlaybookStepper current={resolveRow.playbookStep} />
              <p className="trailer-meta" style={{ marginTop: '0.75rem' }}>
                {resolvePlaybook.resumeHint}
              </p>
              <label className="field">
                <span>Resolution notes</span>
                <input
                  className="search"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Action taken…"
                  autoFocus
                  disabled={resolveBusy}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={resolveBusy}
                onClick={() => setResolveId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={resolveBusy}
                onClick={() => void confirmResolve()}
              >
                {resolveBusy ? 'Saving…' : 'Resolve & resume'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
