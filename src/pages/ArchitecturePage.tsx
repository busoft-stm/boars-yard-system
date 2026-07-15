import { useSmartYard } from '../smart/SmartYardContext'

const ARCHITECTURE_TIERS = [
  {
    title: 'Trailer',
    description:
      'Reefer or dry van on site — identity from OTM, carrier, and gate check-in.',
  },
  {
    title: 'Unified Smart Device',
    description:
      'Magnetic multi-sensor unit attached at gate — one device per trailer for yard ops.',
  },
  {
    title: 'RFID · GPS · BLE · Temperature · Fuel',
    description:
      'On-trailer sensors capture location, slot proximity, cold-chain readings, and reefer fuel where equipped.',
  },
  {
    title: 'LTE / 5G',
    description:
      'Cellular uplink from the unified device and edge gateways — no yard Wi-Fi dependency.',
  },
  {
    title: 'Cloud Platform',
    description:
      'Ingest, normalize, and persist telemetry, geofence events, and device lifecycle state.',
  },
  {
    title: 'Smart Yard Management',
    description:
      'Rules engine for dwell, temperature exceptions, slot assignment, and OEM feed correlation.',
  },
  {
    title: 'Dashboard · Mobile',
    description:
      'Command center for supervisors; mobile app for yard jockeys, gate, and dock floor.',
  },
] as const

function connectionBadgeClass(
  status: 'connected' | 'degraded' | 'paused' | 'error',
) {
  if (status === 'connected') return 'ok'
  if (status === 'degraded') return 'warn'
  return 'offline'
}

export function ArchitecturePage() {
  const { oemIntegrations } = useSmartYard()

  const connectedFeeds = oemIntegrations.filter(
    (i) => i.connectionStatus === 'connected',
  ).length

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Reference architecture</div>
          <h1>Smart Yard Architecture</h1>
          <p>
            End-to-end flow from trailer arrival through unified smart devices,
            cellular backhaul, cloud processing, and operator surfaces — with
            OEM telematics feeding the same platform.
          </p>
        </div>
        <div className="meta-chip">
          {connectedFeeds}/{oemIntegrations.length} OEM feeds connected
        </div>
      </div>

      <div className="panel smart-workflow">
        <div className="panel-head">
          <h2>Telemetry &amp; control flow</h2>
          <span className="panel-meta">Trailer → cloud → operators</span>
        </div>
        <ol className="smart-workflow-steps">
          {ARCHITECTURE_TIERS.map((tier, i) => (
            <li key={tier.title} className="smart-workflow-step">
              <strong>{i + 1}</strong>
              <span>
                <span className="trailer-id">{tier.title}</span>
                <span className="trailer-meta" style={{ display: 'block', marginTop: '0.2rem' }}>
                  {tier.description}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-head">
          <h2>Upstream data flows</h2>
          <span className="panel-meta">OEM &amp; system-of-record feeds</span>
        </div>
        <p className="trailer-meta" style={{ margin: '0 0 0.85rem' }}>
          Thermo King TracKing, Carrier Transicold Lynx Fleet, and Oracle
          Transportation Management (OTM) push trailer identity, reefer
          telemetry, and shipment context into the Smart Yard platform — OTM
          remains system of record for appointments and movements.
        </p>
        <div className="list">
          {oemIntegrations.map((integration) => (
            <div key={integration.id} className="list-item insights-list-item static">
              <span
                className={`priority ${
                  integration.connectionStatus === 'connected'
                    ? 'ok'
                    : integration.connectionStatus === 'degraded'
                      ? 'warn'
                      : 'critical'
                }`}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="btn-row" style={{ marginBottom: '0.25rem' }}>
                  <strong className="trailer-id">{integration.system}</strong>
                  <span
                    className={`badge ${connectionBadgeClass(integration.connectionStatus)}`}
                  >
                    {integration.connectionStatus}
                  </span>
                </div>
                <p className="trailer-meta" style={{ margin: 0 }}>
                  {integration.note}
                </p>
                <div className="kv compact" style={{ marginTop: '0.55rem' }}>
                  <div className="kv-item">
                    <label>Last sync</label>
                    <strong>{integration.lastSync}</strong>
                  </div>
                  <div className="kv-item">
                    <label>API health</label>
                    <strong>
                      <span
                        className={`badge ${
                          integration.apiHealth === 'online'
                            ? 'ok'
                            : integration.apiHealth === 'degraded'
                              ? 'warn'
                              : 'offline'
                        }`}
                      >
                        {integration.apiHealth}
                      </span>
                    </strong>
                  </div>
                  <div className="kv-item">
                    <label>Trailers</label>
                    <strong>{integration.connectedTrailers}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cta-strip" style={{ marginTop: '1rem' }}>
        <div>
          <div className="eyebrow">Design intent</div>
          <h3>Enhance OTM — unify yard + OEM telemetry</h3>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>
            Unified smart devices fill gaps when OEM feeds are delayed or absent;
            TracKing and Lynx reefers still stream setpoint, fuel, and alarms
            into the same exception and analytics layer.
          </p>
        </div>
      </div>
    </div>
  )
}
