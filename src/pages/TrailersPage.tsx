import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LIFECYCLE_TRAILER_STATUSES,
  OPS_HOLD_META,
  REEFER_BRAND_META,
  SITE,
  TRAILER_LENGTH_PRESETS,
  TRAILER_TYPE_META,
  lengthToPreset,
  isOnSite,
  trailerNeedsDock,
  type AddTrailerInput,
  type Ownership,
  type ReeferBrand,
  type TempStatus,
  type Trailer,
  type TrailerLengthFt,
  type TrailerLengthPreset,
  type TrailerRecordStatus,
  type TrailerStatus,
  type TrailerType,
} from '../data/trailers'
import { formatDwellShort } from '../utils/usFormat'
import { OwnBadge, StatusBadge, YardStatusPill, formatTemp } from '../components/Badges'
import {
  ActionIconBtn,
  IconAssignSlot,
  IconCheckIn,
  IconDisable,
  IconEdit,
  IconEnable,
  IconStatus,
  ModalCloseBtn,
} from '../components/ActionIcons'

import { AssignSlotModal } from '../components/AssignSlotModal'
import { GateCheckInModal } from '../components/GateCheckInModal'
import { UpdateTrailerStatusModal } from '../components/UpdateTrailerStatusModal'
import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { Pagination, usePagination } from '../components/Pagination'
import { useSnackbar } from '../components/Snackbar'
import { useYard } from '../yard/YardContext'
import { useDevices } from '../devices/DevicesContext'
import { useSmartYard } from '../smart/SmartYardContext'
import {
  ALL_SMART_CAPABILITIES,
  CAPABILITY_META,
  LIFECYCLE_META,
  type UnifiedSmartDevice,
} from '../data/smartEnterprise'

const TEMP_LABELS: Record<string, string> = {
  critical: 'Excursion',
  warn: 'Warming',
  offline: 'No signal',
  ok: 'In range',
  na: 'N/A',
}

const yardStatuses: TrailerStatus[] = LIFECYCLE_TRAILER_STATUSES

const tempStatuses: TempStatus[] = ['ok', 'warn', 'critical', 'offline', 'na']

function canMapSmartDevice(d: UnifiedSmartDevice, trailerNumber: string) {
  if (d.lifecycle === 'lost' || d.lifecycle === 'retired') return false
  if (d.lifecycle === 'maintenance' && d.assignedTrailer !== trailerNumber)
    return false
  if (d.assignedTrailer && d.assignedTrailer !== trailerNumber) return false
  return true
}

