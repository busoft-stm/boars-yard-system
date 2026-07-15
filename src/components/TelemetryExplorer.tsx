import { useMemo, useState } from 'react'
import type { TempPoint, Trailer } from '../data/trailers'
import { formatTemp } from './Badges'

export type TelemetrySample = {
  id: string
  at: Date
  label: string
  actual: number
  setpoint: number | null
}

type RangeKey = 'week' | 'month' | 'year' | 'custom'
type ViewMode = 'chart' | 'table'

function hashSeed(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function formatLabel(d: Date, range: RangeKey) {
  if (range === 'week') {
    return d.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  if (range === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (range === 'year') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  })
}

function formatTableWhen(d: Date) {
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toInputDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildSeries(opts: {
  trailerId: string
  setpoint: number | null
  actual: number | null
  seedHistory: TempPoint[]
  range: RangeKey
  customFrom: Date
  customTo: Date
  now?: Date
}): TelemetrySample[] {
  const now = opts.now ?? new Date()
  const base =
    opts.actual ??
    opts.setpoint ??
    opts.seedHistory[opts.seedHistory.length - 1]?.actual ??
    34
  const sp = opts.setpoint
  const rand = mulberry32(hashSeed(`${opts.trailerId}:${opts.range}:${toInputDate(opts.customFrom)}:${toInputDate(opts.customTo)}`))

  let start: Date
  let end = new Date(now)
  let stepMs: number

  if (opts.range === 'week') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    stepMs = 6 * 60 * 60 * 1000
  } else if (opts.range === 'month') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    stepMs = 24 * 60 * 60 * 1000
  } else if (opts.range === 'year') {
    start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    stepMs = 7 * 24 * 60 * 60 * 1000
  } else {
    start = startOfDay(opts.customFrom)
    end = new Date(opts.customTo)
    end.setHours(23, 59, 59, 999)
    if (end < start) {
      start = startOfDay(opts.customTo)
      end = new Date(opts.customFrom)
      end.setHours(23, 59, 59, 999)
    }
    const span = Math.max(1, end.getTime() - start.getTime())
    const days = span / (24 * 60 * 60 * 1000)
    if (days <= 3) stepMs = 2 * 60 * 60 * 1000
    else if (days <= 14) stepMs = 6 * 60 * 60 * 1000
    else if (days <= 90) stepMs = 24 * 60 * 60 * 1000
    else stepMs = 7 * 24 * 60 * 60 * 1000
  }

  const points: TelemetrySample[] = []
  let drift = 0
  let i = 0
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    drift += (rand() - 0.48) * (opts.range === 'year' ? 0.35 : 0.55)
    drift *= 0.92
    const wave = Math.sin(i / 4.5) * 0.35
    const actual = Math.round((base + drift + wave) * 10) / 10
    const at = new Date(t)
    points.push({
      id: `${opts.trailerId}-${t}`,
      at,
      label: formatLabel(at, opts.range),
      actual,
      setpoint: sp,
    })
    i += 1
    if (points.length > 180) break
  }

  if (!points.length) {
    points.push({
      id: `${opts.trailerId}-now`,
      at: now,
      label: 'Now',
      actual: base,
      setpoint: sp,
    })
  } else {
    points[points.length - 1] = {
      ...points[points.length - 1],
      at: end > now ? now : points[points.length - 1].at,
      label: opts.range === 'custom' ? formatLabel(now, opts.range) : 'Now',
      actual: Math.round(base * 10) / 10,
    }
  }

  return points
}

