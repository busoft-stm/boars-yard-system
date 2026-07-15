import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { futureAiCards } from '../data/smartEnterprise'
import { isOnSite } from '../data/trailers'
import { useSmartYard } from '../smart/SmartYardContext'
import { useYard } from '../yard/YardContext'
import { formatTemp, OwnBadge } from '../components/Badges'

const FUTURE_STATUS_LABEL: Record<
  (typeof futureAiCards)[number]['status'],
  string
> = {
  planned: 'Planned',
  research: 'Research',
  roadmap: 'Roadmap',
}

export function InsightsPage() {
  const navigate = useNavigate()
  const { trailers, metrics, gateEvents, movements } = useYard()
  const { aiRecommendations } = useSmartYard()

  const onSite = useMemo(() => trailers.filter(isOnSite), [trailers])

  const predicted = useMemo(
    () =>
      trailers
        .filter(
          (t) =>
            isOnSite(t) &&
            (t.tempStatus === 'warn' ||
              t.tempStatus === 'critical' ||
              (t.tempStatus === 'ok' &&
                t.actual != null &&
                t.setpoint != null &&
                t.actual - t.setpoint >= 1.5)),
        )
        .sort((a, b) => {
          const rank = (s: string) =>
            s === 'critical' ? 0 : s === 'warn' ? 1 : 2
          return rank(a.tempStatus) - rank(b.tempStatus)
        })
        .slice(0, 8)
        .map((t, i) => ({
          ...t,
          etaMin: t.tempStatus === 'critical' ? 8 + i * 4 : 25 + i * 10,
          score: Math.max(54, 96 - i * 5),
          reason:
            t.tempStatus === 'critical'
              ? 'Already outside limit — cool recovery unlikely without intervene'
              : t.reeferAlarm
                ? 'Reefer alarm + rising delta from setpoint'
                : t.actual != null && t.setpoint != null
                  ? `Δ ${((t.actual ?? 0) - (t.setpoint ?? 0)).toFixed(1)}°F from SP`
                  : 'Warming trend from last telemetry window',
        })),
    [trailers],
  )

  const priority = metrics.walk.slice(0, 8)

  const longDwell = useMemo(
    () =>
      onSite
        .filter((t) => t.dwellHours >= 12)
        .sort((a, b) => b.dwellHours - a.dwellHours)
        .slice(0, 8),
    [onSite],
  )

  const fuelRisk = useMemo(
    () =>
      onSite
        .filter((t) => t.fuelPct != null && t.fuelPct <= 25 && t.telemetry)
        .sort((a, b) => (a.fuelPct ?? 0) - (b.fuelPct ?? 0))
        .slice(0, 6),
    [onSite],
  )

  const offlineTelemetry = useMemo(
    () =>
      onSite
        .filter((t) => t.tempStatus === 'offline' || (!t.telemetry && t.trailerType !== 'dry'))
        .slice(0, 6),
    [onSite],
  )

  const carriers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; n: number; risk: number; offline: number; long: number }
    >()
    for (const t of onSite) {
      const name = t.ownership === 'bh' ? "Boar’s Head" : t.carrier || 'Unknown carrier'
      const cur = map.get(name) ?? { name, n: 0, risk: 0, offline: 0, long: 0 }
      cur.n += 1
      if (t.tempStatus === 'critical' || t.tempStatus === 'warn' || t.reeferAlarm) {
        cur.risk += 1
      }
      if (t.tempStatus === 'offline' || !t.telemetry) cur.offline += 1
      if (t.dwellHours >= 12) cur.long += 1
      map.set(name, cur)
    }
    return [...map.values()]
      .map((c) => {
        const coverage = c.n ? Math.round(((c.n - c.offline) / c.n) * 100) : 100
        const riskPenalty = c.n ? Math.round((c.risk / c.n) * 40) : 0
        const dwellPenalty = c.n ? Math.round((c.long / c.n) * 20) : 0
        const score = Math.max(40, Math.min(98, coverage - riskPenalty - dwellPenalty + 8))
        const note =
          c.risk > 0
            ? `${c.risk} temp/risk flags · ${coverage}% telemetry`
            : c.long > 0
              ? `${c.long} long-dwell · ${coverage}% telemetry`
              : `Clean heat map · ${coverage}% telemetry`
        return { ...c, score, note, coverage }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [onSite])

  const zoneHotspots = useMemo(
    () =>
      metrics.byZone
        .map((z) => {
          const inZone = onSite.filter((t) => t.zone === z.zone)
          const risk = inZone.filter(
            (t) =>
              t.tempStatus === 'critical' ||
              t.tempStatus === 'warn' ||
              t.reeferAlarm,
          ).length
          const fill = z.total ? Math.round((z.used / z.total) * 100) : 0
          return { ...z, risk, fill, count: inZone.length }
        })
        .sort((a, b) => b.risk - a.risk || b.fill - a.fill),
    [metrics.byZone, onSite],
  )

  const productRisk = useMemo(() => {
    const map = new Map<string, { product: string; n: number; risk: number }>()
    for (const t of onSite) {
      const product = t.product || 'Unspecified'
      const cur = map.get(product) ?? { product, n: 0, risk: 0 }
      cur.n += 1
      if (t.tempStatus === 'critical' || t.tempStatus === 'warn') cur.risk += 1
      map.set(product, cur)
    }
    return [...map.values()]
      .filter((p) => p.n > 0)
      .sort((a, b) => b.risk - a.risk || b.n - a.n)
      .slice(0, 6)
  }, [onSite])

  const heldGate = gateEvents.filter((g) => g.status === 'held').length
  const recentMoves = movements.slice(0, 5)
  const telemetryPct = onSite.length
    ? Math.round((metrics.instrumented / onSite.length) * 100)
    : 0

  const playbook = [
    {
      step: '1',
      title: 'Stabilize excursions',
      detail: `${metrics.critical} critical · ${metrics.warn} warn`,
      to: '/exceptions',
    },
    {
      step: '2',
      title: 'Intercept predicted breaches',
      detail: `${predicted.length} in next ~60 min`,
      to: '/temperature',
    },
    {
      step: '3',
      title: 'Clear aged dwell',
      detail: `${metrics.longDwell} over 12 hours`,
      to: '/map',
    },
    {
      step: '4',
      title: 'Fill open doors',
      detail: `${metrics.readyDock} ready · ${metrics.openDocks} open`,
      to: '/dock',
    },
  ]

  return (
    <div className="page-enter insights-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">AI-driven intelligence</div>
          <h1>Insights</h1>
          <p>
            Live recommendations from live yard state — temperature risk,
            dwell pressure, zone balance, fuel, telemetry, and carrier reliability.
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/analytics')}
          >
            Analytics
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/exceptions')}
          >
            Act on exceptions
          </button>
        </div>
      </div>

      <div className="stats stats-6">
        <div className="stat crit">
          <div className="stat-label">Predicted excursions</div>
          <div className="stat-value">{predicted.length}</div>
          <div className="stat-note">Next 60 minutes</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Priority attention</div>
          <div className="stat-value">{metrics.walkCount}</div>
          <div className="stat-note">Smart ranked walk</div>
        </div>
        <div className="stat">
          <div className="stat-label">Long dwell</div>
          <div className="stat-value">{metrics.longDwell}</div>
          <div className="stat-note">&gt; 12 hours on site</div>
        </div>
        <div className="stat frost">
          <div className="stat-label">Model confidence</div>
          <div className="stat-value">{Math.max(72, Math.min(96, 70 + Math.round(telemetryPct / 5)))}%</div>
          <div className="stat-note">{telemetryPct}% telemetry cover</div>
        </div>
        <div className="stat">
          <div className="stat-label">Carriers scored</div>
          <div className="stat-value">{carriers.length}</div>
          <div className="stat-note">On-site reliability</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Gate holds</div>
          <div className="stat-value">{heldGate || metrics.holds}</div>
          <div className="stat-note">Inbound / yard friction</div>
        </div>
      </div>

      <section className="insights-section">
        <div className="insights-section-head">
          <h2>Shift playbook</h2>
          <span>Suggested sequence</span>
        </div>
        <div className="insights-playbook">
          {playbook.map((p) => (
            <button
              key={p.step}
              type="button"
              className="insights-play-step"
              onClick={() => navigate(p.to)}
            >
              <strong>{p.step}</strong>
              <div>
                <span>{p.title}</span>
                <em>{p.detail}</em>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="insights-section">
        <div className="insights-section-head">
          <h2>AI recommendations</h2>
          <span>{aiRecommendations.length} live suggestions</span>
        </div>
        <div className="insights-ai-grid">
          {aiRecommendations.map((rec) => (
            <div key={rec.id} className={`insights-ai-card tone-${rec.tone}`}>
              <div className="insights-ai-card-head">
                <span className="insights-ai-tag">{rec.tag}</span>
                <span className={`badge ${rec.tone === 'info' ? 'ok' : rec.tone}`}>
                  {rec.impact}
                </span>
              </div>
              <strong>{rec.title}</strong>
              <p>{rec.body}</p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate(rec.actionTo)}
              >
                {rec.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="insights-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Predictive temperature</h2>
            <span className="panel-meta">{predicted.length} flagged</span>
          </div>
          <div className="list">
            {predicted.map((t) => (
              <button
                key={t.id}
                type="button"
                className="list-item insights-list-item"
                onClick={() => navigate(`/trailer/${t.id}`)}
              >
                <span
                  className={`priority ${t.tempStatus === 'critical' ? 'critical' : 'warn'}`}
                />
                <div>
                  <div className="trailer-id">
                    {t.number} <OwnBadge ownership={t.ownership} />
                  </div>
                  <div className="trailer-meta">
                    ~{t.etaMin} min · {formatTemp(t.actual)} · {t.reason}
                  </div>
                </div>
                <span className="mono">{t.score}</span>
              </button>
            ))}
            {!predicted.length ? (
              <div className="empty">No rising trends detected</div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Smart prioritization</h2>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/exceptions')}
            >
              Exceptions
            </button>
          </div>
          <div className="list">
            {priority.map((t, i) => (
              <button
                key={t.id}
                type="button"
                className="list-item insights-list-item"
                onClick={() => navigate(`/trailer/${t.id}`)}
              >
                <span className="mono insights-rank">{i + 1}</span>
                <div>
                  <div className="trailer-id">{t.number}</div>
                  <div className="trailer-meta">
                    {t.slot ?? t.dockDoor ?? 'Gate'} · {t.tempStatus}
                    {t.reeferAlarm ? ' · alarm' : ''}
                    {t.dwellHours >= 12 ? ` · ${t.dwellHours.toFixed(0)}h` : ''}
                  </div>
                </div>
              </button>
            ))}
            {!priority.length ? (
              <div className="empty">Yard walk is clear</div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Carrier reliability</h2>
            <span className="panel-meta">On-site score</span>
          </div>
          <div className="list">
            {carriers.map((c) => (
              <div key={c.name} className="list-item insights-list-item static">
                <span
                  className={`priority ${c.score >= 85 ? 'ok' : c.score >= 75 ? 'warn' : 'critical'}`}
                />
                <div>
                  <div className="trailer-id">{c.name}</div>
                  <div className="trailer-meta">
                    {c.n} trailers · {c.note}
                  </div>
                  <div className="insights-score-bar" aria-hidden>
                    <i style={{ width: `${c.score}%` }} />
                  </div>
                </div>
                <strong className="mono">{c.score}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Zone hotspots</h2>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/map')}
            >
              Map
            </button>
          </div>
          <div className="list">
            {zoneHotspots.map((z) => (
              <button
                key={z.zone}
                type="button"
                className="list-item insights-list-item"
                onClick={() => navigate('/map')}
              >
                <span className="insights-zone-badge">Z{z.zone}</span>
                <div>
                  <div className="trailer-id">
                    {z.used}/{z.total} slots · {z.fill}%
                  </div>
                  <div className="trailer-meta">
                    {z.risk
                      ? `${z.risk} temp / alarm risk`
                      : `${z.count} on site · balanced`}
                  </div>
                  <div className="insights-score-bar" aria-hidden>
                    <i
                      className={z.fill >= 85 ? 'hot' : undefined}
                      style={{ width: `${z.fill}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Long dwell aging</h2>
            <span className="panel-meta">&gt; 12h</span>
          </div>
          <div className="list">
            {longDwell.map((t) => (
              <button
                key={t.id}
                type="button"
                className="list-item insights-list-item"
                onClick={() => navigate(`/trailer/${t.id}`)}
              >
                <span className="priority warn" />
                <div>
                  <div className="trailer-id">
                    {t.number} <OwnBadge ownership={t.ownership} />
                  </div>
                  <div className="trailer-meta">
                    {t.dwellHours.toFixed(1)}h · {t.slot ?? t.status} · {t.product}
                  </div>
                </div>
              </button>
            ))}
            {!longDwell.length ? (
              <div className="empty">No aged dwell over 12 hours</div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Fuel & telemetry gaps</h2>
            <span className="panel-meta">Blind spots</span>
          </div>
          <div className="list">
            {fuelRisk.map((t) => (
              <button
                key={`fuel-${t.id}`}
                type="button"
                className="list-item insights-list-item"
                onClick={() => navigate(`/trailer/${t.id}`)}
              >
                <span className="priority warn" />
                <div>
                  <div className="trailer-id">{t.number}</div>
                  <div className="trailer-meta">
                    Fuel {t.fuelPct}% · {t.slot ?? t.status}
                  </div>
                </div>
              </button>
            ))}
            {offlineTelemetry.map((t) => (
              <button
                key={`off-${t.id}`}
                type="button"
                className="list-item insights-list-item"
                onClick={() => navigate(`/trailer/${t.id}`)}
              >
                <span className="priority critical" />
                <div>
                  <div className="trailer-id">{t.number}</div>
                  <div className="trailer-meta">
                    {t.tempStatus === 'offline' ? 'Telemetry offline' : 'No instrument'} ·{' '}
                    {t.carrier}
                  </div>
                </div>
              </button>
            ))}
            {!fuelRisk.length && !offlineTelemetry.length ? (
              <div className="empty">Fuel and telemetry look healthy</div>
            ) : null}
          </div>
        </div>
      </div>

      <section className="insights-section">
        <div className="insights-section-head">
          <h2>Future AI features</h2>
          <span>Enterprise roadmap</span>
        </div>
        <div className="insights-future-grid">
          {futureAiCards.map((card) => (
            <div key={card.id} className="insights-future-card">
              <div className="insights-future-head">
                <strong>{card.title}</strong>
                <span className={`badge ${card.status === 'research' ? 'warn' : 'ok'}`}>
                  {FUTURE_STATUS_LABEL[card.status]}
                </span>
              </div>
              <p>{card.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="insights-secondary">
        <div className="panel">
          <div className="panel-head">
            <h2>Product risk mix</h2>
            <span className="panel-meta">On-site SKUs</span>
          </div>
          <div className="insights-product-grid">
            {productRisk.map((p) => (
              <div key={p.product} className="insights-product-card">
                <span>{p.product}</span>
                <strong>{p.n}</strong>
                <em className={p.risk ? 'risk' : undefined}>
                  {p.risk ? `${p.risk} at risk` : 'Stable'}
                </em>
              </div>
            ))}
            {!productRisk.length ? (
              <div className="empty">No on-site product mix</div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Recent yard signal</h2>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/movements')}
            >
              Movements
            </button>
          </div>
          <div className="list">
            {recentMoves.map((m) => (
              <button
                key={m.id}
                type="button"
                className="list-item insights-list-item"
                onClick={() => navigate(`/trailer/${m.trailerId}`)}
              >
                <span className="insights-move-time">{m.time}</span>
                <div>
                  <div className="trailer-id">{m.trailerNumber}</div>
                  <div className="trailer-meta">
                    {m.type.replace(/_/g, ' ')} · {m.from} → {m.to}
                  </div>
                </div>
              </button>
            ))}
            {!recentMoves.length ? (
              <div className="empty">No movements logged yet</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
