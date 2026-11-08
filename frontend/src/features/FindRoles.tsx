import { LocationIcon, SearchIcon } from '../components/icons'
import { JobCard } from '../components/JobCard'
import { LoadingMessage } from '../components/LoadingMessage'
import { RoleKindToggle } from '../components/RoleKindToggle'
import { SearchBar, SearchDivider, SearchField } from '../components/SearchBar'
import { TrackButton } from '../components/TrackButton'
import type { ApplicationsState } from '../hooks/useApplications'
import type { InternshipSearch } from '../hooks/useInternshipSearch'

interface FindRolesProps {
  search: InternshipSearch
  companyNames: Map<number, string>
  applications: ApplicationsState
}

export function FindRoles({ search, companyNames, applications }: FindRolesProps) {
  const {
    kind,
    setKind,
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
          placeholder={
            kind === 'internship'
              ? 'Search roles — e.g. data analyst intern'
              : 'Search roles — e.g. software engineer'
          }
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

      <div className="filter-row">
        <RoleKindToggle value={kind} onChange={setKind} disabled={busy} />
        <p className="search-hint">
          Separate multiple roles with commas. Location filters as you type.
        </p>
      </div>

      {error && <div className="message error">{error}</div>}
      {applications.error && <div className="message error">{applications.error}</div>}

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
              score={searched ? job.relevance_score ?? null : null}
              actions={
                <TrackButton
                  signedIn={applications.signedIn}
                  status={applications.byPostingId.get(job.id)?.status ?? null}
                  onChange={status => applications.setStatus(job, status)}
                />
              }
            />
          ))}
        </div>
      )}

      {busy && (
        <LoadingMessage
          message={
            loading
              ? 'Searching for your next paycheck...'
              : `Loading ${kind === 'internship' ? 'internships' : 'full-time roles'}...`
          }
        />
      )}

      {!busy && visible.length === 0 && (
        <div className="empty">
          {searched
            ? `No roles matched "${roleInput.trim()}"${
                filteringByLocation ? ` in "${locationInput.trim()}"` : ''
              }.`
            : `No ${kind === 'internship' ? 'internships' : 'full-time roles'} found yet. Add companies to start tracking.`}
        </div>
      )}
    </>
  )
}
