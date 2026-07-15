import type { TempStatus, Trailer, TrailerStatus } from '../data/trailers'
import { displayYardStatus, trailerHasOpsHold } from '../data/trailers'

export function StatusBadge({ status }: { status: TempStatus }) {
  const label =
    status === 'ok'
      ? 'In range'
      : status === 'warn'
        ? 'Warming'
        : status === 'critical'
          ? 'Excursion'
          : status === 'offline'
            ? 'No signal'
            : 'N/A'

  return <span className={`badge ${status === 'na' ? 'offline' : status}`}>{label}</span>
}

export function OwnBadge({ ownership }: { ownership: 'bh' | 'carrier' }) {
  return (
    <span className={`own ${ownership}`}>
      {ownership === 'bh' ? 'BH-owned' : 'Carrier'}
    </span>
  )
}

export function YardStatusPill({
  status,
  trailer,
}: {
  status?: TrailerStatus
  trailer?: Pick<Trailer, 'status' | 'opsHold'>
}) {
  const label = trailer
    ? displayYardStatus(trailer)
    : status ?? '—'
  const hold = trailer ? trailerHasOpsHold(trailer) : label.includes('hold')
  const tone = hold
    ? 'critical'
    : label === 'Ready to dock' || label === 'Outbound staged'
      ? 'warn'
      : label === 'At dock'
        ? 'ok'
        : label === 'Gate arrived'
          ? 'offline'
          : 'ok'
  return <span className={`badge ${tone}`}>{label}</span>
}

export function formatTemp(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return `${n.toFixed(1)}°F`
}
