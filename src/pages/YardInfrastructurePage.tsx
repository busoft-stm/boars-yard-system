import { useMemo, useState, type FormEvent } from 'react'
import {
  INFRA_KIND_META,
  INFRA_OPS_STATUS_META,
  type InfraKind,
  type InfraOpsStatus,
  type YardInfraAsset,
} from '../data/smartEnterprise'
import { useSmartYard } from '../smart/SmartYardContext'
import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { MaterialIcon } from '../components/MaterialIcon'
import { Pagination, usePagination } from '../components/Pagination'
import { ModalCloseBtn } from '../components/ActionIcons'
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

function statusBadgeClass(status: YardInfraAsset['status']) {
  if (status === 'online') return 'ok'
  if (status === 'degraded' || status === 'maintenance') return 'warn'
  return 'offline'
}

export function YardInfrastructurePage() {
  const { infra, bleAnchors, kpis, installInfraDevice } = useSmartYard()
  const { success, error: showError } = useSnackbar()
  const [q, setQ] = useState('')
  const [nameFilter, setNameFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [lastSeenFilter, setLastSeenFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table')
  const [mapDetailId, setMapDetailId] = useState<string | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<InfraKind>('rfid_reader')
  const [zone, setZone] = useState<string>('A')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<InfraOpsStatus>('online')
  const [coverage, setCoverage] = useState('')
  const [firmware, setFirmware] = useState('')
  const [serial, setSerial] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')

  const rfidReaders = useMemo(
    () => infra.filter((i) => i.kind === 'rfid_reader').length,
    [infra],
  )
  const edgeGateways = useMemo(
    () => infra.filter((i) => i.kind === 'edge_gateway').length,
    [infra],
  )
  const gateReaders = useMemo(
    () => infra.filter((i) => i.kind === 'gate_reader').length,
    [infra],
  )
  const dockSensors = useMemo(
    () => infra.filter((i) => i.kind === 'dock_sensor').length,
    [infra],
  )
  const gpsNodes = useMemo(
    () => infra.filter((i) => i.kind === 'gps_coverage').length,
    [infra],
  )
  const networkOnline = useMemo(
    () => infra.filter((i) => i.status === 'online').length,
    [infra],
  )

  const nameOptions = useMemo(
    () => uniqueOptions(infra.map((i) => i.name)),
    [infra],
  )
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
  const locationOptions = useMemo(
    () => uniqueOptions(infra.map((i) => i.location)),
    [infra],
  )
  const statusOptions = useMemo(
    () => uniqueOptions(infra.map((i) => i.status)),
    [infra],
  )
  const lastSeenOptions = useMemo(
    () => uniqueOptions(infra.map((i) => i.lastSeen)),
    [infra],
  )

  const rows = useMemo(() => {
    return infra.filter((i) => {
      const hay =
        `${i.name} ${i.zone} ${i.location} ${i.note} ${INFRA_KIND_META[i.kind]}`.toLowerCase()
      if (q && !hay.includes(q.toLowerCase())) return false
      if (nameFilter !== 'all' && i.name !== nameFilter) return false
      if (kindFilter !== 'all' && i.kind !== kindFilter) return false
      if (zoneFilter !== 'all' && i.zone !== zoneFilter) return false
      if (locationFilter !== 'all' && i.location !== locationFilter) return false
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (lastSeenFilter !== 'all' && i.lastSeen !== lastSeenFilter) return false
      return true
    })
  }, [
    infra,
    q,
    nameFilter,
    kindFilter,
    zoneFilter,
    locationFilter,
    statusFilter,
    lastSeenFilter,
  ])

  const filterKey = `${q}|${nameFilter}|${kindFilter}|${zoneFilter}|${locationFilter}|${statusFilter}|${lastSeenFilter}`
  const pagination = usePagination(rows, 10, filterKey)
  const mapDetailAsset = mapDetailId
    ? infra.find((i) => i.id === mapDetailId)
    : undefined

  function openInstall() {
    setName('')
    setKind('rfid_reader')
    setZone('A')
    setLocation('')
    setStatus('online')
    setCoverage('')
    setFirmware('')
    setSerial('')
    setNote('')
    setFormError('')
    setInstallOpen(true)
  }

  async function handleInstall(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setFormError('Enter a device name.')
      return
    }
    if (!location.trim()) {
      setFormError('Enter a location.')
      return
    }
    const coverageNum = coverage.trim() ? Number(coverage) : undefined
    if (
      coverage.trim() &&
      (coverageNum === undefined ||
        !Number.isFinite(coverageNum) ||
        coverageNum <= 0)
    ) {
      setFormError('Coverage/range must be a positive number.')
      return
    }
    try {
      const asset = await installInfraDevice({
        name,
        kind,
        zone,
        location,
        status,
        coverageRadius: coverageNum,
        firmwareVersion: firmware,
        serialNumber: serial,
        note,
      })
      success(`Installed ${asset.name}.`)
      setSelectedId(asset.id)
      setInstallOpen(false)
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not install device.',
      )
      showError(
        err instanceof Error ? err.message : 'Could not install device.',
      )
    }
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Automation layer</div>
          <h1>Yard Infrastructure</h1>
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
            {bleAnchors.length} BLE anchors · {networkOnline}/{infra.length}{' '}
            online
          </div>
          <button type="button" className="btn btn-primary" onClick={openInstall}>
            Install device
          </button>
        </div>
      </div>

      <div className="stats stats-compact infra-stats">
        <div className="stat frost">
          <div className="stat-label">RFID readers</div>
          <div className="stat-value">{rfidReaders}</div>
          <div className="stat-note">Fixed yard tags</div>
        </div>
        <div className="stat">
          <div className="stat-label">BLE anchors online</div>
          <div className="stat-value">{kpis.bleAnchorsOnline}</div>
          <div className="stat-note">of {kpis.bleAnchorsTotal} deployed</div>
        </div>
        <div className="stat">
          <div className="stat-label">Edge gateways</div>
          <div className="stat-value">{edgeGateways}</div>
          <div className="stat-note">North + dock backhaul</div>
        </div>
        <div className="stat">
          <div className="stat-label">Gate readers</div>
          <div className="stat-value">{gateReaders}</div>
          <div className="stat-note">IN / OUT lanes</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Dock sensors</div>
          <div className="stat-value">{dockSensors}</div>
          <div className="stat-note">Door occupancy</div>
        </div>
        <div className="stat">
          <div className="stat-label">GPS nodes</div>
          <div className="stat-value">{gpsNodes}</div>
          <div className="stat-note">RTK assist zones</div>
        </div>
        <div className="stat frost">
          <div className="stat-label">Network</div>
          <div className="stat-value">
            {networkOnline}/{infra.length}
          </div>
          <div className="stat-note">Online vs total</div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, zone, location, note…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="view-toggle" role="group" aria-label="Infrastructure view">
          <button
            type="button"
            className={viewMode === 'table' ? 'active' : ''}
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
          >
            <MaterialIcon name="table_rows" size={18} />
            Table
          </button>
          <button
            type="button"
            className={viewMode === 'map' ? 'active' : ''}
            aria-pressed={viewMode === 'map'}
            onClick={() => setViewMode('map')}
          >
            <MaterialIcon name="map" size={18} />
            Map
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="panel table-wrap table-wrap-filters">
          <table>
            <thead>
              <tr>
                <th>
                  <ColumnFilterHeader
                    label="Name"
                    value={nameFilter}
                    options={nameOptions}
                    onChange={setNameFilter}
                    searchable
                    searchPlaceholder="Search name…"
                  />
                </th>
                <th>
                  <ColumnFilterHeader
                    label="Kind"
                    value={kindFilter}
                    options={kindOptions}
                    onChange={setKindFilter}
                  />
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
                    label="Status"
                    value={statusFilter}
                    options={statusOptions}
                    onChange={setStatusFilter}
                  />
                </th>
                <th>
                  <ColumnFilterHeader
                    label="Last seen"
                    value={lastSeenFilter}
                    options={lastSeenOptions}
                    onChange={setLastSeenFilter}
                    searchable
                    searchPlaceholder="Search…"
                  />
                </th>
                <th>
                  <PlainHeader>Note</PlainHeader>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((i) => (
                <tr
                  key={i.id}
                  onClick={() =>
                    setSelectedId(i.id === selectedId ? null : i.id)
                  }
                  style={{
                    cursor: 'pointer',
                    background:
                      selectedId === i.id
                        ? 'rgba(166, 25, 46, 0.06)'
                        : undefined,
                  }}
                >
                  <td className="trailer-id">{i.name}</td>
                  <td className="trailer-meta">{INFRA_KIND_META[i.kind]}</td>
                  <td className="mono">{i.zone}</td>
                  <td className="trailer-meta">{i.location}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(i.status)}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="trailer-meta">{i.lastSeen}</td>
                  <td className="trailer-meta">{i.note}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No infrastructure matches the filters.
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
      ) : (
        <div className="panel map-panel devices-map-panel">
          <div className="panel-head">
            <h2>Yard asset map</h2>
            <span className="trailer-meta">
              {rows.length} of {infra.length} shown · click a marker for details
            </span>
          </div>
          <div className="devices-map-canvas">
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
            {rows.map((asset) => {
              const active = mapDetailId === asset.id
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`devices-map-dot${active ? ' active' : ''}${
                    asset.status === 'offline' ? ' offline' : ''
                  }`}
                  style={{
                    left: `${asset.x}%`,
                    top: `${asset.y}%`,
                    background: KIND_DOT_COLOR[asset.kind],
                  }}
                  title={`${asset.name} · ${INFRA_KIND_META[asset.kind]} · ${asset.status}`}
                  aria-label={asset.name}
                  onClick={() => {
                    setMapDetailId(asset.id)
                    setSelectedId(asset.id)
                  }}
                />
              )
            })}
            {!rows.length ? (
              <div
                className="empty"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                No infrastructure matches the filters.
              </div>
            ) : null}
          </div>
          <div className="devices-map-legend" aria-label="Asset kind legend">
            {INFRA_KINDS.map((k) => (
              <span key={k}>
                <i style={{ background: KIND_DOT_COLOR[k] }} />
                {INFRA_KIND_META[k]}
              </span>
            ))}
          </div>
          <p className="trailer-meta" style={{ margin: '0 1.15rem 1rem' }}>
            BLE anchors triangulate unified smart devices to parking slots — the
            same anchor positions drive slot confidence on the Yards map.
          </p>
        </div>
      )}

      {mapDetailAsset ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setMapDetailId(null)}
        >
          <div
            className="modal-panel modal-panel-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="infra-map-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Infrastructure</div>
                <h2 id="infra-map-detail-title">{mapDetailAsset.name}</h2>
              </div>
              <ModalCloseBtn onClick={() => setMapDetailId(null)} />
            </div>
            <div className="modal-body">
              <div className="kv compact">
                <div className="kv-item">
                  <label>Kind</label>
                  <strong>{INFRA_KIND_META[mapDetailAsset.kind]}</strong>
                </div>
                <div className="kv-item">
                  <label>Status</label>
                  <strong>
                    <span
                      className={`badge ${statusBadgeClass(mapDetailAsset.status)}`}
                    >
                      {mapDetailAsset.status}
                    </span>
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Zone</label>
                  <strong className="mono">{mapDetailAsset.zone}</strong>
                </div>
                <div className="kv-item">
                  <label>Location</label>
                  <strong>{mapDetailAsset.location}</strong>
                </div>
                <div className="kv-item">
                  <label>Last seen</label>
                  <strong>{mapDetailAsset.lastSeen}</strong>
                </div>
                <div className="kv-item">
                  <label>Map position</label>
                  <strong className="mono">
                    {mapDetailAsset.x.toFixed(0)}%, {mapDetailAsset.y.toFixed(0)}
                    %
                  </strong>
                </div>
              </div>
              {mapDetailAsset.note ? (
                <p className="trailer-meta" style={{ marginBottom: 0 }}>
                  {mapDetailAsset.note}
                </p>
              ) : null}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setSelectedId(mapDetailAsset.id)
                  setViewMode('table')
                  setMapDetailId(null)
                }}
              >
                Open in table
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setMapDetailId(null)}
              >
                Close
              </button>
            </div>
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
            aria-labelledby="install-infra-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Infrastructure</div>
                <h2 id="install-infra-title">Install device</h2>
              </div>
              <ModalCloseBtn onClick={() => setInstallOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={handleInstall}>
              <div className="modal-body">
                <p className="trailer-meta" style={{ marginTop: 0 }}>
                  Register a fixed yard asset (reader, anchor, gateway, or
                  sensor) for this site.
                </p>
                {formError ? <div className="form-error">{formError}</div> : null}
                <div className="form-grid">
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Name *</span>
                    <input
                      className="search"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Gate RFID reader · Lane 4"
                      autoFocus
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Kind *</span>
                    <select
                      className="select"
                      value={kind}
                      onChange={(e) => setKind(e.target.value as InfraKind)}
                      required
                    >
                      {INFRA_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {INFRA_KIND_META[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Zone *</span>
                    <select
                      className="select"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
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
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Mast, canopy, door range…"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Status *</span>
                    <select
                      className="select"
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as InfraOpsStatus)
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
                      value={coverage}
                      onChange={(e) => setCoverage(e.target.value)}
                      placeholder="Optional map radius %"
                    />
                  </label>
                  <label className="field">
                    <span>Firmware version</span>
                    <input
                      className="search"
                      value={firmware}
                      onChange={(e) => setFirmware(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="field">
                    <span>Serial number</span>
                    <input
                      className="search"
                      value={serial}
                      onChange={(e) => setSerial(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Notes</span>
                    <input
                      className="search"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional install notes"
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
                  Install device
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
