import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSmartYard } from '../smart/SmartYardContext'
import { useYard } from '../yard/YardContext'
import { isOnSite, SITE } from '../data/trailers'
import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { Pagination, usePagination } from '../components/Pagination'
import { useSnackbar } from '../components/Snackbar'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const { trailers, metrics, gateEvents } = useYard()
  const { devices, kpis } = useSmartYard()
  const { success, info } = useSnackbar()
  const [carrierFilter, setCarrierFilter] = useState('all')
  const [incidentsFilter, setIncidentsFilter] = useState('all')
  const [rateFilter, setRateFilter] = useState('all')

  const onSite = useMemo(() => trailers.filter(isOnSite), [trailers])
  const compliant = onSite.filter(
    (t) => t.tempStatus === 'ok' || t.tempStatus === 'na',
  )
  const compliancePct = onSite.length
    ? Math.round((compliant.length / onSite.length) * 100)
    : 100

  const telemetryPct = onSite.length
    ? Math.round((metrics.instrumented / onSite.length) * 100)
    : 0
  const dockPct = metrics.totalDocks
    ? Math.round(
        ((metrics.totalDocks - metrics.openDocks) / metrics.totalDocks) * 100,
      )
    : 0
  const checkPct = onSite.length
    ? Math.round((1 - metrics.walkCount / onSite.length) * 100)
    : 0

  const bhOnSite = onSite.filter((t) => t.ownership === 'bh').length
  const carrierOnSite = onSite.length - bhOnSite

  const tempMix = useMemo(() => {
    const critical = onSite.filter((t) => t.tempStatus === 'critical').length
    const warn = onSite.filter((t) => t.tempStatus === 'warn').length
    const offline = onSite.filter((t) => t.tempStatus === 'offline').length
    const ok = onSite.filter((t) => t.tempStatus === 'ok').length
    const total = Math.max(onSite.length, 1)
    return [
      { key: 'ok', label: 'In range', n: ok, color: '#2e7d32' },
      { key: 'warn', label: 'Warming', n: warn, color: '#9a5b00' },
      { key: 'critical', label: 'Excursion', n: critical, color: '#a6192e' },
      { key: 'offline', label: 'No signal', n: offline, color: '#6f685c' },
    ].map((s) => ({ ...s, pct: Math.round((s.n / total) * 100) }))
  }, [onSite])

  const carriers = useMemo(() => {
    return Object.entries(
      onSite.reduce<Record<string, { count: number; incidents: number }>>(
        (acc, t) => {
          const key = t.carrier
          if (!acc[key]) acc[key] = { count: 0, incidents: 0 }
          acc[key].count += 1
          if (
            t.tempStatus === 'critical' ||
            t.tempStatus === 'warn' ||
            t.reeferAlarm
          ) {
            acc[key].incidents += 1
          }
          return acc
        },
        {},
      ),
    ).sort((a, b) => b[1].incidents - a[1].incidents)
  }, [onSite])

  const carrierOptions = useMemo(
    () => uniqueOptions(carriers.map(([name]) => name)),
    [carriers],
  )
  const incidentsOptions = useMemo(
    () => uniqueOptions(carriers.map(([, v]) => String(v.incidents))),
    [carriers],
  )
  const rateOptions = useMemo(
    () => [
      { value: '0', label: '0%' },
      { value: 'low', label: '1–25%' },
      { value: 'mid', label: '26–50%' },
      { value: 'high', label: '51%+' },
    ],
    [],
  )

  const filteredCarriers = useMemo(() => {
    return carriers.filter(([name, v]) => {
      if (carrierFilter !== 'all' && name !== carrierFilter) return false
      if (incidentsFilter !== 'all' && String(v.incidents) !== incidentsFilter)
        return false
      if (rateFilter !== 'all') {
        const rate = Math.round((v.incidents / v.count) * 100)
        if (rateFilter === '0' && rate !== 0) return false
        if (rateFilter === 'low' && !(rate >= 1 && rate <= 25)) return false
        if (rateFilter === 'mid' && !(rate >= 26 && rate <= 50)) return false
        if (rateFilter === 'high' && !(rate >= 51)) return false
      }
      return true
    })
  }, [carriers, carrierFilter, incidentsFilter, rateFilter])

  const filterKey = `${carrierFilter}|${incidentsFilter}|${rateFilter}`
  const carrierPagination = usePagination(filteredCarriers, 10, filterKey)

  const dwellBuckets = [
    {
      label: '< 4 hr',
      note: 'Fresh arrivals',
      n: onSite.filter((t) => t.dwellHours < 4).length,
    },
    {
      label: '4–12 hr',
      note: 'Normal cycle',
      n: onSite.filter((t) => t.dwellHours >= 4 && t.dwellHours < 12).length,
    },
    {
      label: '12–16 hr',
      note: 'Watch list',
      n: onSite.filter((t) => t.dwellHours >= 12 && t.dwellHours < 16).length,
    },
    {
      label: '16+ hr',
      note: 'Exception risk',
      n: onSite.filter((t) => t.dwellHours >= 16).length,
    },
  ]
  const maxDwell = Math.max(...dwellBuckets.map((b) => b.n), 1)

  const inbound = gateEvents.filter((g) => g.direction === 'in').length
  const outbound = gateEvents.filter((g) => g.direction === 'out').length
  const heldGate = gateEvents.filter((g) => g.status === 'held').length

  const avgDwell = onSite.length
    ? (onSite.reduce((sum, t) => sum + t.dwellHours, 0) / onSite.length).toFixed(1)
    : '0'

  const fuelTrailers = onSite.filter((t) => t.fuelPct != null)
  const avgFuel = fuelTrailers.length
    ? Math.round(
        fuelTrailers.reduce((sum, t) => sum + (t.fuelPct ?? 0), 0) /
          fuelTrailers.length,
      )
    : 0
  const lowFuel = fuelTrailers.filter((t) => (t.fuelPct ?? 0) <= 25).length

  const deviceUtilPct = kpis.devicesTotal
    ? Math.round(
        (devices.filter((d) => d.assignedTrailer).length / kpis.devicesTotal) *
          100,
      )
    : 0

  const avgBattery = devices.length
    ? Math.round(
        devices.reduce((sum, d) => sum + d.batteryPct, 0) / devices.length,
      )
    : 0
  const lowBattery = devices.filter((d) => d.batteryPct <= 25).length

  const gpsCoveragePct = kpis.gpsCoverage
  const bleCoveragePct = kpis.bleCoverage

  const rangeLabel = 'Today'

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Reports & analytics</div>
          <h1>Analytics</h1>
          <p>
            Site performance for yard utilization, temperature compliance,
            carrier incidents, and dwell time.
          </p>
        </div>
        <div className="analytics-head-actions">
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                info(`CSV export queued for ${rangeLabel} · ${SITE.code}.`)
              }
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                success(`PDF report drafted for ${rangeLabel} · ${SITE.code}.`)
              }
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="analytics-hero">
        <div className="analytics-hero-copy">
          <div className="eyebrow">{SITE.name}</div>
          <h2>{rangeLabel} cold-chain &amp; yard pulse</h2>
          <p>
            {onSite.length} trailers on site · {metrics.occupancy}% yard fill ·{' '}
            {metrics.critical + metrics.warn} temp risks open
          </p>
          <div className="analytics-hero-links filters" role="tablist" aria-label="Quick views">
            <button
              type="button"
              role="tab"
              className="chip active"
              onClick={() => navigate('/temperature')}
            >
              Temperature
            </button>
            <button
              type="button"
              role="tab"
              className="chip"
              onClick={() => navigate('/exceptions')}
            >
              Exceptions
            </button>
            <button
              type="button"
              role="tab"
              className="chip"
              onClick={() => navigate('/yards')}
            >
              Yards
            </button>
          </div>
        </div>
        <div className="analytics-kpis">
          <KpiMeter
            label="Utilization"
            value={metrics.occupancy}
            note={`${metrics.parked}/${metrics.capacity} slots`}
            tone="gold"
          />
          <KpiMeter
            label="Compliance"
            value={compliancePct}
            note={`${compliant.length}/${onSite.length} stable`}
            tone="ok"
          />
          <KpiMeter
            label="Telemetry"
            value={telemetryPct}
            note={`${metrics.instrumented} instrumented`}
            tone="brand"
          />
          <KpiMeter
            label="Dock use"
            value={dockPct}
            note={`${metrics.totalDocks - metrics.openDocks}/${metrics.totalDocks} doors`}
            tone="gold"
          />
        </div>
      </div>

      <div className="stats stats-6 analytics-stats">
        <div className="stat frost">
          <div className="stat-label">Yard utilization</div>
          <div className="stat-value">{metrics.occupancy}%</div>
          <div className="stat-note">
            {metrics.parked}/{metrics.capacity} slots · {SITE.code}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Temp compliance</div>
          <div className="stat-value">{compliancePct}%</div>
          <div className="stat-note">
            {compliant.length}/{onSite.length} in range / N/A
          </div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Long dwell</div>
          <div className="stat-value">{metrics.longDwell}</div>
          <div className="stat-note">&gt; 12 hours on site</div>
        </div>
        <div className="stat crit">
          <div className="stat-label">Excursions</div>
          <div className="stat-value">{metrics.critical}</div>
          <div className="stat-note">{metrics.warn} warming</div>
        </div>
        <div className="stat">
          <div className="stat-label">Gate in / out</div>
          <div className="stat-value">
            {inbound}/{outbound}
          </div>
          <div className="stat-note">{heldGate} held at gate</div>
        </div>
        <div className="stat frost">
          <div className="stat-label">Check efficiency</div>
          <div className="stat-value">{checkPct}%</div>
          <div className="stat-note">
            {metrics.walkCount} prioritized of {onSite.length}
          </div>
        </div>
      </div>

      <div className="stats stats-6 analytics-stats analytics-stats-secondary">
        <div className="stat warn">
          <div className="stat-label">Trailer dwell</div>
          <div className="stat-value">{avgDwell}h</div>
          <div className="stat-note">{metrics.longDwell} over 12h</div>
        </div>
        <div className="stat frost">
          <div className="stat-label">Device health</div>
          <div className="stat-value">{avgBattery}%</div>
          <div className="stat-note">{lowBattery} below 25%</div>
        </div>
        <div className="stat">
          <div className="stat-label">GPS coverage</div>
          <div className="stat-value">{gpsCoveragePct}%</div>
          <div className="stat-note">
            Assigned trailers with GPS · {kpis.gpsActive} active
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">BLE coverage</div>
          <div className="stat-value">{bleCoveragePct}%</div>
          <div className="stat-note">
            {kpis.bleAnchorsOnline}/{kpis.bleAnchorsTotal} anchors online
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Fuel consumption</div>
          <div className="stat-value">{avgFuel}%</div>
          <div className="stat-note">
            Avg tank · {lowFuel} low fuel
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Device utilization</div>
          <div className="stat-value">{deviceUtilPct}%</div>
          <div className="stat-note">
            {kpis.devicesOnline}/{kpis.devicesTotal} online
          </div>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="panel analytics-panel">
          <div className="panel-head">
            <h2>Dwell distribution</h2>
            <span className="panel-meta">Hours on site</span>
          </div>
          <div className="analytics-bars">
            {dwellBuckets.map((b, i) => (
              <div key={b.label} className="analytics-bar-row rich">
                <div className="analytics-bar-label">
                  <strong>{b.label}</strong>
                  <span>{b.note}</span>
                </div>
                <div className="analytics-bar-track">
                  <i
                    style={{
                      width: `${(b.n / maxDwell) * 100}%`,
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                </div>
                <strong className="analytics-bar-count">{b.n}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel analytics-panel">
          <div className="panel-head">
            <h2>Cold-chain mix</h2>
            <span className="panel-meta">On-site trailers</span>
          </div>
          <div className="analytics-pie-wrap">
            <ColdChainPie slices={tempMix} total={onSite.length} />
            <div className="analytics-legend analytics-legend-tiles">
              {tempMix.map((s) => (
                <div key={s.key} className="analytics-legend-tile">
                  <i style={{ background: s.color }} />
                  <div>
                    <span>{s.label}</span>
                    <strong>
                      {s.n}
                      <em>{s.pct}%</em>
                    </strong>
                  </div>
                  <b style={{ width: `${Math.max(s.pct, 4)}%`, background: s.color }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel analytics-panel">
          <div className="panel-head">
            <h2>Fleet mix</h2>
            <span className="panel-meta">Ownership on site</span>
          </div>
          <div className="analytics-split">
            <div className="analytics-split-card bh">
              <span>BH-owned</span>
              <strong>{bhOnSite}</strong>
              <em>trailers</em>
            </div>
            <div className="analytics-split-card carrier">
              <span>Carrier</span>
              <strong>{carrierOnSite}</strong>
              <em>trailers</em>
            </div>
          </div>
          <div className="analytics-zone-grid">
            {metrics.byZone.map((z) => {
              const fill = z.total ? Math.round((z.used / z.total) * 100) : 0
              return (
                <button
                  key={z.zone}
                  type="button"
                  className="analytics-zone-card"
                  onClick={() => navigate('/yards')}
                >
                  <span>Zone {z.zone}</span>
                  <strong>
                    {z.used}/{z.total}
                  </strong>
                  <div className="analytics-mini-track">
                    <i style={{ width: `${fill}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="panel table-wrap table-wrap-filters analytics-carrier-panel">
        <div className="panel-head">
          <h2>Carrier performance</h2>
          <span className="panel-meta">
            Incident rate = temp / reefer issues while on site
          </span>
        </div>
        <table>
          <thead>
            <tr>
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
                <PlainHeader>On site</PlainHeader>
              </th>
              <th>
                <ColumnFilterHeader
                  label="Incidents"
                  value={incidentsFilter}
                  options={incidentsOptions}
                  onChange={setIncidentsFilter}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Rate"
                  value={rateFilter}
                  options={rateOptions}
                  onChange={setRateFilter}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {carrierPagination.paginatedItems.map(([name, v]) => {
              const rate = Math.round((v.incidents / v.count) * 100)
              return (
                <tr key={name}>
                  <td>
                    <div className="trailer-cell">
                      <span className="trailer-id">{name}</span>
                      <span className="trailer-meta">
                        {v.count} trailer{v.count === 1 ? '' : 's'} on site
                      </span>
                    </div>
                  </td>
                  <td className="mono">{v.count}</td>
                  <td className="mono">{v.incidents}</td>
                  <td>
                    <div className="analytics-rate-cell">
                      <span
                        className={`badge ${
                          rate >= 51 ? 'critical' : rate >= 26 ? 'warn' : 'ok'
                        }`}
                      >
                        {rate}%
                      </span>
                      <div className="analytics-mini-track">
                        <i
                          style={{
                            width: `${Math.min(rate, 100)}%`,
                            background:
                              rate >= 51
                                ? 'var(--brand)'
                                : rate >= 26
                                  ? '#9a5b00'
                                  : '#2e7d32',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!filteredCarriers.length ? (
              <tr>
                <td colSpan={4} className="empty">
                  No carriers match the column filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <Pagination
          page={carrierPagination.page}
          setPage={carrierPagination.setPage}
          pageSize={carrierPagination.pageSize}
          setPageSize={carrierPagination.setPageSize}
          total={carrierPagination.total}
          totalPages={carrierPagination.totalPages}
          rangeStart={carrierPagination.rangeStart}
          rangeEnd={carrierPagination.rangeEnd}
        />
      </div>

      <div className="analytics-insight">
        <div>
          <div className="eyebrow">Suggested focus</div>
          <h3>
            {metrics.critical > 0
              ? 'Clear critical temperature excursions first'
              : metrics.longDwell > 0
                ? 'Work long-dwell trailers before dock staging builds up'
                : 'Yard is stable — keep telemetry coverage healthy'}
          </h3>
          <p>
            {metrics.critical} excursions · {metrics.longDwell} long dwell ·{' '}
            {metrics.holds} holds · {telemetryPct}% telemetry coverage
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/exceptions')}
          >
            Open Exceptions
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/temperature')}
          >
            Cold chain board
          </button>
        </div>
      </div>
    </div>
  )
}

function KpiMeter({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: number
  note: string
  tone: 'brand' | 'gold' | 'ok'
}) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div className={`analytics-meter tone-${tone}`}>
      <div className="analytics-meter-head">
        <span>{label}</span>
        <strong>{clamped}%</strong>
      </div>
      <div className="analytics-meter-track" aria-hidden>
        <i style={{ height: `${clamped}%` }} />
      </div>
      <p>{note}</p>
    </div>
  )
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function donutArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polar(cx, cy, rOuter, startAngle)
  const outerEnd = polar(cx, cy, rOuter, endAngle)
  const innerStart = polar(cx, cy, rInner, endAngle)
  const innerEnd = polar(cx, cy, rInner, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ')
}

function ColdChainPie({
  slices,
  total,
}: {
  slices: { key: string; label: string; n: number; pct: number; color: string }[]
  total: number
}) {
  const visible = slices.filter((s) => s.n > 0)
  const sliceTotal = visible.reduce((sum, s) => sum + s.n, 0)
  const centerTotal = total || sliceTotal
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const rOuter = 78
  const rInner = 48
  const gap = 2.5

  if (sliceTotal === 0) {
    return (
      <div className="analytics-pie" aria-hidden>
        <svg viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={(rOuter + rInner) / 2}
            fill="none"
            stroke="rgba(52,48,43,0.1)"
            strokeWidth={rOuter - rInner}
          />
        </svg>
        <div className="analytics-pie-center">
          <strong>{centerTotal}</strong>
          <span>trailers</span>
        </div>
      </div>
    )
  }

  if (visible.length === 1) {
    const only = visible[0]
    return (
      <div className="analytics-pie" aria-label="Cold-chain mix">
        <svg viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={(rOuter + rInner) / 2}
            fill="none"
            stroke={only.color}
            strokeWidth={rOuter - rInner}
          />
        </svg>
        <div className="analytics-pie-center">
          <strong>{centerTotal}</strong>
          <span>trailers</span>
        </div>
      </div>
    )
  }

  let angle = 0
  const paths = visible.map((s) => {
    const sweep = (s.n / sliceTotal) * 360
    const start = angle + gap / 2
    const end = angle + sweep - gap / 2
    angle += sweep
    const safeEnd = Math.max(start + 0.5, end)
    return {
      ...s,
      d: donutArc(cx, cy, rOuter, rInner, start, safeEnd),
    }
  })

  return (
    <div className="analytics-pie" aria-label="Cold-chain mix">
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={rOuter + 4} className="analytics-pie-halo" />
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.color} className="analytics-pie-slice">
            <title>{`${p.label}: ${p.n} (${p.pct}%)`}</title>
          </path>
        ))}
      </svg>
      <div className="analytics-pie-center">
        <strong>{centerTotal}</strong>
        <span>trailers</span>
      </div>
    </div>
  )
}
