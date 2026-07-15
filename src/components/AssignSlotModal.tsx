import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { isOnSite, useYard } from '../yard/YardContext'
import { ModalCloseBtn } from './ActionIcons'
import { useSnackbar } from './Snackbar'

type Props = {
  open: boolean
  onClose: () => void
  /** Pre-select a trailer when opening from Gate or trailer row */
  trailerId?: string | null
  /** Prefer this empty slot when opening from Yards map */
  preferredSlot?: string | null
  onAssigned?: (trailerId: string, slot: string) => void
}

export function AssignSlotModal({
  open,
  onClose,
  trailerId: initialTrailerId = null,
  preferredSlot = null,
  onAssigned,
}: Props) {
  const { trailers, availableParkingSlots, assignParkingSlot } = useYard()
  const { success, error: showError } = useSnackbar()

  const [trailerId, setTrailerId] = useState('')
  const [slot, setSlot] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const assignableTrailers = useMemo(
    () =>
      trailers
        .filter(
          (t) =>
            (t.recordStatus ?? 'active') === 'active' &&
            isOnSite(t) &&
            t.status !== 'At dock' &&
            t.status !== 'Departed',
        )
        .sort((a, b) => {
          const aNeeds = !a.slot ? 0 : 1
          const bNeeds = !b.slot ? 0 : 1
          if (aNeeds !== bNeeds) return aNeeds - bNeeds
          if (a.status === 'Gate arrived' && b.status !== 'Gate arrived')
            return -1
          if (b.status === 'Gate arrived' && a.status !== 'Gate arrived')
            return 1
          return a.number.localeCompare(b.number)
        }),
    [trailers],
  )

  const selected = useMemo(
    () => assignableTrailers.find((t) => t.id === trailerId),
    [assignableTrailers, trailerId],
  )

  const slotOptions = useMemo(() => {
    const openSlots = availableParkingSlots.slice(0, 120)
    const extras: typeof openSlots = []
    if (selected?.slot && !openSlots.some((s) => s.label === selected.slot)) {
      extras.push({
        id: selected.slot,
        zone: selected.zone,
        label: selected.slot,
        type: 'parking' as const,
        trailerId: selected.id,
      })
    }
    return [...extras, ...openSlots]
  }, [availableParkingSlots, selected])

  useEffect(() => {
    if (!open) return
    const nextTrailerId =
      initialTrailerId ??
      trailers.find(
        (t) =>
          (t.recordStatus ?? 'active') === 'active' &&
          isOnSite(t) &&
          !t.slot &&
          t.status !== 'At dock',
      )?.id ??
      ''
    setTrailerId(nextTrailerId)
    setError('')
    setBusy(false)

    const preselected = trailers.find((t) => t.id === nextTrailerId)
    if (preselected?.slot) {
      setSlot(preselected.slot)
    } else if (
      preferredSlot &&
      availableParkingSlots.some((s) => s.label === preferredSlot)
    ) {
      setSlot(preferredSlot)
    } else {
      setSlot('')
    }
    // Snapshot data only when opening / changing the target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTrailerId, preferredSlot])

  // After check-in, trailers may arrive one tick later — keep preselected id
  useEffect(() => {
    if (!open || !initialTrailerId) return
    if (trailerId === initialTrailerId) return
    if (trailers.some((t) => t.id === initialTrailerId)) {
      setTrailerId(initialTrailerId)
    }
  }, [open, initialTrailerId, trailerId, trailers])

  function handleTrailerChange(nextId: string) {
    setTrailerId(nextId)
    const t = assignableTrailers.find((x) => x.id === nextId)
    setSlot(t?.slot ?? '')
    setError('')
  }

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trailerId) {
      setError('Select a trailer.')
      showError('Select a trailer.')
      return
    }
    if (!slot) {
      setError('Select a parking slot.')
      showError('Select a parking slot.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await assignParkingSlot({ trailerId, slot })
      success(`${result.number} assigned to ${slot}.`)
      onAssigned?.(result.id, slot)
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not assign parking slot.'
      setError(message)
      showError(message)
      setBusy(false)
    }
  }

  const canSubmit =
    !busy &&
    !!trailerId &&
    !!slot &&
    assignableTrailers.length > 0 &&
    slotOptions.length > 0

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-slot-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">Yard assignment</div>
            <h2 id="assign-slot-title">Assign parking slot</h2>
          </div>
          <ModalCloseBtn onClick={onClose} />
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {error ? <div className="form-error">{error}</div> : null}

            <p className="role-info-lead" style={{ marginTop: 0 }}>
              Assign an empty parking slot to a trailer at gate or already on
              site. Slot assignment is separate from register edits.
            </p>

            <div className="form-grid">
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Trailer</span>
                <select
                  className="select"
                  value={trailerId}
                  onChange={(e) => handleTrailerChange(e.target.value)}
                  disabled={!!initialTrailerId}
                  autoFocus={!initialTrailerId}
                >
                  <option value="">Select trailer…</option>
                  {assignableTrailers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.number} · {t.status}
                      {t.slot ? ` · current ${t.slot}` : ' · no slot'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Parking slot</span>
                <select
                  className="select"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  autoFocus={!!initialTrailerId}
                >
                  <option value="">Select slot…</option>
                  {slotOptions.map((s) => (
                    <option key={s.id} value={s.label}>
                      {s.label} · Zone {s.zone}
                      {s.trailerId === selected?.id ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selected ? (
              <div className="form-section">
                <div className="eyebrow">Trailer summary</div>
                <div className="kv compact">
                  <div className="kv-item">
                    <label>Yard status</label>
                    <strong>{selected.status}</strong>
                  </div>
                  <div className="kv-item">
                    <label>Current slot</label>
                    <strong>{selected.slot ?? 'None'}</strong>
                  </div>
                  <div className="kv-item">
                    <label>Carrier</label>
                    <strong>{selected.carrier}</strong>
                  </div>
                  <div className="kv-item">
                    <label>Seal</label>
                    <strong>{selected.seal}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {!assignableTrailers.length ? (
              <div className="empty">
                No trailers need slot assignment — check in at Gate first.
              </div>
            ) : null}
            {!slotOptions.length ? (
              <div className="empty">
                No empty parking slots available. Add slots in Yards.
              </div>
            ) : null}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSubmit}
            >
              {busy ? 'Assigning…' : 'Assign slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
