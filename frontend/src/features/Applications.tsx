import { useState } from 'react'
import { SignInButton } from '@clerk/react'
import { JobCard } from '../components/JobCard'
import { LoadingMessage } from '../components/LoadingMessage'
import { StatusSelect } from '../components/StatusSelect'
import type { ApplicationsState } from '../hooks/useApplications'
import { formatDay } from '../lib/format'
import { APPLICATION_STATUSES, STATUS_LABELS } from '../types'
import type { Application, ApplicationStatus } from '../types'

interface ApplicationsProps {
  applications: ApplicationsState
  companyNames: Map<number, string>
}

type Filter = ApplicationStatus | 'all'

export function Applications({ applications, companyNames }: ApplicationsProps) {
  const { signedIn, all, loading, error, setStatus, setNotes } = applications
  const [filter, setFilter] = useState<Filter>('all')

  if (!signedIn) {
    return (
      <div className="empty signed-out">
        <p>Sign in to track where you've applied, with status and notes for each role.</p>
        <SignInButton mode="modal">
          <button type="button" className="search-button">Sign in</button>
        </SignInButton>
      </div>
    )
  }

  const counts = new Map<Filter, number>([['all', all.length]])
  for (const a of all) counts.set(a.status, (counts.get(a.status) ?? 0) + 1)

  const visible = filter === 'all' ? all : all.filter(a => a.status === filter)

  if (loading) return <LoadingMessage message="Loading your applications..." />

  return (
    <>
      <div className="kind-toggle status-filter" role="group" aria-label="Filter by status">
        {(['all', ...APPLICATION_STATUSES] as Filter[]).map(f => (
          <button
            key={f}
            type="button"
            className={f === filter ? 'active' : undefined}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
            <span className="filter-count">{counts.get(f) ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="results-count">
        {visible.length} {visible.length === 1 ? 'role' : 'roles'}
      </div>

      <div className="results">
        {visible.map(application => (
          <JobCard
            key={application.posting_id}
            job={application.posting}
            companyName={companyNames.get(application.posting.company_id)}
            score={null}
            actions={
              <StatusSelect
                status={application.status}
                onChange={status => setStatus(application.posting, status)}
              />
            }
            footer={<ApplicationDetails application={application} onNotes={setNotes} />}
          />
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty">
          {all.length === 0
            ? 'Nothing tracked yet. Use "+ Track" on any role in Find Roles.'
            : `No roles marked ${STATUS_LABELS[filter as ApplicationStatus].toLowerCase()}.`}
        </div>
      )}
    </>
  )
}

interface ApplicationDetailsProps {
  application: Application
  onNotes: (application: Application, notes: string) => Promise<void>
}

function ApplicationDetails({ application, onNotes }: ApplicationDetailsProps) {
  // Local draft, saved on blur rather than per keystroke.
  const [draft, setDraft] = useState(application.notes ?? '')
  const applied = application.applied_at ? formatDay(application.applied_at) : null

  const commit = () => {
    if (draft.trim() !== (application.notes ?? '')) void onNotes(application, draft)
  }

  return (
    <>
      {applied && <div className="application-date">Applied {applied}</div>}
      <textarea
        className="application-notes"
        placeholder="Notes — referral, recruiter, next steps…"
        rows={draft ? 3 : 1}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
      />
    </>
  )
}