function TelemetryChart({
  samples,
  accent,
}: {
  samples: TelemetrySample[]
  accent: string
}) {
  const w = 720
  const h = 260
  const padL = 44
  const padR = 16
  const padT = 18
  const padB = 36

  const vals = samples.map((s) => s.actual)
  const setpoints = samples
    .map((s) => s.setpoint)
    .filter((v): v is number => v != null)
  const all = [...vals, ...setpoints]
  const min = Math.min(...all) - 1.5
  const max = Math.max(...all) + 1.5
  const span = Math.max(0.5, max - min)

  const coords = samples.map((s, i) => {
    const x =
      padL +
      (samples.length === 1
        ? (w - padL - padR) / 2
        : (i / (samples.length - 1)) * (w - padL - padR))
    const y = padT + (1 - (s.actual - min) / span) * (h - padT - padB)
    return { x, y, s }
  })

  const line = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${(h - padB).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(h - padB).toFixed(1)} Z`

  const setpoint = samples.find((s) => s.setpoint != null)?.setpoint ?? null
  const spY =
    setpoint == null
      ? null
      : padT + (1 - (setpoint - min) / span) * (h - padT - padB)

  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => {
    return min + (span * i) / yTicks
  })

  const labelEvery = Math.max(1, Math.ceil(samples.length / 7))

  return (
    <svg
      className="telemetry-chart"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Reefer temperature chart"
    >
      <defs>
        <linearGradient id="telemetryFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {tickVals.map((v) => {
        const y = padT + (1 - (v - min) / span) * (h - padT - padB)
        return (
          <g key={v}>
            <line
              x1={padL}
              x2={w - padR}
              y1={y}
              y2={y}
              stroke="rgba(52,48,43,0.1)"
              strokeWidth="1"
            />
            <text
              x={padL - 8}
              y={y + 3}
              textAnchor="end"
              fill="#6f675e"
              fontSize="11"
              fontFamily="Manrope, sans-serif"
            >
              {v.toFixed(0)}°
            </text>
          </g>
        )
      })}

      {spY != null ? (
        <line
          x1={padL}
          x2={w - padR}
          y1={spY}
          y2={spY}
          stroke="#ab965d"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      ) : null}

      <path d={area} fill="url(#telemetryFill)" />
      <path
        d={line}
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {coords.map((c, i) =>
        i % labelEvery === 0 || i === coords.length - 1 ? (
          <text
            key={`${c.s.id}-l`}
            x={c.x}
            y={h - 10}
            textAnchor="middle"
            fill="#6f675e"
            fontSize="10"
            fontFamily="Manrope, sans-serif"
          >
            {c.s.label}
          </text>
        ) : null,
      )}

      {coords.map((c) => (
        <circle
          key={c.s.id}
          cx={c.x}
          cy={c.y}
          r="3.5"
          fill="#fffdf9"
          stroke={accent}
          strokeWidth="2"
        >
          <title>
            {formatTableWhen(c.s.at)} · {c.s.actual.toFixed(1)}°F
          </title>
        </circle>
      ))}
    </svg>
  )
}

export function TelemetryExplorer({
  trailer,
  accent,
}: {
  trailer: Trailer
  accent: string
}) {
  const today = useMemo(() => new Date('2026-07-14T14:14:00'), [])
  const defaultFrom = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 7)
    return toInputDate(d)
  }, [today])
  const defaultTo = useMemo(() => toInputDate(today), [today])

  const [range, setRange] = useState<RangeKey>('week')
  const [view, setView] = useState<ViewMode>('chart')
  const [customFrom, setCustomFrom] = useState(defaultFrom)
  const [customTo, setCustomTo] = useState(defaultTo)

  const samples = useMemo(
    () =>
      buildSeries({
        trailerId: trailer.id,
        setpoint: trailer.setpoint,
        actual: trailer.actual,
        seedHistory: trailer.history,
        range,
        customFrom: new Date(`${customFrom}T00:00:00`),
        customTo: new Date(`${customTo}T23:59:59`),
        now: today,
      }),
    [
      trailer.id,
      trailer.setpoint,
      trailer.actual,
      trailer.history,
      range,
      customFrom,
      customTo,
      today,
    ],
  )

  const min = Math.min(...samples.map((s) => s.actual))
  const max = Math.max(...samples.map((s) => s.actual))
  const avg =
    samples.reduce((sum, s) => sum + s.actual, 0) / Math.max(1, samples.length)

  return (
    <div className="telemetry-explorer">
      <div className="telemetry-toolbar">
        <div className="page-tabs telemetry-range" role="tablist" aria-label="Telemetry range">
          {(
            [
              ['week', 'Week'],
              ['month', 'Month'],
              ['year', 'Years'],
              ['custom', 'Custom'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={range === id}
              className={`page-tab ${range === id ? 'active' : ''}`}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="page-tabs telemetry-view" role="tablist" aria-label="Telemetry view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'chart'}
            className={`page-tab ${view === 'chart' ? 'active' : ''}`}
            onClick={() => setView('chart')}
          >
            Chart
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'table'}
            className={`page-tab ${view === 'table' ? 'active' : ''}`}
            onClick={() => setView('table')}
          >
            Table
          </button>
        </div>
      </div>

      {range === 'custom' ? (
        <div className="telemetry-custom">
          <label className="field">
            <span>From</span>
            <input
              className="search"
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              className="search"
              type="date"
              value={customTo}
              min={customFrom}
              max={toInputDate(today)}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      <div className="telemetry-summary">
        <div>
          <span>Min</span>
          <strong>{min.toFixed(1)}°F</strong>
        </div>
        <div>
          <span>Avg</span>
          <strong>{avg.toFixed(1)}°F</strong>
        </div>
        <div>
          <span>Max</span>
          <strong>{max.toFixed(1)}°F</strong>
        </div>
        <div>
          <span>Samples</span>
          <strong>{samples.length}</strong>
        </div>
        <div>
          <span>Setpoint</span>
          <strong>
            {trailer.setpoint == null ? '—' : `${trailer.setpoint}°F`}
          </strong>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="telemetry-chart-wrap">
          <TelemetryChart samples={samples} accent={accent} />
          <div className="telemetry-legend">
            <span>
              <i style={{ background: accent }} /> Actual
            </span>
            {trailer.setpoint != null ? (
              <span>
                <i className="setpoint" /> Setpoint
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="table-wrap telemetry-table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actual</th>
                <th>Setpoint</th>
                <th>Δ</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...samples].reverse().map((s) => {
                const delta =
                  s.setpoint == null
                    ? null
                    : Math.round((s.actual - s.setpoint) * 10) / 10
                const tone =
                  delta == null
                    ? 'ok'
                    : Math.abs(delta) >= 5
                      ? 'critical'
                      : Math.abs(delta) >= 2
                        ? 'warn'
                        : 'ok'
                return (
                  <tr key={s.id}>
                    <td className="mono">{formatTableWhen(s.at)}</td>
                    <td className="mono">{formatTemp(s.actual)}</td>
                    <td className="mono">
                      {s.setpoint == null ? '—' : `${s.setpoint}°F`}
                    </td>
                    <td className="mono">
                      {delta == null
                        ? '—'
                        : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}°F`}
                    </td>
                    <td>
                      <span className={`badge ${tone}`}>
                        {tone === 'critical'
                          ? 'Excursion'
                          : tone === 'warn'
                            ? 'Warming'
                            : 'In range'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
