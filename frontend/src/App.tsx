import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { addCompany, ApiError, getCompanies, getRecentInternships, scorePostings } from './api'
import { CompanyHighlight, CompanyList } from './components/CompanyList'
import { Header } from './components/Header'
import { LocationIcon, SearchIcon } from './components/icons'
import { JobCard } from './components/JobCard'
import { LoadingMessage } from './components/LoadingMessage'
import { SearchBar, SearchDivider, SearchField } from './components/SearchBar'
import type { Company, CompanyResult, Posting, ScoredPosting, Tab } from './types'

const RECENT_LIMIT = 50
const OFFLINE_MESSAGE = 'Could not reach the server. Is app.py running?'

/** An aborted request is expected on unmount, not something to log. */
const isAbort = (err: unknown): boolean => err instanceof Error && err.name === 'AbortError'

/** ApiError means the server answered, so prefer its own wording. */
const errorText = (err: unknown): string =>
  err instanceof ApiError ? err.message : OFFLINE_MESSAGE

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search')

  const [companies, setCompanies] = useState<Company[]>([])
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companyResult, setCompanyResult] = useState<CompanyResult | null>(null)

  const [recent, setRecent] = useState<Posting[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [roleInput, setRoleInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [results, setResults] = useState<ScoredPosting[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getCompanies(controller.signal)
      .then(setCompanies)
      .catch(err => {
        if (!isAbort(err)) console.error('Could not load companies:', err)
      })
    return () => controller.abort() // cancel in flight if we unmount first
  }, [])

  // Default view: the newest internships. The API filters, sorts and limits.
  useEffect(() => {
    const controller = new AbortController()
    getRecentInternships(RECENT_LIMIT, controller.signal)
      .then(setRecent)
      .catch(err => {
        if (!isAbort(err)) console.error('Could not load internships:', err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecentLoading(false)
      })
    return () => controller.abort()
  }, [])

  // postings carry company_id, not a name; resolve it against the catalog.
  const companyNames = useMemo(
    () => new Map(companies.map(c => [c.id, c.company_name])),
    [companies]
  )

  const sortedCompanies = useMemo(
    () =>
      [...companies].sort((a, b) =>
        a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' })
      ),
    [companies]
  )

  // ScoredPosting is assignable to Posting — the score is just narrower.
  const shown: Posting[] = searched ? results : recent

  // Location narrows whatever is on screen, so typing filters live without
  // another round trip to the scorer.
  const visible = useMemo(() => {
    const needle = locationInput.trim().toLowerCase()
    if (!needle) return shown
    return shown.filter(job => (job.location ?? '').toLowerCase().includes(needle))
  }, [shown, locationInput])

  const handleSearch = async () => {
    const targets = roleInput
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)

    // An empty role box goes back to the default "newest" view.
    if (targets.length === 0) {
      setSearched(false)
      setResults([])
      setSearchError('')
      return
    }

    setLoading(true)
    setSearchError('')
    try {
      setResults(await scorePostings(targets))
      setSearched(true)
    } catch (err) {
      console.error('Could not score postings:', err)
      setResults([])
      setSearchError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  // Two-step: check what we already track before spending an API call, and
  // only fall through to Greenhouse/Lever verification for unknown names.
  const handleCompanySearch = async () => {
    const name = companyQuery.trim()
    if (!name) {
      setCompanyResult({ kind: 'error', text: 'Enter a company name first.' })
      return
    }

    const tracked = companies.find(c => c.company_name.toLowerCase() === name.toLowerCase())
    if (tracked) {
      setCompanyResult({ kind: 'found', company: tracked })
      return
    }

    setCompanyLoading(true)
    setCompanyResult(null)
    try {
      const added = await addCompany(name)
      const refreshed = await getCompanies()
      setCompanies(refreshed)
      setCompanyResult({
        kind: 'added',
        text: added.message,
        company: refreshed.find(c => c.company_name.toLowerCase() === name.toLowerCase()),
      })
      setCompanyQuery('')
    } catch (err) {
      console.error('Could not add company:', err)
      setCompanyResult({ kind: 'error', text: errorText(err) })
    } finally {
      setCompanyLoading(false)
    }
  }

  const busy = loading || recentLoading
  const filteringByLocation = locationInput.trim().length > 0

  return (
    <div className="app">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'search' && (
        <>
          <SearchBar onSubmit={handleSearch} loading={loading}>
            <SearchField
              icon={<SearchIcon />}
              placeholder="Search roles — e.g. data analyst intern"
              value={roleInput}
              onChange={setRoleInput}
              onEnter={handleSearch}
            />
            <SearchDivider />
            <SearchField
              icon={<LocationIcon />}
              placeholder="Location"
              value={locationInput}
              onChange={setLocationInput}
              onEnter={handleSearch}
            />
          </SearchBar>

          <p className="search-hint">
            Separate multiple roles with commas. Location filters the results as you type.
          </p>

          {searchError && <div className="message error">{searchError}</div>}

          {!busy && (
            <div className="results-count">
              {searched
                ? `${visible.length} ${visible.length === 1 ? 'match' : 'matches'}`
                : 'Most recently posted'}
              {filteringByLocation && shown.length !== visible.length && (
                <span className="muted"> of {shown.length}</span>
              )}
            </div>
          )}

          {!busy && (
            <div className="results">
              {visible.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  companyName={companyNames.get(job.company_id)}
                  // a persisted score only reflects the query the user just ran
                  score={searched ? job.relevance_score : null}
                />
              ))}
            </div>
          )}

          {busy && (
            <LoadingMessage
              message={
                loading ? 'Searching for your next paycheck...' : 'Loading internships...'
              }
            />
          )}

          {!busy && visible.length === 0 && (
            <div className="empty">
              {searched
                ? `No internships matched "${roleInput.trim()}"${
                    filteringByLocation ? ` in "${locationInput.trim()}"` : ''
                  }.`
                : 'No internships found yet. Add companies to start tracking.'}
            </div>
          )}
        </>
      )}

      {activeTab === 'manage' && (
        <>
          <SearchBar
            onSubmit={handleCompanySearch}
            loading={companyLoading}
            loadingLabel="Checking…"
          >
            <SearchField
              icon={<SearchIcon />}
              placeholder="Search a company — adds it if not already tracked"
              value={companyQuery}
              onChange={setCompanyQuery}
              onEnter={handleCompanySearch}
            />
          </SearchBar>

          <p className="search-hint">
            Checks your tracked companies first, then Greenhouse and Lever.
          </p>

          {companyResult?.kind === 'error' && (
            <div className="message error">{companyResult.text}</div>
          )}

          {/* kind !== 'error' narrows to found|added, both of which carry a
              company; the truthiness check then rules out the undefined that
              .find() can return on the 'added' branch. */}
          {companyResult && companyResult.kind !== 'error' && companyResult.company && (
            <CompanyHighlight
              company={companyResult.company}
              label={companyResult.kind === 'found' ? 'Already tracked' : companyResult.text}
            />
          )}

          <div className="results-count">Tracked Companies ({companies.length})</div>

          <CompanyList companies={sortedCompanies} />
        </>
      )}
    </div>
  )
}

export default App
