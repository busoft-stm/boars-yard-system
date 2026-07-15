import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BrandLogo } from '../components/BrandLogo'

export function LoginPage() {
  const { login, isAuthenticated, ready } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('alex.rivera@boarshead.com')
  const [password, setPassword] = useState('yard-demo')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (ready && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await login(email, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="login-page">
      <aside className="login-hero" aria-hidden>
        <div className="login-hero-overlay" />
        <div className="login-hero-content">
          <BrandLogo className="login-brand-logo" size={72} />
          <p className="login-kicker">Since 1905</p>
          <h1>Boar’s Head</h1>
          <p className="login-tagline">
            Smart Yard Management — refrigerated trailer visibility, gate
            operations, and exception-driven walks across the distribution
            network.
          </p>
          <ul className="login-points">
            <li>Live yard & dock occupancy</li>
            <li>Reefer temperature monitoring</li>
            <li>Gate check-in & slot assignment</li>
            <li>Priority walk for Ops & QA</li>
          </ul>
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <div className="login-card-brand">
            <BrandLogo size={48} />
          </div>
          <div className="eyebrow">Secure access</div>
          <h2>Sign in</h2>
          <p className="login-help">
            Sign in with your work email and password. Platform Admin creates
            accounts and can reset passwords from Users.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            {error ? <div className="form-error">{error}</div> : null}

            <label className="field">
              <span>Work email</span>
              <input
                className="search"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@boarshead.com"
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                className="search"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            <div className="login-row">
              <label className="check-row">
                <input type="checkbox" defaultChecked />
                <span>Keep me signed in</span>
              </label>
              <button type="button" className="linkish">
                Forgot password?
              </button>
            </div>

            <button type="submit" className="btn btn-primary login-submit" disabled={busy || !ready}>
              {busy ? 'Signing in…' : 'Sign in to Yard'}
            </button>
          </form>

          <p className="login-footnote">
            Demo accounts use password: <strong>yard-demo</strong>
          </p>
        </div>
      </main>
    </div>
  )
}
