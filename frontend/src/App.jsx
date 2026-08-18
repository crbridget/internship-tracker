import { useState, useEffect, useMemo } from 'react'
import './App.css'

// Set VITE_API_URL in the deploy environment to point at the hosted Flask app.
// Falls back to local dev: 127.0.0.1 rather than localhost because on macOS
// localhost can resolve to ::1, where AirPlay Receiver is listening on :5000
// and answers with a 403.
const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'

// Mirrors is_internship() in score_relevance.py. Duplicated here only because
// there is no endpoint that returns internships directly — /postings hands back
// every open row. See the note in the README about folding this into the API.
const INTERNSHIP_RE = /\b(intern|internship|co-?op)\b/i

const DEFAULT_LIMIT = 50

const SearchIcon = ({ size = 18 }) => (
  <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const LocationIcon = ({ size = 18 }) => (
  <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Types the message out, holds it, backspaces it away, and starts over —
// looping for as long as it stays mounted, which is however long the search
// takes. Erasing is quicker than typing so the re-write feels like the
// deliberate part of the cycle rather than dead time.
function Typewriter({
  text,
  typeSpeed = 45,
  eraseSpeed = 25,
  holdFull = 900,
  holdEmpty = 350,
}) {
  const [reduced] = useState(prefersReducedMotion)
  const [count, setCount] = useState(() => (prefersReducedMotion() ? text.length : 0))
  const [erasing, setErasing] = useState(false)

  useEffect(() => {
    if (reduced) return

    const atEnd = !erasing && count === text.length
    const atStart = erasing && count === 0
    const delay = atEnd ? holdFull : atStart ? holdEmpty : erasing ? eraseSpeed : typeSpeed

    const id = setTimeout(() => {
      if (atEnd) setErasing(true)
      else if (atStart) setErasing(false)
      else setCount(c => c + (erasing ? -1 : 1))
    }, delay)

    return () => clearTimeout(id)
  }, [count, erasing, text, reduced, typeSpeed, eraseSpeed, holdFull, holdEmpty])

  return (
    <span aria-hidden="true">
      {text.slice(0, count)}
      {!reduced && <span className="caret" />}
    </span>
  )
}

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ISO 8601 strings sort correctly as plain strings. Undated postings sink to
// the bottom rather than pretending to be old or new.
const byNewest = (a, b) => {
  const left = a.first_published || ''
  const right = b.first_published || ''
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1
  return right.localeCompare(left)
}

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

  const fetchCompanies = async () => {
    const res = await fetch(`${API}/companies`)
    if (!res.ok) throw new Error(`GET /companies returned ${res.status}`)
    return res.json()
  }

  useEffect(() => {
    let cancelled = false
    fetchCompanies()
      .then(data => { if (!cancelled) setCompanies(data) })
      .catch(err => console.error('Could not load companies:', err))
    return () => { cancelled = true } // ignore the response if we unmount first
  }, [])

  // Default view: the newest internships, no search required.
  useEffect(() => {
    let cancelled = false
    fetch(`${API}/postings`)
      .then(res => {
        if (!res.ok) throw new Error(`GET /postings returned ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        const newest = data
          .filter(job => INTERNSHIP_RE.test(job.title))
          .sort(byNewest)
          .slice(0, DEFAULT_LIMIT)
        setRecent(newest)
      })
      .catch(err => console.error('Could not load recent postings:', err))
      .finally(() => { if (!cancelled) setRecentLoading(false) })
    return () => { cancelled = true }
  }, [])

  // postings carry company_id, not a name; resolve it against the catalog.
  // Keys are stringified because the two endpoints disagree on int vs string.
  const companyNames = useMemo(
    () => new Map(companies.map(c => [String(c.id), c.company_name])),
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
      const res = await fetch(`${API}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      })
      if (!res.ok) throw new Error(`POST /targets returned ${res.status}`)
      setResults(await res.json())
      setSearched(true)
    } catch (err) {
      console.error('Could not score postings:', err)
      setResults([])
      setSearchError('Could not reach the server. Is app.py running?')
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
      const res = await fetch(`${API}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: name }),
      })
      const data = await res.json()

      if (res.ok) {
        const refreshed = await fetchCompanies()
        setCompanies(refreshed)
        setCompanyResult({
          kind: 'added',
          text: data.message,
          company: refreshed.find(c => c.company_name.toLowerCase() === name.toLowerCase()),
        })
        setCompanyQuery('')
      } else {
        setCompanyResult({ kind: 'error', text: data.error })
      }
    } catch (err) {
      console.error('Could not add company:', err)
      setCompanyResult({ kind: 'error', text: 'Could not reach the server. Is app.py running?' })
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
                  companyName={companyNames.get(String(job.company_id))}
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
