import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useYard } from '../yard/YardContext'
import { useAuth } from '../auth/AuthContext'
import { MaterialIcon } from '../components/MaterialIcon'

const tabs: {
  to: string
  label: string
  icon: string
  end?: boolean
}[] = [
  { to: '/mobile', label: 'Home', icon: 'home', end: true },
  { to: '/mobile/map', label: 'Yard', icon: 'map' },
  { to: '/mobile/scan', label: 'Scan', icon: 'qr_code_scanner' },
  { to: '/mobile/alerts', label: 'Alerts', icon: 'notifications' },
  { to: '/mobile/inspect', label: 'Inspect', icon: 'fact_check' },
]

export function MobileShell() {
  const { metrics } = useYard()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function goDesktop() {
    try {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.focus()
          const desktopUrl = `${window.location.origin}${import.meta.env.BASE_URL}`
          window.opener.location.assign(desktopUrl)
        } catch {
          // Cross-origin or blocked — still try to close this tab
        }
        window.close()
        return
      }
    } catch {
      // ignore
    }

    window.close()
    window.setTimeout(() => {
      if (!window.closed) navigate('/', { replace: true })
    }, 150)
  }

  return (
    <div className="mobile-frame">
      <div className="mobile-app">
        <header className="m-nav">
          <div className="m-nav-leading">
            <button
              type="button"
              className="m-nav-btn"
              aria-label="Back to desktop"
              title="Desktop"
              onClick={goDesktop}
            >
              <MaterialIcon name="desktop_windows" size={22} />
            </button>
          </div>
          <div className="m-nav-center">
            <div className="m-nav-title">Smart Yard</div>
            <div className="m-nav-sub">{user?.name?.split(' ')[0] ?? 'Field'}</div>
          </div>
          <div className="m-nav-trailing">
            <button
              type="button"
              className="m-nav-btn"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => {
                void logout().then(() => navigate('/login'))
              }}
            >
              <MaterialIcon name="logout" size={22} />
            </button>
          </div>
        </header>

        <div className="m-status-bar" role="status">
          <span className="m-status-dot" aria-hidden />
          <span className="m-status-label">Offline</span>
          <span className="m-status-sep" aria-hidden>
            ·
          </span>
          <span className="m-status-detail">
            {metrics.walkCount} checks cached
          </span>
          <span className="m-status-sync">Sync queued</span>
        </div>

        <main className="mobile-main">
          <Outlet />
        </main>

        <nav className="m-tabbar" aria-label="Mobile">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `m-tab ${isActive ? 'active' : ''}`.trim()
              }
            >
              <MaterialIcon name={t.icon} size={24} />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
