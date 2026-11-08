import type { ReactNode } from 'react'
import { LocationIcon } from './icons'
import { formatDate } from '../lib/format'
import type { Posting } from '../types'

interface JobCardProps {
  job: Posting
  companyName?: string
  score: number | null
  /** Controls beside the score, e.g. a status menu. */
  actions?: ReactNode
  /** Extra content under the main row. */
  footer?: ReactNode
}

/**
 * The whole card opens the posting, via a stretched link on the title rather
 * than wrapping the card in <a>: interactive controls (actions, footer) can't
 * legally sit inside a link. They're raised above the link's overlay in CSS.
 */
export function JobCard({ job, companyName, score, actions, footer }: JobCardProps) {
  const posted = job.first_published ? formatDate(job.first_published) : null

  return (
    <div className="job-card">
      <div className="job-row">
        <div className="job-main">
          <a className="job-title job-link" href={job.apply_url} target="_blank" rel="noopener noreferrer">
            {job.title}
          </a>
          <div className="job-meta">
            {companyName && <span className="job-company">{companyName}</span>}
            {job.location && (
              <span className="job-tag">
                <LocationIcon size={13} />
                {job.location}
              </span>
            )}
            {posted && <span className="job-tag">Posted {posted}</span>}
            {job.status === 'closed' && <span className="job-tag closed">Closed</span>}
          </div>
        </div>

        <div className="job-side">
          {typeof score === 'number' && (
            <span className="posting-score" title={`Relevance ${score}`}>
              {score.toFixed(2)}
            </span>
          )}
          {actions && <div className="job-actions">{actions}</div>}
          <span className="job-arrow" aria-hidden="true">→</span>
        </div>
      </div>

      {footer && <div className="job-footer">{footer}</div>}
    </div>
  )
}
