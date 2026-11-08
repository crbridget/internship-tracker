import { useState } from 'react'
import { SignInButton } from '@clerk/react'
import { AlertIcon, LocationIcon, SearchIcon } from '../components/icons'
import { MatchReading, Monogram, StagePill } from '../components/bits'
import { PageHeader } from '../components/Rail'
import { RoleKindToggle } from '../components/RoleKindToggle'
import { TrackButton } from '../components/TrackButton'
import type { ApplicationsState } from '../hooks/useApplications'
import type { InternshipSearch } from '../hooks/useInternshipSearch'
import { shortDate, startOfYesterday } from '../lib/format'
import { APPLICATION_STATUSES, STATUS_LABELS } from '../types'
import type { ApplicationStatus, Posting } from '../types'

const PAGE = 20
const RECENT = 5

interface FindRolesProps {
  search: InternshipSearch
  companyNames: Map<number, string>
  companyCount: number
  applications: ApplicationsState
}

const noun = (kind: string, n: number) =>
  kind === 'internship' ? `${n} ${n === 1 ? 'internship' : 'internships'}` : `${n} full-time ${n === 1 ? 'role' : 'roles'}`

export function FindRoles({ search, companyNames, companyCount, applications }: FindRolesProps) {
  const { kind, setKind, roleInput, setRoleInput, locationInput, setLocationInput, visible, searched, loading, busy, error, submit } = search
  const [shownFor, setShownFor] = useState({ key: '', count: PAGE })
  // A new result set starts at the first page again.
  const listKey = `${kind}|${searched}|${roleInput}|${locationInput}|${visible.length}`
  const shown = shownFor.key === listKey ? shownFor.count : PAGE

  const kindLabel = kind === 'internship' ? 'internships' : 'full-time roles'
  const since = startOfYesterday()
  const fresh = searched
    ? visible.filter(p => (p.relevance_score ?? 0) > 0.8 && new Date(p.first_seen_at) >= since).length
    : 0
  const finding = error
    ? `Couldn't load ${kindLabel}. Try the search again.`
    : busy
      ? 'Ranking open roles across tracked boards…'
      : searched
        ? fresh
          ? `${noun(kind, fresh)} above 0.80 match, first seen since yesterday.`
          : 'No new roles above 0.80 match since yesterday.'
        : `Newest ${kindLabel} across tracked boards. Search a role to rank them by match.`

  const location = locationInput.trim()
  const countText = `${noun(kind, visible.length)} · ${searched ? 'sorted by match' : 'newest first'}`

  return (
    <>
      <PageHeader title="Find roles" finding={finding} companyCount={companyCount} />

      <form
        className="search card"
        role="search"
        autoComplete="off"
        onSubmit={e => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="sf">
          <SearchIcon />
          <span className="sr">Role</span>
          <input
            type="search"
            value={roleInput}
            onChange={e => setRoleInput(e.target.value)}
            placeholder={kind === 'internship' ? 'Search roles, e.g. data analyst intern' : 'Search roles, e.g. software engineer'}
          />
        </label>
        <span className="sdiv" aria-hidden="true" />
        <label className="sf sf-loc">
          <LocationIcon />
          <span className="sr">Location</span>
          <input type="search" value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder="Location" />
        </label>
        <button type="submit" className="btn primary search-btn" aria-busy={loading}>
          <span className="bx">
            {loading ? <><span className="spin" aria-hidden="true" /><span className="spin-txt">Searching</span></> : 'Search'}
          </span>
        </button>
      </form>

      <div className="toolbar">
        <RoleKindToggle value={kind} onChange={setKind} disabled={busy} />
        <p className="count" aria-live="polite">
          {!busy && !error && <span className="num">{countText}</span>}
          {!busy && !error && location && <> · <span className="filter-note">Filtered to {location}</span></>}
        </p>
      </div>

      <div className="roles-grid">
        <div className="pipe-sum"><PipelineSummary applications={applications} /></div>

        <section className="card results" aria-label="Matches">
          <div className="thead r-cols" aria-hidden="true">
            <span>Role</span><span className="n">Match</span><span className="n">Stage</span>
          </div>
          {busy ? (
            <ul className="rows">
              {Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="rrow is-loading" aria-hidden="true"><span className="skeleton sk-title" /><span className="skeleton sk-meta" /></li>
              ))}
            </ul>
          ) : error ? (
            <div className="error-line" role="alert">
              <AlertIcon size={14} />
              <span>{error}</span>
              <button type="button" className="link-btn" onClick={() => void submit()}>Retry</button>
            </div>
          ) : visible.length === 0 ? (
            <p className="empty block-empty">
              {searched
                ? `No ${kindLabel} match ${roleInput.trim()}${location ? ` in ${location}` : ''}. Try a broader title or clear the location.`
                : location
                  ? `No ${kindLabel} in ${location}. Clear the location to see them all.`
                  : `No ${kindLabel} yet. Add companies to start tracking their boards.`}
            </p>
          ) : (
            <>
              <ul className="rows">
                {visible.slice(0, shown).map(job => (
                  <ResultRow
                    key={job.id}
                    job={job}
                    companyName={companyNames.get(job.company_id)}
                    score={searched ? job.relevance_score : null}
                    applications={applications}
                  />
                ))}
              </ul>
              <div className="rfoot">
                <span className="muted num">
                  {visible.length > shown ? `Showing ${shown} of ${visible.length}` : `Showing all ${visible.length}`}
                </span>
                {visible.length > shown && (
                  <button type="button" className="btn secondary" onClick={() => setShownFor({ key: listKey, count: shown + PAGE })}>
                    <span className="bx">Show {Math.min(PAGE, visible.length - shown)} more</span>
                  </button>
                )}
              </div>
            </>
          )}
          {applications.error && !busy && (
            <div className="error-line" role="alert"><AlertIcon size={14} /><span>{applications.error}</span></div>
          )}
        </section>

        <aside className={`card pipeline${applications.signedIn && applications.all.length ? ' fill' : ''}`} aria-label="Pipeline">
          <PipelineCard applications={applications} companyNames={companyNames} />
        </aside>
      </div>
    </>
  )
}

