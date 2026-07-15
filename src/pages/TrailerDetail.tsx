import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDwellHours } from '../utils/usFormat'
import { OwnBadge, StatusBadge, YardStatusPill, formatTemp } from '../components/Badges'
import { TelemetryExplorer } from '../components/TelemetryExplorer'
import {
  ALL_SMART_CAPABILITIES,
  CAPABILITY_META,
  LIFECYCLE_META,
  type ConnStatus,
  type SensorStatus,
  type SmartCapability,
  type UnifiedSmartDevice,
} from '../data/smartEnterprise'
import { type Trailer } from '../data/trailers'
import { useSmartYard } from '../smart/SmartYardContext'
import { useYard } from '../yard/YardContext'
import { useDevices } from '../devices/DevicesContext'
import { DEVICE_KIND_META } from '../data/platform'
import {
  REEFER_BRAND_META,
  TRAILER_TYPE_META,
  canStageOutboundFromYard,
  trailerNeedsDock,
} from '../data/trailers'
import { useSnackbar } from '../components/Snackbar'

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

function sensorBadge(status: SensorStatus) {
  return (
    <span className={`badge ${SENSOR_TONES[status]}`}>{SENSOR_LABELS[status]}</span>
  )
}

function connBadge(status: ConnStatus) {
  return <span className={`badge ${CONN_TONES[status]}`}>{status}</span>
}

function healthScoreTone(score: number) {
  if (score >= 85) return 'ok'
  if (score >= 60) return 'warn'
  return 'critical'
}

function reeferStatusLabel(trailer: Trailer) {
  if (trailer.reeferAlarm) return 'Alarm active'
  switch (trailer.tempStatus) {
    case 'critical':
      return 'Critical excursion'
    case 'warn':
      return 'Warming'
    case 'offline':
      return 'Signal lost'
    case 'ok':
      return 'Running normally'
    default:
      return 'Not monitored'
  }
}

function alarmCodesLabel(trailer: Trailer) {
  if (trailer.reeferAlarm && trailer.tempStatus === 'critical') return 'E-42, TEMP_HI'
  if (trailer.reeferAlarm) return 'E-22, REEFER'
  if (trailer.tempStatus === 'critical') return 'TEMP_HI'
  if (trailer.tempStatus === 'warn') return 'TEMP_RISE'
  if (trailer.tempStatus === 'offline') return 'COMM_LOST'
  return 'None'
}

function tempRiskScore(trailer: Trailer) {
  switch (trailer.tempStatus) {
    case 'critical':
      return 15
    case 'warn':
      return 45
    case 'offline':
      return 55
    case 'na':
      return 70
    case 'ok':
      return 92
    default:
      return 50
  }
}

function fuelRiskScore(trailer: Trailer) {
  if (trailer.fuelPct == null) return 50
  if (trailer.fuelPct < 15) return 20
  if (trailer.fuelPct < 25) return 40
  if (trailer.fuelPct < 50) return 65
  return 90
}

function carrierReliabilityScore(trailer: Trailer) {
  if (trailer.ownership === 'bh') return 94
  return 72 + (trailer.carrier.length % 15)
}

function predictedDock(trailer: Trailer, device?: UnifiedSmartDevice) {
  if (trailer.dockDoor) return trailer.dockDoor
  if (device?.nearbyDock) return device.nearbyDock
  if (trailer.status === 'Ready to dock') {
    const doorNum = (parseInt(trailer.number.replace(/\D/g, ''), 10) % 12) + 1
    return `Door ${doorNum}`
  }
  return '—'
}

function estimatedDeparture(trailer: Trailer) {
  if (trailer.status === 'Outbound staged') return 'Today · staging lane'
  if (trailer.status === 'At dock') return 'After unload · ~2h'
  if (trailer.dwellHours >= 16) return 'Pending dispatch review'
  const hrs = Math.max(4, Math.round(24 - trailer.dwellHours))
  return `~${hrs}h if no hold`
}

function scoreBadge(score: number) {
  return (
    <span className={`badge ${healthScoreTone(score)}`}>{score}/100</span>
  )
}

