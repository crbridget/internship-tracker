import { ChevronIcon } from './icons'
import { StagePill } from './bits'
import { APPLICATION_STATUSES, STATUS_LABELS } from '../types'
import type { ApplicationStatus } from '../types'

interface StatusSelectProps {
  status: ApplicationStatus
  /** null means stop tracking. */
  onChange: (status: ApplicationStatus | null) => void
  /** Names the posting for screen readers: "Stage for Backend Engineering Intern, Ramp". */
  label: string
}

/**
 * A native select drawn as the stage tag: the select covers the tag, so the keyboard and screen readers
 * get the real control while the tag stays the look.
 */
export function StatusSelect({ status, onChange, label }: StatusSelectProps) {
  return (
    <span className="sel pillsel">
      <StagePill status={status} />
      <span className="sel-chev"><ChevronIcon size={12} /></span>
      <select
        aria-label={label}
        value={status}
        onChange={e => onChange((e.target.value || null) as ApplicationStatus | null)}
      >
        {APPLICATION_STATUSES.map(s => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
        <option value="">Untrack</option>
      </select>
    </span>
  )
}
