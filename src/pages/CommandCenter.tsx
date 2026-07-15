import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SITE } from '../data/trailers'
import { OwnBadge, StatusBadge, formatTemp } from '../components/Badges'
import { useSmartYard } from '../smart/SmartYardContext'
import { useYard } from '../yard/YardContext'
import {
  MiniBarChart,
  MiniLineChart,
  MiniPieChart,
} from '../components/DashCharts'
import { OpsKpiCard } from '../components/OpsKpiCard'
import { useExceptions } from '../exceptions/ExceptionsContext'
import { useGeofence } from '../geofence/GeofenceContext'
import { trailerHasOpsHold } from '../data/trailers'

export function CommandCenter() {
  const navigate = useNavigate()
  const { trailers, movements, gateEvents, metrics: m } = useYard()
  const { kpis, smartAlerts } = useSmartYard()
  const { rows: exceptionRows } = useExceptions()
  const { pendingRecovery, unacknowledged } = useGeofence()

  const topSmartAlerts = smartAlerts.slice(0, 4)

  const hot = trailers
    .filter(
      (t) =>
        t.tempStatus === 'critical' ||
        t.tempStatus === 'warn' ||
        trailerHasOpsHold(t),
    )
    .slice(0, 5)
  const recentMoves = movements.slice(0, 5)
  const liveGate = gateEvents.filter((g) => g.status !== 'cleared')

  const onSiteTrailers = useMemo(
    () =>
      trailers.filter(
        (t) => t.recordStatus === 'active' && t.status !== 'Departed',
      ),
    [trailers],
  )

  const zoneBarData = useMemo(
    () =>
      m.byZone
        .filter((z) => z.zone !== 'Dock' && z.zone !== 'Gate')
        .map((z, i) => ({
          label: z.zone,
          value: z.used,
          color: ['#730010', '#a6192e', '#8a7449', '#42683d'][i % 4],
        })),
    [m.byZone],
  )

  const tempPieSlices = useMemo(() => {
    const counts = { ok: 0, warn: 0, critical: 0, offline: 0 }
    for (const t of onSiteTrailers) {
      if (t.tempStatus in counts) counts[t.tempStatus as keyof typeof counts] += 1
      else counts.offline += 1
    }
    return [
      { label: 'OK', value: counts.ok, color: '#42683d' },
      { label: 'Warm', value: counts.warn, color: '#ab965d' },
      { label: 'Critical', value: counts.critical, color: '#a6192e' },
      { label: 'Offline', value: counts.offline, color: '#6b645a' },
    ]
  }, [onSiteTrailers])

  const gateFlowLine = useMemo(() => {
    const hours = ['6a', '8a', '10a', '12p', '2p', '4p']
    const base = Math.max(2, Math.round(gateEvents.length / 2))
    const shape = [0.55, 0.8, 1.15, 1.35, 1.1, 0.75]
    return hours.map((label, i) => ({
      label,
      value: Math.max(1, Math.round(base * shape[i]!)),
    }))
  }, [gateEvents.length])

  const dwellBarData = useMemo(() => {
    const buckets = [
      { label: '<4h', min: 0, max: 4, color: '#42683d' },
      { label: '4–8h', min: 4, max: 8, color: '#8a7449' },
      { label: '8–12h', min: 8, max: 12, color: '#ab965d' },
      { label: '>12h', min: 12, max: 999, color: '#a6192e' },
    ]
    return buckets.map((b) => ({
      label: b.label,
      value: onSiteTrailers.filter(
        (t) => t.dwellHours >= b.min && t.dwellHours < b.max,
      ).length,
      color: b.color,
    }))
  }, [onSiteTrailers])

  const fuelLineData = useMemo(() => {
    const hours = ['6a', '8a', '10a', '12p', '2p', '4p']
    const fueled = onSiteTrailers.filter((t) => t.fuelPct != null)
    const avg =
      fueled.length === 0
        ? 55
        : Math.round(
            fueled.reduce((s, t) => s + (t.fuelPct ?? 0), 0) / fueled.length,
          )
    const drift = [-6, -3, 1, 0, -2, -4]
    return hours.map((label, i) => ({
      label,
      value: Math.max(15, Math.min(95, avg + drift[i]!)),
    }))
  }, [onSiteTrailers])

  const ownershipPie = useMemo(() => {
    let bh = 0
    let carrier = 0
    for (const t of onSiteTrailers) {
      if (t.ownership === 'bh') bh += 1
      else carrier += 1
    }
    return [
      { label: 'BH-owned', value: bh, color: '#a6192e' },
      { label: 'Carrier', value: carrier, color: '#8a7449' },
    ]
  }, [onSiteTrailers])

  const facilityZones = useMemo(() => {
    const zones = m.byZone.filter(
      (z) => z.zone !== 'Dock' && z.zone !== 'Gate',
    )
    const primaryOrder = ['A', 'B', 'C', 'D']
    const primary = primaryOrder
      .map((id) => zones.find((z) => z.zone === id))
      .filter((z): z is NonNullable<typeof z> => z != null)
    const extra = zones.filter((z) => !primaryOrder.includes(z.zone))
    return { primary, extra }
  }, [m.byZone])

  const lowFuelCount = useMemo(
    () =>
      onSiteTrailers.filter((t) => t.fuelPct != null && t.fuelPct < 25).length,
    [onSiteTrailers],
  )

  const openExceptions = useMemo(
    () => exceptionRows.filter((r) => r.status !== 'resolved').length,
    [exceptionRows],
  )

  const recoveryCount = pendingRecovery.length
  const geofenceOpen = unacknowledged.length

  function zoneBarTone(zone: string, index: number) {
    if (zone === 'A' || zone === 'B') return 'maroon'
    if (zone === 'C' || zone === 'D') return 'olive'
    return index % 2 === 0 ? 'maroon' : 'olive'
  }

  return (
    <div className="page-enter ops-dash">
      <div className="page-head">
        <div>
          <div className="eyebrow">{SITE.name}</div>
          <h1>Dashboard</h1>
          <p>
            Live site overview — occupancy, docks, gate flow, cold chain, smart
            devices, and open exceptions — with shortcuts to what needs
            attention.
          </p>
        </div>
        <div className="meta-chip">
          <span className="meta-dot" />
          Live · {SITE.asOf}
        </div>
      </div>

      {recoveryCount > 0 ? (
        <div className="panel ble-recommend-banner" role="status">
          <div>
            <div className="eyebrow">Geofence · device recovery</div>
            <strong>
              {pendingRecovery[0]!.trailerNumber}
              {pendingRecovery[0]!.deviceId
                ? ` · ${pendingRecovery[0]!.deviceId}`
                : ''}
              {recoveryCount > 1 ? ` · +${recoveryCount - 1}` : ''}
            </strong>
            <p className="trailer-meta" style={{ margin: '0.25rem 0 0' }}>
              Left yard perimeter with an assigned Trailer Device
            </p>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/gate')}
            >
              Recover at Gate
            </button>
          </div>
        </div>
      ) : null}

      <div className="ops-kpi-grid ops-kpi-grid-5">
        <OpsKpiCard
          label="On site"
          value={m.onSite}
          note={`${m.parked} parked · ${m.atDock} at dock`}
        />
        <OpsKpiCard
          label="Yard occupancy"
          value={`${m.occupancy}%`}
          note={`${m.parked} / ${m.capacity} slots`}
        />
        <OpsKpiCard
          label="Open dock doors"
          value={`${m.openDocks}/${m.totalDocks}`}
          note={`${m.readyDock} ready to dock`}
        />
        <OpsKpiCard
          label="Holds & dwell"
          value={m.holds + m.longDwell}
          note={`${m.holds} holds · ${m.longDwell} >12h`}
        />
        <OpsKpiCard
          label="Priority walk"
          value={m.walkCount}
          note={`of ${m.onSite} trailers`}
        />
      </div>

      <section className="ops-zone-panel">
        <div className="ops-section-head">
          <h3>Facility zone occupancy</h3>
          <Link to="/map">View layout</Link>
        </div>
        <div className="ops-zone-grid">
          {facilityZones.primary.map((z, i) => (
            <button
              key={z.zone}
              type="button"
              className="ops-zone-item"
              onClick={() => navigate('/map')}
            >
              <div className="ops-zone-item-top">
                <span className="ops-zone-name">Zone {z.zone}</span>
                <strong className="ops-zone-count">
                  {z.used}/{z.total}
                </strong>
              </div>
              <div className={`ops-zone-track tone-${zoneBarTone(z.zone, i)}`}>
                <i
                  style={{
                    width: `${Math.min(
                      100,
                      (z.used / Math.max(1, z.total)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </button>
          ))}
        </div>
        {facilityZones.extra.length ? (
          <>
            <div className="ops-zone-divider" role="presentation" />
            <div className="ops-zone-grid ops-zone-grid-extra">
              {facilityZones.extra.map((z, i) => (
                <button
                  key={z.zone}
                  type="button"
                  className="ops-zone-item"
                  onClick={() => navigate('/map')}
                >
                  <div className="ops-zone-item-top">
                    <span className="ops-zone-name">Zone {z.zone}</span>
                    <strong className="ops-zone-count">
                      {z.used}/{z.total}
                    </strong>
                  </div>
                  <div
                    className={`ops-zone-track tone-${zoneBarTone(z.zone, i)}`}
                  >
                    <i
                      style={{
                        width: `${Math.min(
                          100,
                          (z.used / Math.max(1, z.total)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <div className="ops-kpi-grid ops-kpi-grid-5">
        <OpsKpiCard
          label="Temp excursions"
          value={m.critical}
          note={`${m.warn} warming trend`}
          alert={m.critical > 0}
        />
        <OpsKpiCard
          label="Offline devices"
          value={kpis.offlineDevices}
          note="Needs swap"
          alert={kpis.offlineDevices > 0}
        />
        <OpsKpiCard
          label="Low fuel"
          value={lowFuelCount}
          note="Below 25% tank"
          alert={lowFuelCount > 0}
        />
        <OpsKpiCard
          label="Exceptions"
          value={openExceptions}
          note="Open · needs action"
          alert={openExceptions > 0}
        />
        <OpsKpiCard
          label="Geofence events"
          value={geofenceOpen}
          note={`${recoveryCount} need device recovery`}
          alert={recoveryCount > 0}
        />
      </div>

      <section className="ops-charts-band" style={{ marginTop: '0.75rem' }}>
        <div className="ops-section-head">
          <h3>Device capability coverage</h3>
          <Link to="/analytics">Coverage detail</Link>
        </div>
        <div className="ops-kpi-grid ops-kpi-grid-coverage">
          <OpsKpiCard
            label="GPS coverage"
            value={`${kpis.gpsCoverage}%`}
            note="Assigned trailers"
          />
          <OpsKpiCard
            label="BLE coverage"
            value={`${kpis.bleCoverage}%`}
            note="Assigned trailers"
          />
          <OpsKpiCard
            label="Temp monitoring"
            value={`${kpis.temperatureCoverage}%`}
            note="Cold-chain capable"
          />
          <OpsKpiCard
            label="Fuel monitoring"
            value={`${kpis.fuelCoverage}%`}
            note="Fuel capable"
          />
          <OpsKpiCard
            label="RFID coverage"
            value={`${kpis.rfidCoverage}%`}
            note="Gate ID capable"
          />
          <OpsKpiCard
            label="Connected devices"
            value={`${kpis.connectedCoverage}%`}
            note="LTE/5G capable"
          />
        </div>
      </section>

      <section className="ops-charts-band">
        <div className="ops-section-head">
          <h3>Operational charts</h3>
          <Link to="/analytics">Full analytics</Link>
        </div>
        <div className="ops-charts-grid">
          <article className="ops-chart-card">
            <div className="ops-chart-card-head">
              <h4>Zone occupancy</h4>
              <span>Bar · trailers parked</span>
            </div>
            <MiniBarChart
              data={zoneBarData}
              ariaLabel="Trailers parked by zone"
            />
          </article>

          <article className="ops-chart-card">
            <div className="ops-chart-card-head">
              <h4>Cold-chain status</h4>
              <span>Pie · on-site mix</span>
            </div>
            <MiniPieChart
              slices={tempPieSlices}
              centerLabel="on site"
              ariaLabel="Cold-chain status mix"
            />
          </article>

          <article className="ops-chart-card">
            <div className="ops-chart-card-head">
              <h4>Gate volume (today)</h4>
              <span>Line · events by hour</span>
            </div>
            <MiniLineChart
              data={gateFlowLine}
              ariaLabel="Gate events by hour"
              accent="#730010"
            />
          </article>

          <article className="ops-chart-card">
            <div className="ops-chart-card-head">
              <h4>Dwell distribution</h4>
              <span>Bar · hours on site</span>
            </div>
            <MiniBarChart
              data={dwellBarData}
              ariaLabel="Trailer dwell time distribution"
            />
          </article>

          <article className="ops-chart-card">
            <div className="ops-chart-card-head">
              <h4>Avg reefer fuel</h4>
              <span>Line · tank % trend</span>
            </div>
            <MiniLineChart
              data={fuelLineData}
              ariaLabel="Average reefer fuel trend"
              accent="#8a7449"
            />
          </article>

          <article className="ops-chart-card">
            <div className="ops-chart-card-head">
              <h4>Ownership mix</h4>
              <span>Pie · BH vs carrier</span>
            </div>
            <MiniPieChart
              slices={ownershipPie}
              centerLabel="trailers"
              ariaLabel="Ownership mix"
            />
          </article>
        </div>
      </section>

      <section className="ops-panel">
        <div className="ops-section-head inset">
          <h3>Smart alerts</h3>
          <Link to="/devices">All devices</Link>
        </div>
        <div className="ops-alert-list">
          {topSmartAlerts.map((a) => (
            <Link key={a.id} to={a.href} className="ops-alert-row">
              <span
                className={`ops-alert-dot ${
                  a.severity === 'critical'
                    ? 'critical'
                    : a.severity === 'warn'
                      ? 'warn'
                      : 'info'
                }`}
              />
              <div className="ops-alert-copy">
                <strong>
                  {a.title || SMART_ALERT_LABELS[a.type]}
                  {a.trailerNumber ? ` · ${a.trailerNumber}` : ''}
                </strong>
                <span>
                  {a.detail} · {a.time}
                </span>
              </div>
              <span
                className={`ops-alert-badge ${
                  a.severity === 'critical'
                    ? 'critical'
                    : a.severity === 'warn'
                      ? 'warn'
                      : 'info'
                }`}
              >
                {a.severity}
              </span>
            </Link>
          ))}
          {!topSmartAlerts.length ? (
            <div className="empty" style={{ padding: '1rem 1.15rem' }}>
              No open smart alerts
            </div>
          ) : null}
        </div>
      </section>

      <div className="ops-tri-grid">
        <section className="ops-panel">
          <div className="ops-section-head inset">
            <h3>Needs attention</h3>
            <Link to="/exceptions">Exceptions</Link>
          </div>
          <div className="ops-feed-list">
            {hot.map((t) => (
              <button
                key={t.id}
                type="button"
                className="ops-feed-row"
                onClick={() => navigate(`/trailer/${t.id}`)}
              >
                <span
                  className={`ops-alert-dot ${
                    t.tempStatus === 'critical' || t.status.includes('hold')
                      ? 'critical'
                      : t.tempStatus === 'warn'
                        ? 'warn'
                        : 'info'
                  }`}
                />
                <div className="ops-alert-copy">
                  <strong>
                    {t.number} <OwnBadge ownership={t.ownership} />
                  </strong>
                  <span>
                    {t.status} · {t.slot ?? t.dockDoor ?? 'Gate'} ·{' '}
                    {formatTemp(t.actual)}
                  </span>
                </div>
                <StatusBadge status={t.tempStatus} />
              </button>
            ))}
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-section-head inset">
            <h3>Gate activity</h3>
            <Link to="/gate">Gates</Link>
          </div>
          <div className="ops-feed-list">
            {(liveGate.length ? liveGate : gateEvents.slice(0, 4)).map((g) => (
              <button
                key={g.id}
                type="button"
                className="ops-feed-row"
                onClick={() => navigate(`/trailer/${g.trailerId}`)}
              >
                <span
                  className={`ops-alert-dot ${
                    g.status === 'held'
                      ? 'critical'
                      : g.direction === 'in'
                        ? 'info'
                        : 'warn'
                  }`}
                />
                <div className="ops-alert-copy">
                  <strong>
                    {g.direction === 'in' ? 'IN' : 'OUT'} · {g.trailerNumber}
                  </strong>
                  <span>
                    {g.time} · {g.lane} · {g.carrier}
                  </span>
                </div>
                <span
                  className={`ops-alert-badge ${
                    g.status === 'held'
                      ? 'critical'
                      : g.status === 'processing'
                        ? 'warn'
                        : 'info'
                  }`}
                >
                  {g.status}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="ops-panel">
          <div className="ops-section-head inset">
            <h3>Recent movements</h3>
            <Link to="/movements">Movement log</Link>
          </div>
          <div className="ops-feed-list">
            {recentMoves.map((mv) => (
              <button
                key={mv.id}
                type="button"
                className="ops-feed-row"
                onClick={() => navigate(`/trailer/${mv.trailerId}`)}
              >
                <span className="ops-alert-dot info" />
                <div className="ops-alert-copy">
                  <strong>{mv.trailerNumber}</strong>
                  <span>
                    {mv.time} · {mv.from} → {mv.to}
                  </span>
                </div>
                <span className="ops-move-type">
                  {mv.type.replaceAll('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <footer className="ops-pilot">
        <div className="ops-pilot-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/map')}
          >
            Open Yards
          </button>
          <button
            type="button"
            className="btn btn-ghost ops-pilot-secondary"
            onClick={() => navigate('/exceptions')}
          >
            Exceptions
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/temperature')}
          >
            Cold chain board
          </button>
        </div>
        <p className="ops-pilot-tagline">
          Operate the yard from exception-driven workflows
        </p>
      </footer>
    </div>
  )
}