interface ResultRowProps {
  job: Posting
  companyName: string | undefined
  score: number | null | undefined
  applications: ApplicationsState
}

function ResultRow({ job, companyName, score, applications }: ResultRowProps) {
  const posted = shortDate(job.first_published ?? job.first_seen_at)
  const closed = job.status === 'closed'
  const label = `${job.title}${companyName ? `, ${companyName}` : ''}`
  return (
    <li className="rrow r-cols">
      <a className="role-cell" href={job.apply_url} target="_blank" rel="noopener noreferrer">
        <Monogram name={companyName} />
        <span className="role-txt">
          <span className="role-title">{job.title}</span>
          <span className="meta">
            {companyName && <><span className="co">{companyName}</span><span className="sep">·</span></>}
            {job.location && (
              <><span className="loc"><LocationIcon size={12} /><span className="loc-txt">{job.location}</span></span><span className="sep">·</span></>
            )}
            {posted && <span className="num posted"><span className="posted-word">Posted </span>{posted}</span>}
            {closed && <span className="pill closed-pill">Closed</span>}
          </span>
        </span>
      </a>
      <MatchReading score={score} closed={closed} />
      <span className="stage-cell">
        <TrackButton
          signedIn={applications.signedIn}
          status={applications.byPostingId.get(job.id)?.status ?? null}
          onChange={status => applications.setStatus(job, status)}
          label={label}
        />
      </span>
    </li>
  )
}

const countsOf = (applications: ApplicationsState) => {
  const counts = Object.fromEntries(APPLICATION_STATUSES.map(s => [s, 0])) as Record<ApplicationStatus, number>
  for (const a of applications.all) counts[a.status] += 1
  return counts
}

function PipelineCard({ applications, companyNames }: { applications: ApplicationsState; companyNames: Map<number, string> }) {
  const viewAll = <a className="link" href="#/applications">View all</a>
  if (!applications.signedIn) {
    return (
      <>
        <header className="card-head"><h2>Pipeline</h2>{viewAll}</header>
        <div className="prompt">
          <p>Sign in to track roles and keep notes.</p>
          <SignInButton mode="modal">
            <button type="button" className="btn secondary"><span className="bx">Sign in</span></button>
          </SignInButton>
        </div>
      </>
    )
  }
  const { all, loading } = applications
  const counts = countsOf(applications)
  const total = all.length
  const recent = [...all].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, RECENT)
  const footed = !loading && recent.length > 0
  return (
    <>
      <header className="card-head">
        <h2>Pipeline</h2>
        {!loading && <span className="muted num">{total} tracked</span>}
        {!footed && viewAll}
      </header>
      {!loading && total > 0 && (
        <div className="pipe-bar" role="img" aria-label={APPLICATION_STATUSES.map(s => `${STATUS_LABELS[s]} ${counts[s]}`).join(', ')}>
          {APPLICATION_STATUSES.filter(s => counts[s]).map(s => (
            <span key={s} className={`seg st-${s}`} style={{ flexGrow: counts[s] }} />
          ))}
        </div>
      )}
      <dl className="kv">
        {APPLICATION_STATUSES.map(s => (
          <div key={s} className="kv-row">
            <dt><StagePill status={s} /></dt>
            <dd className={`num${counts[s] === 0 ? ' zero' : ''}`}>{loading ? <span className="skeleton sk-count" /> : counts[s]}</dd>
          </div>
        ))}
      </dl>
      <p className="label recent-label">Recently updated</p>
      <ul className="recent">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <li key={i} className="recent-row is-loading" aria-hidden="true"><span className="skeleton sk-title" /><span className="skeleton sk-meta" /></li>)
          : recent.length
            ? recent.map(a => (
              <li key={a.posting_id} className="recent-row">
                <span className="recent-txt">
                  <span className="recent-title">{a.posting.title}</span>
                  <span className="meta">{companyNames.get(a.posting.company_id) ?? 'Unknown company'} · <span className="num">{shortDate(a.updated_at)}</span></span>
                </span>
                <StagePill status={a.status} />
              </li>
            ))
            : <li className="empty slim">Nothing tracked yet. Track a role from the list to start your pipeline.</li>}
      </ul>
      {footed && (
        <div className="pipe-foot">
          <span className="muted num">{Math.min(RECENT, total)} of {total} shown</span>
          {viewAll}
        </div>
      )}
    </>
  )
}

function PipelineSummary({ applications }: { applications: ApplicationsState }) {
  if (!applications.signedIn) {
    return (
      <>
        <span>Sign in to track roles.</span>
        <SignInButton mode="modal"><button type="button" className="btn secondary"><span className="bx">Sign in</span></button></SignInButton>
      </>
    )
  }
  const counts = countsOf(applications)
  return (
    <>
      <span className="num">{applications.all.length} tracked · {counts.interviewing} interviewing</span>
      <a className="link" href="#/applications">View all</a>
    </>
  )
}
