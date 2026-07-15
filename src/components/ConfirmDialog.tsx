import { useCallback, useState } from 'react'
import { ModalCloseBtn } from './ActionIcons'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

type PendingConfirm = ConfirmOptions & {
  resolve: (ok: boolean) => void
}

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">Please confirm</div>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
          <ModalCloseBtn onClick={onCancel} />
        </div>
        <div className="modal-body">
          <p id="confirm-dialog-message" className="confirm-dialog-message">
            {message}
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    pending?.resolve(true)
    setPending(null)
  }, [pending])

  const handleCancel = useCallback(() => {
    pending?.resolve(false)
    setPending(null)
  }, [pending])

  const dialog = (
    <ConfirmDialog
      open={pending != null}
      title={pending?.title ?? ''}
      message={pending?.message ?? ''}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, dialog }
}