export function TrailerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getTrailer, movements, stageOutboundFromYard } = useYard()
  const { devicesForTrailer } = useDevices()
  const { getDeviceForTrailer, gpsTrackForTrailer, historyForDevice } = useSmartYard()
  const { success, error: showError } = useSnackbar()
  const trailer = id ? getTrailer(id) : undefined
  const history = movements.filter((m) => m.trailerId === id).slice(0, 5)
  const mappedDevices = trailer ? devicesForTrailer(trailer.number) : []

  const smartDevice = trailer ? getDeviceForTrailer(trailer.number) : undefined
  const gpsTrack = trailer ? gpsTrackForTrailer(trailer.number) : []
  const deviceHistory = smartDevice ? historyForDevice(smartDevice.id) : []

  const intelligence = useMemo(() => {
    if (!trailer) return null
    const movementSnippet =
      gpsTrack.length >= 2
        ? `${gpsTrack[gpsTrack.length - 2].label} → ${gpsTrack[gpsTrack.length - 1].label}`
        : history[0]
          ? `${history[0].from} → ${history[0].to}`
          : 'No recent movement'
    const location =
      smartDevice?.currentLocation ??
      trailer.slot ??
      trailer.dockDoor ??
      'Gate'
    const deviceHealth = smartDevice?.healthScore ?? (trailer.telemetry ? 75 : null)
    return {
      location,
      movementSnippet,
      estimatedDeparture: estimatedDeparture(trailer),
      predictedDock: predictedDock(trailer, smartDevice),
      carrierScore: carrierReliabilityScore(trailer),
      tempScore: tempRiskScore(trailer),
      fuelScore: fuelRiskScore(trailer),
      deviceHealth,
    }
  }, [trailer, smartDevice, gpsTrack, history])

  const runtimeHours = trailer
    ? Math.round(trailer.dwellHours * 1.2 * 10) / 10
    : 0

  if (!trailer) {
    return (
      <div className="page-enter">
        <div className="page-head">
          <div>
            <Link className="back" to="/trailers">
              ← Trailers
            </Link>
            <h1>Trailer not found</h1>
          </div>
        </div>
      </div>
    )
  }

  const accent =
    trailer.tempStatus === 'critical'
      ? '#9e1b1e'
      : trailer.tempStatus === 'warn'
        ? '#9a5b00'
        : trailer.tempStatus === 'ok'
          ? '#1f6b45'
          : '#5c564e'

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <Link className="back" to="/trailers">
            ← Trailers
          </Link>
          <div className="eyebrow">{trailer.product}</div>
          <h1>{trailer.number}</h1>
          <p>
            {trailer.slot ?? trailer.dockDoor ?? 'Gate'} · arrived {trailer.arrivedAt} ·
            seal {trailer.seal}
          </p>
        </div>
        <div className="btn-row">
          <YardStatusPill trailer={trailer} />
          <StatusBadge status={trailer.tempStatus} />
          <OwnBadge ownership={trailer.ownership} />
          {canStageOutboundFromYard(trailer) ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void (async () => {
                  try {
                    const t = await stageOutboundFromYard(trailer.id)
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
      </div>

      <div className="detail-grid">
        <div className="panel">
          <div className="hero-temp">
            <div className="hero-temp-top">
              <div>
                <div className="eyebrow">Temperature monitoring</div>
                <h2>
                  {trailer.telemetry
                    ? 'Reefer telemetry'
                    : 'No telematics — manual only'}
                </h2>
              </div>
              <div className="meta-chip">Updated {trailer.lastUpdate}</div>
            </div>

            <div className="big-temp">
              <div className="value" style={{ color: accent }}>
                {formatTemp(trailer.actual)}
              </div>
              <div className="set">
                Setpoint {trailer.setpoint == null ? '—' : `${trailer.setpoint}°F`}
              </div>
            </div>

            <div className="panel-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <h2>Reefer telematics</h2>
              {smartDevice ? (
                <Link to="/devices">Device {smartDevice.id}</Link>
              ) : null}
            </div>
            <div className="kv" style={{ marginBottom: '0.85rem' }}>
              <div className="kv-item">
                <label>Current temperature</label>
                <strong>{formatTemp(trailer.actual)}</strong>
              </div>
              <div className="kv-item">
                <label>Set point</label>
                <strong>
                  {trailer.setpoint == null ? '—' : `${trailer.setpoint}°F`}
                </strong>
              </div>
              <div className="kv-item">
                <label>Fuel level</label>
                <strong>
                  {trailer.fuelPct == null ? 'Not available' : `${trailer.fuelPct}%`}
                </strong>
              </div>
              <div className="kv-item">
                <label>Reefer status</label>
                <strong>{reeferStatusLabel(trailer)}</strong>
              </div>
              <div className="kv-item">
                <label>Alarm codes</label>
                <strong>{alarmCodesLabel(trailer)}</strong>
              </div>
              <div className="kv-item">
                <label>Runtime hours</label>
                <strong>{runtimeHours}h</strong>
              </div>
              <div className="kv-item">
                <label>Last telemetry</label>
                <strong>{trailer.lastUpdate}</strong>
              </div>
            </div>

            {trailer.telemetry ? (
              <TelemetryExplorer trailer={trailer} accent={accent} />
            ) : (
              <div className="empty" style={{ textAlign: 'left', paddingLeft: 0 }}>
                Carrier trailers are not instrumented in this Smart Yard pilot.
                They remain on the priority walk until a carrier feed or
                supplemental approach is added.
              </div>
            )}
          </div>

          {trailer.masterNotes ? (
            <div className="note">{trailer.masterNotes}</div>
          ) : null}
          {trailer.notes ? <div className="note">{trailer.notes}</div> : null}

          <div className="panel-head" style={{ paddingTop: 0 }}>
            <h2>Recent movements</h2>
            <Link to="/movements">Full log</Link>
          </div>
          <div className="list">
            {history.length ? (
              history.map((mv) => (
                <div key={mv.id} className="list-item" style={{ cursor: 'default' }}>
                  <span className="severity ok" />
                  <div>
                    <div className="trailer-id">
                      {mv.from} → {mv.to}
                    </div>
                    <div className="trailer-meta">
                      {mv.time} · {mv.by}
                      {mv.note ? ` · ${mv.note}` : ''}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">No recent movement events</div>
            )}
          </div>
        </div>

        <div className="panel">
          <div style={{ padding: '1.2rem 1.2rem 0' }}>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/exceptions')}
              >
                Exceptions
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate('/yards')}
              >
                Yards
              </button>
            </div>
          </div>

          <div className="panel-head">
            <h2>Smart device</h2>
            {smartDevice ? (
              <Link to="/devices">All devices</Link>
            ) : (
              <Link to="/devices">Assign device</Link>
            )}
          </div>
          {smartDevice ? (
            <div className="kv">
              <div className="kv-item">
                <label>Assigned device</label>
                <strong className="mono">
                  <Link to="/devices">{smartDevice.id}</Link>
                </strong>
              </div>
              <div className="kv-item">
                <label>Device type</label>
                <strong>{smartDevice.deviceType}</strong>
              </div>
              <div className="kv-item">
                <label>Device model</label>
                <strong className="mono">{smartDevice.hardwareModel}</strong>
              </div>
              <div className="kv-item" style={{ gridColumn: '1 / -1' }}>
                <label>Capabilities</label>
                <strong>
                  <ul className="capability-checklist">
                    {ALL_SMART_CAPABILITIES.map((cap: SmartCapability) => {
                      const on = smartDevice.capabilities.includes(cap)
                      return (
                        <li key={cap} className={on ? 'cap-on' : 'cap-off'}>
                          <span aria-hidden="true">{on ? '✔' : '✖'}</span>
                          {CAPABILITY_META[cap].label}
                        </li>
                      )
                    })}
                  </ul>
                </strong>
              </div>
              {smartDevice.capabilities.includes('gps') ? (
                <div className="kv-item">
                  <label>GPS status</label>
                  <strong>{sensorBadge(smartDevice.gpsStatus)}</strong>
                </div>
              ) : null}
              {smartDevice.capabilities.includes('ble') ? (
                <div className="kv-item">
                  <label>BLE status</label>
                  <strong>{sensorBadge(smartDevice.bleStatus)}</strong>
                </div>
              ) : null}
              {smartDevice.capabilities.includes('rfid') ? (
                <div className="kv-item">
                  <label>RFID</label>
                  <strong className="mono">
                    {smartDevice.rfidTagId ?? smartDevice.id}
                  </strong>
                </div>
              ) : null}
              <div className="kv-item">
                <label>Battery</label>
                <strong>{smartDevice.batteryPct}%</strong>
              </div>
              <div className="kv-item">
                <label>Firmware</label>
                <strong className="mono">{smartDevice.firmwareVersion}</strong>
              </div>
              <div className="kv-item">
                <label>Last communication</label>
                <strong>{smartDevice.lastCommunication}</strong>
              </div>
              <div className="kv-item">
                <label>Lifecycle</label>
                <strong>{LIFECYCLE_META[smartDevice.lifecycle]}</strong>
              </div>
              <div className="kv-item">
                <label>Health score</label>
                <strong>
                  <span className={`badge ${healthScoreTone(smartDevice.healthScore)}`}>
                    {smartDevice.healthScore}/100
                  </span>
                </strong>
              </div>
              <div className="kv-item">
                <label>Connectivity</label>
                <strong>{connBadge(smartDevice.connectivity)}</strong>
              </div>
            </div>
          ) : (
            <div className="empty" style={{ padding: '0 1.2rem 1rem' }}>
              No trailer device assigned.
              {deviceHistory.length ? (
                <div className="trailer-meta" style={{ marginTop: 8 }}>
                  Last device event: {deviceHistory[0].detail}
                </div>
              ) : null}
            </div>
          )}

          <div className="panel-head">
            <h2>Trailer intelligence</h2>
            <Link to="/insights">Insights</Link>
          </div>
          {intelligence ? (
            <div className="kv">
              <div className="kv-item">
                <label>Current location</label>
                <strong>{intelligence.location}</strong>
              </div>
              <div className="kv-item">
                <label>Movement history</label>
                <strong>{intelligence.movementSnippet}</strong>
              </div>
              <div className="kv-item">
                <label>Estimated departure</label>
                <strong>{intelligence.estimatedDeparture}</strong>
              </div>
              <div className="kv-item">
                <label>Predicted dock</label>
                <strong>{intelligence.predictedDock}</strong>
              </div>
              <div className="kv-item">
                <label>Carrier reliability</label>
                <strong>{scoreBadge(intelligence.carrierScore)}</strong>
              </div>
              <div className="kv-item">
                <label>Temperature risk</label>
                <strong>
                  {smartDevice?.capabilities.includes('temperature')
                    ? scoreBadge(intelligence.tempScore)
                    : 'Not supported'}
                </strong>
              </div>
              <div className="kv-item">
                <label>Fuel risk</label>
                <strong>
                  {smartDevice?.capabilities.includes('fuel')
                    ? scoreBadge(intelligence.fuelScore)
                    : 'Not supported'}
                </strong>
              </div>
              <div className="kv-item">
                <label>Device health</label>
                <strong>
                  {intelligence.deviceHealth != null
                    ? scoreBadge(intelligence.deviceHealth)
                    : '—'}
                </strong>
              </div>
            </div>
          ) : null}

          <div className="panel-head">
            <h2>Trailer record</h2>
          </div>
          <div className="kv">
            <div className="kv-item">
              <label>Carrier</label>
              <strong>{trailer.carrier}</strong>
            </div>
            <div className="kv-item">
              <label>Record status</label>
              <strong style={{ textTransform: 'capitalize' }}>
                {trailer.recordStatus}
              </strong>
            </div>
            <div className="kv-item">
              <label>Fleet / asset ID</label>
              <strong>{trailer.fleetAssetId ?? '—'}</strong>
            </div>
            <div className="kv-item">
              <label>Trailer type</label>
              <strong>{TRAILER_TYPE_META[trailer.trailerType]}</strong>
            </div>
            <div className="kv-item">
              <label>Length</label>
              <strong>{trailer.lengthFt}′</strong>
            </div>
            <div className="kv-item">
              <label>Reefer brand</label>
              <strong>{REEFER_BRAND_META[trailer.reeferBrand]}</strong>
            </div>
            <div className="kv-item">
              <label>Default setpoint</label>
              <strong>
                {trailer.defaultSetpoint == null
                  ? '—'
                  : `${trailer.defaultSetpoint}°F`}
              </strong>
            </div>
            <div className="kv-item">
              <label>Home site</label>
              <strong>{trailer.homeSite}</strong>
            </div>
            <div className="kv-item">
              <label>Yard status</label>
              <strong>{trailer.status}</strong>
            </div>
            <div className="kv-item">
              <label>Dock workflow</label>
              <strong>
                {trailerNeedsDock(trailer)
                  ? 'Dock required'
                  : 'Yard → departure'}
              </strong>
            </div>
            <div className="kv-item">
              <label>Location</label>
              <strong>{trailer.slot ?? trailer.dockDoor ?? 'Gate'}</strong>
            </div>
            <div className="kv-item">
              <label>Zone</label>
              <strong>{trailer.zone}</strong>
            </div>
            <div className="kv-item">
              <label>Dwell</label>
              <strong>{formatDwellHours(trailer.dwellHours)}</strong>
            </div>
            <div className="kv-item">
              <label>Fuel</label>
              <strong>
                {trailer.fuelPct == null ? 'Not available' : `${trailer.fuelPct}%`}
              </strong>
            </div>
            <div className="kv-item">
              <label>Reefer alarm</label>
              <strong>{trailer.reeferAlarm ? 'Active' : 'None'}</strong>
            </div>
            <div className="kv-item">
              <label>Telemetry</label>
              <strong>{trailer.telemetry ? 'Connected' : 'Not installed'}</strong>
            </div>
            <div className="kv-item">
              <label>Mapped devices</label>
              <strong>
                {mappedDevices.length
                  ? mappedDevices
                      .map((d) => DEVICE_KIND_META[d.kind].label)
                      .join(', ')
                  : 'None'}
              </strong>
            </div>
            <div className="kv-item">
              <label>Direction</label>
              <strong style={{ textTransform: 'capitalize' }}>{trailer.direction}</strong>
            </div>
            <div className="kv-item">
              <label>Seal</label>
              <strong>{trailer.seal}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
