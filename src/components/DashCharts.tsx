type ChartDatum = {
  label: string
  value: number
  color?: string
}

type PieSlice = {
  label: string
  value: number
  color: string
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polar(cx, cy, rOuter, startAngle)
  const outerEnd = polar(cx, cy, rOuter, endAngle)
  const innerStart = polar(cx, cy, rInner, endAngle)
  const innerEnd = polar(cx, cy, rInner, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ')
}

export function MiniBarChart({
  data,
  unit = '',
  ariaLabel,
}: {
  data: ChartDatum[]
  unit?: string
  ariaLabel: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const w = 320
  const h = 160
  const padL = 28
  const padR = 8
  const padT = 12
  const padB = 36
  const chartW = w - padL - padR
  const chartH = h - padT - padB
  const gap = 10
  const barW = Math.max(12, (chartW - gap * (data.length - 1)) / Math.max(1, data.length))

  return (
    <svg
      className="dash-chart-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={ariaLabel}
    >
      {[0, 0.5, 1].map((t) => {
        const y = padT + chartH * (1 - t)
        return (
          <g key={t}>
            <line
              x1={padL}
              x2={w - padR}
              y1={y}
              y2={y}
              stroke="rgba(52,48,43,0.1)"
              strokeWidth="1"
            />
            <text
              x={padL - 6}
              y={y + 3}
              textAnchor="end"
              fill="#7a7164"
              fontSize="9"
            >
              {Math.round(max * t)}
              {unit}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const bh = (d.value / max) * chartH
        const x = padL + i * (barW + gap)
        const y = padT + chartH - bh
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(2, bh)}
              rx="5"
              fill={d.color ?? '#a6192e'}
            >
              <title>
                {d.label}: {d.value}
                {unit}
              </title>
            </rect>
            <text
              x={x + barW / 2}
              y={h - 14}
              textAnchor="middle"
              fill="#7a7164"
              fontSize="10"
              fontWeight="600"
            >
              {d.label}
            </text>
            <text
              x={x + barW / 2}
              y={y - 4}
              textAnchor="middle"
              fill="#34302b"
              fontSize="10"
              fontWeight="700"
            >
              {d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function MiniLineChart({
  data,
  ariaLabel,
  accent = '#a6192e',
}: {
  data: ChartDatum[]
  ariaLabel: string
  accent?: string
}) {
  if (data.length < 2) {
    return <div className="empty">Not enough points</div>
  }

  const vals = data.map((d) => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(1, max - min)
  const w = 320
  const h = 160
  const padL = 28
  const padR = 10
  const padT = 16
  const padB = 34
  const chartW = w - padL - padR
  const chartH = h - padT - padB

  const pts = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * chartW
    const y = padT + (1 - (d.value - min) / span) * chartH
    return { ...d, x, y }
  })

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1].x} ${padT + chartH} L ${pts[0].x} ${padT + chartH} Z`
  const gradId = `lineFill-${accent.replace('#', '')}`

  return (
    <svg
      className="dash-chart-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const y = padT + chartH * (1 - t)
        const val = Math.round(min + span * t)
        return (
          <g key={t}>
            <line
              x1={padL}
              x2={w - padR}
              y1={y}
              y2={y}
              stroke="rgba(52,48,43,0.1)"
              strokeWidth="1"
            />
            <text
              x={padL - 6}
              y={y + 3}
              textAnchor="end"
              fill="#7a7164"
              fontSize="9"
            >
              {val}
            </text>
          </g>
        )
      })}
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p) => (
        <g key={p.label}>
          <circle
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#fffef9"
            stroke={accent}
            strokeWidth="2"
          >
            <title>
              {p.label}: {p.value}
            </title>
          </circle>
          <text
            x={p.x}
            y={h - 12}
            textAnchor="middle"
            fill="#7a7164"
            fontSize="10"
            fontWeight="600"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function MiniPieChart({
  slices,
  centerLabel,
  ariaLabel,
}: {
  slices: PieSlice[]
  centerLabel: string
  ariaLabel: string
}) {
  const visible = slices.filter((s) => s.value > 0)
  const total = visible.reduce((sum, s) => sum + s.value, 0)
  const size = 150
  const cx = size / 2
  const cy = size / 2
  const rOuter = 58
  const rInner = 34
  const gap = 2

  let paths: { d: string; color: string; label: string; value: number }[] = []
  if (total > 0 && visible.length === 1) {
    paths = []
  } else if (total > 0) {
    let angle = 0
    paths = visible.map((s) => {
      const sweep = (s.value / total) * 360
      const start = angle + gap / 2
      const end = angle + sweep - gap / 2
      angle += sweep
      return {
        d: donutArc(cx, cy, rOuter, rInner, start, Math.max(start + 0.5, end)),
        color: s.color,
        label: s.label,
        value: s.value,
      }
    })
  }

  return (
    <div className="dash-pie-wrap">
      <div className="dash-pie" aria-label={ariaLabel}>
        <svg viewBox={`0 0 ${size} ${size}`}>
          {total === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={(rOuter + rInner) / 2}
              fill="none"
              stroke="rgba(52,48,43,0.12)"
              strokeWidth={rOuter - rInner}
            />
          ) : visible.length === 1 ? (
            <circle
              cx={cx}
              cy={cy}
              r={(rOuter + rInner) / 2}
              fill="none"
              stroke={visible[0].color}
              strokeWidth={rOuter - rInner}
            />
          ) : (
            paths.map((p) => (
              <path key={p.label} d={p.d} fill={p.color}>
                <title>
                  {p.label}: {p.value}
                </title>
              </path>
            ))
          )}
        </svg>
        <div className="dash-pie-center">
          <strong>{total}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="dash-pie-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
