import { useEffect, useMemo, useState } from 'react'
import { SITE } from '../data/trailers'
import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { Pagination, usePagination } from '../components/Pagination'
import type { ConnStatus, OemIntegration } from '../data/smartEnterprise'
import { useSmartYard } from '../smart/SmartYardContext'

function connectionBadgeClass(status: OemIntegration['connectionStatus']) {
  if (status === 'connected') return 'ok'
  if (status === 'degraded') return 'warn'
  if (status === 'error') return 'critical'
  return 'offline'
}

function apiHealthBadgeClass(health: ConnStatus) {
  if (health === 'online') return 'ok'
  if (health === 'degraded') return 'warn'
  return 'offline'
}

function syncFreshnessSec(lastSync: string): number {
  const m = lastSync.match(/(\d+)\s*(sec|min|hr|hour)/i)
  if (!m) return Number.MAX_SAFE_INTEGER
  const n = parseInt(m[1], 10)
  if (m[2].startsWith('sec')) return n
  if (m[2].startsWith('min')) return n * 60
  return n * 3600
}

function systemOwnClass(system: OemIntegration['system']) {
  if (system.includes('Carrier')) return 'carrier'
  return 'bh'
}

function IntegrationsPageInner() {
  const { oemIntegrations } = useSmartYard()
  const [systemFilter, setSystemFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [syncFilter, setSyncFilter] = useState('all')
  const [healthFilter, setHealthFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const systemOptions = useMemo(
    () => uniqueOptions(oemIntegrations.map((i) => i.system)),
    [oemIntegrations],
  )
  const statusOptions = useMemo(
    () => uniqueOptions(oemIntegrations.map((i) => i.connectionStatus)),
    [oemIntegrations],
  )
  const syncOptions = useMemo(
    () => uniqueOptions(oemIntegrations.map((i) => i.lastSync)),
    [oemIntegrations],
  )
  const healthOptions = useMemo(
    () => uniqueOptions(oemIntegrations.map((i) => i.apiHealth)),
    [oemIntegrations],
  )

  const rows = useMemo(() => {
    return oemIntegrations.filter((i) => {
      if (systemFilter !== 'all' && i.system !== systemFilter) return false
      if (statusFilter !== 'all' && i.connectionStatus !== statusFilter)
        return false
      if (syncFilter !== 'all' && i.lastSync !== syncFilter) return false
      if (healthFilter !== 'all' && i.apiHealth !== healthFilter) return false
      return true
    })
  }, [oemIntegrations, systemFilter, statusFilter, syncFilter, healthFilter])

  useEffect(() => {
    if (!rows.length) return
    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0].id)
    }
  }, [rows, selectedId])

  const filterKey = `${systemFilter}|${statusFilter}|${syncFilter}|${healthFilter}`
  const pagination = usePagination(rows, 10, filterKey)

  const connectedCount = oemIntegrations.filter(
    (i) => i.connectionStatus === 'connected',
  ).length
  const degradedCount = oemIntegrations.filter(
    (i) => i.connectionStatus === 'degraded',
  ).length
  const trailersSum = oemIntegrations.reduce(
    (sum, i) => sum + i.connectedTrailers,
    0,
  )

  const freshestSync = useMemo(() => {
    if (!oemIntegrations.length) return '—'
    return oemIntegrations.reduce((best, i) =>
      syncFreshnessSec(i.lastSync) < syncFreshnessSec(best.lastSync) ? i : best,
    ).lastSync
  }, [oemIntegrations])

  const selected = oemIntegrations.find((i) => i.id === selectedId)

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">OEM & ERP feeds</div>
          <h1>Integrations</h1>
          <p>
            Connection status for Thermo King TracKing, Carrier Transicold Lynx
            Fleet, and Oracle Transportation Management (OTM) — reefer telemetry
            and shipment identity feeds that Smart Yard extends with yard
            visibility and exception workflows.
          </p>
        </div>
        <div className="meta-chip">
          <span className="meta-dot" />
          Last sync · {freshestSync} · {SITE.code}
        </div>
      </div>

      <div className="stats">
        <div className="stat frost">
          <div className="stat-label">Connected integrations</div>
          <div className="stat-value">{connectedCount}</div>
          <div className="stat-note">of {oemIntegrations.length} configured</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Degraded</div>
          <div className="stat-value">{degradedCount}</div>
          <div className="stat-note">Needs attention</div>
        </div>
        <div className="stat">
          <div className="stat-label">Connected trailers</div>
          <div className="stat-value">{trailersSum}</div>
          <div className="stat-note">Across all OEM feeds</div>
        </div>
        <div className="stat">
          <div className="stat-label">Last sync freshness</div>
          <div className="stat-value">{freshestSync}</div>
          <div className="stat-note">Most recent poll</div>
        </div>
      </div>

      <div className="panel table-wrap table-wrap-filters">
        <table>
          <thead>
            <tr>
              <th>
                <ColumnFilterHeader
                  label="System"
                  value={systemFilter}
                  options={systemOptions}
                  onChange={setSystemFilter}
                  searchable
                  searchPlaceholder="Search system…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Connection status"
                  value={statusFilter}
                  options={statusOptions}
                  onChange={setStatusFilter}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Last sync"
                  value={syncFilter}
                  options={syncOptions}
                  onChange={setSyncFilter}
                  searchable
                  searchPlaceholder="Search sync…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="API health"
                  value={healthFilter}
                  options={healthOptions}
                  onChange={setHealthFilter}
                />
              </th>
              <th>
                <PlainHeader>Connected trailers</PlainHeader>
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
                className={selectedId === i.id ? 'selected-row' : undefined}
                onClick={() => setSelectedId(i.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <span className={`own ${systemOwnClass(i.system)}`}>
                    {i.system}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${connectionBadgeClass(i.connectionStatus)}`}
                  >
                    {i.connectionStatus}
                  </span>
                </td>
                <td className="trailer-meta">{i.lastSync}</td>
                <td>
                  <span className={`badge ${apiHealthBadgeClass(i.apiHealth)}`}>
                    {i.apiHealth}
                  </span>
                </td>
                <td className="mono">{i.connectedTrailers}</td>
                <td className="trailer-meta">{i.note}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="empty">
                  No integrations match the column filters.
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

      <div className="panel table-wrap" style={{ marginTop: '1rem' }}>
        <div className="panel-head">
          <h2>Integration logs</h2>
          <span className="panel-meta">{selected?.system ?? '—'}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>
                <PlainHeader>Time</PlainHeader>
              </th>
              <th>
                <PlainHeader>Level</PlainHeader>
              </th>
              <th>
                <PlainHeader>Message</PlainHeader>
              </th>
            </tr>
          </thead>
          <tbody>
            {selected?.logs.map((log, idx) => (
              <tr key={`${selected.id}-${idx}`}>
                <td className="trailer-meta">{log.time}</td>
                <td>
                  <span
                    className={`badge ${
                      log.level === 'error'
                        ? 'critical'
                        : log.level === 'warn'
                          ? 'warn'
                          : 'ok'
                    }`}
                  >
                    {log.level}
                  </span>
                </td>
                <td>{log.message}</td>
              </tr>
            ))}
            {!selected?.logs.length ? (
              <tr>
                <td colSpan={3} className="empty">
                  Select an integration to view logs.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="cta-strip" style={{ marginTop: '1rem' }}>
        <div>
          <div className="eyebrow">Design intent</div>
          <h3>Enhance OTM — do not replace it</h3>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>
            Trailer identity, carrier, and yard movement remain OTM SoR. This
            platform adds cold-chain visibility and exception workflows via
            Thermo King and Carrier telematics.
          </p>
        </div>
      </div>
    </div>
  )
}

export function IntegrationsPage() {
  return <IntegrationsPageInner />
}
