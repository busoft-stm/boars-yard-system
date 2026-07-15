import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useYard } from '../yard/YardContext'
import { useSmartYard } from '../smart/SmartYardContext'
import { gateLaneSupportsDirection } from '../data/trailers'
import {
  ALL_SMART_CAPABILITIES,
  CAPABILITY_META,
  LIFECYCLE_META,
} from '../data/smartEnterprise'
import {
  capabilityActivationLines,
  deviceHealthSummary,
} from '../utils/deviceHealth'
import { OwnBadge } from './Badges'
import { ModalCloseBtn } from './ActionIcons'
import { useSnackbar } from './Snackbar'
import { useGeofence } from '../geofence/GeofenceContext'

type Props = {
  open: boolean
  onClose: () => void
  /** Prefill trailer when opened from the register. */
  initialTrailerId?: string | null
  /** Called after successful check-in. Second arg is the slot when assigned at check-in. */
  onCheckedIn?: (id: string, assignedSlot?: string) => void
}

export function GateCheckInModal({
  open,
  onClose,
  initialTrailerId,
  onCheckedIn,
}: Props) {
  const {
    checkInEligible,
    checkInTrailer,
    availableParkingSlots,
    activeGateLanes,
  } = useYard()
  const { devices, assignDeviceToTrailer } = useSmartYard()
  const { success, error: showError } = useSnackbar()
  const { recordEvent } = useGeofence()

  const inboundLanes = useMemo(
    () => activeGateLanes.filter((l) => gateLaneSupportsDirection(l, 'in')),
    [activeGateLanes],
  )

  const availableDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          d.lifecycle === 'available' ||
          (d.lifecycle === 'charging' && !d.assignedTrailer),
      ),
    [devices],
  )

  const [trailerId, setTrailerId] = useState('')
  const [seal, setSeal] = useState('')
  const [lane, setLane] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [forceDevice, setForceDevice] = useState(false)
  const [actualTemp, setActualTemp] = useState('')
  const [slot, setSlot] = useState('')
  const [dockRequired, setDockRequired] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setLane((prev) => {
      if (prev && inboundLanes.some((l) => l.name === prev)) return prev
      return inboundLanes[0]?.name ?? ''
    })
    const pref = initialTrailerId?.trim()
    if (pref && checkInEligible.some((t) => t.id === pref)) {
      setTrailerId(pref)
    }
    setSeal('')
    setDeviceId('')
    setForceDevice(false)
    setActualTemp('')
    setSlot('')
    setDockRequired(true)
    setError('')
  }, [open, inboundLanes, initialTrailerId, checkInEligible])

  const selected = useMemo(
    () => checkInEligible.find((t) => t.id === trailerId),
    [checkInEligible, trailerId],
  )

  const selectedDevice = useMemo(
    () => availableDevices.find((d) => d.id === deviceId),
    [availableDevices, deviceId],
  )

  const health = useMemo(
    () => (selectedDevice ? deviceHealthSummary(selectedDevice) : null),
    [selectedDevice],
  )

  const needsTemp =
    selected?.trailerType === 'reefer' ||
    selected?.trailerType === 'multi_temp' ||
    !!selected?.telemetry

  const parkingSlots = useMemo(
    () => availableParkingSlots.slice(0, 80),
    [availableParkingSlots],
  )

  if (!open) return null

  function reset() {
    setTrailerId('')
    setSeal('')
    setLane(inboundLanes[0]?.name ?? '')
    setDeviceId('')
    setForceDevice(false)
    setActualTemp('')
    setSlot('')
    setError('')
    setBusy(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trailerId) {
      setError('Select a trailer from the register.')
      showError('Select a trailer from the register.')
      return
    }
    if (!lane) {
      setError('Select an active inbound gate lane.')
      showError('Select an active inbound gate lane.')
      return
    }
    if (!deviceId || !selectedDevice || !health) {
      setError('Assign a Trailer Device before check-in.')
      showError('Assign a Trailer Device before check-in.')
      return
    }
    if (!health.ok && !forceDevice) {
      setError(
        'Device failed health validation. Select another device or confirm force assign.',
      )
      showError('Device health validation failed.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const tempNum = actualTemp.trim() ? Number(actualTemp) : undefined
      if (actualTemp.trim() && !Number.isFinite(tempNum)) {
        throw new Error('Enter a valid temperature.')
      }

      const result = await checkInTrailer({
        trailerId,
        seal: seal.trim() || undefined,
        lane,
        slot: slot || undefined,
        actualTemp: tempNum,
        dockRequired,
      })

      const location = slot || result.slot || 'Gate'
      await assignDeviceToTrailer(
        deviceId,
        result.number,
        result.id,
        location,
      )

      recordEvent({
        type: 'enter_yard',
        trailerId: result.id,
        trailerNumber: result.number,
        deviceId,
        detail: `Gate check-in · entered yard geofence · ${location}`,
      })

      const capNote = selectedDevice.capabilities
        .map((c) => CAPABILITY_META[c].label)
        .join(', ')

      success(
        slot
          ? `${result.number} checked in · ${deviceId} assigned · ${slot} · caps ${capNote}`
          : `${result.number} checked in at ${lane} · ${deviceId} assigned · caps ${capNote}`,
      )
      reset()
      onClose()
      onCheckedIn?.(result.id, slot || undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check-in failed.'
      setError(message)
      showError(message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-checkin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">Gate check-in</div>
            <h2 id="gate-checkin-title">Check in trailer</h2>
          </div>
          <ModalCloseBtn onClick={onClose} />
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {error ? <div className="form-error">{error}</div> : null}

            <p className="role-info-lead" style={{ marginTop: 0 }}>
              Verify the trailer, assign a Trailer Device, validate health,
              activate supported capabilities, then optionally park before
              releasing to the yard.
            </p>

            <div className="form-grid">
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>1. Trailer verification</span>
                <select
                  className="select"
                  value={trailerId}
                  onChange={(e) => {
                    setTrailerId(e.target.value)
                    setSeal('')
                    setActualTemp('')
                  }}
                  autoFocus
                >
                  <option value="">Select trailer…</option>
                  {checkInEligible.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.number} · {t.carrier} ·{' '}
                      {t.ownership === 'bh' ? 'BH' : 'Carrier'}
                      {t.telemetry ? '' : ' · no telematics'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>2. Seal number</span>
                <input
                  className="search"
                  value={seal}
                  onChange={(e) => setSeal(e.target.value)}
                  placeholder={
                    selected?.seal && !selected.seal.startsWith('SL-000')
                      ? `Keep ${selected.seal} or enter new`
                      : 'Capture seal number'
                  }
                />
              </label>

              <label className="field">
                <span>Gate lane</span>
                <select
                  className="select"
                  value={lane}
                  onChange={(e) => setLane(e.target.value)}
                  disabled={!inboundLanes.length}
                  required
                >
                  {!inboundLanes.length ? (
                    <option value="">No active inbound lanes</option>
                  ) : (
                    inboundLanes.map((l) => (
                      <option key={l.id} value={l.name}>
                        {l.name}
                        {l.direction === 'both' ? ' · flex' : ' · inbound'}
                        {l.note ? ` · ${l.note}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {needsTemp ? (
                <label className="field">
                  <span>Initial temperature (°F)</span>
                  <input
                    className="search"
                    type="number"
                    step="0.1"
                    value={actualTemp}
                    onChange={(e) => setActualTemp(e.target.value)}
                    placeholder={
                      selected?.defaultSetpoint != null
                        ? `Setpoint ${selected.defaultSetpoint}°F`
                        : 'e.g. 34.0'
                    }
                  />
                </label>
              ) : null}

              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>3. Assign Trailer Device</span>
                <select
                  className="select"
                  value={deviceId}
                  onChange={(e) => {
                    setDeviceId(e.target.value)
                    setForceDevice(false)
                  }}
                  required
                >
                  <option value="">Select available device…</option>
                  {availableDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.deviceType} · {d.hardwareModel} ·{' '}
                      {LIFECYCLE_META[d.lifecycle]} · {d.batteryPct}%
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedDevice && health ? (
              <div className="form-section">
                <div className="eyebrow">4. Device health & capabilities</div>
                <div className="kv" style={{ padding: 0 }}>
                  <div className="kv-item">
                    <label>Battery</label>
                    <strong>{selectedDevice.batteryPct}%</strong>
                  </div>
                  <div className="kv-item">
                    <label>Connectivity</label>
                    <strong>{selectedDevice.connectivity}</strong>
                  </div>
                  <div className="kv-item">
                    <label>Firmware</label>
                    <strong className="mono">
                      {selectedDevice.firmwareVersion}
                    </strong>
                  </div>
                  <div className="kv-item">
                    <label>Health score</label>
                    <strong>{selectedDevice.healthScore}/100</strong>
                  </div>
                </div>

                {health.blockers.length || health.warnings.length ? (
                  <div
                    className={`form-error ${health.ok ? 'form-warn' : ''}`}
                    style={{ marginTop: '0.75rem' }}
                  >
                    {!health.ok ? (
                      <strong>Validation failed — pick another device.</strong>
                    ) : (
                      <strong>Warnings — review before assigning.</strong>
                    )}
                    <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                      {health.issues.map((i) => (
                        <li key={i.message}>
                          {i.level === 'block' ? 'Block' : 'Warn'}: {i.message}
                        </li>
                      ))}
                    </ul>
                    {!health.ok ? (
                      <label
                        className="check-row"
                        style={{ marginTop: '0.65rem' }}
                      >
                        <input
                          type="checkbox"
                          checked={forceDevice}
                          onChange={(e) => setForceDevice(e.target.checked)}
                        />
                        <span>Force assign despite health blockers</span>
                      </label>
                    ) : null}
                  </div>
                ) : (
                  <p className="trailer-meta" style={{ marginTop: '0.65rem' }}>
                    Device passed health validation.
                  </p>
                )}

                <div className="eyebrow" style={{ marginTop: '0.85rem' }}>
                  Capabilities to activate
                </div>
                <ul className="capability-checklist device-map-caps">
                  {ALL_SMART_CAPABILITIES.map((cap) => {
                    const on = selectedDevice.capabilities.includes(cap)
                    return (
                      <li key={cap} className={on ? 'cap-on' : 'cap-off'}>
                        <span aria-hidden="true">{on ? '✔' : '✖'}</span>
                        {CAPABILITY_META[cap].label}
                      </li>
                    )
                  })}
                </ul>
                {capabilityActivationLines(selectedDevice).length ? (
                  <ul className="perm-list" style={{ marginTop: '0.5rem' }}>
                    {capabilityActivationLines(selectedDevice).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="form-section">
              <div className="eyebrow">5. Parking slot (optional)</div>
              <label className="field">
                <span>Assign parking now</span>
                <select
                  className="select"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                >
                  <option value="">Leave at gate — assign later with BLE assist</option>
                  {parkingSlots.map((s) => (
                    <option key={s.id} value={s.label}>
                      {s.label} · Zone {s.zone}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-section">
              <div className="eyebrow">6. Visit workflow</div>
              <label className="check-row" style={{ marginTop: '0.35rem' }}>
                <input
                  type="checkbox"
                  checked={dockRequired}
                  onChange={(e) => setDockRequired(e.target.checked)}
                />
                <span>
                  Dock required — load/unload at a door before departure
                </span>
              </label>
              <p className="trailer-meta" style={{ margin: '0.45rem 0 0' }}>
                {dockRequired
                  ? 'Follows Ready to dock → Door → Outbound → Gate exit.'
                  : 'Skips dock — after yard parking, stage for departure then Gate exit.'}
              </p>
            </div>

            {selected ? (
              <div className="form-section">
                <div className="eyebrow">Register summary</div>
                <div className="kv" style={{ padding: 0 }}>
                  <div className="kv-item">
                    <label>Ownership</label>
                    <strong>
                      <OwnBadge ownership={selected.ownership} />
                    </strong>
                  </div>
                  <div className="kv-item">
                    <label>Product</label>
                    <strong>{selected.product}</strong>
                  </div>
                  <div className="kv-item">
                    <label>Type</label>
                    <strong>{selected.trailerType}</strong>
                  </div>
                  <div className="kv-item">
                    <label>Last visit</label>
                    <strong>{selected.arrivedAt}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {!availableDevices.length ? (
              <div className="empty">
                No available Trailer Devices in the cage. Register or return a
                unit on Trailer Devices before check-in.
              </div>
            ) : null}

            {!inboundLanes.length ? (
              <div className="empty">
                No active inbound lanes. Add or enable a lane on the Gates page
                before checking in.
              </div>
            ) : null}

            {!checkInEligible.length ? (
              <div className="empty">
                No active off-site trailers available. Register trailers in
                Trailer management, or complete gate exit to free a unit for
                check-in.
              </div>
            ) : null}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                busy ||
                !checkInEligible.length ||
                !inboundLanes.length ||
                !availableDevices.length
              }
            >
              {busy
                ? 'Checking in…'
                : slot
                  ? 'Check in · device · park'
                  : 'Check in · assign device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
