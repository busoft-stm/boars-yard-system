import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  INFRA_ALERT_META,
  INFRA_AUTO_MOVEMENT_META,
  INFRA_KIND_META,
  INFRA_OPS_STATUS_META,
  type InfraAlert,
  type InfraAutoMovementType,
  type InfraKind,
  type InfraOpsStatus,
  type YardInfraAsset,
} from '../data/smartEnterprise'
import { useSmartYard } from '../smart/SmartYardContext'
import { OpsKpiCard } from '../components/OpsKpiCard'
import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { Pagination, usePagination } from '../components/Pagination'
import { ModalCloseBtn, ActionIconBtn, IconEdit, IconDisable, IconEnable } from '../components/ActionIcons'
import { MaterialIcon } from '../components/MaterialIcon'
import { useSnackbar } from '../components/Snackbar'

const INFRA_KINDS = Object.keys(INFRA_KIND_META) as InfraKind[]
const INFRA_STATUSES = Object.keys(INFRA_OPS_STATUS_META) as InfraOpsStatus[]
const ZONE_OPTIONS = ['Gate', 'A', 'B', 'C', 'D', 'Dock'] as const

const KIND_DOT_COLOR: Record<InfraKind, string> = {
  rfid_reader: 'var(--brand)',
  ble_anchor: 'var(--ok)',
  edge_gateway: '#2b6cb0',
  iot_gateway: '#0ea5e9',
  gate_reader: 'var(--warn)',
  dock_sensor: '#6b4c9a',
  gps_coverage: '#0d9488',
}

type InfraV2Tab = 'map' | 'inventory' | 'movements' | 'alerts'

const AUTOMATION_CARDS: {
  kind: InfraKind | 'gps_coverage'
  title: string
  lines: string[]
}[] = [
  {
    kind: 'rfid_reader',
    title: 'RFID Reader',
    lines: ['Detect Gate Entry and Exit', 'Create Gate Arrival events'],
  },
  {
    kind: 'ble_anchor',
    title: 'BLE Anchor',
    lines: ['Detect Trailer Proximity', 'Recommend Parking Slot'],
  },
  {
    kind: 'gps_coverage',
    title: 'GPS Geofence',
    lines: ['Detect Yard Entry/Exit', 'Track Yard Movement'],
  },
  {
    kind: 'dock_sensor',
    title: 'Dock Sensor',
    lines: ['Detect Dock Occupancy', 'Detect Trailer Arrival and Departure'],
  },
  {
    kind: 'iot_gateway',
    title: 'IoT Gateway',
    lines: [
      'Receive Trailer Device Telemetry',
      'Forward Data to Smart Yard Platform',
    ],
  },
]

function statusBadgeClass(status: InfraOpsStatus) {
  if (status === 'online') return 'ok'
  if (status === 'degraded' || status === 'maintenance') return 'warn'
  return 'offline'
}

function healthBand(score: number): 'ok' | 'warn' | 'critical' {
  if (score >= 80) return 'ok'
  if (score >= 55) return 'warn'
  return 'critical'
}

function connBadge(c: YardInfraAsset['connectivity']) {
  if (c === 'online') return 'ok'
  if (c === 'degraded') return 'warn'
  return 'offline'
}

function locationBucket(zone: string) {
  if (zone === 'Gate') return 'Gate'
  if (zone === 'Dock') return 'Dock'
  return `Yard Zone ${zone}`
}

