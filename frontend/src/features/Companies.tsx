import { useState } from 'react'
import { Show, SignInButton } from '@clerk/react'
import { AlertIcon, CheckIcon, SearchIcon } from '../components/icons'
import { Monogram } from '../components/bits'
import { PageHeader } from '../components/Rail'
import type { CompaniesState } from '../hooks/useCompanies'
import { timeAgo } from '../lib/format'
import type { Company } from '../types'

const PAGE = 12

type Category = 'active' | 'failing' | 'inactive'
type Tab = 'all' | Category

const categoryOf = (c: Company): Category =>
  c.status === 'inactive' ? 'inactive' : c.consecutive_failures > 0 ? 'failing' : 'active'

const ORDER: Record<Category, number> = { failing: 0, active: 1, inactive: 2 }

interface CompaniesProps {
  companies: CompaniesState
}

export function Companies({ companies }: CompaniesProps) {
  const { all, query, setQuery, loading, result, submit } = companies
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const counts: Record<Tab, number> = { all: all.length, active: 0, failing: 0, inactive: 0 }
  for (const c of all) counts[categoryOf(c)] += 1

  const failing = all.filter(c => categoryOf(c) === 'failing')
  const finding = !all.length
    ? 'No boards tracked yet.'
    : failing.length === 1
      ? `${failing[0].company_name}'s board failed its last ${failing[0].consecutive_failures} ${failing[0].consecutive_failures === 1 ? 'check' : 'checks'}.`
      : failing.length
        ? `${failing.length} boards are failing their checks.`
        : 'Every board passed its last check.'

  const needle = search.trim().toLowerCase()
  const list = all
    .filter(c => tab === 'all' || categoryOf(c) === tab)
    .filter(c => !needle || c.company_name.toLowerCase().includes(needle) || c.source_token.toLowerCase().includes(needle))
    .sort((a, b) => ORDER[categoryOf(a)] - ORDER[categoryOf(b)] || a.company_name.localeCompare(b.company_name))
  const shown = showAll ? list : list.slice(0, PAGE)

  const resultLine = result && (
    <p className={`result ${result.kind}`} role="status">
      {result.kind === 'error' ? <AlertIcon size={14} /> : <CheckIcon size={14} />}
      <span>
        {result.kind === 'error'
          ? result.text
          : result.kind === 'found'
            ? `${result.company.company_name} is already tracked. Last checked ${timeAgo(result.company.last_checked) ?? 'recently'}.`
            : `${result.text}.`}
      </span>
    </p>
  )

  return (
    <>
      <PageHeader title="Companies" finding={finding} companyCount={all.length} />

      <div className="set-row">
        <div className="set-label">
          <h2>Add a company</h2>
          <p>Type the company's name as it appears in its Greenhouse or Lever careers URL. The poller checks tracked boards every 30 minutes.</p>
        </div>
        <div className="set-col">
          <Show when="signed-out">
            <div className="notice-strip">
              <span>Sign in to add companies.</span>
              <SignInButton mode="modal"><button type="button" className="btn secondary"><span className="bx">Sign in</span></button></SignInButton>
            </div>
          </Show>
          <form
            className="card set-panel"
            autoComplete="off"
            onSubmit={e => {
              e.preventDefault()
              if (!loading) void submit()
            }}
          >
            <label className="field-label" htmlFor="add-company">Company name</label>
            <div className="add-row">
              <span className="pillfield grow">
                <input id="add-company" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. stripe" />
              </span>
              <button type="submit" className="btn primary add-btn" aria-busy={loading}>
                <span className="bx">{loading ? <><span className="spin" aria-hidden="true" /><span className="spin-txt">Checking</span></> : 'Add company'}</span>
              </button>
            </div>
            {resultLine}
          </form>
        </div>
      </div>

      <div className="boards">
        <h2 className="section-title">Tracked boards</h2>
        <div className="boards-bar">
          <div className="tabs" role="group" aria-label="Filter boards">
            {(['all', 'active', 'failing', 'inactive'] as Tab[]).map(t => (
              <button key={t} type="button" className="tab" aria-pressed={tab === t} onClick={() => { setTab(t); setShowAll(false) }}>
                <span className="lbl">{t[0].toUpperCase() + t.slice(1)} <span className="num tab-n">{counts[t]}</span></span>
              </button>
            ))}
          </div>
          <label className="pillfield tool-search narrow">
            <SearchIcon size={14} />
            <span className="sr">Search boards</span>
            <input type="search" value={search} onChange={e => { setSearch(e.target.value); setShowAll(false) }} placeholder="Search name or token" />
          </label>
        </div>

        {!all.length ? (
          <p className="empty block-empty">No boards tracked yet. Add one above to start polling.</p>
        ) : !list.length ? (
          <p className="empty block-empty">
            {needle ? `No boards match ${search.trim()}.` : tab === 'failing' ? 'No failing boards. Every check in the last run succeeded.' : `No ${tab} boards.`}
          </p>
        ) : (
          <>
            <div className="thead c-cols" aria-hidden="true">
              <span>Company</span><span>Source</span><span>Board token</span><span>Status</span><span className="n">Last checked</span>
            </div>
            <ul className="rows">
              {shown.map(c => {
                const cat = categoryOf(c)
                const source = c.source === 'lever' ? 'Lever' : 'Greenhouse'
                const checked = timeAgo(c.last_checked) ?? '-'
                return (
                  <li key={c.id} className="crow c-cols">
                    <span className="c-name">
                      <Monogram name={c.company_name} />
                      <span className="c-name-txt">
                        <span className="role-title">{c.company_name}</span>
                        <span className="meta c-sub">{source} · <span className="token">{c.source_token}</span> · <span className="num">checked {checked}</span></span>
                      </span>
                    </span>
                    <span className="c-src muted">{source}</span>
                    <span className="c-token token">{c.source_token}</span>
                    <span className="c-status">
                      {cat === 'failing'
                        ? <span className="pill neg">Failing · <span className="num">{c.consecutive_failures}</span></span>
                        : cat === 'inactive' ? <span className="pill">Inactive</span> : <span className="pill pos">Active</span>}
                    </span>
                    <span className="c-checked num muted">{checked}</span>
                  </li>
                )
              })}
            </ul>
            <div className="rfoot">
              <span className="muted num">{shown.length < list.length ? `Showing ${shown.length} of ${list.length}` : `Showing all ${list.length}`}</span>
              {list.length > PAGE && (
                <button type="button" className="btn secondary" onClick={() => setShowAll(!showAll)}>
                  <span className="bx">{showAll ? 'Show fewer' : `Show all ${list.length}`}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