export function TrailersPage() {
  const navigate = useNavigate()
  const {
    trailers,
    addTrailer,
    updateTrailer,
    setTrailerStatus,
    setTrailerRecordStatus,
  } = useYard()
  const { remapTrailerNumber } = useDevices()
  const {
    devices: smartDevices,
    getDeviceForTrailer,
    assignDeviceToTrailer,
    unassignDevice,
  } = useSmartYard()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const { success, error: showError } = useSnackbar()

  const [q, setQ] = useState('')
  const [trailerFilter, setTrailerFilter] = useState('all')
  const [recordFilter, setRecordFilter] = useState('all')
  const [yardStatusFilter, setYardStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [devicesFilter, setDevicesFilter] = useState('all')
  const [tempFilter, setTempFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [assignSlotOpen, setAssignSlotOpen] = useState(false)
  const [assignTrailerId, setAssignTrailerId] = useState<string | null>(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkInTrailerId, setCheckInTrailerId] = useState<string | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusTrailerId, setStatusTrailerId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selectedSmartDeviceId, setSelectedSmartDeviceId] = useState<
    string | null
  >(null)

  const [number, setNumber] = useState('')
  const [ownership, setOwnership] = useState<Ownership>('bh')
  const [carrier, setCarrier] = useState("Boar’s Head")
  const [product, setProduct] = useState('Deli meats · chilled')
  const [seal, setSeal] = useState('')
  const [trailerType, setTrailerType] = useState<TrailerType>('reefer')
  const [lengthPreset, setLengthPreset] = useState<TrailerLengthPreset>(53)
  const [lengthOther, setLengthOther] = useState('')
  const [reeferBrand, setReeferBrand] = useState<ReeferBrand>('thermo_king')
  const [defaultSetpoint, setDefaultSetpoint] = useState('34')
  const [homeSite, setHomeSite] = useState(SITE.name)
  const [fleetAssetId, setFleetAssetId] = useState('')
  const [masterNotes, setMasterNotes] = useState('')
  const [recordStatus, setRecordStatus] =
    useState<TrailerRecordStatus>('active')
  const [status, setStatus] = useState<TrailerStatus>('Departed')
  const [setpoint, setSetpoint] = useState('34')
  const [actual, setActual] = useState('34.2')
  const [fuelPct, setFuelPct] = useState('70')
  const [telemetry, setTelemetry] = useState(true)
  const [tempStatus, setTempStatus] = useState<TempStatus>('ok')
  const [reeferAlarm, setReeferAlarm] = useState(false)

  const formTrailerNumber = number.trim().toUpperCase()

  function canCheckIn(t: Trailer) {
    return t.recordStatus === 'active' && t.status === 'Departed'
  }

  function canAssignSlot(t: Trailer) {
    return (
      t.recordStatus === 'active' &&
      isOnSite(t) &&
      t.status !== 'At dock' &&
      t.status !== 'Departed'
    )
  }

  function openCheckIn(t: Trailer) {
    setCheckInTrailerId(t.id)
    setCheckInOpen(true)
  }

  function openAssignSlot(t: Trailer) {
    setAssignTrailerId(t.id)
    setAssignSlotOpen(true)
  }

  function openStatusModal(t: Trailer) {
    setStatusTrailerId(t.id)
    setStatusModalOpen(true)
  }

  const mappableSmartDevices = useMemo(
    () =>
      smartDevices
        .filter((d) => canMapSmartDevice(d, formTrailerNumber))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [smartDevices, formTrailerNumber],
  )

  function trailerLocation(t: Trailer) {
    return t.status === 'Departed' ? 'Off site' : (t.slot ?? t.dockDoor ?? 'Gate')
  }

  const trailerOptions = useMemo(() => {
    const ownerships = Array.from(new Set(trailers.map((t) => t.ownership)))
    return [
      ...ownerships.map((o) => ({
        value: `own:${o}`,
        label: o === 'bh' ? 'BH-owned' : 'Carrier',
      })),
      ...uniqueOptions(trailers.map((t) => t.number)).map((o) => ({
        value: `num:${o.value}`,
        label: o.label,
      })),
    ]
  }, [trailers])

  const recordOptions = useMemo(
    () => [
      { value: 'active', label: 'active' },
      { value: 'disabled', label: 'disabled' },
    ],
    [],
  )

  const yardStatusOptions = useMemo(
    () => uniqueOptions(trailers.map((t) => t.status)),
    [trailers],
  )

  const locationOptions = useMemo(
    () => uniqueOptions(trailers.map(trailerLocation)),
    [trailers],
  )

  const devicesOptions = useMemo(
    () => [
      { value: 'none', label: 'None' },
      { value: 'has', label: 'Has smart device' },
      { value: 'available_map', label: 'Unmapped' },
    ],
    [],
  )

  const tempOptions = useMemo(
    () =>
      uniqueOptions(trailers.map((t) => t.tempStatus), (v) => TEMP_LABELS[v] ?? v),
    [trailers],
  )

  const rows = useMemo(() => {
    return trailers
      .filter((t) => {
        const smart = getDeviceForTrailer(t.number)
        const hay =
          `${t.number} ${t.carrier} ${t.slot ?? ''} ${t.product} ${t.status} ${t.recordStatus} ${t.trailerType} ${t.fleetAssetId ?? ''} ${t.homeSite} ${smart?.id ?? ''} ${smart?.deviceType ?? ''}`.toLowerCase()
        if (q && !hay.includes(q.toLowerCase())) return false

        if (trailerFilter !== 'all') {
          if (trailerFilter.startsWith('own:')) {
            if (t.ownership !== trailerFilter.slice(4)) return false
          } else if (trailerFilter.startsWith('num:')) {
            if (t.number !== trailerFilter.slice(4)) return false
          }
        }
        if (recordFilter !== 'all' && t.recordStatus !== recordFilter)
          return false
        if (yardStatusFilter !== 'all' && t.status !== yardStatusFilter)
          return false
        if (locationFilter !== 'all' && trailerLocation(t) !== locationFilter)
          return false
        if (devicesFilter !== 'all') {
          if (devicesFilter === 'none' || devicesFilter === 'available_map') {
            if (smart) return false
          } else if (devicesFilter === 'has') {
            if (!smart) return false
          }
        }
        if (tempFilter !== 'all' && t.tempStatus !== tempFilter) return false
        return true
      })
      .sort((a, b) => a.number.localeCompare(b.number))
  }, [
    q,
    trailerFilter,
    recordFilter,
    yardStatusFilter,
    locationFilter,
    devicesFilter,
    tempFilter,
    trailers,
    getDeviceForTrailer,
  ])

  const filterKey = `${q}|${trailerFilter}|${recordFilter}|${yardStatusFilter}|${locationFilter}|${devicesFilter}|${tempFilter}`
  const pagination = usePagination(rows, 10, filterKey)

  function openCreate() {
    setEditingId(null)
    setNumber('')
    setOwnership('bh')
    setCarrier("Boar’s Head")
    setProduct('Deli meats · chilled')
    setSeal('')
    setTrailerType('reefer')
    setLengthPreset(53)
    setLengthOther('')
    setReeferBrand('thermo_king')
    setDefaultSetpoint('34')
    setHomeSite(SITE.name)
    setFleetAssetId('')
    setMasterNotes('')
    setRecordStatus('active')
    setStatus('Departed')
    setSetpoint('34')
    setActual('34.2')
    setFuelPct('70')
    setTelemetry(true)
    setTempStatus('ok')
    setReeferAlarm(false)
    setSelectedSmartDeviceId(null)
    setError('')
    setFormOpen(true)
  }

  function openEdit(t: Trailer) {
    setEditingId(t.id)
    setNumber(t.number)
    setOwnership(t.ownership)
    setCarrier(t.carrier)
    setProduct(t.product)
    setSeal(t.seal)
    setTrailerType(t.trailerType)
    setLengthPreset(lengthToPreset(t.lengthFt))
    setLengthOther(lengthToPreset(t.lengthFt) === 'other' ? String(t.lengthFt) : '')
    setReeferBrand(t.reeferBrand)
    setDefaultSetpoint(
      t.defaultSetpoint == null ? '' : String(t.defaultSetpoint),
    )
    setHomeSite(t.homeSite || SITE.name)
    setFleetAssetId(t.fleetAssetId ?? '')
    setMasterNotes(t.masterNotes ?? '')
    setRecordStatus(t.recordStatus ?? 'active')
    setStatus(
      t.status === 'QA hold' || t.status === 'Yard hold' ? 'In yard' : t.status,
    )
    setSetpoint(t.setpoint == null ? '' : String(t.setpoint))
    setActual(t.actual == null ? '' : String(t.actual))
    setFuelPct(t.fuelPct == null ? '' : String(t.fuelPct))
    setTelemetry(t.telemetry)
    setTempStatus(t.tempStatus)
    setReeferAlarm(t.reeferAlarm)
    setSelectedSmartDeviceId(getDeviceForTrailer(t.number)?.id ?? null)
    setError('')
    setFormOpen(true)
  }

  function handleOwnership(next: Ownership) {
    setOwnership(next)
    if (next === 'bh') {
      setCarrier("Boar’s Head")
      setTelemetry(true)
      setTempStatus('ok')
      setTrailerType('reefer')
      setReeferBrand('thermo_king')
      setDefaultSetpoint('34')
      setSetpoint('34')
    } else {
      setCarrier('Carrier partner')
      setTelemetry(false)
      setTempStatus('na')
      setActual('')
      setSetpoint('')
      setFuelPct('')
      setReeferBrand('none')
      setDefaultSetpoint('')
    }
  }

  function handleTrailerType(next: TrailerType) {
    setTrailerType(next)
    if (next === 'dry') {
      setReeferBrand('none')
      setTelemetry(false)
      setTempStatus('na')
      setDefaultSetpoint('')
      setSetpoint('')
      setActual('')
      setFuelPct('')
      setReeferAlarm(false)
    } else if (reeferBrand === 'none') {
      setReeferBrand(ownership === 'bh' ? 'thermo_king' : 'carrier')
    }
  }

  function handleReeferBrand(next: ReeferBrand) {
    setReeferBrand(next)
    if (next === 'none') {
      setTelemetry(false)
      setTempStatus('na')
    } else if (!telemetry) {
      setTelemetry(true)
      if (tempStatus === 'na') setTempStatus('ok')
      if (!defaultSetpoint) setDefaultSetpoint('34')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!number.trim()) {
      setError('Trailer number is required.')
      return
    }

    const parsedSetpoint = setpoint === '' ? null : Number(setpoint)
    const parsedDefaultSetpoint =
      defaultSetpoint === '' ? null : Number(defaultSetpoint)
    const parsedActual = actual === '' ? null : Number(actual)
    const parsedFuel = fuelPct === '' ? null : Number(fuelPct)

    if (parsedSetpoint != null && Number.isNaN(parsedSetpoint)) {
      setError('Setpoint must be a number.')
      return
    }
    if (parsedDefaultSetpoint != null && Number.isNaN(parsedDefaultSetpoint)) {
      setError('Default setpoint must be a number.')
      return
    }

    let lengthFt: TrailerLengthFt
    if (lengthPreset === 'other') {
      const custom = Number(lengthOther)
      if (!lengthOther.trim() || Number.isNaN(custom) || custom <= 0) {
        setError('Enter a valid trailer length in feet.')
        return
      }
      lengthFt = custom
    } else {
      lengthFt = lengthPreset
    }

    if (parsedActual != null && Number.isNaN(parsedActual)) {
      setError('Actual temp must be a number.')
      return
    }
    if (parsedFuel != null && Number.isNaN(parsedFuel)) {
      setError('Fuel % must be a number.')
      return
    }

    const nextNumber = number.trim().toUpperCase()
    const masterPatch = {
      trailerType,
      lengthFt,
      reeferBrand,
      defaultSetpoint: parsedDefaultSetpoint,
      homeSite: homeSite.trim() || SITE.name,
      fleetAssetId: fleetAssetId.trim() || undefined,
      masterNotes: masterNotes.trim() || undefined,
    }

    try {
      if (editingId) {
        const existing = trailers.find((t) => t.id === editingId)
        if (!existing) return
        const duplicate = trailers.some(
          (t) => t.id !== editingId && t.number === nextNumber,
        )
        if (duplicate) {
          setError('Another trailer already uses this number.')
          return
        }

        if (status !== existing.status) {
          await setTrailerStatus(editingId, status)
        }

        await updateTrailer(editingId, {
          number: nextNumber,
          ownership,
          carrier:
            carrier.trim() ||
            (ownership === 'bh' ? "Boar’s Head" : 'Carrier partner'),
          product: product.trim() || 'General · chilled',
          seal: seal.trim() || existing.seal,
          recordStatus,
          ...masterPatch,
          setpoint: telemetry ? parsedSetpoint ?? parsedDefaultSetpoint : null,
          actual: telemetry ? parsedActual : null,
          fuelPct: telemetry ? parsedFuel : null,
          telemetry,
          tempStatus: telemetry ? tempStatus : 'na',
          reeferAlarm: telemetry ? reeferAlarm : false,
        })

        if (existing.number.toUpperCase() !== nextNumber) {
          await remapTrailerNumber(existing.number, nextNumber)
        }
        await syncSmartDeviceMapping(
          nextNumber,
          existing.id,
          existing.slot ?? existing.status,
        )
        success(`Trailer ${nextNumber} updated.`)
      } else {
        const duplicate = trailers.some((t) => t.number === nextNumber)
        if (duplicate) {
          setError('A trailer with this number already exists.')
          return
        }

        const input: AddTrailerInput = {
          number,
          ownership,
          carrier:
            carrier.trim() ||
            (ownership === 'bh' ? "Boar’s Head" : 'Carrier partner'),
          product,
          seal,
          status: 'Departed',
          recordStatus: 'active',
          ...masterPatch,
          slot: null,
          zone: 'Gate',
          setpoint: telemetry ? parsedSetpoint ?? parsedDefaultSetpoint : null,
          actual: telemetry ? parsedActual : null,
          fuelPct: telemetry ? parsedFuel : null,
          telemetry,
          direction: 'inbound',
          tempStatus: telemetry ? tempStatus : 'na',
          reeferAlarm: telemetry ? reeferAlarm : false,
        }
        const created = await addTrailer(input, { asRegister: true })
        await syncSmartDeviceMapping(
          created.number,
          created.id,
          created.slot ?? created.status,
        )
        success(`Trailer ${created.number} registered.`)
      }
      setFormOpen(false)
    } catch {
      showError(
        editingId
          ? 'Could not save trailer changes.'
          : 'Could not register trailer.',
      )
    }
  }

  async function syncSmartDeviceMapping(
    trailerNumber: string,
    trailerId: string,
    location: string,
  ) {
    const current = getDeviceForTrailer(trailerNumber)
    if (current && current.id !== selectedSmartDeviceId) {
      await unassignDevice(current.id)
    }
    if (
      selectedSmartDeviceId &&
      (!current || current.id !== selectedSmartDeviceId)
    ) {
      await assignDeviceToTrailer(
        selectedSmartDeviceId,
        trailerNumber,
        trailerId,
        location,
      )
    }
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Fleet register</div>
          <h1>Trailers</h1>
          <p>
            Register and maintain trailers (Active / Disabled), set yard status,
            map devices, check in off-site units, and assign parking once on
            site. Gates still runs the live lane queue.
          </p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Register trailer
          </button>
          <div className="meta-chip">
            <span className="meta-dot" />
            {rows.length} shown · {SITE.asOf}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search trailer, carrier, slot, device…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
                  label="Record"
                  value={recordFilter}
                  options={recordOptions}
                  onChange={setRecordFilter}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Yard status"
                  value={yardStatusFilter}
                  options={yardStatusOptions}
                  onChange={setYardStatusFilter}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Location"
                  value={locationFilter}
                  options={locationOptions}
                  onChange={setLocationFilter}
                  searchable
                  searchPlaceholder="Search location…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Devices"
                  value={devicesFilter}
                  options={devicesOptions}
                  onChange={setDevicesFilter}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Temp"
                  value={tempFilter}
                  options={tempOptions}
                  onChange={setTempFilter}
                />
              </th>
              <th>
                <PlainHeader>Dwell</PlainHeader>
              </th>
              <th>
                <PlainHeader>Actions</PlainHeader>
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map((t) => {
              const smart = getDeviceForTrailer(t.number)
              return (
                <tr key={t.id}>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => navigate(`/trailer/${t.id}`)}
                    >
                      <div className="trailer-cell">
                        <span className="trailer-id">{t.number}</span>
                        <span className="trailer-meta">
                          <OwnBadge ownership={t.ownership} /> ·{' '}
                          {TRAILER_TYPE_META[t.trailerType]} · {t.lengthFt}′ ·{' '}
                          {t.carrier}
                        </span>
                      </div>
                    </button>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        t.recordStatus === 'active' ? 'ok' : 'offline'
                      }`}
                    >
                      {t.recordStatus}
                    </span>
                  </td>
                  <td>
                    <div className="yard-status-cell">
                      <YardStatusPill trailer={t} />
                      {t.recordStatus === 'active' && t.status !== 'Departed' ? (
                        <span className="trailer-meta yard-status-meta">
                          {(t.opsHold ?? 'none') !== 'none'
                            ? `Hold: ${OPS_HOLD_META[t.opsHold ?? 'none']}`
                            : 'No hold'}
                          {' · '}
                          {trailerNeedsDock(t)
                            ? 'Dock required'
                            : 'Yard → departure'}
                        </span>
                      ) : null}
                      {t.recordStatus === 'active' ? (
                        <button
                          type="button"
                          className="btn btn-ghost yard-status-update"
                          onClick={() => openStatusModal(t)}
                        >
                          Update status
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="mono">{trailerLocation(t)}</td>
                  <td>
                    {smart ? (
                      <div className="trailer-cell">
                        <span className="trailer-id">{smart.id}</span>
                        <span className="trailer-meta">
                          {smart.deviceType} · {LIFECYCLE_META[smart.lifecycle]}
                        </span>
                      </div>
                    ) : (
                      <span className="trailer-meta">None</span>
                    )}
                  </td>
                  <td>
                    <div className="temp-cell">
                      <span className="temp-main">{formatTemp(t.actual)}</span>
                      <span className="trailer-meta" style={{ marginTop: 4 }}>
                        <StatusBadge status={t.tempStatus} />
                      </span>
                    </div>
                  </td>
                  <td className="mono">
                    {t.status === 'Departed'
                      ? '—'
                      : formatDwellShort(t.dwellHours)}
                  </td>
                  <td>
                    <div className="action-icon-row">
                      <ActionIconBtn label="Edit trailer" onClick={() => openEdit(t)}>
                        <IconEdit />
                      </ActionIconBtn>
                      {t.recordStatus === 'active' ? (
                        <ActionIconBtn
                          label="Update yard status"
                          onClick={() => openStatusModal(t)}
                        >
                          <IconStatus />
                        </ActionIconBtn>
                      ) : null}
                      {canCheckIn(t) ? (
                        <ActionIconBtn
                          label="Check in at gate"
                          onClick={() => openCheckIn(t)}
                        >
                          <IconCheckIn />
                        </ActionIconBtn>
                      ) : null}
                      {canAssignSlot(t) ? (
                        <ActionIconBtn
                          label={
                            t.slot
                              ? 'Change parking slot'
                              : 'Assign parking slot'
                          }
                          onClick={() => openAssignSlot(t)}
                        >
                          <IconAssignSlot />
                        </ActionIconBtn>
                      ) : null}
                      {t.recordStatus !== 'disabled' ? (
                        <ActionIconBtn
                          label="Disable trailer"
                          tone="danger"
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm({
                                title: 'Disable trailer',
                                message: `Disable ${t.number}? It will leave the yard register active list and cannot check in until re-enabled.`,
                                confirmLabel: 'Disable',
                                tone: 'danger',
                              })
                              if (ok) {
                                try {
                                  await setTrailerRecordStatus(t.id, 'disabled')
                                  success(`${t.number} disabled.`)
                                } catch {
                                  showError(`Could not disable ${t.number}.`)
                                }
                              }
                            })()
                          }}
                        >
                          <IconDisable />
                        </ActionIconBtn>
                      ) : (
                        <ActionIconBtn
                          label="Enable trailer"
                          tone="ok"
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm({
                                title: 'Enable trailer',
                                message: `Enable ${t.number}? It will be available for gate check-in again when off site.`,
                                confirmLabel: 'Enable',
                              })
                              if (ok) {
                                try {
                                  await setTrailerRecordStatus(t.id, 'active')
                                  success(`${t.number} enabled.`)
                                } catch {
                                  showError(`Could not enable ${t.number}.`)
                                }
                              }
                            })()
                          }}
                        >
                          <IconEnable />
                        </ActionIconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="empty">
                  No trailers match the filters.
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

      {formOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Fleet register</div>
                <h2>{editingId ? 'Edit trailer' : 'Register trailer'}</h2>
              </div>
              <ModalCloseBtn onClick={() => setFormOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
                <div className="modal-body">
              {error ? <div className="form-error">{error}</div> : null}

              {!editingId ? (
                <p className="role-info-lead" style={{ marginTop: 0 }}>
                  New trailers are registered as Active / off site (Departed).
                  Check them in at the Gate when they arrive.
                </p>
              ) : null}

              <div className="form-section">
                <div className="eyebrow">Trailer details</div>
                <div className="form-grid">
                  <label className="field">
                    <span>Trailer number</span>
                    <input
                      className="search"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="BH-5501"
                      autoFocus
                    />
                  </label>
                  <label className="field">
                    <span>Fleet / asset ID</span>
                    <input
                      className="search"
                      value={fleetAssetId}
                      onChange={(e) => setFleetAssetId(e.target.value)}
                      placeholder="ASSET-BH-5501 (optional)"
                    />
                  </label>
                  <label className="field">
                    <span>Ownership</span>
                    <select
                      className="select"
                      value={ownership}
                      onChange={(e) =>
                        handleOwnership(e.target.value as Ownership)
                      }
                    >
                      <option value="bh">BH-owned</option>
                      <option value="carrier">Carrier</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Carrier</span>
                    <input
                      className="search"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Trailer type</span>
                    <select
                      className="select"
                      value={trailerType}
                      onChange={(e) =>
                        handleTrailerType(e.target.value as TrailerType)
                      }
                    >
                      {(Object.keys(TRAILER_TYPE_META) as TrailerType[]).map(
                        (k) => (
                          <option key={k} value={k}>
                            {TRAILER_TYPE_META[k]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="field">
                    <span>Length</span>
                    <select
                      className="select"
                      value={lengthPreset}
                      onChange={(e) => {
                        const next = e.target.value
                        if (next === 'other') {
                          setLengthPreset('other')
                          if (!lengthOther) setLengthOther('')
                        } else {
                          setLengthPreset(Number(next) as TrailerLengthPreset)
                          setLengthOther('')
                        }
                      }}
                    >
                      {TRAILER_LENGTH_PRESETS.map((ft) => (
                        <option key={ft} value={ft}>
                          {ft}′
                        </option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                  </label>
                  {lengthPreset === 'other' ? (
                    <label className="field">
                      <span>Custom length (ft)</span>
                      <input
                        className="search"
                        inputMode="decimal"
                        value={lengthOther}
                        onChange={(e) => setLengthOther(e.target.value)}
                        placeholder="e.g. 57"
                      />
                    </label>
                  ) : null}
                  <label className="field">
                    <span>Reefer brand</span>
                    <select
                      className="select"
                      value={reeferBrand}
                      onChange={(e) =>
                        handleReeferBrand(e.target.value as ReeferBrand)
                      }
                      disabled={trailerType === 'dry'}
                    >
                      {(Object.keys(REEFER_BRAND_META) as ReeferBrand[]).map(
                        (k) => (
                          <option key={k} value={k}>
                            {REEFER_BRAND_META[k]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="field">
                    <span>Default setpoint °F</span>
                    <input
                      className="search"
                      value={defaultSetpoint}
                      onChange={(e) => setDefaultSetpoint(e.target.value)}
                      placeholder="34"
                      disabled={trailerType === 'dry' || reeferBrand === 'none'}
                    />
                  </label>
                  <label className="field">
                    <span>Home site</span>
                    <select
                      className="select"
                      value={homeSite}
                      onChange={(e) => setHomeSite(e.target.value)}
                    >
                      <option value={SITE.name}>{SITE.name}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Product profile</span>
                    <input
                      className="search"
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Seal</span>
                    <input
                      className="search"
                      value={seal}
                      onChange={(e) => setSeal(e.target.value)}
                      placeholder="Optional until gate check-in"
                    />
                  </label>
                  {editingId ? (
                    <>
                      <label className="field">
                        <span>Record status</span>
                        <select
                          className="select"
                          value={recordStatus}
                          onChange={(e) =>
                            setRecordStatus(
                              e.target.value as TrailerRecordStatus,
                            )
                          }
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Yard status</span>
                        <select
                          className="select"
                          value={status}
                          onChange={(e) =>
                            setStatus(e.target.value as TrailerStatus)
                          }
                        >
                          {yardStatuses.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                </div>
                <label className="field" style={{ marginTop: '0.75rem' }}>
                  <span>Master notes</span>
                  <textarea
                    className="search"
                    value={masterNotes}
                    onChange={(e) => setMasterNotes(e.target.value)}
                    placeholder="Fleet notes for this asset…"
                    rows={3}
                    style={{ resize: 'vertical', minHeight: '4.5rem' }}
                  />
                </label>
              </div>

              <div className="form-section">
                <div className="eyebrow">Cold chain</div>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={telemetry}
                    onChange={(e) => {
                      setTelemetry(e.target.checked)
                      if (!e.target.checked) {
                        setTempStatus('na')
                        setReeferAlarm(false)
                      } else if (tempStatus === 'na') {
                        setTempStatus('ok')
                      }
                    }}
                    disabled={trailerType === 'dry' || reeferBrand === 'none'}
                  />
                  <span>Reefer telemetry available</span>
                </label>
                {editingId ? (
                  <>
                    <div className="form-grid">
                      <label className="field">
                        <span>Current setpoint °F</span>
                        <input
                          className="search"
                          value={setpoint}
                          onChange={(e) => setSetpoint(e.target.value)}
                          disabled={!telemetry}
                        />
                      </label>
                      <label className="field">
                        <span>Actual °F</span>
                        <input
                          className="search"
                          value={actual}
                          onChange={(e) => setActual(e.target.value)}
                          disabled={!telemetry}
                        />
                      </label>
                      <label className="field">
                        <span>Fuel %</span>
                        <input
                          className="search"
                          value={fuelPct}
                          onChange={(e) => setFuelPct(e.target.value)}
                          disabled={!telemetry}
                        />
                      </label>
                      <label className="field">
                        <span>Temp status</span>
                        <select
                          className="select"
                          value={tempStatus}
                          onChange={(e) =>
                            setTempStatus(e.target.value as TempStatus)
                          }
                          disabled={!telemetry}
                        >
                          {tempStatuses.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={reeferAlarm}
                        onChange={(e) => setReeferAlarm(e.target.checked)}
                        disabled={!telemetry}
                      />
                      <span>Reefer alarm active</span>
                    </label>
                  </>
                ) : (
                  <p className="trailer-meta" style={{ margin: '0.5rem 0 0' }}>
                    Visit temps and alarms are set at gate check-in / while on
                    site. Default setpoint is saved on the master record above.
                  </p>
                )}
              </div>

              <div className="form-section">
                <div className="eyebrow">Device mapping</div>
                <p className="role-info-lead" style={{ marginTop: 0 }}>
                  Map an available Trailer Device from inventory. Features on
                  this trailer enable only for the selected device&apos;s
                  capabilities. Only unassigned (or currently mapped) units are
                  listed.
                </p>
                <div className="device-map-list">
                  {mappableSmartDevices.map((d) => (
                    <label key={d.id} className="check-row device-map-row">
                      <input
                        type="radio"
                        name="smart-device-map"
                        checked={selectedSmartDeviceId === d.id}
                        onChange={() => setSelectedSmartDeviceId(d.id)}
                      />
                      <span>
                        <strong>{d.id}</strong>
                        <span className="trailer-meta">
                          {d.deviceType}
                          {d.hardwareModel ? ` · ${d.hardwareModel}` : ''} ·{' '}
                          {LIFECYCLE_META[d.lifecycle]} · {d.connectivity}
                          {d.batteryPct != null ? ` · ${d.batteryPct}%` : ''}
                          {d.assignedTrailer === formTrailerNumber
                            ? ' · currently mapped'
                            : ' · available'}
                        </span>
                        <ul className="capability-checklist device-map-caps">
                          {ALL_SMART_CAPABILITIES.map((cap) => {
                            const on = d.capabilities.includes(cap)
                            return (
                              <li
                                key={cap}
                                className={on ? 'cap-on' : 'cap-off'}
                              >
                                <span aria-hidden="true">
                                  {on ? '✔' : '✖'}
                                </span>
                                {CAPABILITY_META[cap].label}
                              </li>
                            )
                          })}
                        </ul>
                      </span>
                    </label>
                  ))}
                  {selectedSmartDeviceId ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => setSelectedSmartDeviceId(null)}
                    >
                      Clear smart device
                    </button>
                  ) : null}
                  {!mappableSmartDevices.length ? (
                    <div className="empty">
                      No available trailer devices — register units in Trailer
                      Devices first.
                    </div>
                  ) : null}
                </div>
              </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Save trailer' : 'Register trailer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <GateCheckInModal
        key={checkInTrailerId ?? 'check-in'}
        open={checkInOpen}
        initialTrailerId={checkInTrailerId}
        onClose={() => {
          setCheckInOpen(false)
          setCheckInTrailerId(null)
        }}
        onCheckedIn={(id, assignedSlot) => {
          if (assignedSlot) {
            navigate(`/trailer/${id}`)
            return
          }
          setAssignTrailerId(id)
          setAssignSlotOpen(true)
        }}
      />
      <AssignSlotModal
        key={assignTrailerId ?? 'pick-trailer'}
        open={assignSlotOpen}
        trailerId={assignTrailerId}
        onClose={() => {
          setAssignSlotOpen(false)
          setAssignTrailerId(null)
        }}
      />
      <UpdateTrailerStatusModal
        key={statusTrailerId ?? 'status'}
        open={statusModalOpen}
        trailerId={statusTrailerId}
        onClose={() => {
          setStatusModalOpen(false)
          setStatusTrailerId(null)
        }}
      />
      {confirmDialog}
    </div>
  )
}
