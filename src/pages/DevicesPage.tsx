import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeviceAssignmentWorkflow } from '../components/DeviceAssignmentWorkflow'
import {
  ActionIconBtn,
  IconAssignSlot,
  IconDisable,
  IconEdit,
  IconInfo,
  ModalCloseBtn,
} from '../components/ActionIcons'
import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { Pagination, usePagination } from '../components/Pagination'
import { useSnackbar } from '../components/Snackbar'
import {
  ALL_SMART_CAPABILITIES,
  CAPABILITY_META,
  CONNECTIVITY_PROFILE_META,
  CONNECTIVITY_PROFILES,
  LIFECYCLE_META,
  SMART_DEVICE_CLASS_META,
  SMART_DEVICE_CLASSES,
  type ConnectivityProfile,
  type ConnStatus,
  type SensorStatus,
  type SmartCapability,
  type SmartDeviceClass,
  type SmartLifecycle,
  type UnifiedSmartDevice,
} from '../data/smartEnterprise'
import { isOnSite } from '../data/trailers'
import { useSmartYard } from '../smart/SmartYardContext'
import { useYard } from '../yard/YardContext'

const LIFECYCLE_TONES: Record<SmartLifecycle, string> = {
  available: 'ok',
  assigned: 'warn',
  in_use: 'ok',
  charging: 'warn',
  maintenance: 'warn',
  lost: 'critical',
  retired: 'offline',
}

const SENSOR_LABELS: Record<SensorStatus, string> = {
  ok: 'OK',
  warn: 'Warn',
  offline: 'Offline',
  na: 'N/A',
}

const SENSOR_TONES: Record<SensorStatus, string> = {
  ok: 'ok',
  warn: 'warn',
  offline: 'critical',
  na: 'offline',
}

const CONN_TONES: Record<ConnStatus, string> = {
  online: 'ok',
  degraded: 'warn',
  offline: 'critical',
}

const LIFECYCLE_ACTIONS: SmartLifecycle[] = [
  'available',
  'charging',
  'maintenance',
  'lost',
  'retired',
]

const UNIFIED_CAPABILITIES = ALL_SMART_CAPABILITIES.map((key) => ({
  key,
  label: CAPABILITY_META[key].label,
  description: CAPABILITY_META[key].feature,
  uses:
    key === 'rfid'
      ? ['Gate lane auto-ID', 'Yard slot correlation', 'Outbound verification']
      : key === 'gps'
        ? ['Live yard position', 'Geofence alerts', 'Movement trail']
        : key === 'ble'
          ? ['Dock apron precision', 'Zone crowding', 'Slot confidence scoring']
          : key === 'temperature'
            ? ['Setpoint delta', 'Excursion alerts', 'QA hold correlation']
            : key === 'fuel'
              ? ['Tank level monitoring', 'Low fuel alerts', 'Top-off planning']
              : ['Real-time telemetry', 'OTA firmware', 'Remote health checks'],
}))

function capabilityChecklist(capabilities: SmartCapability[]) {
  return (
    <ul className="capability-checklist">
      {ALL_SMART_CAPABILITIES.map((cap) => {
        const on = capabilities.includes(cap)
        return (
          <li key={cap} className={on ? 'cap-on' : 'cap-off'}>
            <span aria-hidden="true">{on ? '✔' : '✖'}</span>
            {CAPABILITY_META[cap].label}
          </li>
        )
      })}
    </ul>
  )
}

function sensorBadge(status: SensorStatus) {
  return (
    <span className={`badge ${SENSOR_TONES[status]}`}>{SENSOR_LABELS[status]}</span>
  )
}

function connBadge(status: ConnStatus) {
  return <span className={`badge ${CONN_TONES[status]}`}>{status}</span>
}

function lifecycleBadge(lifecycle: SmartLifecycle) {
  return (
    <span className={`badge smart-lifecycle ${LIFECYCLE_TONES[lifecycle]}`}>
      {LIFECYCLE_META[lifecycle]}
    </span>
  )
}

function healthScoreTone(score: number) {
  if (score >= 85) return 'ok'
  if (score >= 60) return 'warn'
  return 'critical'
}

