import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SITE, type TempStatus } from '../data/trailers'
import { formatDwellShort } from '../utils/usFormat'
import { OwnBadge, StatusBadge, formatTemp } from '../components/Badges'
import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { Pagination, usePagination } from '../components/Pagination'
import { useYard } from '../yard/YardContext'

const TEMP_LABELS: Record<string, string> = {
  critical: 'Excursion',
  warn: 'Warming',
  offline: 'No signal',
  ok: 'In range',
  na: 'N/A',
}

export function TemperaturePage() {
  const navigate = useNavigate()
  const { trailers, metrics: c } = useYard()
  const [trailerFilter, setTrailerFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [fuelFilter, setFuelFilter] = useState('all')
  const [updatedFilter, setUpdatedFilter] = useState('all')

  const coldChainStats = useMemo(() => {
    const tempMonitoring = trailers.filter(
      (t) => t.telemetry || t.tempStatus !== 'na',
    ).length
    const fuelMonitoring = trailers.filter((t) => t.fuelPct != null).length
    const reeferHealth = trailers.filter(
      (t) => t.telemetry && !t.reeferAlarm && t.tempStatus === 'ok',
    ).length
    const lowFuelAlerts = trailers.filter(
      (t) => t.fuelPct != null && t.fuelPct < 25,
    ).length
    const inRange = trailers.filter((t) => t.tempStatus === 'ok').length
    return {
      tempMonitoring,
      fuelMonitoring,
      reeferHealth,
      lowFuelAlerts,
      inRange,
    }
  }, [trailers])

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

  const locationOptions = useMemo(
    () =>
      uniqueOptions(
        trailers.map((t) => t.slot ?? t.dockDoor ?? 'Gate'),
      ),
    [trailers],
  )

  const statusOptions = useMemo(
    () =>
      uniqueOptions(trailers.map((t) => t.tempStatus), (v) => TEMP_LABELS[v] ?? v),
    [trailers],
  )

  const fuelOptions = useMemo(() => {
    const opts = [{ value: 'none', label: 'No fuel data' }]
    const buckets = [
      { value: 'low', label: 'Low (<25%)' },
      { value: 'mid', label: '25–50%' },
      { value: 'ok', label: '50–75%' },
      { value: 'high', label: '75%+' },
    ]
    return [...opts, ...buckets]
  }, [])

  const updatedOptions = useMemo(
    () => uniqueOptions(trailers.map((t) => t.lastUpdate)),
    [trailers],
  )

  const rows = useMemo(() => {
    return trailers
      .filter((t) => {
        if (trailerFilter !== 'all') {
          if (trailerFilter.startsWith('own:')) {
            if (t.ownership !== trailerFilter.slice(4)) return false
          } else if (trailerFilter.startsWith('num:')) {
            if (t.number !== trailerFilter.slice(4)) return false
          }
        }
        const loc = t.slot ?? t.dockDoor ?? 'Gate'
        if (locationFilter !== 'all' && loc !== locationFilter) return false
        if (statusFilter !== 'all' && t.tempStatus !== statusFilter) return false
        if (fuelFilter !== 'all') {
          if (fuelFilter === 'none') {
            if (t.fuelPct != null) return false
          } else if (t.fuelPct == null) {
            return false
          } else if (fuelFilter === 'low' && !(t.fuelPct < 25)) {
            return false
          } else if (fuelFilter === 'mid' && !(t.fuelPct >= 25 && t.fuelPct < 50)) {
            return false
          } else if (fuelFilter === 'ok' && !(t.fuelPct >= 50 && t.fuelPct < 75)) {
            return false
          } else if (fuelFilter === 'high' && !(t.fuelPct >= 75)) {
            return false
          }
        }
        if (updatedFilter !== 'all' && t.lastUpdate !== updatedFilter) return false
        return true
      })
      .sort((a, b) => {
        const rank: Record<TempStatus, number> = {
          critical: 0,
          warn: 1,
          offline: 2,
          na: 3,
          ok: 4,
        }
        return rank[a.tempStatus] - rank[b.tempStatus]
      })
  }, [
    trailers,
    trailerFilter,
    locationFilter,
    statusFilter,
    fuelFilter,
    updatedFilter,
  ])

  const filterKey = `${trailerFilter}|${locationFilter}|${statusFilter}|${fuelFilter}|${updatedFilter}`
  const pagination = usePagination(rows, 10, filterKey)

  const tempTrendNote =
    c.critical > 0
      ? `${c.critical} excursion${c.critical === 1 ? '' : 's'} active — prioritize QA holds`
      : c.warn > 0
        ? `${c.warn} unit${c.warn === 1 ? '' : 's'} warming — watch next hour`
        : `${coldChainStats.inRange} of ${c.onSite} in range`

  const fuelTrendNote =
    coldChainStats.lowFuelAlerts > 0
      ? `${coldChainStats.lowFuelAlerts} below 25% — schedule top-off before dock`
      : coldChainStats.fuelMonitoring > 0
        ? `${Math.round((coldChainStats.fuelMonitoring / c.onSite) * 100)}% fuel telemetry cover`
        : 'Limited fuel data on carrier units'

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Cold Chain Monitoring</div>
          <h1>Cold Chain Monitoring</h1>
          <p>
            Unified temperature, fuel, and reefer health across the yard — track
            excursions, low-fuel risk, and offline units that feed Exceptions and
            the priority walk.
          </p>
        </div>
        <div className="meta-chip">
          <span className="meta-dot" />
          Live · {SITE.asOf}
        </div>
      </div>

      <div className="stats stats-6">
        <div className="stat">
          <div className="stat-label">Temperature monitoring</div>
          <div className="stat-value">{coldChainStats.tempMonitoring}</div>
          <div className="stat-note">{c.instrumented} with live telemetry</div>
        </div>
        <div className="stat">
          <div className="stat-label">Fuel monitoring</div>
          <div className="stat-value">{coldChainStats.fuelMonitoring}</div>
          <div className="stat-note">Reefers reporting fuel level</div>
        </div>
        <div className="stat frost">
          <div className="stat-label">Reefer health</div>
          <div className="stat-value">{coldChainStats.reeferHealth}</div>
          <div className="stat-note">In range · no alarm</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Low fuel alerts</div>
          <div className="stat-value">{coldChainStats.lowFuelAlerts}</div>
          <div className="stat-note">Below 25% threshold</div>
        </div>
        <div className="stat crit">
          <div className="stat-label">Temperature excursions</div>
          <div className="stat-value">{c.critical}</div>
          <div className="stat-note">{c.warn} warming</div>
        </div>
        <div className="stat">
          <div className="stat-label">Trailers watched</div>
          <div className="stat-value">{c.onSite}</div>
          <div className="stat-note">{c.offline} no signal / carrier</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Temperature trends</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {c.critical + c.warn > 0 ? 'Elevated' : 'Stable'}
          </div>
          <div className="stat-note">{tempTrendNote}</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Fuel trends</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {coldChainStats.lowFuelAlerts > 0 ? 'Attention' : 'Normal'}
          </div>
          <div className="stat-note">{fuelTrendNote}</div>
        </div>
        <div className="stat frost">
          <div className="stat-label">No signal / carrier</div>
          <div className="stat-value">{c.offline}</div>
          <div className="stat-note">Manual check candidates</div>
        </div>
        <div className="stat">
          <div className="stat-label">In range</div>
          <div className="stat-value">{coldChainStats.inRange}</div>
          <div className="stat-note">Setpoint within tolerance</div>
        </div>
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
                  label="Location"
                  value={locationFilter}
                  options={locationOptions}
                  onChange={setLocationFilter}
                  searchable
                  searchPlaceholder="Search location…"
                />
              </th>
              <th>
                <PlainHeader>Temperature</PlainHeader>
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
                  label="Fuel"
                  value={fuelFilter}
                  options={fuelOptions}
                  onChange={setFuelFilter}
                />
              </th>
              <th>
                <PlainHeader>Dwell</PlainHeader>
              </th>
              <th>
                <ColumnFilterHeader
                  label="Updated"
                  value={updatedFilter}
                  options={updatedOptions}
                  onChange={setUpdatedFilter}
                  searchable
                  searchPlaceholder="Search update…"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map((t) => (
              <tr key={t.id} onClick={() => navigate(`/trailer/${t.id}`)}>
                <td>
                  <div className="trailer-cell">
                    <span className="trailer-id">{t.number}</span>
                    <span className="trailer-meta">
                      <OwnBadge ownership={t.ownership} /> · {t.carrier}
                    </span>
                  </div>
                </td>
                <td className="mono">{t.slot ?? t.dockDoor ?? 'Gate'}</td>
                <td>
                  <div className="temp-cell">
                    <span className="temp-main">{formatTemp(t.actual)}</span>
                    <span className="temp-sub">
                      Set {t.setpoint == null ? '—' : `${t.setpoint}°F`}
                    </span>
                  </div>
                </td>
                <td>
                  <StatusBadge status={t.tempStatus} />
                  {t.reeferAlarm ? (
                    <div className="temp-sub" style={{ marginTop: 6 }}>
                      Reefer alarm
                    </div>
                  ) : null}
                </td>
                <td className="mono">
                  {t.fuelPct == null ? '—' : `${t.fuelPct}%`}
                </td>
                <td className="mono">{formatDwellShort(t.dwellHours)}</td>
                <td className="trailer-meta">{t.lastUpdate}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="empty">
                  No trailers match the column filters.
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
    </div>
  )
}
