import { useMemo, useState } from 'react'
import { MaterialIcon } from '../components/MaterialIcon'
import { useSnackbar } from '../components/Snackbar'
import { SITE, isOnSite } from '../data/trailers'
import {
  REPORT_DEFINITIONS,
  downloadReportCsv,
  downloadReportExcel,
  generateReport,
  printReportPdf,
  type GeneratedReport,
  type ReportId,
  type ReportPeriod,
} from '../data/reports'
import { useExceptions } from '../exceptions/ExceptionsContext'
import { useSmartYard } from '../smart/SmartYardContext'
import { useYard } from '../yard/YardContext'

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'custom', label: 'Custom date range' },
]

type ExportType = 'csv' | 'excel' | 'pdf'

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function ReportsPage() {
  const { trailers, metrics, gateEvents, movements } = useYard()
  const { devices, kpis, infra, infraMovements, infraAlerts } = useSmartYard()
  const { rows: exceptions } = useExceptions()
  const { success, info, error } = useSnackbar()

  const [selectedId, setSelectedId] = useState<ReportId>('yard_utilization')
  const [period, setPeriod] = useState<ReportPeriod>('today')
  const [customStart, setCustomStart] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return isoDate(date)
  })
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()))
  const [exportType, setExportType] = useState<ExportType>('csv')
  const [generated, setGenerated] = useState<GeneratedReport | null>(null)

  const onSite = useMemo(() => trailers.filter(isOnSite), [trailers])

  const reportData = useMemo(
    () => ({
      trailers,
      onSite,
      metrics,
      gateEvents,
      movements,
      devices,
      kpis,
      infra,
      infraMovements,
      infraAlerts,
      exceptions,
    }),
    [
      trailers,
      onSite,
      metrics,
      gateEvents,
      movements,
      devices,
      kpis,
      infra,
      infraMovements,
      infraAlerts,
      exceptions,
    ],
  )

  const selected = REPORT_DEFINITIONS.find((r) => r.id === selectedId)!

  const reportsByCategory = useMemo(() => {
    const groups = new Map<string, typeof REPORT_DEFINITIONS>()
    for (const report of REPORT_DEFINITIONS) {
      const list = groups.get(report.category) ?? []
      list.push(report)
      groups.set(report.category, list)
    }
    return [...groups.entries()]
  }, [])

  function createCurrentReport() {
    if (period === 'custom') {
      if (!customStart || !customEnd) {
        error('Select both a start date and end date.')
        return null
      }
      if (customStart > customEnd) {
        error('Start date must be on or before the end date.')
        return null
      }
    }
    return generateReport(
      selectedId,
      period,
      reportData,
      period === 'custom'
        ? { start: customStart, end: customEnd }
        : undefined,
    )
  }

  function handleGenerate() {
    const report = createCurrentReport()
    if (!report) return
    setGenerated(report)
    success(`${report.title} generated for ${report.periodLabel}.`)
  }

  function handleExport() {
    const report = preview ?? createCurrentReport()
    if (!report) return
    if (!preview) setGenerated(report)
    if (exportType === 'csv') {
      downloadReportCsv(report)
      info(`CSV downloaded · ${report.title}`)
      return
    }
    if (exportType === 'excel') {
      downloadReportExcel(report)
      info(`Excel downloaded · ${report.title}`)
      return
    }
    if (printReportPdf(report)) {
      info(`Print dialog opened · choose Save as PDF`)
    } else {
      error('Allow pop-ups to export the PDF report.')
    }
  }

  const preview =
    generated?.id === selectedId && generated.period === period
      ? generated
      : null

  const periodLabel =
    PERIODS.find((p) => p.id === period)?.label ?? period

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Reports & analytics</div>
          <h1>Reports</h1>
          <p>
            Generate operational, cold-chain, gate, carrier, device, and
            infrastructure reports for {SITE.code}.
          </p>
        </div>
      </div>

      <div className="reports-layout">
        <section className="reports-workspace">
          <div className="panel reports-config">
            <div className="panel-head">
              <div>
                <h2>Report library</h2>
                <span className="panel-meta">
                  {REPORT_DEFINITIONS.length} templates · {selected.category}
                </span>
              </div>
            </div>

            <div
              className={`reports-toolbar${period === 'custom' ? ' has-custom-dates' : ''}`}
            >
              <label className="field reports-field reports-field-template">
                Template
                <select
                  className="select"
                  value={selectedId}
                  aria-label="Report library templates"
                  onChange={(e) => {
                    setSelectedId(e.target.value as ReportId)
                    setGenerated(null)
                  }}
                >
                  {reportsByCategory.map(([category, reports]) => (
                    <optgroup key={category} label={category}>
                      {reports.map((report) => (
                        <option key={report.id} value={report.id}>
                          {report.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="field reports-field">
                Period
                <select
                  className="select"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value as ReportPeriod)
                    setGenerated(null)
                  }}
                >
                  {PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {period === 'custom' ? (
                <>
                  <label className="field reports-field">
                    Start date
                    <input
                      className="select"
                      type="date"
                      value={customStart}
                      max={customEnd}
                      onChange={(e) => {
                        setCustomStart(e.target.value)
                        setGenerated(null)
                      }}
                    />
                  </label>
                  <label className="field reports-field">
                    End date
                    <input
                      className="select"
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => {
                        setCustomEnd(e.target.value)
                        setGenerated(null)
                      }}
                    />
                  </label>
                </>
              ) : null}
              <label className="field reports-field">
                Export type
                <select
                  className="select"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as ExportType)}
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel (.xls)</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
              <div className="reports-actions">
                <span className="reports-actions-spacer" aria-hidden>
                  Actions
                </span>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleGenerate}
                  >
                    Generate report
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleExport}
                  >
                    Export report
                  </button>
                </div>
              </div>
            </div>

            <div className="reports-template-detail">
              <div className="reports-template-hero">
                <span className="reports-template-icon" aria-hidden>
                  <MaterialIcon name={selected.icon} size={28} />
                </span>
                <div>
                  <div className="eyebrow">{selected.category}</div>
                  <h3>{selected.title}</h3>
                  <p>{selected.description}</p>
                </div>
              </div>

              <div className="reports-detail-meta">
                <div>
                  <span>Audience</span>
                  <strong>{selected.audience}</strong>
                </div>
                <div>
                  <span>Freshness</span>
                  <strong>{selected.freshness}</strong>
                </div>
                <div>
                  <span>Period</span>
                  <strong>
                    {period === 'custom'
                      ? `${customStart || '—'} → ${customEnd || '—'}`
                      : periodLabel}
                  </strong>
                </div>
                <div>
                  <span>Export</span>
                  <strong>
                    {exportType === 'excel'
                      ? 'Excel (.xls)'
                      : exportType.toUpperCase()}
                  </strong>
                </div>
                <div>
                  <span>Columns</span>
                  <strong>{selected.columns.length}</strong>
                </div>
                <div>
                  <span>Site</span>
                  <strong>{SITE.code}</strong>
                </div>
              </div>

              <div className="reports-detail-grid">
                <div className="reports-detail-section">
                  <h4>Data sources</h4>
                  <ul>
                    {selected.dataSources.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="reports-detail-section">
                  <h4>Includes</h4>
                  <ul>
                    {selected.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="reports-detail-section">
                  <h4>Output columns</h4>
                  <div className="reports-column-chips">
                    {selected.columns.map((column) => (
                      <span key={column} className="meta-chip">
                        {column}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {preview ? (
            <>
              <div className="stats stats-3 reports-summary">
                {preview.summary.map((item) => (
                  <div key={item.label} className="stat frost">
                    <div className="stat-label">{item.label}</div>
                    <div className="stat-value">{item.value}</div>
                    <div className="stat-note">{preview.periodLabel}</div>
                  </div>
                ))}
              </div>

              <div className="panel table-wrap reports-preview">
                <div className="panel-head">
                  <h2>Preview</h2>
                  <span className="panel-meta">
                    {preview.rows.length} rows · Generated {preview.generatedAt}
                  </span>
                </div>
                <table>
                  <thead>
                    <tr>
                      {preview.columns.map((col) => (
                        <th key={col}>
                          <span className="th-label">{col}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                    {!preview.rows.length ? (
                      <tr>
                        <td colSpan={preview.columns.length} className="empty">
                          No rows for this period.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="panel reports-empty">
              <div className="eyebrow">Ready to generate</div>
              <h3>{selected.title}</h3>
              <p>
                Review the template details above, choose a period, then click{' '}
                <strong>Generate report</strong> to preview{' '}
                {selected.category.toLowerCase()} data before exporting.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