export function YardInfrastructureV2Page() {
  const navigate = useNavigate()
  const {
    infra,
    infraMovements,
    infraAlerts,
    infraOpsKpis: k,
    updateInfraDevice,
    setInfraEnabled,
    setInfraMaintenance,
    acknowledgeInfraAlert,
    resolveInfraAlert,
    installInfraDevice,
  } = useSmartYard()
  const { success, error: showError } = useSnackbar()

  const [tab, setTab] = useState<InfraV2Tab>('inventory')
  const [kindFilter, setKindFilter] = useState('all')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [connFilter, setConnFilter] = useState('all')
  const [healthFilter, setHealthFilter] = useState('all')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(
    () => infra[0]?.id ?? null,
  )

  function selectDevice(id: string, focus: InfraV2Tab = 'map') {
    setSelectedId(id)
    setTab(focus)
  }
  const [editOpen, setEditOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editFirmware, setEditFirmware] = useState('')
  const [editNote, setEditNote] = useState('')
  const [instName, setInstName] = useState('')
  const [instKind, setInstKind] = useState<InfraKind>('rfid_reader')
  const [instZone, setInstZone] = useState('A')
  const [instLocation, setInstLocation] = useState('')
  const [instStatus, setInstStatus] = useState<InfraOpsStatus>('online')
  const [instCoverage, setInstCoverage] = useState('')
  const [instFirmware, setInstFirmware] = useState('')
  const [instSerial, setInstSerial] = useState('')
  const [instNote, setInstNote] = useState('')

  const filteredInfra = useMemo(() => {
    return infra.filter((i) => {
      const hay = `${i.id} ${i.name} ${i.zone} ${i.location} ${i.note}`.toLowerCase()
      if (q && !hay.includes(q.toLowerCase())) return false
      if (kindFilter !== 'all' && i.kind !== kindFilter) return false
      if (zoneFilter !== 'all' && i.zone !== zoneFilter) return false
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (connFilter !== 'all' && i.connectivity !== connFilter) return false
      if (healthFilter === 'ok' && (i.healthScore ?? 0) < 80) return false
      if (
        healthFilter === 'warn' &&
        ((i.healthScore ?? 0) < 55 || (i.healthScore ?? 0) >= 80)
      )
        return false
      if (healthFilter === 'critical' && (i.healthScore ?? 0) >= 55) return false
      return true
    })
  }, [
    infra,
    q,
    kindFilter,
    zoneFilter,
    statusFilter,
    connFilter,
    healthFilter,
  ])

  const selected = useMemo(
    () => infra.find((i) => i.id === selectedId) ?? filteredInfra[0] ?? null,
    [infra, selectedId, filteredInfra],
  )

  const movementRows = useMemo(() => {
    return infraMovements.filter((m) => {
      if (eventTypeFilter !== 'all' && m.type !== eventTypeFilter) return false
      if (zoneFilter !== 'all' && m.zone !== zoneFilter) return false
      if (kindFilter !== 'all') {
        const device = infra.find((i) => i.id === m.infraDeviceId)
        if (!device || device.kind !== kindFilter) return false
      }
      return true
    })
  }, [infraMovements, eventTypeFilter, zoneFilter, kindFilter, infra])

  const alertRows = useMemo(() => {
    return infraAlerts.filter((a) => {
      if (statusFilter === 'online' && a.status !== 'open') return false
      return true
    })
  }, [infraAlerts, statusFilter])

  const tableKey = `${q}|${kindFilter}|${zoneFilter}|${statusFilter}|${connFilter}|${healthFilter}`
  const pagination = usePagination(filteredInfra, 8, tableKey)
  const moveKey = `${eventTypeFilter}|${zoneFilter}|${kindFilter}`
  const movePage = usePagination(movementRows, 8, moveKey)

  const kindOptions = useMemo(
    () =>
      uniqueOptions(
        infra.map((i) => i.kind),
        (v) => INFRA_KIND_META[v as InfraKind] ?? v,
      ),
    [infra],
  )
  const zoneOptions = useMemo(
    () => uniqueOptions(infra.map((i) => i.zone)),
    [infra],
  )
  const statusOptions = useMemo(
    () =>
      uniqueOptions(
        infra.map((i) => i.status),
        (v) => INFRA_OPS_STATUS_META[v as InfraOpsStatus] ?? v,
      ),
    [infra],
  )
  const connOptions = useMemo(
    () => uniqueOptions(infra.map((i) => i.connectivity)),
    [infra],
  )
  const eventOptions = useMemo(
    () =>
      uniqueOptions(
        infraMovements.map((m) => m.type),
        (v) => INFRA_AUTO_MOVEMENT_META[v as InfraAutoMovementType] ?? v,
      ),
    [infraMovements],
  )

  function openEdit(asset: YardInfraAsset) {
    setSelectedId(asset.id)
    setEditName(asset.name)
    setEditLocation(asset.location)
    setEditFirmware(asset.firmwareVersion ?? '')
    setEditNote(asset.note)
    setFormError('')
    setEditOpen(true)
  }

  const activeAlertCount = alertRows.filter((a) => a.status !== 'resolved').length

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (!editName.trim()) {
      setFormError('Name is required.')
      return
    }
    try {
      await updateInfraDevice(selected.id, {
        name: editName.trim(),
        location: editLocation.trim() || selected.location,
        firmwareVersion: editFirmware.trim() || selected.firmwareVersion,
        note: editNote.trim(),
      })
      success(`Updated ${editName.trim()}.`)
      setEditOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed.'
      setFormError(msg)
      showError(msg)
    }
  }

  async function handleInstall(e: FormEvent) {
    e.preventDefault()
    if (!instName.trim()) {
      setFormError('Enter a device name.')
      return
    }
    if (!instLocation.trim()) {
      setFormError('Enter a location.')
      return
    }
    const coverageNum = instCoverage.trim() ? Number(instCoverage) : undefined
    if (
      instCoverage.trim() &&
      (coverageNum === undefined ||
        !Number.isFinite(coverageNum) ||
        coverageNum <= 0)
    ) {
      setFormError('Coverage/range must be a positive number.')
      return
    }
    try {
      const asset = await installInfraDevice({
        name: instName,
        kind: instKind,
        zone: instZone,
        location: instLocation,
        status: instStatus,
        coverageRadius: coverageNum,
        firmwareVersion: instFirmware,
        serialNumber: instSerial,
        note: instNote,
      })
      success(`Installed ${asset.name}.`)
      setSelectedId(asset.id)
      setTab('map')
      setInstallOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Install failed.'
      setFormError(msg)
      showError(msg)
    }
  }

  return (
    <div className="page-enter infra-v2">
      <div className="page-head">
        <div>
          <div className="eyebrow">Automation layer · Operations Center</div>
          <h1>Yard Infrastructure V2</h1>
          <p>
            Yard Infrastructure acts as the automation layer of the Smart Yard
            platform. By continuously monitoring RFID readers, BLE anchors,
            dock sensors, GPS coverage nodes, and edge gateways, it automatically
            detects trailer movements, infrastructure events, and operational
            changes, providing real-time visibility and reducing manual
            intervention across Gate, Yard, and Dock operations.
          </p>
        </div>
        <div className="btn-row">
          <div className="meta-chip">
            {k.online}/{k.total} online · health {k.healthPct}%
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormError('')
              setInstName('')
              setInstKind('rfid_reader')
              setInstZone('A')
              setInstLocation('')
              setInstStatus('online')
              setInstCoverage('')
              setInstFirmware('')
              setInstSerial('')
              setInstNote('')
              setInstallOpen(true)
            }}
          >
            Install device
          </button>
        </div>
      </div>

      <div className="ops-kpi-grid ops-kpi-grid-coverage" style={{ marginBottom: '1rem' }}>
        <OpsKpiCard label="Total devices" value={k.total} note="Fixed infrastructure" />
        <OpsKpiCard label="Online" value={k.online} note="Enabled & online" />
        <OpsKpiCard
          label="Offline"
          value={k.offline}
          note="Needs attention"
          alert={k.offline > 0}
        />
        <OpsKpiCard
          label="Maintenance"
          value={k.maintenance}
          note="In service window"
          alert={k.maintenance > 0}
        />
        <OpsKpiCard
          label="Infrastructure health"
          value={`${k.healthPct}%`}
          note="Fleet average score"
          alert={k.healthPct < 70}
        />
        <OpsKpiCard
          label="Auto events today"
          value={k.autoEventsToday}
          note="Detected by site devices"
        />
      </div>

      <div className="panel infra-v2-filters">
        <div className="toolbar" style={{ margin: 0, flexWrap: 'wrap', gap: '0.65rem' }}>
          <input
            className="search"
            placeholder="Search device ID, name, zone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: '14rem', flex: '1 1 14rem' }}
          />
          <label className="field" style={{ margin: 0, minWidth: '9rem' }}>
            <span className="sr-only">Device type</span>
            <select
              className="select select-compact"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
            >
              <option value="all">All types</option>
              {kindOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ margin: 0, minWidth: '7rem' }}>
            <span className="sr-only">Zone</span>
            <select
              className="select select-compact"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
            >
              <option value="all">All zones</option>
              {zoneOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ margin: 0, minWidth: '8rem' }}>
            <span className="sr-only">Status</span>
            <select
              className="select select-compact"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ margin: 0, minWidth: '8rem' }}>
            <span className="sr-only">Connectivity</span>
            <select
              className="select select-compact"
              value={connFilter}
              onChange={(e) => setConnFilter(e.target.value)}
            >
              <option value="all">All connectivity</option>
              {connOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ margin: 0, minWidth: '8rem' }}>
            <span className="sr-only">Health</span>
            <select
              className="select select-compact"
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
            >
              <option value="all">All health</option>
              <option value="ok">Healthy ≥80</option>
              <option value="warn">Watch 55–79</option>
              <option value="critical">Critical &lt;55</option>
            </select>
          </label>
          <label className="field" style={{ margin: 0, minWidth: '11rem' }}>
            <span className="sr-only">Event type</span>
            <select
              className="select select-compact"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="all">All auto events</option>
              {eventOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div
        className="page-tabs"
        role="tablist"
        aria-label="Infrastructure views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inventory'}
          className={`page-tab ${tab === 'inventory' ? 'active' : ''}`}
          onClick={() => setTab('inventory')}
        >
          Device inventory
          <em>{filteredInfra.length}</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'map'}
          className={`page-tab ${tab === 'map' ? 'active' : ''}`}
          onClick={() => setTab('map')}
        >
          Infrastructure map
          <em>{filteredInfra.length}</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'movements'}
          className={`page-tab ${tab === 'movements' ? 'active' : ''}`}
          onClick={() => setTab('movements')}
        >
          Trailer movements
          <em>{movementRows.length}</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'alerts'}
          className={`page-tab ${tab === 'alerts' ? 'active' : ''}`}
          onClick={() => setTab('alerts')}
        >
          Infrastructure alerts
          <em>{activeAlertCount}</em>
        </button>
      </div>

      {tab === 'map' ? (
      <div className="infra-v2-map-grid">
        <section className="panel map-panel devices-map-panel">
          <div className="panel-head">
            <h2>Infrastructure map</h2>
            <span className="trailer-meta">
              {filteredInfra.length} devices · select to show coverage
            </span>
          </div>
          <div className="devices-map-canvas infra-v2-map-canvas">
            <div className="devices-map-yard" aria-hidden />
            <span className="devices-map-label" style={{ left: '7%', top: '4%' }}>
              Gate
            </span>
            <span
              className="devices-map-label"
              style={{ right: '8%', top: '38%' }}
            >
              Dock
            </span>
            {selected ? (
              <span
                className="infra-v2-coverage"
                style={{
                  left: `${selected.x}%`,
                  top: `${selected.y}%`,
                  width: `${(selected.coverageRadius ?? 8) * 2}%`,
                  height: `${(selected.coverageRadius ?? 8) * 2}%`,
                  borderColor: KIND_DOT_COLOR[selected.kind],
                  background: `${KIND_DOT_COLOR[selected.kind]}22`,
                }}
                aria-hidden
              />
            ) : null}
            {filteredInfra.map((asset) => {
              const active = selected?.id === asset.id
              const hs = asset.healthScore ?? 0
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`devices-map-dot infra-v2-dot${active ? ' active' : ''}${
                    asset.status === 'offline' || asset.status === 'disabled'
                      ? ' offline'
                      : ''
                  }`}
                  style={{
                    left: `${asset.x}%`,
                    top: `${asset.y}%`,
                    background: KIND_DOT_COLOR[asset.kind],
                    boxShadow: active
                      ? `0 0 0 3px ${KIND_DOT_COLOR[asset.kind]}55`
                      : undefined,
                  }}
                  title={`${asset.name} · ${asset.status} · health ${hs}% · ${asset.lastSeen}`}
                  aria-label={asset.name}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <i
                    className={`infra-v2-dot-health ${healthBand(hs)}`}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
          <div className="devices-map-legend" aria-label="Asset kind legend">
            {(
              [
                'rfid_reader',
                'gate_reader',
                'ble_anchor',
                'iot_gateway',
                'edge_gateway',
                'dock_sensor',
                'gps_coverage',
              ] as InfraKind[]
            ).map((knd) => (
              <span key={knd}>
                <i style={{ background: KIND_DOT_COLOR[knd] }} />
                {INFRA_KIND_META[knd]}
              </span>
            ))}
          </div>
        </section>

        <aside className="panel infra-v2-detail">
          <div className="panel-head">
            <h2>Device details</h2>
            <span className="trailer-meta">
              {selected ? selected.id : 'Select a device'}
            </span>
          </div>
          {selected ? (
            <div className="infra-v2-detail-body">
              <div className="eyebrow">General information</div>
              <div className="kv compact">
                <div className="kv-item">
                  <label>Device name</label>
                  <strong>{selected.name}</strong>
                </div>
                <div className="kv-item">
                  <label>Device type</label>
                  <strong>{INFRA_KIND_META[selected.kind]}</strong>
                </div>
                <div className="kv-item">
                  <label>Model</label>
                  <strong>{selected.model ?? '—'}</strong>
                </div>
                <div className="kv-item">
                  <label>Serial number</label>
                  <strong className="mono">{selected.serialNumber ?? '—'}</strong>
                </div>
                <div className="kv-item">
                  <label>Firmware</label>
                  <strong>{selected.firmwareVersion ?? '—'}</strong>
                </div>
              </div>

              <div className="eyebrow">Location</div>
              <div className="kv compact">
                <div className="kv-item">
                  <label>Area</label>
                  <strong>{locationBucket(selected.zone)}</strong>
                </div>
                <div className="kv-item">
                  <label>Zone</label>
                  <strong className="mono">{selected.zone}</strong>
                </div>
                <div className="kv-item">
                  <label>Location</label>
                  <strong>{selected.location}</strong>
                </div>
                <div className="kv-item">
                  <label>GPS coordinates</label>
                  <strong className="mono">
                    {selected.lat?.toFixed(5)}, {selected.lng?.toFixed(5)}
                  </strong>
                </div>
              </div>

              <div className="eyebrow">Health</div>
              <div className="kv compact">
                <div className="kv-item">
                  <label>Online status</label>
                  <strong>
                    <span className={`badge ${statusBadgeClass(selected.status)}`}>
                      {INFRA_OPS_STATUS_META[selected.status]}
                    </span>
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Connectivity</label>
                  <strong>
                    <span className={`badge ${connBadge(selected.connectivity)}`}>
                      {selected.connectivity}
                    </span>
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Signal strength</label>
                  <strong>{selected.signalStrength ?? '—'}%</strong>
                </div>
                <div className="kv-item">
                  <label>Health score</label>
                  <strong>
                    <span
                      className={`badge ${healthBand(selected.healthScore ?? 0)}`}
                    >
                      {selected.healthScore ?? '—'}
                    </span>
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Last communication</label>
                  <strong>{selected.lastSeen}</strong>
                </div>
                <div className="kv-item">
                  <label>Uptime</label>
                  <strong>{selected.uptimeHours ?? 0}h</strong>
                </div>
              </div>

              <div className="eyebrow">Maintenance</div>
              <div className="kv compact">
                <div className="kv-item">
                  <label>Last service</label>
                  <strong>{selected.lastServiceDate ?? '—'}</strong>
                </div>
                <div className="kv-item">
                  <label>Next scheduled</label>
                  <strong>{selected.nextServiceDate ?? '—'}</strong>
                </div>
              </div>
              <ul className="perm-list" style={{ marginTop: '0.35rem' }}>
                {(selected.maintenanceHistory ?? []).slice(0, 3).map((h) => (
                  <li key={`${h.date}-${h.detail}`}>
                    <strong>{h.date}</strong> — {h.detail}
                  </li>
                ))}
              </ul>

              <div className="btn-row" style={{ marginTop: '0.85rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => openEdit(selected)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    void (async () => {
                      try {
                        const next = !(selected.enabled !== false)
                        await setInfraEnabled(selected.id, next)
                        success(
                          next
                            ? `${selected.name} enabled`
                            : `${selected.name} disabled`,
                        )
                      } catch (err) {
                        showError(
                          err instanceof Error ? err.message : 'Update failed.',
                        )
                      }
                    })()
                  }}
                >
                  {selected.enabled !== false ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    void (async () => {
                      try {
                        await setInfraMaintenance(selected.id)
                        success(`${selected.name} · maintenance`)
                      } catch (err) {
                        showError(
                          err instanceof Error ? err.message : 'Update failed.',
                        )
                      }
                    })()
                  }}
                >
                  Maintenance
                </button>
              </div>
            </div>
          ) : (
            <p className="trailer-meta" style={{ padding: '1rem 1.15rem' }}>
              Select a map marker or inventory row.
            </p>
          )}
        </aside>
      </div>
      ) : null}

      {tab === 'inventory' ? (
      <section className="panel table-wrap table-wrap-filters">
        <div className="panel-head">
          <h2>Infrastructure device inventory</h2>
          <span className="trailer-meta">{filteredInfra.length} shown</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>
                <PlainHeader>Device ID</PlainHeader>
              </th>
              <th>
                <PlainHeader>Device name</PlainHeader>
              </th>
              <th>
                <ColumnFilterHeader
                  label="Type"
                  value={kindFilter}
                  options={kindOptions}
                  onChange={setKindFilter}
                />
              </th>
              <th>
                <PlainHeader>Location</PlainHeader>
              </th>
              <th>
                <ColumnFilterHeader
                  label="Zone"
                  value={zoneFilter}
                  options={zoneOptions}
                  onChange={setZoneFilter}
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
              <th>
                <PlainHeader>Connectivity</PlainHeader>
              </th>
              <th>
                <PlainHeader>Health</PlainHeader>
              </th>
              <th>
                <PlainHeader>Firmware</PlainHeader>
              </th>
              <th>
                <PlainHeader>Last comm</PlainHeader>
              </th>
              <th>
                <PlainHeader>Actions</PlainHeader>
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map((i) => (
              <tr
                key={i.id}
                style={{
                  cursor: 'pointer',
                  background:
                    selected?.id === i.id
                      ? 'rgba(166, 25, 46, 0.06)'
                      : undefined,
                }}
                onClick={() => selectDevice(i.id)}
              >
                <td className="mono">{i.id}</td>
                <td className="trailer-id">{i.name}</td>
                <td className="trailer-meta">{INFRA_KIND_META[i.kind]}</td>
                <td className="trailer-meta">{i.location}</td>
                <td className="mono">{i.zone}</td>
                <td>
                  <span className={`badge ${statusBadgeClass(i.status)}`}>
                    {INFRA_OPS_STATUS_META[i.status]}
                  </span>
                </td>
                <td>
                  <span className={`badge ${connBadge(i.connectivity)}`}>
                    {i.connectivity}
                  </span>
                </td>
                <td>
                  <span className={`badge ${healthBand(i.healthScore ?? 0)}`}>
                    {i.healthScore ?? '—'}
                  </span>
                </td>
                <td className="trailer-meta">{i.firmwareVersion ?? '—'}</td>
                <td className="trailer-meta">{i.lastSeen}</td>
                <td>
                  <div
                    className="action-icon-row"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActionIconBtn
                      label="View details"
                      onClick={() => selectDevice(i.id)}
                    >
                      <MaterialIcon name="visibility" size={18} />
                    </ActionIconBtn>
                    <ActionIconBtn
                      label="Edit device"
                      onClick={() => openEdit(i)}
                    >
                      <IconEdit />
                    </ActionIconBtn>
                    <ActionIconBtn
                      label={
                        i.enabled !== false ? 'Disable device' : 'Enable device'
                      }
                      onClick={() => {
                        void setInfraEnabled(i.id, !(i.enabled !== false)).then(
                          (a) =>
                            success(
                              a.enabled !== false
                                ? `${a.name} enabled`
                                : `${a.name} disabled`,
                            ),
                        )
                      }}
                    >
                      {i.enabled !== false ? <IconDisable /> : <IconEnable />}
                    </ActionIconBtn>
                    <ActionIconBtn
                      label="Mark maintenance"
                      onClick={() => {
                        void setInfraMaintenance(i.id).then((a) =>
                          success(`${a.name} · maintenance`),
                        )
                      }}
                    >
                      <MaterialIcon name="build" size={18} />
                    </ActionIconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredInfra.length ? (
              <tr>
                <td colSpan={11} className="empty">
                  No devices match the filters.
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
      </section>
      ) : null}

      {tab === 'movements' ? (
        <section className="panel table-wrap">
          <div className="panel-head">
            <h2>Trailer movements</h2>
            <span className="trailer-meta">
              Detected by infrastructure · not entered manually
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Trailer</th>
                <th>Infrastructure device</th>
                <th>Zone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {movePage.paginatedItems.map((m) => (
                <tr key={m.id}>
                  <td className="trailer-meta">{m.time}</td>
                  <td>
                    <div className="trailer-cell">
                      <span className="trailer-id">{m.event}</span>
                      <span className="trailer-meta">
                        {INFRA_AUTO_MOVEMENT_META[m.type]}
                      </span>
                    </div>
                  </td>
                  <td>
                    {m.trailerId ? (
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => navigate(`/trailer/${m.trailerId}`)}
                      >
                        {m.trailerNumber}
                      </button>
                    ) : (
                      m.trailerNumber
                    )}
                  </td>
                  <td className="trailer-meta">
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => selectDevice(m.infraDeviceId)}
                    >
                      {m.infraDeviceName}
                    </button>
                  </td>
                  <td className="mono">{m.zone}</td>
                  <td>
                    <span
                      className={`badge ${
                        m.status === 'confirmed'
                          ? 'ok'
                          : m.status === 'cleared'
                            ? 'offline'
                            : 'warn'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!movementRows.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No auto-detected movements for these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <Pagination
            page={movePage.page}
            setPage={movePage.setPage}
            pageSize={movePage.pageSize}
            setPageSize={movePage.setPageSize}
            total={movePage.total}
            totalPages={movePage.totalPages}
            rangeStart={movePage.rangeStart}
            rangeEnd={movePage.rangeEnd}
          />
        </section>
      ) : null}

      {tab === 'alerts' ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Infrastructure alerts</h2>
            <span className="trailer-meta">{activeAlertCount} active</span>
          </div>
          <div className="list">
            {alertRows.map((a: InfraAlert) => (
              <div key={a.id} className="list-item static infra-v2-alert-row">
                <span
                  className={`priority ${
                    a.severity === 'critical'
                      ? 'critical'
                      : a.severity === 'warn'
                        ? 'warn'
                        : 'ok'
                  }`}
                />
                <div className="gps-ble-row-copy">
                  <div className="trailer-id">
                    {a.title}
                    <span
                      className={`badge ${
                        a.status === 'resolved'
                          ? 'ok'
                          : a.status === 'acknowledged'
                            ? 'warn'
                            : 'critical'
                      }`}
                      style={{ marginLeft: '0.45rem' }}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="trailer-meta">
                    {a.detail} · {a.time} · {INFRA_ALERT_META[a.type]}
                  </div>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => selectDevice(a.infraDeviceId)}
                  >
                    View
                  </button>
                  {a.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        acknowledgeInfraAlert(a.id)
                        success('Alert acknowledged.')
                      }}
                    >
                      Ack
                    </button>
                  ) : null}
                  {a.status !== 'resolved' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        resolveInfraAlert(a.id)
                        success('Alert resolved.')
                      }}
                    >
                      Resolve
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!alertRows.length ? (
              <div className="empty">No infrastructure alerts.</div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-head">
          <h2>Automation overview</h2>
          <span className="trailer-meta">
            How fixed devices drive Gate · Yard · Dock workflows
          </span>
        </div>
        <div className="infra-v2-auto-grid">
          {AUTOMATION_CARDS.map((card) => (
            <article key={card.title} className="infra-v2-auto-card">
              <div className="eyebrow">{INFRA_KIND_META[card.kind]}</div>
              <strong>{card.title}</strong>
              <ul className="perm-list">
                {card.lines.map((line) => (
                  <li key={line}>→ {line}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="trailer-meta" style={{ margin: '0 1.15rem 1.1rem' }}>
          Example logic: RFID creates Gate Arrival · BLE recommends parking ·
          GPS geofence tracks enter/leave · Dock sensors update occupancy · IoT
          gateways forward Trailer Device telemetry to Smart Yard.
        </p>
      </section>

      {editOpen && selected ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="modal-panel modal-panel-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Edit infrastructure</div>
                <h2>{selected.id}</h2>
              </div>
              <ModalCloseBtn onClick={() => setEditOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={saveEdit}>
              <div className="modal-body">
                {formError ? <div className="form-error">{formError}</div> : null}
                <div className="form-grid">
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Device name</span>
                    <input
                      className="search"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <input
                      className="search"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Firmware</span>
                    <input
                      className="search"
                      value={editFirmware}
                      onChange={(e) => setEditFirmware(e.target.value)}
                    />
                  </label>
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Notes</span>
                    <input
                      className="search"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {installOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setInstallOpen(false)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Infrastructure V2</div>
                <h2>Install device</h2>
              </div>
              <ModalCloseBtn onClick={() => setInstallOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={handleInstall}>
              <div className="modal-body">
                {formError ? <div className="form-error">{formError}</div> : null}
                <div className="form-grid">
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Name *</span>
                    <input
                      className="search"
                      value={instName}
                      onChange={(e) => setInstName(e.target.value)}
                      required
                      autoFocus
                    />
                  </label>
                  <label className="field">
                    <span>Kind *</span>
                    <select
                      className="select"
                      value={instKind}
                      onChange={(e) =>
                        setInstKind(e.target.value as InfraKind)
                      }
                      required
                    >
                      {INFRA_KINDS.map((knd) => (
                        <option key={knd} value={knd}>
                          {INFRA_KIND_META[knd]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Zone *</span>
                    <select
                      className="select"
                      value={instZone}
                      onChange={(e) => setInstZone(e.target.value)}
                      required
                    >
                      {ZONE_OPTIONS.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Location *</span>
                    <input
                      className="search"
                      value={instLocation}
                      onChange={(e) => setInstLocation(e.target.value)}
                      placeholder="Mast, canopy, door range…"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Status *</span>
                    <select
                      className="select"
                      value={instStatus}
                      onChange={(e) =>
                        setInstStatus(e.target.value as InfraOpsStatus)
                      }
                      required
                    >
                      {INFRA_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {INFRA_OPS_STATUS_META[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Coverage / range</span>
                    <input
                      className="search"
                      type="number"
                      min={1}
                      step={1}
                      value={instCoverage}
                      onChange={(e) => setInstCoverage(e.target.value)}
                      placeholder="Optional map radius %"
                    />
                  </label>
                  <label className="field">
                    <span>Firmware version</span>
                    <input
                      className="search"
                      value={instFirmware}
                      onChange={(e) => setInstFirmware(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="field">
                    <span>Serial number</span>
                    <input
                      className="search"
                      value={instSerial}
                      onChange={(e) => setInstSerial(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Notes</span>
                    <input
                      className="search"
                      value={instNote}
                      onChange={(e) => setInstNote(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setInstallOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Install
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
