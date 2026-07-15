import type { ExceptionRow } from '../exceptions/ExceptionsContext'
import type { Trailer } from './trailers'
import { SITE } from './trailers'
import type {
  InfraAlert,
  InfraAutoMovement,
  UnifiedSmartDevice,
  YardInfraAsset,
} from './smartEnterprise'
import { INFRA_KIND_META, INFRA_OPS_STATUS_META } from './smartEnterprise'
import { formatUsDateTime } from '../utils/usFormat'

export type ReportId =
  | 'yard_utilization'
  | 'cold_chain'
  | 'gate_activity'
  | 'trailer_dwell'
  | 'carrier_performance'
  | 'device_telemetry'
  | 'infrastructure_ops'
  | 'exception_summary'

export type ReportPeriod = 'today' | '7d' | '30d'

export type ReportDefinition = {
  id: ReportId
  title: string
  description: string
  icon: string
  category: string
}

export type GeneratedReport = {
  id: ReportId
  title: string
  period: ReportPeriod
  periodLabel: string
  generatedAt: string
  site: string
  columns: string[]
  rows: string[][]
  summary: { label: string; value: string }[]
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'yard_utilization',
    title: 'Yard utilization',
    description: 'Slot occupancy, zone fill, and dock door use across the site.',
    icon: 'grid_view',
    category: 'Yard',
  },
  {
    id: 'cold_chain',
    title: 'Cold-chain compliance',
    description: 'Temperature status, excursions, and reefer telemetry coverage.',
    icon: 'ac_unit',
    category: 'Cold chain',
  },
  {
    id: 'gate_activity',
    title: 'Gate activity',
    description: 'Inbound and outbound gate events, holds, and lane throughput.',
    icon: 'sensor_door',
    category: 'Gate',
  },
  {
    id: 'trailer_dwell',
    title: 'Trailer dwell',
    description: 'Hours on site, long-dwell flags, and slot assignment history.',
    icon: 'schedule',
    category: 'Yard',
  },
  {
    id: 'carrier_performance',
    title: 'Carrier performance',
    description: 'On-site carrier mix, incident rates, and compliance scores.',
    icon: 'local_shipping',
    category: 'Operations',
  },
  {
    id: 'device_telemetry',
    title: 'Device & telemetry health',
    description: 'Trailer device assignment, battery, and sensor coverage.',
    icon: 'devices',
    category: 'Devices',
  },
  {
    id: 'infrastructure_ops',
    title: 'Infrastructure operations',
    description: 'Fixed asset status, auto movements, and infrastructure alerts.',
    icon: 'cell_tower',
    category: 'Infrastructure',
  },
  {
    id: 'exception_summary',
    title: 'Exception summary',
    description: 'Open and resolved exceptions with severity and SLA posture.',
    icon: 'warning',
    category: 'Operations',
  },
]

export type ReportDataInput = {
  trailers: Trailer[]
  onSite: Trailer[]
  metrics: {
    occupancy: number
    parked: number
    capacity: number
    openDocks: number
    totalDocks: number
    longDwell: number
    critical: number
    warn: number
    holds: number
    byZone: { zone: string; used: number; total: number }[]
  }
  gateEvents: {
    direction: string
    status: string
    trailerNumber?: string
    lane?: string
    time?: string
    carrier?: string
  }[]
  movements: {
    time: string
    trailerNumber: string
    type: string
    from: string
    to: string
    by: string
  }[]
  devices: UnifiedSmartDevice[]
  kpis: {
    devicesTotal: number
    devicesOnline: number
    gpsCoverage: number
    bleCoverage: number
    telemetryCoverage: number
    assignedDevices: number
  }
  infra: YardInfraAsset[]
  infraMovements: InfraAutoMovement[]
  infraAlerts: InfraAlert[]
  exceptions: ExceptionRow[]
}

const PERIOD_LABEL: Record<ReportPeriod, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

function periodRowLimit(period: ReportPeriod) {
  if (period === 'today') return 12
  if (period === '7d') return 24
  return 40
}

