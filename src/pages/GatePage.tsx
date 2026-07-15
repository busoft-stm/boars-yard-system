import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  gateLaneSupportsDirection,
  type GateLaneDef,
  type GateLaneDirection,
} from '../data/trailers'
import { AssignSlotModal } from '../components/AssignSlotModal'
import { GateCheckInModal } from '../components/GateCheckInModal'
import { OwnBadge } from '../components/Badges'
import {
  ActionIconBtn,
  IconDisable,
  IconEdit,
  IconEnable,
  ModalCloseBtn,
} from '../components/ActionIcons'
import {
  ColumnFilterHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { Pagination, usePagination } from '../components/Pagination'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { useSnackbar } from '../components/Snackbar'
import { isOnSite, useYard } from '../yard/YardContext'
import { useSmartYard } from '../smart/SmartYardContext'
import { useGeofence } from '../geofence/GeofenceContext'

const DIR_LABELS: Record<string, string> = {
  in: 'IN',
  out: 'OUT',
}

const STATUS_LABELS: Record<string, string> = {
  processing: 'processing',
  cleared: 'cleared',
  held: 'held',
}

const LANE_DIR_LABELS: Record<GateLaneDirection, string> = {
  in: 'Inbound',
  out: 'Outbound',
  both: 'Flex (both)',
}

export function GatePage() {
  const navigate = useNavigate()
  const {
    gateEvents,
    trailers,
    availableParkingSlots,
    gateLanes,
    activeGateLanes,
    addGateLane,
    updateGateLane,
    setGateLaneStatus,
    gateExitTrailer,
  } = useYard()
  const {
    devices,
    getDeviceForTrailer,
    unassignDevice,
    setDeviceLifecycle,
  } = useSmartYard()
  const { pendingRecovery, acknowledgeForTrailer, acknowledge, recordEvent } =
    useGeofence()
  const { success, error: showError } = useSnackbar()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  const [openCheckIn, setOpenCheckIn] = useState(false)
  const [openExit, setOpenExit] = useState(false)
  const [exitTrailerId, setExitTrailerId] = useState('')
  const [exitLane, setExitLane] = useState('')
  const [exitError, setExitError] = useState('')
  const [exitBusy, setExitBusy] = useState(false)
  const [assignSlotOpen, setAssignSlotOpen] = useState(false)
  const [assignTrailerId, setAssignTrailerId] = useState<string | null>(null)
  const [timeFilter, setTimeFilter] = useState('all')
  const [dirFilter, setDirFilter] = useState('all')
  const [trailerFilter, setTrailerFilter] = useState('all')
  const [carrierFilter, setCarrierFilter] = useState('all')
  const [laneFilter, setLaneFilter] = useState('all')
  const [sealFilter, setSealFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [laneModalOpen, setLaneModalOpen] = useState(false)
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null)
  const [laneName, setLaneName] = useState('')
  const [laneDirection, setLaneDirection] =
    useState<GateLaneDirection>('in')
  const [laneNote, setLaneNote] = useState('')
  const [laneError, setLaneError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'lanes' | 'queue'>('lanes')

  const [laneNameFilter, setLaneNameFilter] = useState('all')
  const [laneDirFilter, setLaneDirFilter] = useState('all')
  const [laneStatusFilter, setLaneStatusFilter] = useState('all')
  const [laneNoteFilter, setLaneNoteFilter] = useState('all')

  /** On site, no parking slot yet (gate arrivals and holdovers). */
  const awaiting = useMemo(
    () =>
      trailers.filter(
        (t) =>
          isOnSite(t) &&
          (t.recordStatus ?? 'active') === 'active' &&
          !t.slot &&
          t.status !== 'At dock',
      ),
    [trailers],
  )

  const exitEligible = useMemo(
    () =>
      trailers.filter(
        (t) =>
          (t.recordStatus ?? 'active') === 'active' &&
          (t.status === 'Outbound staged' || t.status === 'Gate arrived'),
      ),
    [trailers],
  )

  const outboundLanes = useMemo(
    () => activeGateLanes.filter((l) => gateLaneSupportsDirection(l, 'out')),
    [activeGateLanes],
  )

  const canAssignSlot =
    awaiting.length > 0 ||
    (availableParkingSlots.length > 0 &&
      trailers.some(
        (t) =>
          isOnSite(t) &&
          (t.recordStatus ?? 'active') === 'active' &&
          t.status !== 'At dock' &&
          t.status !== 'Departed',
      ))

  const inboundToday = gateEvents.filter((g) => g.direction === 'in').length
  const outboundToday = gateEvents.filter((g) => g.direction === 'out').length
  const held = gateEvents.filter((g) => g.status === 'held').length
  const activeLanes = gateLanes.filter((l) => l.status !== 'disabled')
  const inactiveLanes = gateLanes.filter((l) => l.status === 'disabled')
  const inboundReady = activeLanes.filter((l) =>
    gateLaneSupportsDirection(l, 'in'),
  ).length

  const laneVolume = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of gateEvents) {
      map.set(g.lane, (map.get(g.lane) ?? 0) + 1)
    }
    return map
  }, [gateEvents])

  const timeOptions = useMemo(
    () => uniqueOptions(gateEvents.map((g) => g.time)),
    [gateEvents],
  )
  const dirOptions = useMemo(
    () =>
      uniqueOptions(gateEvents.map((g) => g.direction), (v) => DIR_LABELS[v] ?? v),
    [gateEvents],
  )
  const trailerOptions = useMemo(
    () => uniqueOptions(gateEvents.map((g) => g.trailerNumber)),
    [gateEvents],
  )
  const carrierOptions = useMemo(
    () => uniqueOptions(gateEvents.map((g) => g.carrier)),
    [gateEvents],
  )
  const laneOptions = useMemo(
    () =>
      uniqueOptions([
        ...gateLanes.map((l) => l.name),
        ...gateEvents.map((g) => g.lane),
      ]),
    [gateLanes, gateEvents],
  )
  const sealOptions = useMemo(
    () => uniqueOptions(gateEvents.map((g) => g.seal)),
    [gateEvents],
  )
  const statusOptions = useMemo(
    () =>
      uniqueOptions(
        gateEvents.map((g) => g.status),
        (v) => STATUS_LABELS[v] ?? v,
      ),
    [gateEvents],
  )

  const rows = useMemo(() => {
    return gateEvents.filter((g) => {
      if (timeFilter !== 'all' && g.time !== timeFilter) return false
      if (dirFilter !== 'all' && g.direction !== dirFilter) return false
      if (trailerFilter !== 'all' && g.trailerNumber !== trailerFilter)
        return false
      if (carrierFilter !== 'all' && g.carrier !== carrierFilter) return false
      if (laneFilter !== 'all' && g.lane !== laneFilter) return false
      if (sealFilter !== 'all' && g.seal !== sealFilter) return false
      if (statusFilter !== 'all' && g.status !== statusFilter) return false
      return true
    })
  }, [
    gateEvents,
    timeFilter,
    dirFilter,
    trailerFilter,
    carrierFilter,
    laneFilter,
    sealFilter,
    statusFilter,
  ])

  const laneNameOptions = useMemo(
    () => uniqueOptions(gateLanes.map((l) => l.name)),
    [gateLanes],
  )
  const laneDirOptions = useMemo(
    () =>
      uniqueOptions(
        gateLanes.map((l) => l.direction),
        (v) => LANE_DIR_LABELS[v as GateLaneDirection] ?? v,
      ),
    [gateLanes],
  )
  const laneStatusOptions = useMemo(
    () =>
      uniqueOptions(
        gateLanes.map((l) => (l.status === 'disabled' ? 'inactive' : 'active')),
        (v) => (v === 'inactive' ? 'Inactive' : 'Active'),
      ),
    [gateLanes],
  )
  const laneNoteOptions = useMemo(
    () => uniqueOptions(gateLanes.map((l) => l.note?.trim() || '—')),
    [gateLanes],
  )

  const laneRows = useMemo(() => {
    return gateLanes.filter((l) => {
      if (laneNameFilter !== 'all' && l.name !== laneNameFilter) return false
      if (laneDirFilter !== 'all' && l.direction !== laneDirFilter) return false
      const statusKey = l.status === 'disabled' ? 'inactive' : 'active'
      if (laneStatusFilter !== 'all' && statusKey !== laneStatusFilter)
        return false
      const noteKey = l.note?.trim() || '—'
      if (laneNoteFilter !== 'all' && noteKey !== laneNoteFilter) return false
      return true
    })
  }, [
    gateLanes,
    laneNameFilter,
    laneDirFilter,
    laneStatusFilter,
    laneNoteFilter,
  ])

  const laneFilterKey = `${laneNameFilter}|${laneDirFilter}|${laneStatusFilter}|${laneNoteFilter}`
  const lanePagination = usePagination(laneRows, 10, laneFilterKey)

  const filterKey = `${timeFilter}|${dirFilter}|${trailerFilter}|${carrierFilter}|${laneFilter}|${sealFilter}|${statusFilter}`
  const pagination = usePagination(rows, 10, filterKey)

  function openAssign(trailerId: string) {
    setAssignTrailerId(trailerId)
    setAssignSlotOpen(true)
  }

  function openCreateLane() {
    setEditingLaneId(null)
    setLaneName('')
    setLaneDirection('in')
    setLaneNote('')
    setLaneError('')
    setLaneModalOpen(true)
  }

  function openEditLane(lane: GateLaneDef) {
    setEditingLaneId(lane.id)
    setLaneName(lane.name)
    setLaneDirection(lane.direction)
    setLaneNote(lane.note ?? '')
    setLaneError('')
    setLaneModalOpen(true)
  }

  async function handleLaneSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setLaneError('')
    try {
      if (editingLaneId) {
        const updated = await updateGateLane(editingLaneId, {
          name: laneName,
          direction: laneDirection,
          note: laneNote,
        })
        success(`${updated.name} updated.`)
      } else {
        const created = await addGateLane({
          name: laneName,
          direction: laneDirection,
          note: laneNote,
        })
        success(`${created.name} added (${LANE_DIR_LABELS[created.direction]}).`)
      }
      setLaneModalOpen(false)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : editingLaneId
            ? 'Could not update lane.'
            : 'Could not add lane.'
      setLaneError(message)
      showError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleLane(lane: GateLaneDef) {
    const disabling = lane.status !== 'disabled'
    const ok = await confirm({
      title: disabling ? `Disable ${lane.name}?` : `Enable ${lane.name}?`,
      message: disabling
        ? 'Disabled lanes cannot be used for new check-ins. Historical events keep the lane name.'
        : 'This lane will be available for gate operations again.',
      confirmLabel: disabling ? 'Disable lane' : 'Enable lane',
      danger: disabling,
    })
    if (!ok) return
    setBusy(true)
    try {
      const updated = await setGateLaneStatus(
        lane.id,
        disabling ? 'disabled' : 'active',
      )
      success(
        updated.status === 'disabled'
          ? `${updated.name} marked inactive.`
          : `${updated.name} is active again.`,
      )
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not update lane.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Gate operations</div>
          <h1>Gates</h1>
          <p>
            Manage physical gate lanes, check in inbound trailers from the
            register, and assign parking after arrival.
          </p>
        </div>
        <div className="page-head-actions">
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={openCreateLane}
            >
              Add lane
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setAssignTrailerId(awaiting[0]?.id ?? null)
                setAssignSlotOpen(true)
              }}
              disabled={!canAssignSlot}
              aria-disabled={!canAssignSlot}
              title={
                canAssignSlot
                  ? 'Assign a parking slot'
                  : 'Unavailable — check in a trailer first, or free a parking slot in Yards'
              }
            >
              Assign parking slot
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setExitTrailerId(exitEligible[0]?.id ?? '')
                setExitLane(outboundLanes[0]?.name ?? '')
                setExitError('')
                setOpenExit(true)
              }}
              disabled={!exitEligible.length || !outboundLanes.length}
              title={
                exitEligible.length
                  ? 'Gate exit · unassign Trailer Device'
                  : 'No outbound-staged trailers'
              }
            >
              Gate exit
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setOpenCheckIn(true)}
              disabled={!inboundReady}
              title={
                inboundReady
                  ? 'Check in trailer'
                  : 'Enable an inbound lane first'
              }
            >
              Check in trailer
            </button>
          </div>
          {!canAssignSlot ? (
            <p className="btn-disabled-hint">
              Assign unavailable — check in a trailer first, or free a parking
              slot in Yards.
            </p>
          ) : awaiting.length ? (
            <p className="btn-enabled-hint">
              {awaiting.length} trailer{awaiting.length === 1 ? '' : 's'} waiting
              for a parking slot
            </p>
          ) : null}
        </div>
      </div>

      {pendingRecovery.length ? (
        <div className="panel ble-recommend-banner" role="status">
          <div>
            <div className="eyebrow">Device recovery · left yard geofence</div>
            <strong>
              {pendingRecovery[0]!.trailerNumber}
              {pendingRecovery[0]!.deviceId
                ? ` · ${pendingRecovery[0]!.deviceId}`
                : ''}
            </strong>
            <p className="trailer-meta" style={{ margin: '0.25rem 0 0' }}>
              {pendingRecovery[0]!.detail}
              {pendingRecovery.length > 1
                ? ` · +${pendingRecovery.length - 1} more`
                : ''}
            </p>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => acknowledge(pendingRecovery[0]!.id)}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void (async () => {
                  const ev = pendingRecovery[0]!
                  const device =
                    ev.deviceId
                      ? devices.find((d) => d.id === ev.deviceId) ??
                        getDeviceForTrailer(ev.trailerNumber)
                      : getDeviceForTrailer(ev.trailerNumber)
                  try {
                    if (device) {
                      await unassignDevice(device.id)
                      await setDeviceLifecycle(device.id, 'charging')
                    }
                    acknowledgeForTrailer(ev.trailerId)
                    success(
                      device
                        ? `${ev.trailerNumber} · ${device.id} → charge bay`
                        : `${ev.trailerNumber} · recovery acknowledged`,
                    )
                  } catch (err) {
                    showError(
                      err instanceof Error
                        ? err.message
                        : 'Device recovery failed.',
                    )
                  }
                })()
              }}
            >
              Recover device
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const ev = pendingRecovery[0]!
                const eligible = exitEligible.find((t) => t.id === ev.trailerId)
                setExitTrailerId(eligible?.id ?? ev.trailerId)
                setExitLane(outboundLanes[0]?.name ?? '')
                setExitError('')
                setOpenExit(true)
              }}
              disabled={!outboundLanes.length}
            >
              Open gate exit
            </button>
          </div>
        </div>
      ) : null}

      <div className="stats stats-6">
        <div className="stat frost">
          <div className="stat-label">Active lanes</div>
          <div className="stat-value">{activeLanes.length}</div>
          <div className="stat-note">
            {inactiveLanes.length} inactive · {gateLanes.length} total
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Inbound ready</div>
          <div className="stat-value">{inboundReady}</div>
          <div className="stat-note">Open for check-in</div>
        </div>
        <div className="stat frost">
          <div className="stat-label">Inbound today</div>
          <div className="stat-value">{inboundToday}</div>
          <div className="stat-note">Gate-in events</div>
        </div>
        <div className="stat">
          <div className="stat-label">Outbound today</div>
          <div className="stat-value">{outboundToday}</div>
          <div className="stat-note">Cleared exit</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Awaiting slot</div>
          <div className="stat-value">{awaiting.length}</div>
          <div className="stat-note">At gate now</div>
        </div>
        <div className="stat crit">
          <div className="stat-label">Held at gate</div>
          <div className="stat-value">{held}</div>
          <div className="stat-note">Needs QA / Ops</div>
        </div>
      </div>

      <div
        className="page-tabs"
        role="tablist"
        aria-label="Gates views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'lanes'}
          className={`page-tab ${tab === 'lanes' ? 'active' : ''}`}
          onClick={() => setTab('lanes')}
        >
          Gate lanes
          <em>{gateLanes.length}</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'queue'}
          className={`page-tab ${tab === 'queue' ? 'active' : ''}`}
          onClick={() => setTab('queue')}
        >
          Live gate queue
          <em>{rows.length}</em>
        </button>
      </div>

      {tab === 'lanes' ? (
        <div className="panel table-wrap table-wrap-filters">
          <div className="panel-head">
            <div>
              <h2>Gate lanes</h2>
              <p className="trailer-meta" style={{ margin: '0.2rem 0 0' }}>
                Add, edit, or mark lanes inactive. Check-in only uses active
                inbound / flex lanes.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateLane}
            >
              Add lane
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>
                  <ColumnFilterHeader
                    label="Lane"
                    value={laneNameFilter}
                    options={laneNameOptions}
                    onChange={setLaneNameFilter}
                    searchable
                    searchPlaceholder="Search lane…"
                  />
                </th>
                <th>
                  <ColumnFilterHeader
                    label="Direction"
                    value={laneDirFilter}
                    options={laneDirOptions}
                    onChange={setLaneDirFilter}
                  />
                </th>
                <th>
                  <ColumnFilterHeader
                    label="Status"
                    value={laneStatusFilter}
                    options={laneStatusOptions}
                    onChange={setLaneStatusFilter}
                  />
                </th>
                <th>
                  <ColumnFilterHeader
                    label="Note"
                    value={laneNoteFilter}
                    options={laneNoteOptions}
                    onChange={setLaneNoteFilter}
                    searchable
                    searchPlaceholder="Search note…"
                  />
                </th>
                <th>Events</th>
                <th>Capability</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lanePagination.paginatedItems.map((lane) => {
                const volume = laneVolume.get(lane.name) ?? 0
                const inactive = lane.status === 'disabled'
                const canCheckIn = gateLaneSupportsDirection(
                  { ...lane, status: 'active' },
                  'in',
                )
                return (
                  <tr
                    key={lane.id}
                    className={inactive ? 'gate-lane-row-inactive' : undefined}
                  >
                    <td>
                      <span className="trailer-id">{lane.name}</span>
                    </td>
                    <td>
                      <span
                        className={`own ${
                          lane.direction === 'in'
                            ? 'bh'
                            : lane.direction === 'out'
                              ? 'carrier'
                              : 'bh'
                        }`}
                      >
                        {LANE_DIR_LABELS[lane.direction]}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${inactive ? 'offline' : 'ok'}`}>
                        {inactive ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="trailer-meta">{lane.note?.trim() || '—'}</td>
                    <td className="mono">{volume}</td>
                    <td className="trailer-meta">
                      {canCheckIn ? 'Check-in capable' : 'Exit only'}
                    </td>
                    <td>
                      <div className="action-icon-row">
                        <ActionIconBtn
                          label={`Edit ${lane.name}`}
                          onClick={() => openEditLane(lane)}
                          disabled={busy}
                        >
                          <IconEdit />
                        </ActionIconBtn>
                        <ActionIconBtn
                          label={
                            inactive
                              ? `Enable ${lane.name}`
                              : `Disable ${lane.name}`
                          }
                          tone={inactive ? 'ok' : 'danger'}
                          onClick={() => void handleToggleLane(lane)}
                          disabled={busy}
                        >
                          {inactive ? <IconEnable /> : <IconDisable />}
                        </ActionIconBtn>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!laneRows.length ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No gate lanes match the column filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <Pagination
            page={lanePagination.page}
            setPage={lanePagination.setPage}
            pageSize={lanePagination.pageSize}
            setPageSize={lanePagination.setPageSize}
            total={lanePagination.total}
            totalPages={lanePagination.totalPages}
            rangeStart={lanePagination.rangeStart}
            rangeEnd={lanePagination.rangeEnd}
          />
        </div>
      ) : (
        <div className="split">
          <div className="panel">
            <div className="panel-head">
              <h2>Live gate queue</h2>
            </div>
            <div className="table-wrap table-wrap-filters">
              <table>
                <thead>
                  <tr>
                    <th>
                      <ColumnFilterHeader
                        label="Time"
                        value={timeFilter}
                        options={timeOptions}
                        onChange={setTimeFilter}
                        searchable
                        searchPlaceholder="Search time…"
                      />
                    </th>
                    <th>
                      <ColumnFilterHeader
                        label="Dir"
                        value={dirFilter}
                        options={dirOptions}
                        onChange={setDirFilter}
                      />
                    </th>
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
                        label="Carrier"
                        value={carrierFilter}
                        options={carrierOptions}
                        onChange={setCarrierFilter}
                        searchable
                        searchPlaceholder="Search carrier…"
                      />
                    </th>
                    <th>
                      <ColumnFilterHeader
                        label="Lane"
                        value={laneFilter}
                        options={laneOptions}
                        onChange={setLaneFilter}
                      />
                    </th>
                    <th>
                      <ColumnFilterHeader
                        label="Seal"
                        value={sealFilter}
                        options={sealOptions}
                        onChange={setSealFilter}
                        searchable
                        searchPlaceholder="Search seal…"
                      />
                    </th>
                    <th>
                      <ColumnFilterHeader
                        label="Status"
                        value={statusFilter}
                        options={statusOptions}
                        onChange={setStatusFilter}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedItems.map((g) => {
                    const linked = trailers.find((t) => t.id === g.trailerId)
                    const needsSlot =
                      !!linked &&
                      isOnSite(linked) &&
                      !linked.slot &&
                      linked.status !== 'At dock'
                    return (
                      <tr key={g.id}>
                        <td className="mono">{g.time}</td>
                        <td>
                          <span
                            className={`own ${g.direction === 'in' ? 'bh' : 'carrier'}`}
                          >
                            {g.direction.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => {
                              if (linked) navigate(`/trailer/${linked.id}`)
                            }}
                          >
                            <span className="trailer-id">{g.trailerNumber}</span>
                          </button>
                        </td>
                        <td>{g.carrier}</td>
                        <td className="mono">{g.lane}</td>
                        <td className="mono">{g.seal}</td>
                        <td>
                          <div className="action-icon-row">
                            <span
                              className={`badge ${
                                g.status === 'held'
                                  ? 'critical'
                                  : g.status === 'processing'
                                    ? 'warn'
                                    : 'ok'
                              }`}
                            >
                              {g.status}
                            </span>
                            {needsSlot ? (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openAssign(linked.id)
                                }}
                              >
                                Assign slot
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={7} className="empty">
                        No gate events match the column filters.
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
          </div>

          <div className="panel story-card">
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setOpenCheckIn(true)}
                disabled={!inboundReady}
              >
                Check in trailer
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate('/map')}
              >
                Open Yards
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate('/trailers')}
              >
                Trailer register
              </button>
            </div>
            <div className="eyebrow">Assignment</div>
            <h2>Trailers waiting for yard slot</h2>
            <p>
              After gate check-in, assign an empty parking slot here or from
              Trailers / Yards. BH-owned units start cold-chain monitoring once
              parked.
            </p>
            <div className="list" style={{ margin: '0 -1.3rem' }}>
              {awaiting.map((t) => (
                <div key={t.id} className="list-item gate-await-item">
                  <button
                    type="button"
                    className="gate-await-main"
                    onClick={() => navigate(`/trailer/${t.id}`)}
                  >
                    <span className="priority warn" />
                    <div>
                      <div className="trailer-id">
                        {t.number}{' '}
                        <span style={{ marginLeft: 6 }}>
                          <OwnBadge ownership={t.ownership} />
                        </span>
                      </div>
                      <div className="trailer-meta">
                        Arrived {t.arrivedAt} · seal {t.seal}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => openAssign(t.id)}
                  >
                    Assign slot
                  </button>
                </div>
              ))}
              {!awaiting.length ? (
                <div className="empty">Gate clear — no pending assignments</div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <GateCheckInModal
        open={openCheckIn}
        onClose={() => setOpenCheckIn(false)}
        onCheckedIn={(id, assignedSlot) => {
          if (assignedSlot) {
            navigate(`/trailer/${id}`)
            return
          }
          setAssignTrailerId(id)
          setAssignSlotOpen(true)
        }}
      />

      {openExit ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !exitBusy && setOpenExit(false)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gate-exit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Gate exit</div>
                <h2 id="gate-exit-title">Depart & recover device</h2>
              </div>
              <ModalCloseBtn onClick={() => setOpenExit(false)} />
            </div>
            <div className="modal-body">
              {exitError ? <div className="form-error">{exitError}</div> : null}
              <p className="role-info-lead" style={{ marginTop: 0 }}>
                Complete outbound exit: mark trailer Departed, unassign the
                Trailer Device, and return it to the cage for charging.
              </p>
              <label className="field">
                <span>Trailer</span>
                <select
                  className="select"
                  value={exitTrailerId}
                  onChange={(e) => setExitTrailerId(e.target.value)}
                >
                  <option value="">Select trailer…</option>
                  {exitEligible.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.number} · {t.status}
                      {getDeviceForTrailer(t.number)
                        ? ` · ${getDeviceForTrailer(t.number)!.id}`
                        : ' · no device'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Outbound lane</span>
                <select
                  className="select"
                  value={exitLane}
                  onChange={(e) => setExitLane(e.target.value)}
                >
                  {outboundLanes.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={exitBusy}
                onClick={() => setOpenExit(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={exitBusy || !exitTrailerId || !exitLane}
                onClick={() => {
                  void (async () => {
                    setExitBusy(true)
                    setExitError('')
                    try {
                      const departed = await gateExitTrailer({
                        trailerId: exitTrailerId,
                        lane: exitLane,
                      })
                      const device = getDeviceForTrailer(departed.number)
                      if (device) {
                        await unassignDevice(device.id)
                        await setDeviceLifecycle(device.id, 'charging')
                      }
                      acknowledgeForTrailer(departed.id)
                      recordEvent({
                        type: 'leave_yard',
                        trailerId: departed.id,
                        trailerNumber: departed.number,
                        deviceId: device?.id,
                        detail: device
                          ? `Gate exit · ${device.id} recovered to charge bay`
                          : 'Gate exit · left yard geofence',
                        needsDeviceRecovery: false,
                        acknowledged: true,
                        notify: false,
                      })
                      success(
                        device
                          ? `${departed.number} departed · ${device.id} → charge bay`
                          : `${departed.number} departed · no device to recover`,
                      )
                      setOpenExit(false)
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : 'Gate exit failed.'
                      setExitError(message)
                      showError(message)
                    } finally {
                      setExitBusy(false)
                    }
                  })()
                }}
              >
                {exitBusy ? 'Exiting…' : 'Confirm gate exit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AssignSlotModal
        key={assignTrailerId ?? 'pick-trailer'}
        open={assignSlotOpen}
        trailerId={assignTrailerId}
        onClose={() => {
          setAssignSlotOpen(false)
          setAssignTrailerId(null)
        }}
      />

      {laneModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !busy && setLaneModalOpen(false)}
        >
          <div
            className="modal-panel modal-panel-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lane-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Gate layout</div>
                <h2 id="lane-form-title">
                  {editingLaneId ? 'Edit gate lane' : 'Add gate lane'}
                </h2>
              </div>
              <ModalCloseBtn onClick={() => setLaneModalOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={handleLaneSubmit}>
              <div className="modal-body">
                {laneError ? <div className="form-error">{laneError}</div> : null}
                <div className="form-grid">
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Lane name</span>
                    <input
                      className="search"
                      value={laneName}
                      onChange={(e) => setLaneName(e.target.value)}
                      placeholder="e.g. Lane 4 or Visitor"
                      required
                      autoFocus
                    />
                  </label>
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Direction</span>
                    <select
                      className="select"
                      value={laneDirection}
                      onChange={(e) =>
                        setLaneDirection(e.target.value as GateLaneDirection)
                      }
                    >
                      <option value="in">Inbound</option>
                      <option value="out">Outbound</option>
                      <option value="both">Flex (both)</option>
                    </select>
                  </label>
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Note (optional)</span>
                    <input
                      className="search"
                      value={laneNote}
                      onChange={(e) => setLaneNote(e.target.value)}
                      placeholder="Staffing, LPR, weighbridge…"
                    />
                  </label>
                </div>
                <p className="trailer-meta" style={{ margin: 0 }}>
                  Inactive lanes stay in history filters but cannot be selected
                  for new check-ins.
                </p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setLaneModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  {busy
                    ? 'Saving…'
                    : editingLaneId
                      ? 'Save lane'
                      : 'Add lane'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </div>
  )
}