function canAssign(d: UnifiedSmartDevice) {
  return (
    !d.assignedTrailer &&
    d.lifecycle !== 'lost' &&
    d.lifecycle !== 'retired' &&
    d.lifecycle !== 'maintenance'
  )
}

function canUnassign(d: UnifiedSmartDevice) {
  return !!d.assignedTrailer
}

export function DevicesPage() {
  const navigate = useNavigate()
  const { trailers } = useYard()
  const {
    devices,
    historyForDevice,
    assignDeviceToTrailer,
    unassignDevice,
    setDeviceLifecycle,
    installSmartDevice,
    updateSmartDevice,
  } = useSmartYard()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const { success, error: showError } = useSnackbar()

  const [q, setQ] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [trailerFilter, setTrailerFilter] = useState('all')
  const [connFilter, setConnFilter] = useState('all')
  const [lifecycleFilter, setLifecycleFilter] = useState('all')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCapabilitiesInfo, setShowCapabilitiesInfo] = useState(false)
  const [assignDeviceId, setAssignDeviceId] = useState<string | null>(null)
  const [assignTrailerId, setAssignTrailerId] = useState('')
  const [installOpen, setInstallOpen] = useState(false)
  const [editDeviceId, setEditDeviceId] = useState<string | null>(null)
  const [installId, setInstallId] = useState('')
  const [installSerial, setInstallSerial] = useState('')
  const [installRfid, setInstallRfid] = useState('')
  const [installImei, setInstallImei] = useState('')
  const [installLocation, setInstallLocation] = useState('')
  const [installFirmware, setInstallFirmware] = useState('')
  const [installNote, setInstallNote] = useState('')
  const [installModel, setInstallModel] = useState<SmartDeviceClass>('unified')
  const [installHardwareModel, setInstallHardwareModel] = useState('')
  const [installConnectivityProfile, setInstallConnectivityProfile] = useState<
    ConnectivityProfile | ''
  >('')
  const [installCapabilities, setInstallCapabilities] = useState<
    SmartCapability[]
  >([...SMART_DEVICE_CLASS_META.unified.suggestedCapabilities])
  const [installError, setInstallError] = useState('')

  const online = devices.filter((d) => d.health === 'online').length
  const assignedInUse = devices.filter(
    (d) =>
      d.lifecycle === 'assigned' ||
      d.lifecycle === 'in_use' ||
      !!d.assignedTrailer,
  ).length
  const available = devices.filter((d) => d.lifecycle === 'available').length
  const charging = devices.filter((d) => d.lifecycle === 'charging').length
  const maintLost = devices.filter(
    (d) => d.lifecycle === 'maintenance' || d.lifecycle === 'lost',
  ).length
  const offline = devices.filter(
    (d) => d.health === 'offline' || d.connectivity === 'offline',
  ).length

  const deviceOptions = useMemo(
    () => uniqueOptions(devices.map((d) => d.id)),
    [devices],
  )
  const trailerOptions = useMemo(() => {
    const opts = [{ value: 'unassigned', label: 'Unassigned' }]
    return [
      ...opts,
      ...uniqueOptions(devices.map((d) => d.assignedTrailer)),
    ]
  }, [devices])
  const connOptions = useMemo(
    () =>
      uniqueOptions(
        ['online', 'degraded', 'offline'] as ConnStatus[],
        (v) => v,
      ),
    [],
  )
  const lifecycleOptions = useMemo(
    () =>
      uniqueOptions(
        devices.map((d) => d.lifecycle),
        (v) => LIFECYCLE_META[v as SmartLifecycle] ?? v,
      ),
    [devices],
  )

  const assignableTrailers = useMemo(() => {
    const assignedNumbers = new Set(
      devices
        .filter((d) => d.assignedTrailer)
        .map((d) => d.assignedTrailer as string),
    )
    return trailers
      .filter(
        (t) =>
          t.recordStatus === 'active' &&
          (isOnSite(t) || t.status === 'Gate arrived') &&
          !assignedNumbers.has(t.number),
      )
      .sort((a, b) => a.number.localeCompare(b.number))
  }, [trailers, devices])

  const rows = useMemo(() => {
    return devices.filter((d) => {
      const hay =
        `${d.id} ${d.assignedTrailer ?? ''} ${d.currentLocation} ${d.firmwareVersion}`.toLowerCase()
      if (q && !hay.includes(q.toLowerCase())) return false
      if (deviceFilter !== 'all' && d.id !== deviceFilter) return false
      if (trailerFilter === 'unassigned') {
        if (d.assignedTrailer) return false
      } else if (trailerFilter !== 'all' && d.assignedTrailer !== trailerFilter) {
        return false
      }
      if (connFilter !== 'all' && d.connectivity !== connFilter) return false
      if (lifecycleFilter !== 'all' && d.lifecycle !== lifecycleFilter)
        return false
      return true
    })
  }, [devices, q, deviceFilter, trailerFilter, connFilter, lifecycleFilter])

  const filterKey = `${q}|${deviceFilter}|${trailerFilter}|${connFilter}|${lifecycleFilter}`
  const pagination = usePagination(rows, 10, filterKey)

  const selectedDevice = selectedId
    ? devices.find((d) => d.id === selectedId)
    : undefined
  const selectedHistory = selectedId ? historyForDevice(selectedId) : []

  function openAssign(deviceId: string) {
    setAssignDeviceId(deviceId)
    setAssignTrailerId('')
  }

  function applyDeviceClassDefaults(deviceClass: SmartDeviceClass) {
    const meta = SMART_DEVICE_CLASS_META[deviceClass]
    setInstallModel(deviceClass)
    setInstallCapabilities([...meta.suggestedCapabilities])
  }

  function toggleInstallCapability(cap: SmartCapability) {
    setInstallCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    )
  }

  function openInstall() {
    const nextNum =
      devices.reduce((max, d) => {
        const m = /^USD-(\d+)$/.exec(d.id)
        if (!m) return max
        return Math.max(max, Number(m[1]))
      }, 1000) + 1
    setEditDeviceId(null)
    setInstallId(`USD-${nextNum}`)
    setInstallSerial('')
    setInstallRfid('')
    setInstallImei('')
    setInstallLocation('')
    setInstallFirmware('')
    setInstallNote('')
    setInstallHardwareModel('')
    setInstallConnectivityProfile('')
    applyDeviceClassDefaults('unified')
    setInstallError('')
    setInstallOpen(true)
  }

  function openEdit(d: UnifiedSmartDevice) {
    setEditDeviceId(d.id)
    setInstallId(d.id)
    setInstallSerial(d.serialNumber ?? '')
    setInstallRfid(d.rfidTagId ?? '')
    setInstallImei(d.imei ?? '')
    setInstallLocation(d.currentLocation)
    setInstallFirmware(d.firmwareVersion)
    setInstallNote(d.registerNote ?? '')
    setInstallModel(d.deviceClass)
    setInstallHardwareModel(d.hardwareModel)
    setInstallConnectivityProfile(d.connectivityProfile)
    setInstallCapabilities([...d.capabilities])
    setInstallError('')
    setInstallOpen(true)
  }

  async function handleInstall(e: FormEvent) {
    e.preventDefault()
    if (!installSerial.trim()) {
      setInstallError('Enter the hardware serial number.')
      return
    }
    if (!installHardwareModel.trim()) {
      setInstallError('Enter the device model / SKU.')
      return
    }
    if (!installConnectivityProfile) {
      setInstallError('Select a connectivity profile.')
      return
    }
    if (!installCapabilities.length) {
      setInstallError('Select at least one device capability.')
      return
    }
    if (installCapabilities.includes('rfid') && !installRfid.trim()) {
      setInstallError('Enter the on-device RFID EPC.')
      return
    }
    const payload = {
      deviceClass: installModel,
      hardwareModel: installHardwareModel,
      capabilities: installCapabilities,
      connectivityProfile: installConnectivityProfile,
      serialNumber: installSerial,
      rfidTagId: installRfid,
      imei: installImei,
      location: installLocation,
      firmwareVersion: installFirmware,
      note: installNote,
    }
    try {
      if (editDeviceId) {
        const device = await updateSmartDevice(editDeviceId, payload)
        success(`${device.id} updated.`)
        setSelectedId(device.id)
      } else {
        const device = await installSmartDevice(payload)
        success(`${device.id} registered · available in cage.`)
        setSelectedId(device.id)
      }
      setInstallOpen(false)
      setEditDeviceId(null)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : editDeviceId
            ? 'Could not update device.'
            : 'Could not register device.'
      setInstallError(message)
      showError(message)
    }
  }

  async function handleAssign() {
    if (!assignDeviceId || !assignTrailerId) return
    const trailer = trailers.find((t) => t.id === assignTrailerId)
    if (!trailer) return
    try {
      await assignDeviceToTrailer(
        assignDeviceId,
        trailer.number,
        trailer.id,
        trailer.slot ?? trailer.status,
      )
      success(`${assignDeviceId} assigned to ${trailer.number}.`)
      setAssignDeviceId(null)
      setSelectedId(assignDeviceId)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not assign device.')
    }
  }

  async function handleUnassign(d: UnifiedSmartDevice) {
    const ok = await confirm({
      title: 'Unassign device',
      message: `Return ${d.id} from ${d.assignedTrailer} to the available pool?`,
      confirmLabel: 'Unassign',
    })
    if (!ok) return
    try {
      await unassignDevice(d.id)
      success(`${d.id} unassigned.`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not unassign device.')
    }
  }

  async function handleLifecycleChange(
    d: UnifiedSmartDevice,
    lifecycle: SmartLifecycle,
  ) {
    if (lifecycle === d.lifecycle) return

    if (lifecycle === 'lost' || lifecycle === 'retired') {
      const ok = await confirm({
        title: `Mark ${LIFECYCLE_META[lifecycle]}`,
        message:
          lifecycle === 'lost'
            ? `${d.id} will be flagged lost — GPS/BLE tracking stops and assignment is blocked.`
            : `${d.id} will be retired from fleet inventory. This cannot be undone in the mock.`,
        confirmLabel: LIFECYCLE_META[lifecycle],
        tone: 'danger',
      })
      if (!ok) return
    }

    if (lifecycle === 'maintenance' && d.assignedTrailer) {
      const ok = await confirm({
        title: 'Send to maintenance',
        message: `${d.id} is on ${d.assignedTrailer}. Unassign and mark maintenance?`,
        confirmLabel: 'Maintenance',
      })
      if (!ok) return
      try {
        await unassignDevice(d.id)
      } catch {
        showError('Could not unassign before maintenance.')
        return
      }
    }

    try {
      await setDeviceLifecycle(d.id, lifecycle)
      success(`${d.id} → ${LIFECYCLE_META[lifecycle]}.`)
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Could not update lifecycle.',
      )
    }
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Unified smart trailer devices</div>
          <div className="title-with-info">
            <h1>Trailer Devices</h1>
            <button
              type="button"
              className="info-icon-btn"
              aria-label="About unified device capabilities"
              title="About unified device capabilities"
              onClick={() => setShowCapabilitiesInfo(true)}
            >
              <IconInfo size={18} />
            </button>
          </div>
          <p>
            Capability-based trailer device inventory — register by type and
            model, assign supported features automatically, and manage lifecycle
            across vendors.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowCapabilitiesInfo(true)}
          >
            Capabilities
          </button>
          <button type="button" className="btn btn-primary" onClick={openInstall}>
            Register device
          </button>
        </div>
      </div>

      <div className="panel devices-overview">
        <DeviceAssignmentWorkflow activeStep={3} />

        <div className="stats stats-6">
          <div className="stat frost">
            <div className="stat-label">Online</div>
            <div className="stat-value">{online}</div>
            <div className="stat-note">of {devices.length} devices</div>
          </div>
          <div className="stat">
            <div className="stat-label">Assigned / In use</div>
            <div className="stat-value">{assignedInUse}</div>
            <div className="stat-note">On trailers</div>
          </div>
          <div className="stat ok">
            <div className="stat-label">Available</div>
            <div className="stat-value">{available}</div>
            <div className="stat-note">Ready at gate cage</div>
          </div>
          <div className="stat warn">
            <div className="stat-label">Charging</div>
            <div className="stat-value">{charging}</div>
            <div className="stat-note">Charge bay</div>
          </div>
          <div className="stat warn">
            <div className="stat-label">Maintenance / Lost</div>
            <div className="stat-value">{maintLost}</div>
            <div className="stat-note">Ops bench · missing</div>
          </div>
          <div className="stat crit">
            <div className="stat-label">Offline</div>
            <div className="stat-value">{offline}</div>
            <div className="stat-note">Needs recovery</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search device ID, trailer, location, firmware…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="split devices-split">
        <div className="panel devices-table-panel">
          <div className="devices-table-scroll table-wrap table-wrap-filters">
          <table className="devices-table">
            <thead>
              <tr>
                <th>
                  <ColumnFilterHeader
                    label="Device ID"
                    value={deviceFilter}
                    options={deviceOptions}
                    onChange={setDeviceFilter}
                    searchable
                    searchPlaceholder="Search device…"
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
                    label="Lifecycle"
                    value={lifecycleFilter}
                    options={lifecycleOptions}
                    onChange={setLifecycleFilter}
                  />
                </th>
                <th>
                  <ColumnFilterHeader
                    label="Connectivity"
                    value={connFilter}
                    options={connOptions}
                    onChange={setConnFilter}
                  />
                </th>
                <th>
                  <PlainHeader>Battery</PlainHeader>
                </th>
                <th>
                  <PlainHeader>Actions</PlainHeader>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((d) => (
                <tr
                  key={d.id}
                  className={selectedId === d.id ? 'selected-row' : undefined}
                  onClick={() =>
                    setSelectedId((prev) => (prev === d.id ? null : d.id))
                  }
                >
                  <td>
                    <span className="trailer-id">{d.id}</span>
                  </td>
                  <td className="mono">
                    {d.assignedTrailer && d.trailerId ? (
                      <button
                        type="button"
                        className="linkish"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/trailer/${d.trailerId}`)
                        }}
                      >
                        {d.assignedTrailer}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{lifecycleBadge(d.lifecycle)}</td>
                  <td>{connBadge(d.connectivity)}</td>
                  <td className="mono">
                    <span
                      className={
                        d.batteryPct < 20 ? 'badge warn' : undefined
                      }
                    >
                      {d.batteryPct}%
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="action-icon-row">
                      <ActionIconBtn
                        label="Edit device"
                        onClick={() => openEdit(d)}
                      >
                        <IconEdit />
                      </ActionIconBtn>
                      {canAssign(d) ? (
                        <ActionIconBtn
                          label="Assign to trailer"
                          tone="ok"
                          onClick={() => openAssign(d.id)}
                        >
                          <IconAssignSlot />
                        </ActionIconBtn>
                      ) : null}
                      {canUnassign(d) ? (
                        <ActionIconBtn
                          label="Unassign device"
                          onClick={() => {
                            void handleUnassign(d)
                          }}
                        >
                          <IconDisable />
                        </ActionIconBtn>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No devices match the filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
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

        <div className="panel story-card inspector devices-inspector">
          <div className="devices-inspector-scroll">
          {selectedDevice ? (
            <>
              <div className="eyebrow">Device detail</div>
              <h2>
                {selectedDevice.id}
                {selectedDevice.assignedTrailer ? (
                  <span className="inspector-sub">
                    {' '}
                    · {selectedDevice.assignedTrailer}
                  </span>
                ) : null}
              </h2>
              <p>
                {selectedDevice.deviceType}
                {selectedDevice.hardwareModel
                  ? ` · ${selectedDevice.hardwareModel}`
                  : ''}
                <br />
                {selectedDevice.currentLocation} ·{' '}
                {selectedDevice.lastCommunication}
              </p>

              <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => openEdit(selectedDevice)}
                >
                  Edit
                </button>
                {selectedDevice.assignedTrailer && selectedDevice.trailerId ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        navigate(`/trailer/${selectedDevice.trailerId}`)
                      }
                    >
                      Open trailer
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        void handleUnassign(selectedDevice)
                      }}
                    >
                      Unassign
                    </button>
                  </>
                ) : canAssign(selectedDevice) ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openAssign(selectedDevice.id)}
                  >
                    Assign to trailer
                  </button>
                ) : null}
              </div>

              <div className="btn-row smart-lifecycle">
                {LIFECYCLE_ACTIONS.map((lc) => (
                  <button
                    key={lc}
                    type="button"
                    className={`btn btn-ghost ${selectedDevice.lifecycle === lc ? 'btn-primary' : ''}`}
                    disabled={selectedDevice.lifecycle === lc}
                    onClick={() => {
                      void handleLifecycleChange(selectedDevice, lc)
                    }}
                  >
                    {LIFECYCLE_META[lc]}
                  </button>
                ))}
              </div>

              <div className="kv compact">
                <div className="kv-item" style={{ gridColumn: '1 / -1' }}>
                  <label>Capabilities</label>
                  <strong>{capabilityChecklist(selectedDevice.capabilities)}</strong>
                </div>
                <div className="kv-item">
                  <label>Lifecycle</label>
                  <strong>{lifecycleBadge(selectedDevice.lifecycle)}</strong>
                </div>
                <div className="kv-item">
                  <label>Link health</label>
                  <strong>{connBadge(selectedDevice.connectivity)}</strong>
                </div>
                <div className="kv-item">
                  <label>Connectivity</label>
                  <strong>
                    {
                      CONNECTIVITY_PROFILE_META[
                        selectedDevice.connectivityProfile
                      ].label
                    }
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Device type</label>
                  <strong>{selectedDevice.deviceType}</strong>
                </div>
                <div className="kv-item">
                  <label>Device model</label>
                  <strong className="mono">{selectedDevice.hardwareModel}</strong>
                </div>
                {selectedDevice.serialNumber ? (
                  <div className="kv-item">
                    <label>Serial</label>
                    <strong className="mono">
                      {selectedDevice.serialNumber}
                    </strong>
                  </div>
                ) : null}
                {selectedDevice.capabilities.includes('rfid') &&
                selectedDevice.rfidTagId ? (
                  <div className="kv-item">
                    <label>RFID EPC</label>
                    <strong className="mono">{selectedDevice.rfidTagId}</strong>
                  </div>
                ) : null}
                {selectedDevice.capabilities.includes('lte') &&
                selectedDevice.imei ? (
                  <div className="kv-item">
                    <label>IMEI</label>
                    <strong className="mono">{selectedDevice.imei}</strong>
                  </div>
                ) : null}
                <div className="kv-item">
                  <label>Battery</label>
                  <strong>{selectedDevice.batteryPct}%</strong>
                </div>
                <div className="kv-item">
                  <label>Health score</label>
                  <strong>
                    <span
                      className={`badge ${healthScoreTone(selectedDevice.healthScore)}`}
                    >
                      {selectedDevice.healthScore}
                    </span>
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Charge cycles</label>
                  <strong>{selectedDevice.chargingCycles}</strong>
                </div>
                <div className="kv-item">
                  <label>Firmware</label>
                  <strong className="mono">
                    {selectedDevice.firmwareVersion}
                  </strong>
                </div>
                {selectedDevice.capabilities.includes('gps') ? (
                  <div className="kv-item">
                    <label>GPS</label>
                    <strong>{sensorBadge(selectedDevice.gpsStatus)}</strong>
                  </div>
                ) : null}
                {selectedDevice.capabilities.includes('ble') ? (
                  <div className="kv-item">
                    <label>BLE</label>
                    <strong>{sensorBadge(selectedDevice.bleStatus)}</strong>
                  </div>
                ) : null}
                {selectedDevice.capabilities.includes('rfid') ? (
                  <div className="kv-item">
                    <label>RFID</label>
                    <strong>{sensorBadge(selectedDevice.rfidStatus)}</strong>
                  </div>
                ) : null}
                {selectedDevice.capabilities.includes('temperature') ? (
                  <div className="kv-item">
                    <label>Temp sensor</label>
                    <strong>
                      {sensorBadge(selectedDevice.temperatureSensorStatus)}
                    </strong>
                  </div>
                ) : null}
                {selectedDevice.capabilities.includes('fuel') ? (
                  <div className="kv-item">
                    <label>Fuel sensor</label>
                    <strong>
                      {sensorBadge(selectedDevice.fuelSensorStatus)}
                    </strong>
                  </div>
                ) : null}
                {selectedDevice.registerNote ? (
                  <div className="kv-item" style={{ gridColumn: '1 / -1' }}>
                    <label>Register note</label>
                    <strong>{selectedDevice.registerNote}</strong>
                  </div>
                ) : null}
              </div>

              <div className="panel-head">
                <h2>Assignment & maintenance history</h2>
                <span className="panel-meta">{selectedHistory.length} events</span>
              </div>
              <div className="list">
                {selectedHistory.length ? (
                  selectedHistory.map((ev) => (
                    <div key={ev.id} className="list-item gate-await-item">
                      <div className="gate-await-main">
                        <span
                          className={`trail ${
                            ev.type === 'maintenance'
                              ? 'warn'
                              : ev.type === 'assign' || ev.type === 'charge'
                                ? 'critical'
                                : 'offline'
                          }`}
                        />
                        <div>
                          <div className="trailer-id">{ev.time}</div>
                          <div className="trailer-meta">{ev.detail}</div>
                        </div>
                      </div>
                      <span className="badge offline">{ev.type}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty" style={{ padding: '1rem' }}>
                    No history for this device yet.
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="eyebrow">Inspector</div>
              <h2>Select a device</h2>
              <p>
                Click a row to view sensors, firmware, assignment history, and
                lifecycle actions.
              </p>
            </>
          )}
          </div>
        </div>
      </div>

      {installOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setInstallOpen(false)
            setEditDeviceId(null)
          }}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-device-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Inventory</div>
                <h2 id="install-device-title">
                  {editDeviceId ? 'Edit device' : 'Register device'}
                </h2>
              </div>
              <ModalCloseBtn
                onClick={() => {
                  setInstallOpen(false)
                  setEditDeviceId(null)
                }}
              />
            </div>
            <form className="modal-form" onSubmit={handleInstall}>
              <div className="modal-body">
                <p className="trailer-meta" style={{ marginTop: 0 }}>
                  {editDeviceId
                    ? 'Update type, model, connectivity, capabilities, and identity. Features follow capabilities — not device type.'
                    : 'Capture type (classification), model, serial, firmware, connectivity, and capabilities. New units stay Available until assigned at gate.'}
                </p>
                {installError ? (
                  <div className="form-error">{installError}</div>
                ) : null}
                <div className="device-id-label">
                  <span className="trailer-meta">Device ID</span>
                  <strong className="mono">{installId}</strong>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Device type</span>
                    <select
                      className="select"
                      value={installModel}
                      onChange={(e) =>
                        applyDeviceClassDefaults(
                          e.target.value as SmartDeviceClass,
                        )
                      }
                      autoFocus
                    >
                      {SMART_DEVICE_CLASSES.map((m) => (
                        <option key={m} value={m}>
                          {SMART_DEVICE_CLASS_META[m].label}
                        </option>
                      ))}
                    </select>
                    <span className="trailer-meta" style={{ marginTop: '0.35rem' }}>
                      {SMART_DEVICE_CLASS_META[installModel].description}. Type
                      is for inventory only — toggle capabilities below.
                    </span>
                  </label>
                  <label className="field">
                    <span>Device model</span>
                    <input
                      className="search"
                      value={installHardwareModel}
                      onChange={(e) => setInstallHardwareModel(e.target.value)}
                      placeholder="e.g. BH-USD-X1"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Hardware serial</span>
                    <input
                      className="search"
                      value={installSerial}
                      onChange={(e) => setInstallSerial(e.target.value)}
                      placeholder="Enter serial number"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Firmware version</span>
                    <input
                      className="search"
                      value={installFirmware}
                      onChange={(e) => setInstallFirmware(e.target.value)}
                      placeholder="e.g. 3.4.2"
                    />
                  </label>
                  <label className="field">
                    <span>Connectivity</span>
                    <select
                      className="select"
                      value={installConnectivityProfile}
                      onChange={(e) =>
                        setInstallConnectivityProfile(
                          e.target.value as ConnectivityProfile | '',
                        )
                      }
                      required
                    >
                      <option value="">Select connectivity…</option>
                      {CONNECTIVITY_PROFILES.map((p) => (
                        <option key={p} value={p}>
                          {CONNECTIVITY_PROFILE_META[p].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Device capabilities</span>
                    <div className="capability-picker">
                      {ALL_SMART_CAPABILITIES.map((cap) => {
                        const checked = installCapabilities.includes(cap)
                        return (
                          <label key={cap} className="capability-option">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleInstallCapability(cap)}
                            />
                            <span>
                              <strong>{CAPABILITY_META[cap].label}</strong>
                              <span className="trailer-meta">
                                {CAPABILITY_META[cap].feature}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  {installCapabilities.includes('rfid') ? (
                    <label className="field">
                      <span>On-device RFID EPC</span>
                      <input
                        className="search"
                        value={installRfid}
                        onChange={(e) => setInstallRfid(e.target.value)}
                        placeholder="E280…"
                        required
                      />
                    </label>
                  ) : null}
                  {installCapabilities.includes('lte') ? (
                    <label className="field">
                      <span>LTE modem IMEI</span>
                      <input
                        className="search"
                        value={installImei}
                        onChange={(e) => setInstallImei(e.target.value)}
                        placeholder="Enter IMEI"
                      />
                    </label>
                  ) : null}
                  <label className="field">
                    <span>Cage location</span>
                    <input
                      className="search"
                      value={installLocation}
                      onChange={(e) => setInstallLocation(e.target.value)}
                      placeholder="e.g. Device cage · Gate"
                    />
                  </label>
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Notes</span>
                    <input
                      className="search"
                      value={installNote}
                      onChange={(e) => setInstallNote(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setInstallOpen(false)
                    setEditDeviceId(null)
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editDeviceId ? 'Save changes' : 'Register device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {assignDeviceId ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setAssignDeviceId(null)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Assignment</div>
                <h2>Assign {assignDeviceId}</h2>
              </div>
              <ModalCloseBtn onClick={() => setAssignDeviceId(null)} />
            </div>
            <div className="modal-body">
              <p className="role-info-lead">
                Pick an on-site or gate-waiting trailer. Platform features enable
                from this device&apos;s capabilities on assignment.
              </p>
              <label className="field">
                <span>Trailer</span>
                <select
                  className="select"
                  value={assignTrailerId}
                  onChange={(e) => setAssignTrailerId(e.target.value)}
                  autoFocus
                >
                  <option value="">Select trailer…</option>
                  {assignableTrailers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.number} · {t.status}
                      {t.slot ? ` · ${t.slot}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {!assignableTrailers.length ? (
                <div className="form-error">
                  No on-site trailers available without a device.
                </div>
              ) : null}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAssignDeviceId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!assignTrailerId}
                onClick={() => {
                  void handleAssign()
                }}
              >
                Assign device
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCapabilitiesInfo ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowCapabilitiesInfo(false)}
        >
          <div
            className="modal-panel role-info-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unified-device-info-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Reference</div>
                <h2 id="unified-device-info-title">Device capabilities</h2>
              </div>
              <ModalCloseBtn onClick={() => setShowCapabilitiesInfo(false)} />
            </div>
            <div className="modal-body">
              <p className="role-info-lead">
                Capabilities drive Smart Yard features independently of device
                type. Type is inventory classification; each unit can mix RFID,
                GPS, BLE, temperature, fuel, and LTE/5G based on hardware.
              </p>
              <div className="role-info-list">
                {UNIFIED_CAPABILITIES.map((cap) => (
                  <article key={cap.key} className="role-info-item">
                    <div className="role-info-item-head">
                      <span className="badge ok">{cap.label}</span>
                    </div>
                    <p>{cap.description}</p>
                    <ul className="perm-list">
                      {cap.uses.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCapabilitiesInfo(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </div>
  )
}
