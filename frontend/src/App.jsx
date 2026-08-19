import { useState, useEffect, useMemo } from 'react'
import './App.css'
import { addCompany, ApiError, getCompanies, getRecentInternships, scorePostings } from './api'
import { LocationIcon, SearchIcon } from './components/icons'
import { Typewriter } from './components/Typewriter'
import { formatDate } from './lib/format'

function JobCard({ job, companyName, showScore }) {
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
        {/* relevance_score persists in the DB from whatever was scored last,
            so it only means something once the user has actually searched */}
        {showScore && typeof job.relevance_score === 'number' && (
          <span className="posting-score" title={`Relevance ${job.relevance_score}`}>
            {job.relevance_score.toFixed(2)}
          </span>
        )}
        <span className="job-arrow" aria-hidden="true">→</span>
      </div>
    </a>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('search')

  const [companies, setCompanies] = useState([])
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companyResult, setCompanyResult] = useState(null)

  const [recent, setRecent] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [roleInput, setRoleInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getCompanies(controller.signal)
      .then(setCompanies)
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Could not load companies:', err)
      })
    return () => controller.abort() // cancel in flight if we unmount first
  }, [])

  // Default view: the newest internships. The API filters, sorts and limits.
  useEffect(() => {
    const controller = new AbortController()
    getRecentInternships(50, controller.signal)
      .then(setRecent)
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Could not load internships:', err)
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
    () => [...companies].sort((a, b) =>
      a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' })
    ),
    [companies]
  )

  const shown = searched ? results : recent

  // Location narrows whatever is on screen, so typing filters live without
  // another round trip to the scorer.
  const visible = useMemo(() => {
    const needle = locationInput.trim().toLowerCase()
    if (!needle) return shown
    return shown.filter(job => (job.location || '').toLowerCase().includes(needle))
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
      // ApiError means the server answered, so show its own wording
      setSearchError(
        err instanceof ApiError ? err.message : 'Could not reach the server. Is app.py running?'
      )
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

    const tracked = companies.find(
      c => c.company_name.toLowerCase() === name.toLowerCase()
    )
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
      setCompanyResult({
        kind: 'error',
        // a 404 from the board check is the server talking, not a dead server
        text: err instanceof ApiError ? err.message : 'Could not reach the server. Is app.py running?',
      })
    } finally {
      setCompanyLoading(false)
    }
  }

  const submitOnEnter = (handler) => (e) => {
    if (e.key === 'Enter') handler()
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">Internship Tracker</div>
        <nav className="tabs">
          <button onClick={() => setActiveTab('search')} disabled={activeTab === 'search'}>
            Find Roles
          </button>
          <button onClick={() => setActiveTab('manage')} disabled={activeTab === 'manage'}>
            Add Companies
          </button>
        </nav>
      </header>

      {activeTab === 'search' && (
        <>
          <div className="searchbar">
            <div className="search-field">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search roles — e.g. data analyst intern"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={submitOnEnter(handleSearch)}
              />
            </div>

            <span className="search-divider" />

            <div className="search-field">
              <LocationIcon />
              <input
                type="text"
                placeholder="Location"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={submitOnEnter(handleSearch)}
              />
            </div>

            <button className="search-button" onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          <p className="search-hint">
            Separate multiple roles with commas. Location filters the results as you type.
          </p>

          {searchError && <div className="message error">{searchError}</div>}

          {!loading && !recentLoading && (
            <div className="results-count">
              {searched
                ? `${visible.length} ${visible.length === 1 ? 'match' : 'matches'}`
                : 'Most recently posted'}
              {locationInput.trim() && shown.length !== visible.length && (
                <span className="muted"> of {shown.length}</span>
              )}
            </div>
          )}

          {!loading && !recentLoading && (
            <div className="results">
              {visible.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  companyName={companyNames.get(job.company_id)}
                  showScore={searched}
                />
              ))}
            </div>
          )}

          {(loading || recentLoading) && (() => {
            const message = loading
              ? 'Searching for your next paycheck...'
              : 'Loading internships...'
            return (
              // aria-label carries the whole message so screen readers get it
              // once, rather than announcing every partially typed frame.
              <div className="empty loading" role="status" aria-label={message}>
                <Typewriter text={message} />
              </div>
            )
          })()}

          {!loading && !recentLoading && visible.length === 0 && (
            <div className="empty">
              {searched
                ? `No internships matched "${roleInput.trim()}"${locationInput.trim() ? ` in "${locationInput.trim()}"` : ''}.`
                : 'No internships found yet. Add companies to start tracking.'}
            </div>
          )}
        </>
      )}

      {activeTab === 'manage' && (
        <>
          <div className="searchbar">
            <div className="search-field">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search a company — adds it if not already tracked"
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
                onKeyDown={submitOnEnter(handleCompanySearch)}
              />
            </div>
            <button className="search-button" onClick={handleCompanySearch} disabled={companyLoading}>
              {companyLoading ? 'Checking…' : 'Search'}
            </button>
          </div>

          <p className="search-hint">
            Checks your tracked companies first, then Greenhouse and Lever.
          </p>

          {companyResult?.kind === 'error' && (
            <div className="message error">{companyResult.text}</div>
          )}

          {(companyResult?.kind === 'found' || companyResult?.kind === 'added') && companyResult.company && (
            <div className="company-result">
              <div className="company-result-label">
                {companyResult.kind === 'found' ? 'Already tracked' : companyResult.text}
              </div>
              <div className="company-row highlight">
                <span>{companyResult.company.company_name}</span>
                <span className={`badge ${companyResult.company.status}`}>
                  {companyResult.company.status}
                </span>
              </div>
            </div>
          )}

          <div className="results-count">Tracked Companies ({companies.length})</div>

          <ul className="company-list">
            {sortedCompanies.map(company => (
              <li key={company.id} className="company-row">
                <span>{company.company_name}</span>
                <span className={`badge ${company.status}`}>{company.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default App
