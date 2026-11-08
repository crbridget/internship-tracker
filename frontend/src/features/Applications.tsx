import { useEffect, useRef, useState } from 'react'
import { SignInButton } from '@clerk/react'
import { AlertIcon, ChevronIcon, CloseIcon, SearchIcon } from '../components/icons'
import { Monogram } from '../components/bits'
import { PageHeader } from '../components/Rail'
import { StatusSelect } from '../components/StatusSelect'
import type { ApplicationsState } from '../hooks/useApplications'
import { shortDate } from '../lib/format'
import { APPLICATION_STATUSES, STATUS_LABELS } from '../types'
import type { Application, ApplicationStatus } from '../types'

interface ApplicationsProps {
  applications: ApplicationsState
  companyNames: Map<number, string>
  companyCount: number
}

type Filter = ApplicationStatus | 'all'
type View = 'list' | 'board'
type Sort = 'updated' | 'applied' | 'company'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'updated', label: 'Last updated' },
  { value: 'applied', label: 'Applied on' },
  { value: 'company', label: 'Company' },
]

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

export function Applications({ applications, companyNames, companyCount }: ApplicationsProps) {
  const { signedIn, all, loading, error, setStatus } = applications
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('list')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('updated')

  const nameOf = (a: Application) => companyNames.get(a.posting.company_id) ?? ''
  const counts = Object.fromEntries(APPLICATION_STATUSES.map(s => [s, 0])) as Record<ApplicationStatus, number>
  for (const a of all) counts[a.status] += 1

  const needle = query.trim().toLowerCase()
  const sorters: Record<Sort, (a: Application, b: Application) => number> = {
    updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    applied: (a, b) => (b.applied_at ?? '').localeCompare(a.applied_at ?? '') || b.updated_at.localeCompare(a.updated_at),
    company: (a, b) => nameOf(a).localeCompare(nameOf(b)),
  }
  const list = all
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => !needle || a.posting.title.toLowerCase().includes(needle) || nameOf(a).toLowerCase().includes(needle))
    .sort(sorters[sort])

  const interviewing = all.filter(a => a.status === 'interviewing').map(nameOf).filter(Boolean)
  const finding = !signedIn
    ? 'Sign in to see your pipeline.'
    : loading
      ? 'Loading your applications…'
      : !all.length
        ? 'Nothing tracked yet.'
        : interviewing.length
          ? `${joinNames([...new Set(interviewing)])} ${interviewing.length === 1 ? 'is' : 'are'} at interview stage.`
          : `${all.length} ${all.length === 1 ? 'application' : 'applications'} tracked, none at interview stage.`

  const ready = signedIn && !loading
  const value = (n: number, lead = false) =>
    !signedIn ? <span className="dash">-</span>
      : loading ? <span className={`skeleton ${lead ? 'sk-lead' : 'sk-kpi'}`} />
        : <span className={`num${n === 0 ? ' zero' : ''}`}>{n}</span>
  const cell = (v: Filter, label: string, n: number, lead = false) => (
    <button
      key={v}
      type="button"
      className={`stage st-${v}${lead ? ' lead' : ''}`}
      aria-pressed={ready && filter === v}
      disabled={!ready}
      onClick={() => setFilter(filter === v ? 'all' : v)}
    >
      <span className="lbl stage-lbl">{label}</span>
      <span className="stage-n">{value(n, lead)}</span>
    </button>
  )

  return (
    <>
      <PageHeader title="My applications" finding={finding} companyCount={companyCount} />

      <div className="stages card" role="group" aria-label="Filter by stage">
        {cell('all', 'Total tracked', all.length, true)}
        {APPLICATION_STATUSES.map(s => cell(s, STATUS_LABELS[s], counts[s]))}
      </div>
      {!signedIn && (
        <div className="strip-prompt">
          <span>Sign in to see your pipeline.</span>
          <SignInButton mode="modal"><button type="button" className="btn secondary"><span className="bx">Sign in</span></button></SignInButton>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Applications view">
        {(['list', 'board'] as View[]).map(v => (
          <button
            key={v}
            type="button"
            role="tab"
            className="tab"
            id={`tab-${v}`}
            aria-controls="applications-panel"
            aria-selected={view === v}
            tabIndex={view === v ? 0 : -1}
            onClick={() => setView(v)}
            onKeyDown={e => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const next = view === 'list' ? 'board' : 'list'
                setView(next)
                document.getElementById(`tab-${next}`)?.focus()
              }
            }}
          >
            <span className="lbl">{v === 'list' ? 'List' : 'Board'}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="pillfield tool-search">
          <SearchIcon size={14} />
          <span className="sr">Search applications</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search role or company" disabled={!ready} />
        </label>
        <div className="tool-right">
          <p className="count" aria-live="polite">
            {ready && <span className="num">{filter === 'all' ? '' : `${STATUS_LABELS[filter]} · `}{list.length} {list.length === 1 ? 'application' : 'applications'}</span>}
          </p>
          <span className="sel plainsel">
            <span className="sel-face">Sort: {SORTS.find(s => s.value === sort)?.label}</span>
            <span className="sel-chev"><ChevronIcon size={12} /></span>
            <select aria-label="Sort applications" value={sort} onChange={e => setSort(e.target.value as Sort)} disabled={!ready}>
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </span>
        </div>
      </div>

      {error && <div className="error-line" role="alert"><AlertIcon size={14} /><span>{error}</span></div>}

      <div id="applications-panel" role="tabpanel" aria-labelledby={`tab-${view}`}>
        {!signedIn ? (
          <p className="empty block-empty">Sign in to see your applications, stages and notes.</p>
        ) : loading ? (
          <ul className="rows">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="arow is-loading" aria-hidden="true"><span className="skeleton sk-title" /><span className="skeleton sk-meta" /></li>
            ))}
          </ul>
        ) : !all.length ? (
          <div className="empty block-empty first-run">
            <p>Nothing tracked yet. Track a role from Find roles to start your pipeline.</p>
            <a className="btn primary" href="#/roles"><span className="bx">Find roles</span></a>
          </div>
        ) : view === 'board' ? (
          <div className="board">
            {APPLICATION_STATUSES.map(s => {
              const items = list.filter(a => a.status === s)
              return (
                <section key={s} className={`bcol st-${s}`} aria-label={STATUS_LABELS[s]}>
                  <header className="bcol-head"><span className={`pill st-${s}`}>{STATUS_LABELS[s]}</span><span className="num muted">{items.length}</span></header>
                  <ul className="bcards">
                    {items.length ? items.map(a => (
                      <li key={a.posting_id} className="bcard">
                        <a className="bcard-link" href={a.posting.apply_url} target="_blank" rel="noopener noreferrer">
                          <span className="role-title">{a.posting.title}</span>
                          <span className="meta">{nameOf(a) || 'Unknown company'}</span>
                        </a>
                        <span className="meta num">{a.applied_at ? `Applied ${a.applied_at}` : 'Not applied yet'}</span>
                        {a.notes && <span className="bnote">{a.notes}</span>}
                        <StatusSelect status={a.status} onChange={st => setStatus(a.posting, st)} label={`Stage for ${a.posting.title}`} />
                      </li>
                    )) : <li className="empty slim">No {STATUS_LABELS[s].toLowerCase()} {s === 'offer' ? 'offers' : 'roles'} yet</li>}
                  </ul>
                </section>
              )
            })}
          </div>
        ) : !list.length ? (
          <p className="empty block-empty">{needle ? `No applications match ${query.trim()}.` : `No applications at ${filter === 'all' ? 'any stage' : STATUS_LABELS[filter]}.`}</p>
        ) : (
          <>
            <div className="thead a-cols" aria-hidden="true">
              <span>Role</span><span>Stage</span><span>Applied on</span><span>Notes</span><span className="n">Updated</span>
            </div>
            <ul className="rows">
              {list.map(a => <ApplicationRow key={a.posting_id} application={a} companyName={nameOf(a)} applications={applications} />)}
            </ul>
          </>
        )}
      </div>
    </>
  )
}

