import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  LIFECYCLE_TRAILER_STATUSES,
  OPS_HOLD_META,
  type OpsHold,
  type TrailerStatus,
} from '../data/trailers'
import { useYard } from '../yard/YardContext'
import { ModalCloseBtn } from './ActionIcons'
import { YardStatusPill } from './Badges'
import { useSnackbar } from './Snackbar'

type Props = {
  open: boolean
  onClose: () => void
  trailerId: string | null
}

const yardStatuses: TrailerStatus[] = LIFECYCLE_TRAILER_STATUSES

function normalizeStatus(status: TrailerStatus): TrailerStatus {
  return status === 'QA hold' || status === 'Yard hold' ? 'In yard' : status
}

export function UpdateTrailerStatusModal({ open, onClose, trailerId }: Props) {
  const { trailers, setTrailerStatus, setTrailerOpsHold, setTrailerDockRequired } =
    useYard()
  const { success, error: showError } = useSnackbar()

  const trailer = useMemo(
    () => trailers.find((t) => t.id === trailerId) ?? null,
    [trailers, trailerId],
  )

  const [status, setStatus] = useState<TrailerStatus>('In yard')
  const [opsHold, setOpsHold] = useState<OpsHold>('none')
  const [dockWorkflow, setDockWorkflow] = useState<'dock' | 'skip'>('dock')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !trailer) return
    setStatus(normalizeStatus(trailer.status))
    setOpsHold(trailer.opsHold ?? 'none')
    setDockWorkflow(trailer.dockRequired === false ? 'skip' : 'dock')
    setError('')
    setBusy(false)
  }, [open, trailer])

  if (!open || !trailer) return null

  const isDeparted = trailer.status === 'Departed'
  const canEditWorkflow = !isDeparted

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trailer) return

    setBusy(true)
    setError('')

    // Ready / At dock always uses the dock workflow.
    const needsDock =
      status === 'Ready to dock' || status === 'At dock' || dockWorkflow === 'dock'
    const nextDockRequired = needsDock
    const currentDockRequired = trailer.dockRequired !== false

    try {
      if (canEditWorkflow && nextDockRequired !== currentDockRequired) {
        await setTrailerDockRequired(trailer.id, nextDockRequired)
      }

      const currentOpsHold = trailer.opsHold ?? 'none'
      if (canEditWorkflow && opsHold !== currentOpsHold) {
        await setTrailerOpsHold(trailer.id, opsHold)
      }

      const currentStatus = normalizeStatus(trailer.status)
      if (status !== currentStatus) {
        await setTrailerStatus(trailer.id, status)
      }

      success(`${trailer.number} status updated.`)
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not update trailer status.'
      setError(message)
      showError(message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-status-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">Yard operations</div>
            <h2 id="update-status-title">Update yard status</h2>
          </div>
          <ModalCloseBtn onClick={onClose} />
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {error ? <div className="form-error">{error}</div> : null}

            <div className="status-modal-summary">
              <div className="trailer-cell">
                <span className="trailer-id">{trailer.number}</span>
                <span className="trailer-meta">
                  {trailer.carrier} · {trailer.slot ?? trailer.dockDoor ?? 'Gate'}
                </span>
              </div>
              <YardStatusPill trailer={trailer} />
            </div>

            <p className="role-info-lead" style={{ marginTop: 0 }}>
              Set lifecycle status, operational hold, and dock workflow together.
              Holds can apply while a trailer is in yard or at dock.
            </p>

            <div className="form-grid">
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Yard status</span>
                <select
                  className="select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TrailerStatus)}
                  autoFocus
                >
                  {yardStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {canEditWorkflow ? (
                <>
                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Operational hold</span>
                    <select
                      className="select"
                      value={opsHold}
                      onChange={(e) => setOpsHold(e.target.value as OpsHold)}
                    >
                      {(Object.keys(OPS_HOLD_META) as OpsHold[]).map((h) => (
                        <option key={h} value={h}>
                          {OPS_HOLD_META[h]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field" style={{ gridColumn: '1 / -1' }}>
                    <span>Dock workflow</span>
                    <select
                      className="select"
                      value={
                        status === 'Ready to dock' || status === 'At dock'
                          ? 'dock'
                          : dockWorkflow
                      }
                      disabled={
                        status === 'Ready to dock' || status === 'At dock'
                      }
                      onChange={(e) =>
                        setDockWorkflow(e.target.value as 'dock' | 'skip')
                      }
                    >
                      <option value="dock">Dock required</option>
                      <option value="skip">Yard → departure</option>
                    </select>
                  </label>
                </>
              ) : null}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Save status
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
