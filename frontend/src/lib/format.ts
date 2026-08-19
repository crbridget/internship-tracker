/**
 * Human-readable date, or null when the value isn't parseable. Callers render
 * nothing rather than "Invalid Date".
 */
export function formatDate(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
