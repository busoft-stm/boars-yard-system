import { useNavigate } from 'react-router-dom'
import { useYard } from '../yard/YardContext'
import { formatTemp } from '../components/Badges'
import { MaterialIcon } from '../components/MaterialIcon'
import { useAuth } from '../auth/AuthContext'

const OFFLINE_SYNC = {
  pendingCount: 3,
  lastSync: '1:42 PM',
  localStorage: '2.4 MB',
}

export function MobileHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { metrics, trailers } = useYard()
  const alerts = trailers.filter(
    (t) =>
      t.tempStatus === 'critical' ||
      t.tempStatus === 'warn' ||
      t.reeferAlarm,
  ).length
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="page-enter m-screen">
      <header className="m-large-title">
        <p className="m-greeting">Good afternoon, {firstName}</p>
        <h1>Field work</h1>
        <p className="m-subtitle">
          Exception-driven checks — not a full yard walk every cycle.
        </p>
      </header>

      <div className="m-hero-actions">
        <button
          type="button"
          className="m-btn m-btn-primary"
          onClick={() => navigate('/mobile/scan')}
        >
          <MaterialIcon name="qr_code_scanner" size={20} />
          Scan trailer
        </button>
        <button
          type="button"
          className="m-btn m-btn-secondary"
          onClick={() => navigate('/mobile/inspect')}
        >
          <MaterialIcon name="fact_check" size={20} />
          Inspect
        </button>
      </div>

      <section className="m-section">
        <h2 className="m-section-label">Today</h2>
        <div className="m-stat-row">
          <button
            type="button"
            className="m-stat"
            onClick={() => navigate('/mobile/inspect')}
          >
            <span>Queue</span>
            <strong>{metrics.walkCount}</strong>
          </button>
          <button
            type="button"
            className="m-stat m-stat-alert"
            onClick={() => navigate('/mobile/alerts')}
          >
            <span>Critical</span>
            <strong>{metrics.critical}</strong>
          </button>
          <button
            type="button"
            className="m-stat"
            onClick={() => navigate('/mobile/alerts')}
          >
            <span>Alerts</span>
            <strong>{alerts}</strong>
          </button>
          <div className="m-stat">
            <span>Pending</span>
            <strong>{OFFLINE_SYNC.pendingCount}</strong>
          </div>
        </div>
      </section>

      <section className="m-section">
        <h2 className="m-section-label">Offline sync</h2>
        <div className="m-inset-group">
          <div className="m-row">
            <div className="m-row-icon tone-warn">
              <MaterialIcon name="cloud_off" size={20} />
            </div>
            <div className="m-row-body">
              <strong>Sync queue</strong>
              <span>{OFFLINE_SYNC.pendingCount} actions waiting</span>
            </div>
            <span className="m-row-value">{OFFLINE_SYNC.lastSync}</span>
          </div>
          <div className="m-row">
            <div className="m-row-icon">
              <MaterialIcon name="storage" size={20} />
            </div>
            <div className="m-row-body">
              <strong>Local cache</strong>
              <span>IndexedDB ready</span>
            </div>
            <span className="m-row-value">{OFFLINE_SYNC.localStorage}</span>
          </div>
        </div>
      </section>

      <section className="m-section">
        <div className="m-section-head">
          <h2 className="m-section-label">Priority walk</h2>
          <button
            type="button"
            className="m-link"
            onClick={() => navigate('/mobile/inspect')}
          >
            See all
          </button>
        </div>
        <div className="m-inset-group">
          {metrics.walk.slice(0, 5).map((t) => (
            <button
              key={t.id}
              type="button"
              className="m-row m-row-btn"
              onClick={() => navigate(`/mobile/inspect?trailer=${t.id}`)}
            >
              <span
                className={`m-priority ${t.tempStatus === 'ok' ? 'warn' : t.tempStatus}`}
                aria-hidden
              />
              <div className="m-row-body">
                <strong>{t.number}</strong>
                <span>
                  {t.slot ?? 'Gate'} · {formatTemp(t.actual)}
                </span>
              </div>
              <MaterialIcon name="chevron_right" size={22} className="m-chevron" />
            </button>
          ))}
          {!metrics.walk.length ? (
            <div className="m-empty">No priority trailers</div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
