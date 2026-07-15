import type { ReactNode } from 'react'
import { IconWarning } from './ActionIcons'

type OpsKpiCardProps = {
  label: string
  value: ReactNode
  note: ReactNode
  alert?: boolean
  warn?: boolean
  className?: string
}

function AlertBadge() {
  return (
    <span className="ops-kpi-badge" aria-hidden>
      <IconWarning size={16} />
    </span>
  )
}

export function OpsKpiCard({
  label,
  value,
  note,
  alert = false,
  warn = false,
  className = '',
}: OpsKpiCardProps) {
  return (
    <article
      className={`ops-kpi ${alert ? 'ops-kpi-alert' : ''} ${warn ? 'ops-kpi-warn' : ''} ${className}`.trim()}
    >
      {alert ? <AlertBadge /> : null}
      <div className="ops-kpi-label">{label}</div>
      <div className="ops-kpi-value">{value}</div>
      <div className="ops-kpi-note">{note}</div>
    </article>
  )
}
