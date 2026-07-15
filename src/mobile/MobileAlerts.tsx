import { useNavigate } from 'react-router-dom'
import { useYard } from '../yard/YardContext'
import { formatTemp, OwnBadge } from '../components/Badges'
import { useSmartYard } from '../smart/SmartYardContext'
import { SMART_ALERT_LABELS } from '../data/smartEnterprise'
import { MaterialIcon } from '../components/MaterialIcon'

export function MobileAlerts() {
  const navigate = useNavigate()
  const { trailers } = useYard()
  const { smartAlerts } = useSmartYard()
  const alerts = trailers
    .filter(
      (t) =>
        t.tempStatus === 'critical' ||
        t.tempStatus === 'warn' ||
        t.reeferAlarm ||
        t.tempStatus === 'offline' ||
        t.status.includes('hold'),
    )
    .sort((a, b) => {
      const rank = { critical: 0, warn: 1, offline: 2, na: 3, ok: 4 }
      return rank[a.tempStatus] - rank[b.tempStatus]
    })

  return (
    <div className="page-enter m-screen">
      <header className="m-large-title">
        <h1>Alerts</h1>
        <p className="m-subtitle">
          Smart yard and cold-chain queue with quick actions.
        </p>
      </header>

      <section className="m-section">
        <h2 className="m-section-label">Smart alerts</h2>
        <div className="m-inset-group">
          {smartAlerts.slice(0, 8).map((a) => (
            <button
              key={a.id}
              type="button"
              className="m-row m-row-btn"
              onClick={() => navigate(a.href)}
            >
              <span className={`m-priority ${a.severity}`} aria-hidden />
              <div className="m-row-body">
                <strong>
                  {SMART_ALERT_LABELS[a.type]}
                  {a.trailerNumber ? ` · ${a.trailerNumber}` : ''}
                </strong>
                <span>
                  {a.detail} · {a.time}
                </span>
              </div>
              <MaterialIcon name="chevron_right" size={22} className="m-chevron" />
            </button>
          ))}
          {!smartAlerts.length ? (
            <div className="m-empty">No smart alerts</div>
          ) : null}
        </div>
      </section>

      <section className="m-section">
        <h2 className="m-section-label">Cold chain</h2>
        <div className="m-inset-group">
          {alerts.map((t) => (
            <div key={t.id} className="m-alert-block">
              <button
                type="button"
                className="m-row m-row-btn"
                onClick={() => navigate(`/m/inspect?trailer=${t.id}`)}
              >
                <span
                  className={`m-priority ${
                    t.tempStatus === 'ok' ? 'warn' : t.tempStatus
                  }`}
                  aria-hidden
                />
                <div className="m-row-body">
                  <strong>
                    {t.number} <OwnBadge ownership={t.ownership} />
                  </strong>
                  <span>
                    {t.slot ?? 'Gate'} · {formatTemp(t.actual)}
                    {t.reeferAlarm ? ' · alarm' : ''}
                  </span>
                </div>
              </button>
              <div className="m-alert-actions">
                <button
                  type="button"
                  className="m-btn m-btn-primary m-btn-sm"
                  onClick={() => navigate(`/m/inspect?trailer=${t.id}`)}
                >
                  Resolve
                </button>
                <button type="button" className="m-btn m-btn-secondary m-btn-sm">
                  Escalate
                </button>
              </div>
            </div>
          ))}
          {!alerts.length ? <div className="m-empty">All clear</div> : null}
        </div>
      </section>
    </div>
  )
}
