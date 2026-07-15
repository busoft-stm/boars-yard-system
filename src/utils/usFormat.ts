/** US-centric display helpers for Boar’s Head Smart Yard mockup. */

const US = 'en-US'

export function formatUsTime(date = new Date()): string {
  return date.toLocaleTimeString(US, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  })
}

export function formatUsDateTime(date = new Date()): string {
  const d = date.toLocaleDateString(US, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
  const t = formatUsTime(date)
  return `${d} · ${t} ET`
}

export function formatUsPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw.trim()
}

export function formatDwellHours(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60)
    return `${mins} min`
  }
  const whole = Math.floor(hours)
  const mins = Math.round((hours - whole) * 60)
  if (mins === 0) return `${whole} hr`
  return `${whole} hr ${mins} min`
}

export function formatDwellShort(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(1)} hr`
}

export function formatRelativeAgo(ms: number, now = Date.now()): string {
  const delta = Math.max(0, now - ms)
  const sec = Math.floor(delta / 1000)
  if (sec < 45) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  const rem = min % 60
  if (rem === 0) return `${hr} hr ago`
  return `${hr} hr ${rem} min ago`
}

export function siteAsOfLabel(now = new Date()): string {
  const day = now.toLocaleDateString(US, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
  return `${day} · ${formatUsTime(now)} ET`
}
