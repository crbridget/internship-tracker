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
