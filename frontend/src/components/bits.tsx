import type { CSSProperties } from 'react'
import { hueFor, initials } from '../lib/format'
import { STATUS_LABELS } from '../types'
import type { ApplicationStatus } from '../types'

/** A stage tag: solid colour, white text. Applied carries a small square so it reads apart from Saved. */
export function StagePill({ status }: { status: ApplicationStatus }) {
  return <span className={`pill st-${status}`}>{STATUS_LABELS[status]}</span>
}

/** A company's two-letter badge on a tint of its own hue. Identity only, never status. */
export function Monogram({ name }: { name: string | undefined }) {
  const label = name ?? '?'
  return (
    <span className="mono-av" style={{ '--h': hueFor(label) } as CSSProperties} aria-hidden="true">
      {initials(label)}
    </span>
  )
}

/** The match reading: a bar on a fixed 0 to 1 scale, with the two-decimal score beside it. */
export function MatchReading({ score, closed }: { score: number | null | undefined; closed?: boolean }) {
  if (typeof score !== 'number') {
    return (
      <span className="match-cell" aria-label="No match score">
        <span className="reading" aria-hidden="true"><span className="track" /></span>
        <span className="dash">-</span>
      </span>
    )
  }
  return (
    <span className="match-cell" aria-label={`Match ${score.toFixed(2)}`}>
      <span className={`reading${closed ? ' closed' : ''}`} style={{ '--v': Math.max(0, Math.min(1, score)) } as CSSProperties} aria-hidden="true">
        <span className="track" />
        <span className="fill" />
      </span>
      <span className="score num">{score.toFixed(2)}</span>
    </span>
  )
}