interface ApplicationRowProps {
  application: Application
  companyName: string
  applications: ApplicationsState
}

function ApplicationRow({ application: a, companyName, applications }: ApplicationRowProps) {
  const [open, setOpen] = useState(false)
  const line2 = [companyName, a.applied_at ? `Applied ${a.applied_at}` : null, a.notes].filter(Boolean).join(' · ')
  return (
    <li className={`arow a-cols${open ? ' open' : ''}`}>
      <a className="role-cell" href={a.posting.apply_url} target="_blank" rel="noopener noreferrer">
        <Monogram name={companyName || undefined} />
        <span className="role-txt">
          <span className="role-title">{a.posting.title}</span>
          <span className="meta"><span className="co-plain">{companyName}</span><span className="line2">{line2}</span></span>
        </span>
      </a>
      <span className="c-stage">
        <StatusSelect status={a.status} onChange={st => applications.setStatus(a.posting, st)} label={`Stage for ${a.posting.title}`} />
      </span>
      <span className="c-date"><DateField application={a} onChange={d => applications.setAppliedAt(a, d)} /></span>
      <span className="c-notes"><NoteField application={a} onSave={notes => applications.setNotes(a, notes)} /></span>
      <span className="c-upd num">{shortDate(a.updated_at)}</span>
      <button type="button" className="icon-btn row-open" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Edit'} date and notes for ${a.posting.title}`} onClick={() => setOpen(!open)}>
        <ChevronIcon />
      </button>
    </li>
  )
}

