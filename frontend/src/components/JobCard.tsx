import { LocationIcon } from './icons'
import { formatDate } from '../lib/format'
import type { Posting } from '../types'

interface JobCardProps {
  job: Posting
  /** Undefined when the posting's company isn't in the catalog. */
  companyName?: string
  /**
   * The score to render, or null to hide the badge.
   *
   * relevance_score is persisted in the database from whatever was scored last,
   * so the column alone can't say whether it reflects the current search — only
   * the caller knows that. Passing it explicitly keeps the judgement there
   * instead of handing this component a `searched` flag it has no business
   * reasoning about.
   */
  score: number | null
}

export function JobCard({ job, companyName, score }: JobCardProps) {
  const posted = job.first_published ? formatDate(job.first_published) : null

  return (
    <a className="job-card" href={job.apply_url} target="_blank" rel="noopener noreferrer">
      <div className="job-main">
        <div className="job-title">{job.title}</div>
        <div className="job-meta">
          {companyName && <span className="job-company">{companyName}</span>}
          {job.location && (
            <span className="job-tag">
              <LocationIcon size={13} />
              {job.location}
            </span>
          )}
          {posted && <span className="job-tag">Posted {posted}</span>}
        </div>
      </div>

      <div className="job-side">
        {/* typeof rather than !== null: App.jsx is still unchecked JS, so a
            missing prop would arrive as undefined and crash .toFixed() */}
        {typeof score === 'number' && (
          <span className="posting-score" title={`Relevance ${score}`}>
            {score.toFixed(2)}
          </span>
        )}
        <span className="job-arrow" aria-hidden="true">→</span>
      </div>
    </a>
  )
}