export function generateReport(
  id: ReportId,
  period: ReportPeriod,
  data: ReportDataInput,
): GeneratedReport {
  const def = REPORT_DEFINITIONS.find((r) => r.id === id)!
  const generatedAt = formatUsDateTime()
  const base = {
    id,
    title: def.title,
    period,
    periodLabel: PERIOD_LABEL[period],
    generatedAt,
    site: SITE.name,
  }

  switch (id) {
    case 'yard_utilization':
      return {
        ...base,
        columns: ['Zone', 'Used', 'Capacity', 'Fill %', 'Status'],
        rows: [
          ...data.metrics.byZone.map((z) => {
            const fill = z.total ? Math.round((z.used / z.total) * 100) : 0
            return [
              `Zone ${z.zone}`,
              String(z.used),
              String(z.total),
              `${fill}%`,
              fill >= 90 ? 'Near capacity' : fill >= 70 ? 'Busy' : 'Normal',
            ]
          }),
          [
            'Dock doors',
            String(data.metrics.totalDocks - data.metrics.openDocks),
            String(data.metrics.totalDocks),
            `${data.metrics.totalDocks ? Math.round(((data.metrics.totalDocks - data.metrics.openDocks) / data.metrics.totalDocks) * 100) : 0}%`,
            'Live',
          ],
        ],
        summary: [
          { label: 'Yard fill', value: `${data.metrics.occupancy}%` },
          { label: 'Slots', value: `${data.metrics.parked}/${data.metrics.capacity}` },
          { label: 'On site', value: String(data.onSite.length) },
        ],
      }

    case 'cold_chain': {
      const rows = data.onSite
        .slice(0, periodRowLimit(period))
        .map((t) => [
          t.number,
          t.carrier || (t.ownership === 'bh' ? "Boar's Head" : '—'),
          t.tempStatus,
          t.actual != null ? `${t.actual}°F` : '—',
          t.setpoint != null ? `${t.setpoint}°F` : '—',
          t.telemetry ? 'Yes' : 'No',
          t.reeferAlarm ? 'Alarm' : 'OK',
        ])
      const compliant = data.onSite.filter(
        (t) => t.tempStatus === 'ok' || t.tempStatus === 'na',
      ).length
      const pct = data.onSite.length
        ? Math.round((compliant / data.onSite.length) * 100)
        : 100
      return {
        ...base,
        columns: [
          'Trailer',
          'Carrier',
          'Status',
          'Actual',
          'Setpoint',
          'Telemetry',
          'Reefer',
        ],
        rows,
        summary: [
          { label: 'Compliance', value: `${pct}%` },
          { label: 'Excursions', value: String(data.metrics.critical) },
          { label: 'Warming', value: String(data.metrics.warn) },
        ],
      }
    }

    case 'gate_activity':
      return {
        ...base,
        columns: ['Time', 'Direction', 'Trailer', 'Lane', 'Status', 'Carrier'],
        rows: data.gateEvents.slice(0, periodRowLimit(period)).map((g) => [
          g.time ?? '—',
          g.direction === 'in' ? 'Inbound' : 'Outbound',
          g.trailerNumber ?? '—',
          g.lane ?? '—',
          g.status ?? '—',
          g.carrier ?? '—',
        ]),
        summary: [
          {
            label: 'Inbound',
            value: String(data.gateEvents.filter((g) => g.direction === 'in').length),
          },
          {
            label: 'Outbound',
            value: String(data.gateEvents.filter((g) => g.direction === 'out').length),
          },
          {
            label: 'Held',
            value: String(data.gateEvents.filter((g) => g.status === 'held').length),
          },
        ],
      }

    case 'trailer_dwell':
      return {
        ...base,
        columns: [
          'Trailer',
          'Zone',
          'Slot',
          'Dwell (h)',
          'Status',
          'Cold chain',
          'Hold',
        ],
        rows: [...data.onSite]
          .sort((a, b) => b.dwellHours - a.dwellHours)
          .slice(0, periodRowLimit(period))
          .map((t) => [
            t.number,
            t.zone ?? '—',
            t.slot ?? '—',
            String(t.dwellHours),
            t.status,
            t.tempStatus,
            t.opsHold !== 'none' ? t.opsHold : '—',
          ]),
        summary: [
          { label: 'Long dwell', value: String(data.metrics.longDwell) },
          { label: 'Avg dwell', value: data.onSite.length ? `${(data.onSite.reduce((s, t) => s + t.dwellHours, 0) / data.onSite.length).toFixed(1)}h` : '0h' },
          { label: 'Holds', value: String(data.metrics.holds) },
        ],
      }

    case 'carrier_performance': {
      const map = new Map<string, { count: number; incidents: number }>()
      for (const t of data.onSite) {
        const name = t.ownership === 'bh' ? "Boar's Head" : t.carrier
        const cur = map.get(name) ?? { count: 0, incidents: 0 }
        cur.count += 1
        if (
          t.tempStatus === 'critical' ||
          t.tempStatus === 'warn' ||
          t.reeferAlarm
        ) {
          cur.incidents += 1
        }
        map.set(name, cur)
      }
      const rows = [...map.entries()]
        .sort((a, b) => b[1].incidents - a[1].incidents)
        .map(([name, v]) => {
          const rate = v.count ? Math.round((v.incidents / v.count) * 100) : 0
          return [name, String(v.count), String(v.incidents), `${rate}%`]
        })
      return {
        ...base,
        columns: ['Carrier', 'On site', 'Incidents', 'Rate'],
        rows,
        summary: [
          { label: 'Carriers', value: String(map.size) },
          { label: 'BH-owned', value: String(data.onSite.filter((t) => t.ownership === 'bh').length) },
          { label: 'Carrier-owned', value: String(data.onSite.filter((t) => t.ownership === 'carrier').length) },
        ],
      }
    }

    case 'device_telemetry':
      return {
        ...base,
        columns: [
          'Device ID',
          'Class',
          'Trailer',
          'Status',
          'Battery %',
          'Connectivity',
          'Capabilities',
        ],
        rows: data.devices.slice(0, periodRowLimit(period)).map((d) => [
          d.id,
          d.deviceClass,
          d.assignedTrailer ?? 'Unassigned',
          d.connectivity,
          String(d.batteryPct),
          d.connectivityProfile,
          d.capabilities.slice(0, 3).join(', '),
        ]),
        summary: [
          {
            label: 'Online',
            value: `${data.kpis.devicesOnline}/${data.kpis.devicesTotal}`,
          },
          { label: 'GPS coverage', value: `${data.kpis.gpsCoverage}%` },
          { label: 'Telemetry', value: `${data.kpis.telemetryCoverage}%` },
        ],
      }

    case 'infrastructure_ops':
      return {
        ...base,
        columns: [
          'Device',
          'Kind',
          'Zone',
          'Status',
          'Health',
          'Last seen',
        ],
        rows: data.infra.slice(0, periodRowLimit(period)).map((a) => [
          a.name,
          INFRA_KIND_META[a.kind],
          a.zone,
          INFRA_OPS_STATUS_META[a.status],
          a.healthScore != null ? `${a.healthScore}%` : '—',
          a.lastSeen,
        ]),
        summary: [
          { label: 'Assets', value: String(data.infra.length) },
          {
            label: 'Auto movements',
            value: String(data.infraMovements.length),
          },
          {
            label: 'Open alerts',
            value: String(data.infraAlerts.filter((a) => a.status === 'open').length),
          },
        ],
      }

    case 'exception_summary':
      return {
        ...base,
        columns: [
          'Trailer',
          'Reason',
          'Severity',
          'Status',
          'Assignee',
          'SLA (min)',
        ],
        rows: data.exceptions.slice(0, periodRowLimit(period)).map((e) => [
          e.trailerId,
          e.reason,
          e.severity,
          e.status,
          e.assignee ?? 'Unassigned',
          String(e.slaMin),
        ]),
        summary: [
          {
            label: 'Open',
            value: String(data.exceptions.filter((e) => e.status !== 'resolved').length),
          },
          {
            label: 'Critical',
            value: String(data.exceptions.filter((e) => e.severity === 'critical').length),
          },
          {
            label: 'Resolved',
            value: String(data.exceptions.filter((e) => e.status === 'resolved').length),
          },
        ],
      }
  }
}

export function reportToCsv(report: GeneratedReport): string {
  const header = [
    report.title,
    report.site,
    report.periodLabel,
    report.generatedAt,
  ].join(',')
  const cols = report.columns.join(',')
  const body = report.rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n')
  return `${header}\n\n${cols}\n${body}`
}

export function downloadReportCsv(report: GeneratedReport) {
  const blob = new Blob([reportToCsv(report)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${report.id}-${report.period}-${SITE.code}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