/** The applied date: a button showing YYYY-MM-DD (or a dash) that opens the native date picker. */
function DateField({ application, onChange }: { application: Application; onChange: (date: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  const open = () => {
    const el = input.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }
  return (
    <span className="datefield">
      <button type="button" className="date-btn" onClick={open} aria-label={application.applied_at ? `Applied on ${application.applied_at}, change` : 'Set applied date'}>
        <span className="date-val num">{application.applied_at ?? <span className="dash">-</span>}</span>
      </button>
      <input
        ref={input}
        type="date"
        className="date-input"
        tabIndex={-1}
        aria-hidden="true"
        max={today}
        value={application.applied_at ?? ''}
        onChange={e => e.target.value && onChange(e.target.value)}
      />
      {application.applied_at && (
        <button type="button" className="icon-btn" aria-label="Clear applied date" onClick={() => onChange(null)}>
          <CloseIcon size={12} />
        </button>
      )}
    </span>
  )
}

/** Notes edit in place: Enter or leaving the field saves, Escape puts the old text back. */
function NoteField({ application, onSave }: { application: Application; onSave: (notes: string) => Promise<void> }) {
  const [draft, setDraft] = useState(application.notes ?? '')
  const [stamp, setStamp] = useState(false)
  const [synced, setSynced] = useState(application.notes)
  const cancelled = useRef(false)
  // Follow the server's copy when it changes underneath (another tab, a rollback after a failed save).
  if (application.notes !== synced) {
    setSynced(application.notes)
    setDraft(application.notes ?? '')
  }
  useEffect(() => {
    if (!stamp) return
    const t = setTimeout(() => setStamp(false), 2000)
    return () => clearTimeout(t)
  }, [stamp])

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    if (draft.trim() === (application.notes ?? '')) return
    void onSave(draft)
    setStamp(true)
  }
  return (
    <>
      <textarea
        className="note"
        rows={1}
        value={draft}
        placeholder="Add a note"
        aria-label={`Notes for ${application.posting.title}`}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            cancelled.current = true
            setDraft(application.notes ?? '')
            e.currentTarget.blur()
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />
      <span className="stamp" aria-live="polite">{stamp ? 'Saved' : ''}</span>
    </>
  )
}
