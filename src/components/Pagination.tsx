import { useCallback, useEffect, useMemo, useState } from 'react'

const DEFAULT_PAGE_SIZE = 10

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const

export function usePagination<T>(
  items: T[],
  initialPageSize = DEFAULT_PAGE_SIZE,
  resetKey?: unknown,
) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setPage(1)
  }, [])

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    setPage(1)
  }, [resetKey])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    paginatedItems,
    rangeStart,
    rangeEnd,
  }
}

function pageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]

  if (page > 3) pages.push('ellipsis')

  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let i = start; i <= end; i += 1) pages.push(i)

  if (page < totalPages - 2) pages.push('ellipsis')

  if (totalPages > 1) pages.push(totalPages)

  return pages
}

type PaginationProps = {
  page: number
  setPage: (page: number) => void
  pageSize: number
  setPageSize: (size: number) => void
  total: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
}

export function Pagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  totalPages,
  rangeStart,
  rangeEnd,
}: PaginationProps) {
  if (total === 0) return null

  const pages = pageNumbers(page, totalPages)

  return (
    <div className="table-pagination">
      <div className="table-pagination-left">
        <span className="table-pagination-meta">
          Showing {rangeStart}–{rangeEnd} of {total}
        </span>
        <label className="table-pagination-size">
          <span>Rows per page</span>
          <select
            className="select pagination-size-select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-pagination-controls">
        <span
          className={`ui-tip ui-tip-btn${page <= 1 ? ' ui-tip-disabled' : ''}`}
          data-tooltip={page <= 1 ? 'Already on first page' : 'Previous page'}
        >
          <button
            type="button"
            className="btn btn-ghost pagination-btn"
            disabled={page <= 1}
            aria-label="Previous page"
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
        </span>

        <div className="pagination-numbers" role="group" aria-label="Page numbers">
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="pagination-ellipsis" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pagination-page-btn ${p === page ? 'active' : ''}`}
                aria-label={`Go to page ${p}`}
                title={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <span
          className={`ui-tip ui-tip-btn${page >= totalPages ? ' ui-tip-disabled' : ''}`}
          data-tooltip={
            page >= totalPages ? 'Already on last page' : 'Next page'
          }
        >
          <button
            type="button"
            className="btn btn-ghost pagination-btn"
            disabled={page >= totalPages}
            aria-label="Next page"
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </span>
      </div>
    </div>
  )
}
