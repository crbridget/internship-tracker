import { LocationIcon, SearchIcon } from '../components/icons'
import { JobCard } from '../components/JobCard'
import { LoadingMessage } from '../components/LoadingMessage'
import { SearchBar, SearchDivider, SearchField } from '../components/SearchBar'
import type { InternshipSearch } from '../hooks/useInternshipSearch'

interface FindRolesProps {
  search: InternshipSearch
  companyNames: Map<number, string>
}

export function FindRoles({ search, companyNames }: FindRolesProps) {
  const {
    roleInput,
    setRoleInput,
    locationInput,
    setLocationInput,
    visible,
    shown,
    searched,
    loading,
    busy,
    error,
    submit,
  } = search

  const filteringByLocation = locationInput.trim().length > 0

  return (
    <>
      <SearchBar onSubmit={submit} loading={loading}>
        <SearchField
          icon={<SearchIcon />}
          placeholder="Search roles — e.g. data analyst intern"
          value={roleInput}
          onChange={setRoleInput}
          onEnter={submit}
        />
        <SearchDivider />
        <SearchField
          icon={<LocationIcon />}
          placeholder="Location"
          value={locationInput}
          onChange={setLocationInput}
          onEnter={submit}
        />
      </SearchBar>

      <p className="search-hint">
        Separate multiple roles with commas. Location filters the results as you type.
      </p>

      {error && <div className="message error">{error}</div>}

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
          message={loading ? 'Searching for your next paycheck...' : 'Loading internships...'}
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
  )
}
