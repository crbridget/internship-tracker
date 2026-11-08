// makes it a human readable date
export function formatDate(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * A calendar date (YYYY-MM-DD) as written, e.g. "Oct 1, 2026". Not formatDate:
 * new Date('2026-10-01') is UTC midnight, which shows as Sep 30 west of UTC.
 */
export function formatDay(value: string): string | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Nov 7", with the year only when it isn't this year. */
export function shortDate(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** "8 min ago", "3 h ago", then a short date. */
export function timeAgo(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const mins = Math.round((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  return shortDate(value)
}

/** Start of yesterday, local time: the window for "first seen since yesterday". */
export function startOfYesterday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return d
}

/** Two letters for a company badge: "St" for Stripe, "SA" for Scale AI. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).replace(/^./, c => c.toUpperCase())
}

/** A stable pale hue per company name, so a company always has the same badge colour. */
export function hueFor(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}
