import { useMemo, useState } from 'react'
import { useSnackbar } from '../components/Snackbar'
import { SITE, isOnSite } from '../data/trailers'
import {
  REPORT_DEFINITIONS,
  downloadReportCsv,
  generateReport,
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
]

export function ReportsPage() {
  const { trailers, metrics, gateEvents, movements } = useYard()
  const { devices, kpis, infra, infraMovements, infraAlerts } = useSmartYard()
  const { rows: exceptions } = useExceptions()
  const { success, info } = useSnackbar()

  const [selectedId, setSelectedId] = useState<ReportId>('yard_utilization')
  const [period, setPeriod] = useState<ReportPeriod>('today')
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

  function handleGenerate() {
    const report = generateReport(selectedId, period, reportData)
    setGenerated(report)
    success(`${report.title} generated for ${report.periodLabel}.`)
  }

  function handleExportCsv() {
    const report = preview ?? generateReport(selectedId, period, reportData)
    if (!preview) setGenerated(report)
    downloadReportCsv(report)
    info(`CSV downloaded · ${report.title}`)
  }

  function handleExportPdf() {
    const report = generated ?? generateReport(selectedId, period, reportData)
    if (!generated) setGenerated(report)
    success(`PDF report drafted for ${report.periodLabel} · ${SITE.code}.`)
  }

  const preview =
    generated?.id === selectedId && generated.period === period
      ? generated
      : null

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
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!preview}
            onClick={handleExportCsv}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportPdf}
          >
            Export PDF
          </button>
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
            <div className="reports-config-row">
              <label className="reports-field reports-field-template">
                <span>Template</span>
                <select
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
              <label className="reports-field">
                <span>Period</span>
                <select
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
              <label className="reports-field">
                <span>Site</span>
                <input type="text" value={SITE.name} readOnly />
              </label>
              <button
                type="button"
                className="btn btn-primary reports-generate-btn"
                onClick={handleGenerate}
              >
                Generate report
              </button>
            </div>
            <p className="reports-template-desc">{selected.description}</p>
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
                Choose a period and click <strong>Generate report</strong> to
                preview {selected.category.toLowerCase()} data before exporting.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
