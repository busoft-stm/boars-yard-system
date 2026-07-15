import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

export type SnackbarTone = 'success' | 'error' | 'info'

type SnackbarItem = {
  id: number
  message: string
  tone: SnackbarTone
}

type SnackbarContextValue = {
  show: (message: string, tone?: SnackbarTone) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null)

const AUTO_DISMISS_MS = 4200

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: SnackbarTone = 'info') => {
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { id, message, tone }])
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  const success = useCallback((message: string) => show(message, 'success'), [show])
  const error = useCallback((message: string) => show(message, 'error'), [show])
  const info = useCallback((message: string) => show(message, 'info'), [show])

  return (
    <SnackbarContext.Provider value={{ show, success, error, info }}>
      {children}
      <div className="snackbar-stack" aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <div
            key={item.id}
            className={`snackbar snackbar-${item.tone}`}
            role="status"
          >
            <span className="snackbar-icon" aria-hidden>
              {item.tone === 'success' ? '✓' : item.tone === 'error' ? '!' : 'i'}
            </span>
            <span className="snackbar-message">{item.message}</span>
            <button
              type="button"
              className="snackbar-close"
              aria-label="Dismiss notification"
              title="Dismiss"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  )
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext)
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider')
  return ctx
}
