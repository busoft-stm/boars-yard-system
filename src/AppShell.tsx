import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { AccountSettingsModals } from './components/AccountSettingsModals'
import {
  IconAccount,
  IconException,
  IconHistory,
  IconNotifications,
  IconSearch,
  ModalCloseBtn,
} from './components/ActionIcons'
import { BrandLogo } from './components/BrandLogo'
import { MaterialIcon } from './components/MaterialIcon'
import { roleCanAccess } from './data/users'
import { useYard } from './yard/YardContext'
import { useExceptions } from './exceptions/ExceptionsContext'
import { useNotifications } from './notifications/NotificationsContext'
import { useSmartYard } from './smart/SmartYardContext'
import { SMART_ALERT_LABELS } from './data/smartEnterprise'

const links: {
  to: string
  label: string
  icon: string
  end?: boolean
  adminOnly?: boolean
}[] = [
  { to: '/', label: 'Dashboard', icon: 'space_dashboard', end: true },
  { to: '/users', label: 'Users', icon: 'group', adminOnly: true },
  { to: '/yards', label: 'Yards', icon: 'map' },
  { to: '/dock', label: 'Docks', icon: 'warehouse' },
  { to: '/trailers', label: 'Trailers', icon: 'local_shipping' },
  { to: '/devices', label: 'Trailer Devices', icon: 'devices' },
  { to: '/infrastructure', label: 'Infrastructure', icon: 'radar' },
  { to: '/gate', label: 'Gates', icon: 'sensor_door' },
  { to: '/temperature', label: 'Cold Chain', icon: 'ac_unit' },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' },
  { to: '/reports', label: 'Reports', icon: 'description' },
  { to: '/insights', label: 'Insights', icon: 'lightbulb' },
  { to: '/integrations', label: 'Integrations', icon: 'hub' },
]

type NotifTone = 'critical' | 'warn' | 'info'

type HeaderNotification = {
  id: string
  title: string
  detail: string
  tone: NotifTone
  href: string
}

