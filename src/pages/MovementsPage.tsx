import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ColumnFilterHeader,
  PlainHeader,
  uniqueOptions,
} from '../components/ColumnFilterHeader'
import { Pagination, usePagination } from '../components/Pagination'
import { useYard } from '../yard/YardContext'

const typeLabel: Record<string, string> = {
  gate_in: 'Gate in',
  gate_out: 'Gate out',
  slot_move: 'Slot move',
  dock_assign: 'Dock assign',
  undock: 'Undock',
  stage_outbound: 'Stage outbound',
  hold: 'Hold',
}

export function MovementsPage() {
  const navigate = useNavigate()
  const { movements } = useYard()
  const [timeFilter, setTimeFilter] = useState('all')
  const [trailerFilter, setTrailerFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [fromFilter, setFromFilter] = useState('all')
  const [toFilter, setToFilter] = useState('all')
  const [byFilter, setByFilter] = useState('all')

  const timeOptions = useMemo(
    () => uniqueOptions(movements.map((m) => m.time)),
    [movements],
  )
  const trailerOptions = useMemo(
    () => uniqueOptions(movements.map((m) => m.trailerNumber)),
    [movements],
  )
  const eventOptions = useMemo(
    () =>
      uniqueOptions(movements.map((m) => m.type), (v) => typeLabel[v] ?? v),
    [movements],
  )
  const fromOptions = useMemo(
    () => uniqueOptions(movements.map((m) => m.from)),
    [movements],
  )
  const toOptions = useMemo(
    () => uniqueOptions(movements.map((m) => m.to)),
    [movements],
  )
  const byOptions = useMemo(
    () => uniqueOptions(movements.map((m) => m.by)),
    [movements],
  )

  const rows = useMemo(() => {
    return movements.filter((mv) => {
      if (timeFilter !== 'all' && mv.time !== timeFilter) return false
      if (trailerFilter !== 'all' && mv.trailerNumber !== trailerFilter)
        return false
      if (eventFilter !== 'all' && mv.type !== eventFilter) return false
      if (fromFilter !== 'all' && mv.from !== fromFilter) return false
      if (toFilter !== 'all' && mv.to !== toFilter) return false
      if (byFilter !== 'all' && mv.by !== byFilter) return false
      return true
    })
  }, [
    movements,
    timeFilter,
    trailerFilter,
    eventFilter,
    fromFilter,
    toFilter,
    byFilter,
  ])

  const filterKey = `${timeFilter}|${trailerFilter}|${eventFilter}|${fromFilter}|${toFilter}|${byFilter}`
  const pagination = usePagination(rows, 10, filterKey)

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <div className="eyebrow">Yard event log</div>
          <h1>Movements</h1>
          <p>
            Review gate, slot, dock, and hold events for each trailer — the
            chronological trail of yard activity.
          </p>
        </div>
        <div className="meta-chip">{rows.length} events</div>
      </div>

      <div className="panel table-wrap table-wrap-filters">
        <table>
          <thead>
            <tr>
              <th>
                <ColumnFilterHeader
                  label="Time"
                  value={timeFilter}
                  options={timeOptions}
                  onChange={setTimeFilter}
                  searchable
                  searchPlaceholder="Search time…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Trailer"
                  value={trailerFilter}
                  options={trailerOptions}
                  onChange={setTrailerFilter}
                  searchable
                  searchPlaceholder="Search trailer…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="Event"
                  value={eventFilter}
                  options={eventOptions}
                  onChange={setEventFilter}
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="From"
                  value={fromFilter}
                  options={fromOptions}
                  onChange={setFromFilter}
                  searchable
                  searchPlaceholder="Search from…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="To"
                  value={toFilter}
                  options={toOptions}
                  onChange={setToFilter}
                  searchable
                  searchPlaceholder="Search to…"
                />
              </th>
              <th>
                <ColumnFilterHeader
                  label="By"
                  value={byFilter}
                  options={byOptions}
                  onChange={setByFilter}
                  searchable
                  searchPlaceholder="Search user…"
                />
              </th>
              <th>
                <PlainHeader>Note</PlainHeader>
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map((mv) => (
              <tr
                key={mv.id}
                onClick={() => navigate(`/trailer/${mv.trailerId}`)}
              >
                <td className="mono">{mv.time}</td>
                <td className="trailer-id">{mv.trailerNumber}</td>
                <td>
                  <span className="badge ok">
                    {typeLabel[mv.type] ?? mv.type}
                  </span>
                </td>
                <td className="mono">{mv.from}</td>
                <td className="mono">{mv.to}</td>
                <td>{mv.by}</td>
                <td className="trailer-meta">{mv.note ?? '—'}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="empty">
                  No movements match the column filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <Pagination
          page={pagination.page}
          setPage={pagination.setPage}
          pageSize={pagination.pageSize}
          setPageSize={pagination.setPageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
        />
      </div>
    </div>
  )
}
