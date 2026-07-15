import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { type Zone, type YardZoneDef, canStageOutboundFromYard, trailerNeedsDock } from '../data/trailers'
import { formatDwellShort } from '../utils/usFormat'
import { StatusBadge, formatTemp } from '../components/Badges'
import {
  ActionIconBtn,
  IconDisable,
  IconEdit,
  IconEnable,
  ModalCloseBtn,
} from '../components/ActionIcons'

import { useConfirmDialog } from '../components/ConfirmDialog'
import { AssignSlotModal } from '../components/AssignSlotModal'
import { useSnackbar } from '../components/Snackbar'
import { useSmartYard } from '../smart/SmartYardContext'
import { useYard } from '../yard/YardContext'
import { useGeofence } from '../geofence/GeofenceContext'

function shortGps(lat: number, lng: number) {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

export function YardMapPage() {
  const navigate = useNavigate()
  const {
    slots,
    trailers,
    metrics: m,
    movements,
    getTrailer,
    parkingZones,
    addZone,
    updateZone,
    setZoneStatus,
    addParkingSlots,
    availableParkingSlots,
    assignParkingSlot,
    stageOutboundFromYard,
  } = useYard()
  const {
    devices,
    bleAnchors,
    getDeviceForTrailer,
    gpsTrackForTrailer,
    applyBleProximitySlot,
  } = useSmartYard()
  const { success, error: showError } = useSnackbar()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const {
    pendingRecovery,
    unacknowledged,
    acknowledge,
    simulateEnter,
    simulateLeave,
  } = useGeofence()
  const bleAutoRan = useRef(false)
  const enterPrompt = useMemo(
    () =>
      unacknowledged.find(
        (e) => e.type === 'enter_yard' && !e.needsDeviceRecovery,
      ) ?? null,
    [unacknowledged],
  )
  const [bleRecommend, setBleRecommend] = useState<{
    deviceId: string
    trailerId: string
    trailerNumber: string
    slot: string
    confidence: number
  } | null>(null)
  const [bleBusy, setBleBusy] = useState(false)

  useEffect(() => {
    if (bleRecommend || bleAutoRan.current) return
    const pending = devices.find(
      (d) =>
        d.trailerId &&
        d.assignedTrailer &&
        d.bleSuggestedSlot &&
        d.bleSuggestedSlot !== d.currentLocation &&
        d.capabilities.includes('ble') &&
        (d.slotConfidence ?? 0) >= 85,
    )
    if (!pending?.trailerId || !pending.bleSuggestedSlot || !pending.assignedTrailer)
      return

    const targetSlot = pending.bleSuggestedSlot
    const free = availableParkingSlots.some((s) => s.label === targetSlot)
    if (!free) return

    bleAutoRan.current = true
    setBleRecommend({
      deviceId: pending.id,
      trailerId: pending.trailerId,
      trailerNumber: pending.assignedTrailer,
      slot: targetSlot,
      confidence: pending.slotConfidence ?? 90,
    })
  }, [devices, availableParkingSlots, bleRecommend])

  async function confirmBleRecommendation() {
    if (!bleRecommend) return
    setBleBusy(true)
    try {
      await assignParkingSlot({
        trailerId: bleRecommend.trailerId,
        slot: bleRecommend.slot,
      })
      await applyBleProximitySlot(
        bleRecommend.deviceId,
        bleRecommend.slot,
        bleRecommend.confidence,
        null,
      )
      success(
        `BLE slot confirmed · ${bleRecommend.trailerNumber} → ${bleRecommend.slot}`,
      )
      setBleRecommend(null)
    } catch (e) {
      showError(
        e instanceof Error ? e.message : 'Could not confirm BLE slot.',
      )
      bleAutoRan.current = false
    } finally {
      setBleBusy(false)
    }
  }

  function dismissBleRecommendation() {
    setBleRecommend(null)
    // Keep bleAutoRan so we don't re-prompt immediately this session
  }

  const [zone, setZone] = useState<Zone | 'all' | 'Dock'>('all')
  const [selected, setSelected] = useState<string | null>('A-14')
  const [zoneModalOpen, setZoneModalOpen] = useState(false)
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [slotsModalOpen, setSlotsModalOpen] = useState(false)
  const [assignSlotOpen, setAssignSlotOpen] = useState(false)
  const [zoneError, setZoneError] = useState('')
  const [slotsError, setSlotsError] = useState('')
  const [busy, setBusy] = useState(false)

  const [newZoneId, setNewZoneId] = useState('')
  const [newZoneName, setNewZoneName] = useState('')
  const [newZoneSlots, setNewZoneSlots] = useState('10')

  const activeZones = useMemo(
    () => parkingZones.filter((z) => z.status !== 'disabled'),
    [parkingZones],
  )

  const [slotZoneId, setSlotZoneId] = useState(activeZones[0]?.id ?? 'A')
  const [slotCount, setSlotCount] = useState('5')

  const parking = useMemo(() => {
    return slots.filter((s) => {
      if (s.type !== 'parking') return false
      if (zone === 'all' || zone === 'Dock') return true
      return s.zone === zone
    })
  }, [zone, slots])

  const docks = slots.filter((s) => s.type === 'dock')
  const selectedSlot = selected
    ? slots.find((s) => s.label === selected || s.id === selected)
    : null
  const selectedTrailer = selectedSlot?.trailerId
    ? getTrailer(selectedSlot.trailerId)
    : null

  const gateTrailers = trailers.filter((t) => t.status === 'Gate arrived')

  const liveDevices = useMemo(
    () =>
      devices.filter(
        (d) => d.assignedTrailer && d.lifecycle === 'in_use' && d.gpsStatus === 'ok',
      ),
    [devices],
  )

  const bleByZone = useMemo(() => {
    const map = new Map<
      string,
      { online: number; total: number; degraded: number }
    >()
    for (const a of bleAnchors) {
      const cur = map.get(a.zone) ?? { online: 0, total: 0, degraded: 0 }
      cur.total += 1
      if (a.status === 'online') cur.online += 1
      if (a.status === 'degraded') cur.degraded += 1
      map.set(a.zone, cur)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [bleAnchors])

  const selectedDevice = selectedTrailer
    ? getDeviceForTrailer(selectedTrailer.number)
    : null
  const gpsTrack =
    selectedTrailer && selectedDevice
      ? gpsTrackForTrailer(selectedTrailer.number)
      : []
  const lastMovement = selectedTrailer
    ? movements.find((mv) => mv.trailerId === selectedTrailer.id)
    : null

  const visibleZones =
    zone === 'all'
      ? parkingZones.map((z) => z.id)
      : zone === 'Dock'
        ? []
        : [zone]

  function openCreateZoneModal() {
    setEditingZoneId(null)
    setNewZoneId('')
    setNewZoneName('')
    setNewZoneSlots('10')
    setZoneError('')
    setZoneModalOpen(true)
  }

  function openEditZoneModal(z: YardZoneDef) {
    setEditingZoneId(z.id)
    setNewZoneId(z.id)
    setNewZoneName(z.name)
    setNewZoneSlots(String(z.slotCount))
    setZoneError('')
    setZoneModalOpen(true)
  }

  function openSlotsModal(preferredZoneId?: string) {
    const fallback =
      preferredZoneId &&
      activeZones.some((z) => z.id === preferredZoneId)
        ? preferredZoneId
        : zone !== 'all' &&
            zone !== 'Dock' &&
            activeZones.some((z) => z.id === zone)
          ? zone
          : (activeZones[0]?.id ?? 'A')
    setSlotZoneId(fallback)
    setSlotCount('5')
    setSlotsError('')
    setSlotsModalOpen(true)
  }

  async function handleZoneSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setZoneError('')
    try {
      if (editingZoneId) {
        const updated = await updateZone(editingZoneId, {
          name: newZoneName,
          slotCount: Number(newZoneSlots),
        })
        success(`${updated.name} updated.`)
        setZone(updated.id)
      } else {
        const created = await addZone({
          id: newZoneId,
          name: newZoneName,
          slotCount: Number(newZoneSlots),
        })
        success(
          `${created.name} created with ${created.slotCount} parking slots.`,
        )
        setZone(created.id)
      }
      setZoneModalOpen(false)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : editingZoneId
            ? 'Could not update zone.'
            : 'Could not create zone.'
      setZoneError(message)
      showError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddSlots(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setSlotsError('')
    try {
      const updated = await addParkingSlots({
        zoneId: slotZoneId,
        count: Number(slotCount),
      })
      success(
        `Added ${slotCount} parking slots to ${updated.name} (${updated.slotCount} total).`,
      )
      setZone(updated.id)
      setSlotsModalOpen(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not add parking slots.'
      setSlotsError(message)
      showError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleZoneStatus(z: YardZoneDef) {
    const disabling = z.status !== 'disabled'
    const ok = await confirm({
      title: disabling ? 'Disable zone' : 'Enable zone',
      message: disabling
        ? `Disable ${z.name}? Empty slots will be unavailable for assignment until re-enabled. Clear any parked trailers first.`
        : `Enable ${z.name}? Its parking slots will be available for assignment again.`,
      confirmLabel: disabling ? 'Disable' : 'Enable',
      tone: disabling ? 'danger' : 'default',
    })
    if (!ok) return
    try {
      await setZoneStatus(z.id, disabling ? 'disabled' : 'active')
      success(disabling ? `${z.name} disabled.` : `${z.name} enabled.`)
      if (disabling && zone === z.id) setZone('all')
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : `Could not ${disabling ? 'disable' : 'enable'} ${z.name}.`,
      )
    }
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Zones & parking slots</div>
          <h1>Yards</h1>
          <p>
            Create and manage parking zones and slots, assign trailers on the
            map, and view docks and gate arrivals by occupancy and cold-chain
            risk.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openSlotsModal()}
            disabled={!activeZones.length}
          >
            Add parking slots
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreateZoneModal}
          >
            New zone
          </button>
        </div>
      </div>

      <div className="meta-chip" style={{ marginBottom: '0.85rem' }}>
        Occupancy {m.occupancy}% · {m.parked}/{m.capacity} slots ·{' '}
        {activeZones.length} active zones
        {parkingZones.length - activeZones.length
          ? ` · ${parkingZones.length - activeZones.length} disabled`
          : ''}
      </div>

      {pendingRecovery.length ? (
        <div className="panel ble-recommend-banner" role="status">
          <div>
            <div className="eyebrow">Left yard geofence · recover device</div>
            <strong>
              {pendingRecovery[0]!.trailerNumber}
              {pendingRecovery[0]!.deviceId
                ? ` · ${pendingRecovery[0]!.deviceId}`
                : ''}
            </strong>
            <p className="trailer-meta" style={{ margin: '0.25rem 0 0' }}>
              GPS leave event · complete recovery at Gate exit
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
              className="btn btn-primary"
              onClick={() => navigate('/gate')}
            >
              Go to Gate exit
            </button>
          </div>
        </div>
      ) : enterPrompt ? (
        <div className="panel ble-recommend-banner" role="status">
          <div>
            <div className="eyebrow">Entered yard geofence</div>
            <strong>{enterPrompt.trailerNumber} · auto arrival</strong>
            <p className="trailer-meta" style={{ margin: '0.25rem 0 0' }}>
              {enterPrompt.detail}
            </p>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => acknowledge(enterPrompt.id)}
            >
              Acknowledge
            </button>
          </div>
        </div>
      ) : null}

      {bleRecommend ? (
        <div className="panel ble-recommend-banner" role="status">
          <div>
            <div className="eyebrow">BLE slot recommendation</div>
            <strong>
              {bleRecommend.trailerNumber} · suggest {bleRecommend.slot}
            </strong>
            <p className="trailer-meta" style={{ margin: '0.25rem 0 0' }}>
              GPS places the trailer in yard · BLE confidence{' '}
              {bleRecommend.confidence}% · operator confirmation required
            </p>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={bleBusy}
              onClick={dismissBleRecommendation}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={bleBusy}
              onClick={() => void confirmBleRecommendation()}
            >
              {bleBusy ? 'Assigning…' : 'Confirm parking slot'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <div className="filters">
          <button
            type="button"
            className={`chip ${zone === 'all' ? 'active' : ''}`}
            onClick={() => setZone('all')}
          >
            All zones
          </button>
          {parkingZones.map((z) => (
            <button
              key={z.id}
              type="button"
              className={`chip ${zone === z.id ? 'active' : ''} ${
                z.status === 'disabled' ? 'chip-muted' : ''
              }`}
              onClick={() => setZone(z.id)}
            >
              {z.name}
              {z.status === 'disabled' ? ' · off' : ''}
            </button>
          ))}
          <button
            type="button"
            className={`chip ${zone === 'Dock' ? 'active' : ''}`}
            onClick={() => setZone('Dock')}
          >
            Docks
          </button>
        </div>
        <div className="legend">
          <span>
            <i className="lg empty" /> Empty
          </span>
          <span>
            <i className="lg ok" /> OK
          </span>
          <span>
            <i className="lg warn" /> Warming
          </span>
          <span>
            <i className="lg critical" /> Excursion
          </span>
          <span>
            <i className="lg offline" /> No signal
          </span>
        </div>
      </div>

      <div className="map-layout">
        <div className="panel map-panel map-panel-geofence">
          {zone !== 'Dock' &&
            visibleZones.map((z) => {
              const zoneSlots = parking.filter((s) => s.zone === z)
              const zoneMeta = parkingZones.find((pz) => pz.id === z)
              const disabled = zoneMeta?.status === 'disabled'
              return (
                <div
                  key={z}
                  className={`map-zone ${disabled ? 'map-zone-disabled' : ''}`}
                >
                  <div className="map-zone-head">
                    <div className="map-zone-title">
                      <h3>{zoneMeta?.name ?? `Zone ${z}`}</h3>
                      {disabled ? (
                        <span className="badge offline">disabled</span>
                      ) : null}
                    </div>
                    <div className="map-zone-actions">
                      <span className="map-zone-meta">
                        {zoneSlots.filter((s) => s.trailerId).length}/
                        {zoneSlots.length} occupied
                        {bleAnchors.filter((a) => a.zone === z).length
                          ? ` · ${bleAnchors.filter((a) => a.zone === z).length} BLE`
                          : ''}
                      </span>
                      {zoneMeta ? (
                        <div className="action-icon-row">
                          <ActionIconBtn
                            label="Edit zone"
                            onClick={() => openEditZoneModal(zoneMeta)}
                          >
                            <IconEdit />
                          </ActionIconBtn>
                          {disabled ? (
                            <ActionIconBtn
                              label="Enable zone"
                              tone="ok"
                              onClick={() => {
                                void handleToggleZoneStatus(zoneMeta)
                              }}
                            >
                              <IconEnable />
                            </ActionIconBtn>
                          ) : (
                            <ActionIconBtn
                              label="Disable zone"
                              tone="danger"
                              onClick={() => {
                                void handleToggleZoneStatus(zoneMeta)
                              }}
                            >
                              <IconDisable />
                            </ActionIconBtn>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {bleAnchors.filter((a) => a.zone === z).length ? (
                    <div className="ble-anchor-strip">
                      {bleAnchors
                        .filter((a) => a.zone === z)
                        .map((a) => (
                          <span
                            key={a.id}
                            className={`ble-anchor-chip ${a.status}`}
                            title={`${a.label} · ${a.slotHint} · ${a.coverageM}m`}
                          >
                            {a.label}
                          </span>
                        ))}
                    </div>
                  ) : null}
                  <div className="slot-grid">
                    {zoneSlots.map((s) => {
                      const t = s.trailerId ? getTrailer(s.trailerId) : null
                      const tone = t ? t.tempStatus : 'empty'
                      const slotDevice = t
                        ? getDeviceForTrailer(t.number)
                        : null
                      const gpsLive =
                        slotDevice?.gpsStatus === 'ok' &&
                        slotDevice.connectivity !== 'offline'
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`slot ${tone} ${selected === s.label ? 'selected' : ''} ${gpsLive ? 'gps-live' : ''}`}
                          onClick={() => setSelected(s.label)}
                          title={
                            t
                              ? `${t.number} · ${formatTemp(t.actual)}`
                              : disabled
                                ? 'Empty · zone disabled'
                                : 'Empty'
                          }
                        >
                          <span className="slot-label">{s.label}</span>
                          <span className="slot-unit">
                            {t ? t.number.replace(/^[A-Z]+-?/, '') : '·'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

          {(zone === 'all' || zone === 'Dock') && (
            <div className="map-zone">
              <div className="map-zone-head">
                <h3>Dock doors</h3>
                <span>
                  {docks.filter((s) => s.trailerId).length}/{docks.length} in use
                </span>
              </div>
              <div className="dock-grid">
                {docks.map((s) => {
                  const t = s.trailerId ? getTrailer(s.trailerId) : null
                  const slotDevice = t ? getDeviceForTrailer(t.number) : null
                  const gpsLive =
                    slotDevice?.gpsStatus === 'ok' &&
                    slotDevice.connectivity !== 'offline'
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`dock-slot ${t ? t.tempStatus : 'empty'} ${
                        selected === s.label ? 'selected' : ''
                      } ${gpsLive ? 'gps-live' : ''}`}
                      onClick={() => setSelected(s.label)}
                    >
                      <strong>{s.label}</strong>
                      <span>{t ? t.number : 'Open'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {zone === 'all' && (
            <div className="map-zone">
              <div className="map-zone-head">
                <h3>Gate staging</h3>
                <span>{gateTrailers.length} waiting assignment</span>
              </div>
              <div className="gate-strip">
                {gateTrailers.length ? (
                  gateTrailers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="gate-chip"
                      onClick={() => navigate(`/trailer/${t.id}`)}
                    >
                      {t.number} · awaiting slot
                    </button>
                  ))
                ) : (
                  <span className="trailer-meta">No trailers at gate</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="panel story-card inspector">
          {selectedTrailer && selectedSlot ? (
            <>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate(`/trailer/${selectedTrailer.id}`)}
                >
                  Open trailer
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate('/movements')}
                >
                  Movement history
                </button>
                {canStageOutboundFromYard(selectedTrailer) ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      void (async () => {
                        try {
                          const t = await stageOutboundFromYard(
                            selectedTrailer.id,
                          )
                          success(
                            `${t.number} staged for departure · dock not required`,
                          )
                        } catch (e) {
                          showError(
                            e instanceof Error
                              ? e.message
                              : 'Could not stage for departure.',
                          )
                        }
                      })()
                    }}
                  >
                    Stage for departure
                  </button>
                ) : null}
              </div>
              <div className="eyebrow">Selected location</div>
              <h2>
                {selectedSlot.label}
                <span className="inspector-sub"> · {selectedTrailer.number}</span>
              </h2>
              <p>
                {selectedTrailer.carrier} · {selectedTrailer.product}
              </p>
              <div className="kv compact">
                <div className="kv-item">
                  <label>Temperature</label>
                  <strong>{formatTemp(selectedTrailer.actual)}</strong>
                </div>
                <div className="kv-item">
                  <label>Cold chain</label>
                  <strong>
                    <StatusBadge status={selectedTrailer.tempStatus} />
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Yard status</label>
                  <strong>{selectedTrailer.status}</strong>
                </div>
                <div className="kv-item">
                  <label>Dock workflow</label>
                  <strong>
                    {trailerNeedsDock(selectedTrailer)
                      ? 'Dock required'
                      : 'Yard → departure'}
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Dwell</label>
                  <strong>{formatDwellShort(selectedTrailer.dwellHours)}</strong>
                </div>
                <div className="kv-item">
                  <label>Fuel</label>
                  <strong>
                    {selectedTrailer.fuelPct == null
                      ? '—'
                      : `${selectedTrailer.fuelPct}%`}
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Seal</label>
                  <strong>{selectedTrailer.seal}</strong>
                </div>
                {selectedDevice ? (
                  <>
                    <div className="kv-item">
                      <label>Last movement</label>
                      <strong>
                        {lastMovement
                          ? `${lastMovement.time} · ${lastMovement.to}`
                          : gpsTrack.at(-1)?.label ?? '—'}
                      </strong>
                    </div>
                    <div className="kv-item">
                      <label>Arrival</label>
                      <strong>{selectedTrailer.arrivedAt}</strong>
                    </div>
                    <div className="kv-item">
                      <label>Current zone</label>
                      <strong>
                        {selectedDevice.currentLocation}
                        {selectedDevice.nearbyDock
                          ? ` · near ${selectedDevice.nearbyDock}`
                          : ''}
                      </strong>
                    </div>
                    <div className="kv-item">
                      <label>Slot confidence</label>
                      <strong>
                        {selectedDevice.slotConfidence != null
                          ? `${selectedDevice.slotConfidence}%`
                          : '—'}
                      </strong>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : selectedSlot ? (
            <>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setAssignSlotOpen(true)}
                >
                  Assign slot
                </button>
                {selectedSlot.type === 'parking' ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => openSlotsModal(selectedSlot.zone)}
                  >
                    Expand zone
                  </button>
                ) : null}
              </div>
              <div className="eyebrow">Selected location</div>
              <h2>{selectedSlot.label}</h2>
              <p>
                Empty slot
                {parkingZones.find((z) => z.id === selectedSlot.zone)
                  ?.status === 'disabled'
                  ? ' — zone disabled; not available for new assignments.'
                  : ' — available for assignment from gate or relocate.'}
              </p>
            </>
          ) : (
            <p>Select a slot to inspect trailer details.</p>
          )}
        </div>

      <section className="panel gps-ble-panel">
        <div className="panel-head">
          <h2>GPS &amp; BLE visibility</h2>
          <span className="panel-meta">
            {liveDevices.length} live GPS ·{' '}
            {bleAnchors.filter((a) => a.status === 'online').length}/
            {bleAnchors.length} BLE anchors
          </span>
        </div>

        <div className="gps-ble-body">
          <p className="gps-geofence-note">
            GPS provides yard location and geofence enter/leave events. Leave
            events with an assigned device prompt recovery at Gate exit. BLE
            recommends a parking slot — operators confirm (confidence ≥85%).
          </p>

          {selectedTrailer ? (
            <div className="gps-ble-actions btn-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  simulateEnter(selectedTrailer.id)
                  success(`${selectedTrailer.number} · simulated enter geofence`)
                }}
              >
                Simulate enter geofence
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  simulateLeave(selectedTrailer.id)
                  success(`${selectedTrailer.number} · simulated leave geofence`)
                }}
              >
                Simulate leave geofence
              </button>
            </div>
          ) : null}

          <div className="gps-ble-grid">
            <div className="gps-ble-block">
              <div className="gps-ble-block-head">Live GPS</div>
              <div className="list">
                {liveDevices.map((d) => (
                  <div key={d.id} className="list-item gps-live-row static">
                    <span className="priority ok" />
                    <div className="gps-ble-row-copy">
                      <div className="trailer-id">
                        {d.assignedTrailer} · {d.id}
                      </div>
                      <div className="trailer-meta">
                        {shortGps(d.lat, d.lng)} · {d.currentLocation}
                        {d.slotConfidence != null
                          ? ` · ${d.slotConfidence}% conf`
                          : ''}
                        {d.nearbyDock ? ` · dock ${d.nearbyDock}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
                {!liveDevices.length ? (
                  <div className="gps-ble-empty">No assigned devices reporting GPS</div>
                ) : null}
              </div>
            </div>

            <div className="gps-ble-block">
              <div className="gps-ble-block-head">BLE anchors by zone</div>
              <div className="list">
                {bleByZone.map(([zoneId, stats]) => (
                  <div key={zoneId} className="list-item static">
                    <span
                      className={`priority ${
                        stats.online === stats.total
                          ? 'ok'
                          : stats.online > 0
                            ? 'warn'
                            : 'critical'
                      }`}
                    />
                    <div className="gps-ble-row-copy">
                      <div className="trailer-id">Zone {zoneId}</div>
                      <div className="trailer-meta">
                        {stats.online}/{stats.total} online
                        {stats.degraded
                          ? ` · ${stats.degraded} degraded`
                          : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gps-ble-block">
              <div className="gps-ble-block-head">
                Movement history
                {selectedTrailer ? ` · ${selectedTrailer.number}` : ''}
              </div>
              {selectedTrailer && selectedDevice ? (
                <div className="list">
                  {gpsTrack.map((pt, i) => (
                    <div key={`${pt.t}-${i}`} className="list-item static">
                      <span className="priority ok" />
                      <div className="gps-ble-row-copy">
                        <div className="trailer-id">{pt.label}</div>
                        <div className="trailer-meta">
                          {pt.t} · {shortGps(pt.lat, pt.lng)} · {pt.zone}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="gps-ble-empty">
                  Select a parked trailer with a smart device to view its GPS
                  trail.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      </div>

      {zoneModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setZoneModalOpen(false)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="zone-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Yard layout</div>
                <h2 id="zone-form-title">
                  {editingZoneId ? 'Edit zone' : 'Create new zone'}
                </h2>
              </div>
              <ModalCloseBtn onClick={() => setZoneModalOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={handleZoneSubmit}>
              <div className="modal-body">
              {zoneError ? <div className="form-error">{zoneError}</div> : null}
              <div className="form-grid">
                <label className="field">
                  <span>Zone code</span>
                  <input
                    className="search"
                    value={newZoneId}
                    onChange={(e) => setNewZoneId(e.target.value)}
                    placeholder="e.g. E or OVERFLOW"
                    required
                    disabled={!!editingZoneId}
                    autoFocus={!editingZoneId}
                  />
                </label>
                <label className="field">
                  <span>Display name</span>
                  <input
                    className="search"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="Optional · Zone E"
                    autoFocus={!!editingZoneId}
                  />
                </label>
                <label className="field">
                  <span>Parking slots</span>
                  <input
                    className="search"
                    type="number"
                    min={1}
                    max={500}
                    value={newZoneSlots}
                    onChange={(e) => setNewZoneSlots(e.target.value)}
                    required
                  />
                </label>
              </div>
              <p className="trailer-meta" style={{ margin: 0 }}>
                {editingZoneId
                  ? 'Zone code cannot change. Slot count cannot go below occupied slots.'
                  : 'Slots are labeled as CODE-01, CODE-02, and so on.'}
              </p>
                </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setZoneModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  {editingZoneId ? 'Save zone' : 'Create zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {slotsModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSlotsModalOpen(false)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-slots-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Yard layout</div>
                <h2 id="add-slots-title">Add parking slots</h2>
              </div>
              <ModalCloseBtn onClick={() => setSlotsModalOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={handleAddSlots}>
              <div className="modal-body">
              {slotsError ? <div className="form-error">{slotsError}</div> : null}
              <div className="form-grid">
                <label className="field">
                  <span>Zone</span>
                  <select
                    className="select"
                    value={slotZoneId}
                    onChange={(e) => setSlotZoneId(e.target.value)}
                  >
                    {activeZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.slotCount} slots)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Slots to add</span>
                  <input
                    className="search"
                    type="number"
                    min={1}
                    max={100}
                    value={slotCount}
                    onChange={(e) => setSlotCount(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
              </div>
                </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSlotsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !activeZones.length}
                >
                  Add slots
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDialog}
      <AssignSlotModal
        open={assignSlotOpen}
        onClose={() => setAssignSlotOpen(false)}
      />
    </div>
  )
}
