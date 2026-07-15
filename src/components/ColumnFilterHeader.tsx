import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { IconFilter } from './ActionIcons'

export type ColumnFilterOption = {
  value: string
  label: string
}

type Props = {
  label: string
  value: string
  options: ColumnFilterOption[]
  onChange: (value: string) => void
  /** Default "all" option label */
  allLabel?: string
  align?: 'left' | 'right'
  searchable?: boolean
  searchPlaceholder?: string
}

export function ColumnFilterHeader({
  label,
  value,
  options,
  onChange,
  allLabel = 'All',
  align = 'left',
  searchable = false,
  searchPlaceholder = 'Search…',
}: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const active = value !== 'all'

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  const filtered = searchable
    ? options.filter((o) =>
        o.label.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : options

  return (
    <div
      className={`column-filter ${align === 'right' ? 'column-filter-right' : ''}`}
      ref={wrapRef}
    >
      <button
        type="button"
        className={`column-filter-trigger ${active ? 'active' : ''} ${open ? 'open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          active ? `Filter ${label} (active)` : `Filter ${label}`
        }
        title={`Filter ${label}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span>{label}</span>
        <span className="column-filter-icon" aria-hidden>
          <IconFilter size={14} />
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="column-filter-panel"
          role="listbox"
          aria-label={`Filter ${label}`}
          onClick={(e) => e.stopPropagation()}
        >
          {searchable ? (
            <input
              className="search column-filter-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          ) : null}
          <button
            type="button"
            role="option"
            aria-selected={value === 'all'}
            className={`column-filter-option ${value === 'all' ? 'selected' : ''}`}
            onClick={() => {
              onChange('all')
              setOpen(false)
            }}
          >
            {allLabel}
          </button>
          <div className="column-filter-options">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={value === o.value}
                className={`column-filter-option ${value === o.value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            ))}
            {searchable && !filtered.length ? (
              <div className="column-filter-empty">No matches</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function PlainHeader({ children }: { children: ReactNode }) {
  return <span className="column-filter-plain">{children}</span>
}

/** Unique sorted options for column overlay filters. */
export function uniqueOptions(
  values: Iterable<string | null | undefined>,
  labelFn?: (value: string) => string,
): ColumnFilterOption[] {
  const set = new Set<string>()
  for (const v of values) {
    if (v != null && String(v).trim() !== '') set.add(String(v))
  }
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((value) => ({
      value,
      label: labelFn ? labelFn(value) : value,
    }))
}
