import type { TempPoint } from '../data/trailers'

export function Sparkline({
  points,
  accent = '#9e1b1e',
}: {
  points: TempPoint[]
  accent?: string
}) {
  if (!points.length) {
    return <div className="empty">No telemetry history yet</div>
  }

  const vals = points.map((p) => p.actual)
  const min = Math.min(...vals) - 1
  const max = Math.max(...vals) + 1
  const w = 560
  const h = 120
  const pad = 8

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (p.actual - min) / (max - min)) * (h - pad * 2)
    return { x, y, ...p }
  })

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const area = `${line} L ${coords[coords.length - 1].x} ${h - pad} L ${coords[0].x} ${h - pad} Z`

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Temperature trend">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path d={line} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      {coords.map((c) => (
        <circle key={c.t} cx={c.x} cy={c.y} r="4" fill="#fffdf9" stroke={accent} strokeWidth="2" />
      ))}
      {coords.map((c) => (
        <text
          key={`${c.t}-l`}
          x={c.x}
          y={h - 2}
          textAnchor="middle"
          fill="#6f675e"
          fontSize="11"
          fontFamily="Manrope, sans-serif"
        >
          {c.t}
        </text>
      ))}
    </svg>
  )
}
