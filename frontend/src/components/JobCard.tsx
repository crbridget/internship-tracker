import { LocationIcon } from './icons'
import { formatDate } from '../lib/format'
import type { Posting } from '../types'

interface JobCardProps {
  job: Posting
  companyName?: string
  score: number | null
}

// job cards
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
