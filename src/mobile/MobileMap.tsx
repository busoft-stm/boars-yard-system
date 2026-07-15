import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useYard } from '../yard/YardContext'
import { formatTemp } from '../components/Badges'
import type { Zone } from '../data/trailers'
import { MaterialIcon } from '../components/MaterialIcon'

export function MobileMap() {
  const navigate = useNavigate()
  const { slots, getTrailer, metrics, parkingZones } = useYard()
  const [q, setQ] = useState('')
  const [zone, setZone] = useState<Zone | 'all'>('all')

  const parking = useMemo(() => {
    return slots.filter((s) => {
      if (s.type !== 'parking') return false
      if (zone !== 'all' && s.zone !== zone) return false
      if (!q.trim()) return true
      const t = s.trailerId ? getTrailer(s.trailerId) : null
      const hay = `${s.label} ${t?.number ?? ''}`.toLowerCase()
      return hay.includes(q.toLowerCase())
    })
  }, [slots, zone, q, getTrailer])

  return (
    <div className="page-enter m-screen">
      <header className="m-large-title">
        <h1>Yard</h1>
        <p className="m-subtitle">
          Find your slot — GPS to zone, then walk to the trailer.
        </p>
      </header>

      <div className="m-pill">
        <MaterialIcon name="near_me" size={16} />
        Occupancy {metrics.occupancy}%
      </div>

      <label className="m-search-field">
        <MaterialIcon name="search" size={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search trailer or slot…"
          inputMode="search"
        />
      </label>

      <div className="m-chips" role="tablist" aria-label="Zones">
        <button
          type="button"
          className={`m-chip ${zone === 'all' ? 'active' : ''}`}
          onClick={() => setZone('all')}
        >
          All
        </button>
        {parkingZones.map((z) => (
          <button
            key={z.id}
            type="button"
            className={`m-chip ${zone === z.id ? 'active' : ''}`}
            onClick={() => setZone(z.id)}
          >
            {z.name}
          </button>
        ))}
      </div>

      <div className="m-slot-grid">
        {parking.slice(0, 48).map((s) => {
          const t = s.trailerId ? getTrailer(s.trailerId) : null
          const tone = !t
            ? 'empty'
            : t.tempStatus === 'critical'
              ? 'critical'
              : t.tempStatus === 'warn'
                ? 'warn'
                : t.tempStatus === 'offline'
                  ? 'offline'
                  : 'ok'
          return (
            <button
              key={s.id}
              type="button"
              className={`m-slot ${tone}`}
              onClick={() =>
                t ? navigate(`/m/inspect?trailer=${t.id}`) : undefined
              }
            >
              <span className="m-slot-label">{s.label}</span>
              <span className="m-slot-unit">
                {t ? t.number.replace(/^BH-|^CX-/, '') : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {parking.find((s) => s.trailerId) ? (
        <p className="m-footnote">
          Critical slots glow red — tap to inspect. Sample reading{' '}
          {formatTemp(
            getTrailer(parking.find((s) => s.trailerId)!.trailerId!)?.actual ??
              null,
          )}
          .
        </p>
      ) : null}
    </div>
  )
}
