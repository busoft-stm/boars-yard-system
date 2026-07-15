import { useEffect, useState, type ReactNode } from 'react'
import { BRAND_LOGO_SRC } from '../components/BrandLogo'
import { ensureDbSeeded } from './yardDb'

export function DbBoot({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ensureDbSeeded()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err: unknown) => {
        console.error(err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to open local database')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="db-boot">
        <h1>Storage error</h1>
        <p>{error}</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="db-boot">
        <img src={BRAND_LOGO_SRC} alt="Boar’s Head" className="db-boot-logo" />
        <p>Loading Smart Yard…</p>
      </div>
    )
  }

  return children
}