export function AppShell() {
  const { user, logout, canManageUsers } = useAuth()
  const { metrics, trailers, gateEvents } = useYard()
  const { rows: exceptionRows } = useExceptions()
  const {
    notifications: liveNotifications,
    unreadCount,
    markAllRead,
  } = useNotifications()
  const { smartAlerts } = useSmartYard()
  const navigate = useNavigate()
  const location = useLocation()
  const openExceptions = exceptionRows.filter((r) => r.status !== 'resolved')
  const [headerProfileOpen, setHeaderProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [accountPanel, setAccountPanel] = useState<'profile' | 'password' | null>(
    null,
  )
  const [searchQ, setSearchQ] = useState('')
  const headerRef = useRef<HTMLElement>(null)

  const baselineNotifications = useMemo(() => {
    const items: HeaderNotification[] = []

    for (const alert of smartAlerts.slice(0, 5)) {
      items.push({
        id: `smart-${alert.id}`,
        title: alert.title || SMART_ALERT_LABELS[alert.type],
        detail: `${alert.detail}${alert.trailerNumber ? ` · ${alert.trailerNumber}` : ''} · ${alert.time}`,
        tone: alert.severity,
        href: alert.href,
      })
    }

    for (const row of openExceptions.slice(0, 4)) {
      const t = trailers.find((x) => x.id === row.trailerId)
      items.push({
        id: `ex-${row.id}`,
        title: t?.number ?? 'Trailer',
        detail: `${row.reason} · ${row.status}${row.assignee ? ` · ${row.assignee}` : ''}`,
        tone:
          row.severity === 'critical'
            ? 'critical'
            : row.severity === 'warn'
              ? 'warn'
              : 'info',
        href: '/exceptions',
      })
    }

    for (const g of gateEvents
      .filter((e) => e.status === 'held' || e.status === 'processing')
      .slice(0, 2)) {
      items.push({
        id: `gate-${g.id}`,
        title: `Gate · ${g.trailerNumber}`,
        detail: `${g.status} · ${g.lane} · ${g.time}`,
        tone: g.status === 'held' ? 'critical' : 'warn',
        href: '/gate',
      })
    }

    if (metrics.critical > 0) {
      items.push({
        id: 'temp-crit',
        title: 'Cold-chain excursions',
        detail: `${metrics.critical} trailer${metrics.critical === 1 ? '' : 's'} above critical threshold`,
        tone: 'critical',
        href: '/temperature',
      })
    }

    return items
  }, [smartAlerts, openExceptions, trailers, gateEvents, metrics.critical])

  const notifications = useMemo(() => {
    const live: HeaderNotification[] = liveNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      detail: n.detail,
      tone: n.tone,
      href: n.href,
    }))
    const seen = new Set(live.map((n) => n.id))
    const rest = baselineNotifications.filter((n) => !seen.has(n.id))
    return [...live, ...rest].slice(0, 12)
  }, [liveNotifications, baselineNotifications])

  const notifBadge = unreadCount > 0 ? unreadCount : 0

  const visibleLinks = links.filter((l) => {
    if (l.adminOnly) return canManageUsers
    if (!user) return false
    return roleCanAccess(user.role, l.to)
  })

  useEffect(() => {
    if (!notifOpen && !headerProfileOpen && !helpOpen) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (!headerRef.current?.contains(target)) {
        setNotifOpen(false)
        setHeaderProfileOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNotifOpen(false)
        setHeaderProfileOpen(false)
        setHelpOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifOpen, headerProfileOpen, helpOpen])

  function handleLogout() {
    setHeaderProfileOpen(false)
    void logout().then(() => navigate('/login', { replace: true }))
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    const q = searchQ.trim().toLowerCase()
    if (!q) return
    const trailer = trailers.find(
      (t) =>
        t.number.toLowerCase().includes(q) ||
        t.seal.toLowerCase().includes(q) ||
        (t.slot ?? '').toLowerCase().includes(q) ||
        (t.fleetAssetId ?? '').toLowerCase().includes(q),
    )
    if (trailer) {
      navigate(`/trailer/${trailer.id}`)
      return
    }
    if (q.includes('exception')) {
      navigate('/exceptions')
      return
    }
    if (q.includes('gate')) {
      navigate('/gate')
      return
    }
    if (q.includes('dock')) {
      navigate('/dock')
      return
    }
    if (q.includes('device')) {
      navigate('/devices')
      return
    }
    navigate(`/trailers`)
  }

  const pathBlocked =
    !!user &&
    (location.pathname === '/users'
      ? !canManageUsers
      : !roleCanAccess(user.role, location.pathname))

  const exceptionsActive = location.pathname.startsWith('/exceptions')
  const movementActive = location.pathname.startsWith('/movements')
  const mobileActive =
    location.pathname === '/mobile' ||
    location.pathname.startsWith('/mobile/')
  const mobileUrl = `${window.location.origin}${import.meta.env.BASE_URL}mobile`

  return (
    <div className="app app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandLogo className="brand-logo sidebar-logo" size={44} />
          <div className="brand-text">
            <div className="brand-name">Boar’s Head</div>
            <div className="brand-sub">Smart Yard</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <div className="sidebar-nav-scroll">
            {visibleLinks.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="sidebar-nav-link">
                <MaterialIcon name={l.icon} size={20} />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </div>
          <div className="sidebar-nav-actions">
            <button
              type="button"
              className="sidebar-nav-link sidebar-nav-action"
              onClick={() => {
                setNotifOpen(false)
                setHeaderProfileOpen(false)
                setHelpOpen(true)
              }}
            >
              <MaterialIcon name="support_agent" size={20} />
              <span>Support</span>
            </button>
            <button
              type="button"
              className="sidebar-nav-link sidebar-nav-action"
              onClick={handleLogout}
            >
              <MaterialIcon name="logout" size={20} />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </aside>

      <div className="shell-main">
        <header className="app-top-header" ref={headerRef}>
          <form className="app-top-search" onSubmit={handleSearch} role="search">
            <IconSearch size={20} />
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search facilities, assets, or tags…"
              aria-label="Search facilities, assets, or tags"
            />
          </form>

          <nav className="app-top-links" aria-label="Quick">
            <NavLink
              to="/exceptions"
              className={() =>
                `app-top-link ${exceptionsActive ? 'active' : ''}`
              }
            >
              <IconException size={18} />
              Exceptions
            </NavLink>
            <NavLink
              to="/movements"
              className={() => `app-top-link ${movementActive ? 'active' : ''}`}
            >
              <IconHistory size={18} />
              Movement
            </NavLink>
            <a
              href={mobileUrl}
              className={`app-top-link ${mobileActive ? 'active' : ''}`}
              target="_blank"
              rel="opener"
              onClick={(e) => {
                e.preventDefault()
                window.open(mobileUrl, '_blank')
              }}
            >
              <MaterialIcon name="smartphone" size={18} />
              Mobile
            </a>
          </nav>

          <div className="app-top-divider" aria-hidden />

          <div className="app-top-utils">
            <div className="header-notif">
              <button
                type="button"
                className={`app-top-icon-btn ${notifOpen ? 'open' : ''}`}
                aria-label={`${notifBadge} unread notifications`}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
                title="Notifications"
                onClick={() => {
                  setNotifOpen((v) => {
                    const next = !v
                    if (next) markAllRead()
                    return next
                  })
                  setHeaderProfileOpen(false)
                }}
              >
                <IconNotifications size={22} />
                {notifBadge > 0 ? (
                  <span className="app-top-notif-dot" aria-hidden />
                ) : null}
              </button>
              {notifOpen ? (
                <div
                  className="header-notif-dropdown"
                  role="dialog"
                  aria-label="Notifications"
                >
                  <div className="header-notif-head">
                    <strong>Notifications</strong>
                    <span>{notifications.length} recent</span>
                  </div>
                  <div className="header-notif-list">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="header-notif-item"
                        onClick={() => {
                          setNotifOpen(false)
                          navigate(n.href)
                        }}
                      >
                        <span
                          className={`header-notif-dot ${n.tone}`}
                          aria-hidden
                        />
                        <span className="header-notif-copy">
                          <strong>{n.title}</strong>
                          <span>{n.detail}</span>
                        </span>
                      </button>
                    ))}
                    {!notifications.length ? (
                      <div className="header-notif-empty">
                        No new notifications
                      </div>
                    ) : null}
                  </div>
                  <div className="header-notif-foot">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setNotifOpen(false)
                        navigate('/exceptions')
                      }}
                    >
                      View exceptions
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="app-top-profile">
              <button
                type="button"
                className={`app-top-icon-btn ${headerProfileOpen ? 'open' : ''}`}
                aria-label="Account menu"
                aria-expanded={headerProfileOpen}
                aria-haspopup="menu"
                title="Account"
                onClick={() => {
                  setHeaderProfileOpen((v) => !v)
                  setNotifOpen(false)
                }}
              >
                <IconAccount size={24} />
              </button>
              {headerProfileOpen ? (
                <div className="app-top-profile-menu" role="menu">
                  <div className="app-top-profile-meta">
                    <strong>{user?.name}</strong>
                    <span>{user?.roleLabel}</span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="sidebar-settings-item"
                    onClick={() => {
                      setHeaderProfileOpen(false)
                      setAccountPanel('profile')
                    }}
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="sidebar-settings-item"
                    onClick={() => {
                      setHeaderProfileOpen(false)
                      setAccountPanel('password')
                    }}
                  >
                    Change password
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="sidebar-settings-item sidebar-settings-item-danger"
                    onClick={handleLogout}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="shell">
          {pathBlocked ? <Navigate to="/" replace /> : <Outlet />}
        </main>
      </div>

      <AccountSettingsModals
        panel={accountPanel}
        onClose={() => setAccountPanel(null)}
      />

      {helpOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="modal-panel modal-panel-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Support</div>
                <h2 id="help-title">Help</h2>
              </div>
              <ModalCloseBtn onClick={() => setHelpOpen(false)} />
            </div>
            <div className="modal-body">
              <p className="trailer-meta" style={{ marginTop: 0 }}>
                Smart Yard guides yard ops, cold-chain checks, gate, and
                exceptions for this site.
              </p>
              <ul className="help-list">
                <li>
                  Demo sign-in password: <strong>yard-demo</strong>
                </li>
                <li>
                  Use Settings to edit your profile or change your password.
                </li>
                <li>
                  Ask a Platform Admin for role changes or new user accounts.
                </li>
              </ul>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setHelpOpen(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
