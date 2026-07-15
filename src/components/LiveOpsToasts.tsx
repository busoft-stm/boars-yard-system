import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useSnackbar, type SnackbarTone } from './Snackbar'
import { useYard } from '../yard/YardContext'
import { useNotifications } from '../notifications/NotificationsContext'

type DemoToast = {
  message: string
  tone: SnackbarTone
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

function randomBetween(minMs: number, maxMs: number) {
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1))
}

/**
 * Demo ops feed — randomly surfaces gate / exception / yard toasts
 * and mirrors them into the header notification list.
 */
export function LiveOpsToasts() {
  const { show } = useSnackbar()
  const { pushFromToast } = useNotifications()
  const { trailers, metrics, activeGateLanes } = useYard()
  const location = useLocation()
  const showRef = useRef(show)
  const pushRef = useRef(pushFromToast)
  const trailersRef = useRef(trailers)
  const metricsRef = useRef(metrics)
  const lanesRef = useRef(activeGateLanes)

  showRef.current = show
  pushRef.current = pushFromToast
  trailersRef.current = trailers
  metricsRef.current = metrics
  lanesRef.current = activeGateLanes

  useEffect(() => {
    if (location.pathname === '/login') return

    let cancelled = false
    let timer = 0

    function nextToast() {
      const list = trailersRef.current
      const onSite = list.filter(
        (t) =>
          t.status !== 'Departed' && (t.recordStatus ?? 'active') === 'active',
      )
      const numbers = (onSite.length ? onSite : list).map((t) => t.number)
      const trailer = numbers.length ? pick(numbers) : 'BH-1120'
      const laneNames = lanesRef.current.map((l) => l.name)
      const lane = pick(laneNames.length ? laneNames : ['Lane 1', 'Lane 2', 'Lane 3'])
      const slot = pick(['A-04', 'B-11', 'C-08', 'D-03', 'A-18'])
      const m = metricsRef.current

      const pool: DemoToast[] = [
        {
          tone: 'success',
          message: `${trailer} checked in at Gate · ${lane}`,
        },
        {
          tone: 'success',
          message: `${trailer} assigned to parking slot ${slot}`,
        },
        {
          tone: 'info',
          message: `${trailer} staged for outbound · seal verified`,
        },
        {
          tone: 'info',
          message: `OTM sync · arrival appointment updated for ${trailer}`,
        },
        {
          tone: 'info',
          message: `${trailer} moved ${pick(['Gate → yard', 'yard → dock', 'dock → yard'])}`,
        },
        {
          tone: 'error',
          message: `Exception · ${trailer} temperature excursion — assign owner`,
        },
        {
          tone: 'error',
          message: `Exception · ${trailer} on QA hold — needs review`,
        },
        {
          tone: 'info',
          message: `Reefer alert · ${trailer} warming toward threshold`,
        },
        {
          tone: 'info',
          message: `Device offline · BLE tag on ${trailer} lost signal`,
        },
        {
          tone: 'success',
          message: `${trailer} cleared Gate ${lane} · outbound`,
        },
        {
          tone: 'info',
          message: `${m.critical || 1} active cold-chain excursions on site`,
        },
        {
          tone: 'info',
          message: `Dock Door ${pick(['2', '5', '7'])} ready · assign next trailer`,
        },
      ]

      const toast = pick(pool)
      showRef.current(toast.message, toast.tone)
      pushRef.current(toast.message, toast.tone)
    }

    function schedule() {
      timer = window.setTimeout(() => {
        if (cancelled) return
        nextToast()
        schedule()
      }, randomBetween(9000, 18000))
    }

    timer = window.setTimeout(() => {
      if (cancelled) return
      nextToast()
      schedule()
    }, randomBetween(4000, 7000))

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [location.pathname])

  return null
}
