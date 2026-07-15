import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useYard } from '../yard/YardContext'
import { MaterialIcon } from '../components/MaterialIcon'

export function MobileScan() {
  const navigate = useNavigate()
  const { trailers } = useYard()
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'qr' | 'rfid' | 'lookup'>('qr')

  const hits = trailers
    .filter((t) => {
      if (!q.trim()) return false
      const hay = `${t.number} ${t.seal} ${t.slot ?? ''}`.toLowerCase()
      return hay.includes(q.toLowerCase())
    })
    .slice(0, 6)

  return (
    <div className="page-enter m-screen">
      <header className="m-large-title">
        <h1>Scan</h1>
        <p className="m-subtitle">QR, RFID / BLE, or lookup at the slot.</p>
      </header>

      <div className="m-segmented" role="tablist" aria-label="Scan mode">
        {(
          [
            ['qr', 'QR'],
            ['rfid', 'RFID'],
            ['lookup', 'Lookup'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            className={mode === id ? 'active' : ''}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="m-scan-stage" aria-hidden>
        <div className="m-scan-reticle" />
        <p>
          {mode === 'qr'
            ? 'Align QR on trailer plate'
            : mode === 'rfid'
              ? 'Hold near RFID / BLE tag…'
              : 'Enter trailer number below'}
        </p>
      </div>

      <label className="m-search-field">
        <MaterialIcon name="search" size={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="BH-4412 or seal…"
          inputMode="search"
        />
      </label>

      {q ? (
        <section className="m-section">
          <h2 className="m-section-label">Matches</h2>
          <div className="m-inset-group">
            {hits.map((t) => (
              <button
                key={t.id}
                type="button"
                className="m-row m-row-btn"
                onClick={() => navigate(`/mobile/inspect?trailer=${t.id}`)}
              >
                <div className="m-row-icon tone-ok">
                  <MaterialIcon name="local_shipping" size={20} />
                </div>
                <div className="m-row-body">
                  <strong>{t.number}</strong>
                  <span>
                    {t.slot ?? t.dockDoor ?? 'Gate'} · {t.seal}
                  </span>
                </div>
                <span className="m-row-action">Inspect</span>
              </button>
            ))}
            {!hits.length ? <div className="m-empty">No match</div> : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
