import { APPLICATION_STATUSES, STATUS_LABELS } from '../types'
import type { ApplicationStatus } from '../types'

interface StatusSelectProps {
  status: ApplicationStatus | null
  /** null means stop tracking. */
  onChange: (status: ApplicationStatus | null) => void
}

/** Track a posting, move it through the pipeline, or untrack it. */
export function StatusSelect({ status, onChange }: StatusSelectProps) {
  return (
    <select
      className={`status-select ${status ?? 'untracked'}`}
      value={status ?? ''}
      aria-label="Application status"
      onChange={e => onChange((e.target.value || null) as ApplicationStatus | null)}
    >
      <option value="">{status ? 'Untrack' : '+ Track'}</option>
      {APPLICATION_STATUSES.map(s => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )
}
