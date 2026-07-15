import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatTemp, OwnBadge, StatusBadge } from '../components/Badges'
import { ModalCloseBtn } from '../components/ActionIcons'
import { useSnackbar } from '../components/Snackbar'
import { useYard } from '../yard/YardContext'
import {
  DOCK_PHASE_META,
  OPS_HOLD_META,
  trailerHasOpsHold,
  trailerNeedsDock,
  type DockPhase,
  type Trailer,
} from '../data/trailers'

function readyDockBlockReason(t: Trailer): string | null {
  if ((t.recordStatus ?? 'active') !== 'active') return 'Disabled'
  if (trailerHasOpsHold(t)) {
    const hold = t.opsHold === 'qa' || t.opsHold === 'yard' ? t.opsHold : 'qa'
    return `Hold: ${OPS_HOLD_META[hold]}`
  }
  if (!trailerNeedsDock(t)) return 'Yard → departure'
  return null
}

function canAssignFromReadyQueue(t: Trailer) {
  return readyDockBlockReason(t) === null
}

const DOCK_FLOW: DockPhase[] = [
  'idle',
  'loading',
  'unloading',
  'qa_verify',
  'complete',
]

export function DockPage() {
  const navigate = useNavigate()
  const {
    slots,
    trailers,
    getTrailer,
    metrics,
    layout,
    assignToDock,
    undockTrailer,
    setDockPhase,
    addDocks,
  } = useYard()
  const { success, error: showError } = useSnackbar()

  const [selected, setSelected] = useState<string | null>('Door 1')
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addCount, setAddCount] = useState('2')
  const [addError, setAddError] = useState('')

  const docks = useMemo(
    () => slots.filter((s) => s.type === 'dock'),
    [slots],
  )
  const ready = useMemo(
    () =>
      trailers
        .filter((t) => t.status === 'Ready to dock')
        .sort((a, b) => {
          const aBlocked = canAssignFromReadyQueue(a) ? 0 : 1
          const bBlocked = canAssignFromReadyQueue(b) ? 0 : 1
          if (aBlocked !== bBlocked) return aBlocked - bBlocked
          return b.dwellHours - a.dwellHours
        }),
    [trailers],
  )
  const readyAssignable = useMemo(
    () => ready.filter((t) => canAssignFromReadyQueue(t)),
    [ready],
  )
  const skipDockCount = useMemo(
    () =>
      trailers.filter(
        (t) =>
          !trailerNeedsDock(t) &&
          (t.status === 'In yard' || t.status === 'Gate arrived'),
      ).length,
    [trailers],
  )
  const atDock = trailers.filter((t) => t.status === 'At dock')
  const selectedDock = docks.find((d) => d.label === selected)
  const selectedTrailer = selectedDock?.trailerId
    ? getTrailer(selectedDock.trailerId)
    : null
  const openDoors = docks.filter((d) => !d.trailerId)

  async function handleAssign(trailerId: string, doorLabel: string) {
    setBusy(true)
    try {
      const t = await assignToDock({ trailerId, doorLabel })
      setSelected(doorLabel)
      success(`${t.number} assigned to ${doorLabel}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not assign dock.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAssignFromQueue() {
    if (!selectedDock) {
      showError('Select a dock door first.')
      return
    }
    if (selectedDock.trailerId) {
      showError(`${selectedDock.label} is occupied — unlock it first.`)
      return
    }
    const nextReady = readyAssignable[0]
    if (!nextReady) {
      showError(
        ready.length
          ? 'Ready trailers are on hold or yard-depart — clear hold / enable Dock required.'
          : 'No trailers in the ready-to-dock queue.',
      )
      return
    }
    await handleAssign(nextReady.id, selectedDock.label)
  }

  async function handleAssignReadyTrailer(trailerId: string) {
    const target =
      selectedDock && !selectedDock.trailerId
        ? selectedDock
        : openDoors[0]
    if (!target) {
      showError('No open dock doors available.')
      return
    }
    await handleAssign(trailerId, target.label)
  }

  async function handleUnlock() {
    if (!selectedTrailer) {
      showError('No trailer at this door.')
      return
    }
    setBusy(true)
    try {
      const door = selectedTrailer.dockDoor ?? selected
      const t = await undockTrailer(selectedTrailer.id)
      success(`${t.number} unlocked from ${door}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not unlock door.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDockPhase(phase: DockPhase) {
    if (!selectedTrailer) return
    setBusy(true)
    try {
      const t = await setDockPhase(selectedTrailer.id, phase)
      success(`${t.number} · ${DOCK_PHASE_META[phase]}`)
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Could not update dock activity.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleAddDocks(e: FormEvent) {
    e.preventDefault()
    setAddError('')
    setBusy(true)
    try {
      const next = await addDocks({ count: Number(addCount) })
      setAddOpen(false)
      setAddCount('2')
      setSelected(`Door ${next.dockCount}`)
      success(
        `Added ${addCount} dock door${Number(addCount) === 1 ? '' : 's'} · now ${next.dockCount} total`,
      )
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add docks.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Dock operations</div>
          <h1>Docks</h1>
          <p>
            Dock assignment is optional — only trailers marked Dock required
            enter this queue. Others stage for departure from Yards.
          </p>
        </div>
        <div className="btn-row">
          <div className="meta-chip">
            {metrics.openDocks}/{metrics.totalDocks} doors open
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setAddError('')
              setAddOpen(true)
            }}
          >
            Add docks
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat frost">
          <div className="stat-label">Open doors</div>
          <div className="stat-value">
            {metrics.openDocks}/{metrics.totalDocks}
          </div>
          <div className="stat-note">Available now</div>
        </div>
        <div className="stat">
          <div className="stat-label">At dock</div>
          <div className="stat-value">{atDock.length}</div>
          <div className="stat-note">Unloading / loading</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Ready to dock</div>
          <div className="stat-value">{ready.length}</div>
          <div className="stat-note">
            {readyAssignable.length} assignable
            {ready.length > readyAssignable.length
              ? ` · ${ready.length - readyAssignable.length} blocked`
              : ''}
            {skipDockCount ? ` · ${skipDockCount} yard-depart` : ''}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Outbound staged</div>
          <div className="stat-value">{metrics.outbound}</div>
          <div className="stat-note">Near dock apron</div>
        </div>
      </div>

      <div className="map-layout">
        <div className="panel map-panel">
          <div className="panel-head">
            <h2>
              Doors 1–{layout.dockCount}
            </h2>
            <span className="trailer-meta">Click a door to inspect</span>
          </div>
          <div className="dock-grid">
            {docks.map((d) => {
              const t = d.trailerId ? getTrailer(d.trailerId) : null
              const tone = !t
                ? 'empty'
                : t.tempStatus === 'critical'
                  ? 'critical'
                  : t.tempStatus === 'warn'
                    ? 'warn'
                    : 'ok'
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`dock-slot ${tone} ${selected === d.label ? 'selected' : ''}`}
                  onClick={() => setSelected(d.label)}
                >
                  <strong>{d.label}</strong>
                  <span>{t ? t.number : 'Open'}</span>
                  {t ? <StatusBadge status={t.tempStatus} /> : null}
                </button>
              )
            })}
          </div>

          <div className="panel-head" style={{ marginTop: '1.2rem' }}>
            <h2>Ready to dock</h2>
            <span className="trailer-meta">
              {readyAssignable.length} assignable
              {ready.length !== readyAssignable.length
                ? ` · ${ready.length} total`
                : ''}
            </span>
          </div>
          <div className="list">
            {ready.map((t) => {
              const blockReason = readyDockBlockReason(t)
              const canAssign = !blockReason
              return (
                <div key={t.id} className="list-item insights-list-item static">
                  <span
                    className={`priority ${blockReason ? 'critical' : 'warn'}`}
                  />
                  <button
                    type="button"
                    className="dock-ready-main"
                    onClick={() => navigate(`/trailer/${t.id}`)}
                  >
                    <div className="trailer-id">
                      {t.number} <OwnBadge ownership={t.ownership} />
                    </div>
                    <div className="trailer-meta">
                      {t.slot ?? 'Yard'} · {formatTemp(t.actual)} · dwell{' '}
                      {t.dwellHours.toFixed(1)} hr
                      {blockReason ? ` · ${blockReason}` : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy || openDoors.length === 0 || !canAssign}
                    title={
                      blockReason
                        ? `Clear “${blockReason}” before assigning`
                        : openDoors.length === 0
                          ? 'No open dock doors'
                          : 'Assign to an open door'
                    }
                    onClick={() => handleAssignReadyTrailer(t.id)}
                  >
                    Assign door
                  </button>
                </div>
              )
            })}
            {!ready.length ? (
              <div className="empty">
                No trailers marked Ready to dock
                {skipDockCount
                  ? ` · ${skipDockCount} on yard-depart workflow`
                  : ''}
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel story-card inspector">
          {selectedTrailer && selectedDock ? (
            <>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate(`/trailer/${selectedTrailer.id}`)}
                >
                  Open trailer
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={
                    busy || (selectedTrailer.dockPhase ?? 'idle') !== 'complete'
                  }
                  title={
                    (selectedTrailer.dockPhase ?? 'idle') !== 'complete'
                      ? 'Complete QA verification first'
                      : 'Unlock door'
                  }
                  onClick={() => void handleUnlock()}
                >
                  Unlock
                </button>
              </div>
              <div className="eyebrow">Selected door</div>
              <h2>{selectedDock.label}</h2>
              <p>
                {selectedTrailer.number} · {selectedTrailer.carrier} ·{' '}
                {selectedTrailer.product}
              </p>
              <div className="eyebrow" style={{ marginTop: '0.75rem' }}>
                Dock workflow
              </div>
              <div className="btn-row smart-lifecycle" style={{ flexWrap: 'wrap' }}>
                {DOCK_FLOW.map((phase) => (
                  <button
                    key={phase}
                    type="button"
                    className={`btn btn-ghost ${
                      (selectedTrailer.dockPhase ?? 'idle') === phase
                        ? 'btn-primary'
                        : ''
                    }`}
                    disabled={busy || (selectedTrailer.dockPhase ?? 'idle') === phase}
                    onClick={() => void handleDockPhase(phase)}
                  >
                    {DOCK_PHASE_META[phase]}
                  </button>
                ))}
              </div>
              <div className="kv compact">
                <div className="kv-item">
                  <label>Temp</label>
                  <strong>{formatTemp(selectedTrailer.actual)}</strong>
                </div>
                <div className="kv-item">
                  <label>Status</label>
                  <strong>{selectedTrailer.status}</strong>
                </div>
                <div className="kv-item">
                  <label>Dock activity</label>
                  <strong>
                    {
                      DOCK_PHASE_META[
                        selectedTrailer.dockPhase ?? 'idle'
                      ]
                    }
                  </strong>
                </div>
                <div className="kv-item">
                  <label>Seal</label>
                  <strong>{selectedTrailer.seal}</strong>
                </div>
                <div className="kv-item">
                  <label>Fuel</label>
                  <strong>
                    {selectedTrailer.fuelPct == null
                      ? '—'
                      : `${selectedTrailer.fuelPct}%`}
                  </strong>
                </div>
              </div>
            </>
          ) : selectedDock ? (
            <>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || readyAssignable.length === 0}
                  onClick={() => void handleAssignFromQueue()}
                >
                  Assign from ready queue
                </button>
              </div>
              <div className="eyebrow">Selected door</div>
              <h2>{selectedDock.label}</h2>
              <p>
                Door is open
                {readyAssignable.length
                  ? ` — next in queue: ${readyAssignable[0].number}`
                  : ready.length
                    ? ' — ready trailers are blocked (hold / yard-depart).'
                    : ' — no ready-to-dock trailers waiting.'}
              </p>
              {readyAssignable.length > 0 ? (
                <div className="list" style={{ marginTop: '0.85rem' }}>
                  {readyAssignable.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="list-item"
                      disabled={busy}
                      onClick={() => void handleAssign(t.id, selectedDock.label)}
                    >
                      <span className="priority warn" />
                      <div>
                        <div className="trailer-id">{t.number}</div>
                        <div className="trailer-meta">
                          {t.product} · {t.dwellHours.toFixed(1)} hr
                        </div>
                      </div>
                      <span className="btn btn-ghost" style={{ pointerEvents: 'none' }}>
                        Dock here
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p>Select a dock door.</p>
          )}
        </div>
      </div>

      {addOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !busy && setAddOpen(false)}
        >
          <div
            className="modal-panel modal-panel-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-docks-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">Dock layout</div>
                <h2 id="add-docks-title">Add dock doors</h2>
              </div>
              <ModalCloseBtn onClick={() => setAddOpen(false)} />
            </div>
            <form className="modal-form" onSubmit={handleAddDocks}>
              <div className="modal-body">
                {addError ? <div className="form-error">{addError}</div> : null}
                <label className="field">
                  <span>Doors to add</span>
                  <input
                    className="search"
                    type="number"
                    min={1}
                    max={20}
                    value={addCount}
                    onChange={(e) => setAddCount(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <p className="trailer-meta" style={{ margin: 0 }}>
                  Currently {layout.dockCount} doors (Door 1–{layout.dockCount}
                  ). New doors continue the sequence up to 64.
                </p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Adding…' : 'Add docks'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
