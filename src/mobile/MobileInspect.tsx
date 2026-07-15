import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useYard } from '../yard/YardContext'
import { formatTemp } from '../components/Badges'
import { MaterialIcon } from '../components/MaterialIcon'

export function MobileInspect() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { trailers, getTrailer } = useYard()
  const initial = params.get('trailer')
  const [trailerId, setTrailerId] = useState(initial ?? trailers[0]?.id ?? '')
  const trailer = getTrailer(trailerId)
  const [temp, setTemp] = useState(trailer?.actual?.toString() ?? '')
  const [fuel, setFuel] = useState(trailer?.fuelPct?.toString() ?? '')
  const [sealOk, setSealOk] = useState(true)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const queue = useMemo(
    () =>
      trailers.filter(
        (t) =>
          t.tempStatus === 'critical' ||
          t.tempStatus === 'warn' ||
          !t.telemetry ||
          t.status.includes('hold'),
      ),
    [trailers],
  )

  function save() {
    setSaved(true)
  }

  return (
    <div className="page-enter m-screen">
      <header className="m-large-title">
        <h1>Inspect</h1>
        <p className="m-subtitle">
          Capture temp, fuel, and seal — syncs when you reconnect.
        </p>
      </header>

      <div className="m-pill m-pill-warn">
        <MaterialIcon name="cloud_off" size={16} />
        Offline · will sync later
      </div>

      <section className="m-section">
        <h2 className="m-section-label">Trailer</h2>
        <div className="m-inset-group m-form-group">
          <label className="m-form-row">
            <span>Unit</span>
            <select
              value={trailerId}
              onChange={(e) => {
                setTrailerId(e.target.value)
                const t = getTrailer(e.target.value)
                setTemp(t?.actual?.toString() ?? '')
                setFuel(t?.fuelPct?.toString() ?? '')
                setSaved(false)
              }}
            >
              {queue.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.number} · {t.slot ?? 'Gate'}
                </option>
              ))}
            </select>
          </label>
          {trailer ? (
            <div className="m-row">
              <div className="m-row-body">
                <strong>{trailer.product}</strong>
                <span>
                  Last {formatTemp(trailer.actual)} · {trailer.lastUpdate}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="m-section">
        <h2 className="m-section-label">Readings</h2>
        <div className="m-inset-group m-form-group">
          <label className="m-form-row">
            <span>Temp °F</span>
            <input
              inputMode="decimal"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
            />
          </label>
          <label className="m-form-row">
            <span>Fuel %</span>
            <input
              inputMode="numeric"
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
            />
          </label>
          <label className="m-toggle-row">
            <span>Seal intact ({trailer?.seal ?? '—'})</span>
            <input
              type="checkbox"
              className="m-switch"
              checked={sealOk}
              onChange={(e) => setSealOk(e.target.checked)}
            />
          </label>
          <label className="m-form-row m-form-row-stack">
            <span>Notes</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </label>
        </div>
      </section>

      <div className="m-hero-actions">
        <button type="button" className="m-btn m-btn-secondary">
          <MaterialIcon name="photo_camera" size={20} />
          Add photo
        </button>
        <button type="button" className="m-btn m-btn-primary" onClick={save}>
          <MaterialIcon name="save" size={20} />
          Save inspection
        </button>
        {saved ? (
          <p className="m-toast-hint">
            <MaterialIcon name="check_circle" size={16} />
            Saved locally · queued for sync
          </p>
        ) : null}
        <button
          type="button"
          className="m-link m-link-center"
          onClick={() => navigate('/m/alerts')}
        >
          View alerts
        </button>
      </div>
    </div>
  )
}
